import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { slugify as transliterateSlugify } from 'transliteration'
import { transformInputData } from './fixtures'
import {
  ITEM_CATEGORY_BY_CODE,
  I18N_CODE,
  MOVE_CATEGORY_BY_CODE,
  MOVE_CLASSIFICATION_BY_CODE,
  MOVE_TARGET_BY_CODE,
  POKEMON_TYPE_BY_CODE,
  langMap,
} from './mappings'
import type { I18nCode } from './mappings'
import {
  abilitySchema,
  battleStateSchema,
  i18nSchema,
  itemI18nSchema,
  itemSchema,
  moveSchema,
} from './schemas'
import type {
  AbilityRecord,
  BattleStateRecord,
  I18nRecord,
  ItemI18nRecord,
  ItemRecord,
  MoveRecord,
} from './schemas'
import {
  battleStates,
  type BattleState,
  type ItemCategory,
  type MoveClass,
  type MoveTarget,
} from '../../lib-next/enums'
import { DEFAULT_GAME_LOCALE, type GameLocale } from '../../lib-next/languages'

export const DEFAULT_LANGUAGE: I18nCode = 'usa'
export const DEFAULT_DATASET_ROOT = join(process.cwd(), 'src/upstreams/projectpokemon-champout')
export const DEFAULT_OUTPUT_ROOT = join(process.cwd(), 'data-next/champions')
export const I18N_FILE_NAMES = [
  'moves.json',
  'abilities.json',
  'items.json',
  'battle-states.json',
] as const

const missingLocales: GameLocale[] = ['PT-BR']

export type TextEntry = {
  Index: number
  LabelName: string
  OriginalText: string
}

export type DomainI18nData = {
  moves: I18nRecord[]
  abilities: I18nRecord[]
  items: ItemI18nRecord[]
  battleStates: I18nRecord[]
}

export type OrphanTextLabel = {
  index: number
  labelName: string
  text: string
}

export type BuildWarning = {
  kind: 'orphan-text-labels'
  domain: 'moves'
  lang: I18nCode
  sourceFile: string
  referenceFile: string
  labels: OrphanTextLabel[]
}

export type BuildDataOptions = {
  onWarning?: (warning: BuildWarning) => void
}

export type BuiltData = {
  moves: MoveRecord[]
  abilities: AbilityRecord[]
  items: ItemRecord[]
  battleStates: BattleStateRecord[]
  i18n: Record<I18nCode, DomainI18nData>
  warnings: BuildWarning[]
}

type SourceRecord = Record<string, unknown>

type MoveMasterRecord = {
  id: string
  type: string
  category: string
  target: string
  power: string
  accuracy: string
  pp: string
  direct: string
  priority: string
  classificationA: string
  classificationB: string
  available: string
  msLbl: string
  msNameInfo: string
  msLblInfo: string
}

type ItemMasterRecord = {
  id: string
  categoryA: string
  categoryB: string
  categoryC: string
  msLbl: string
  msLblInfo: string
}

type BattleStateText = {
  id: string
  stateCode: number
  name: string
  description: string
}

type SlugLocRecord = {
  id: string
  slugLoc: string
}

const BATTLE_STATE_SET: ReadonlySet<string> = new Set(battleStates)
const LOCALIZED_SLUG_OPTIONS = {
  lowercase: true,
  separator: '-',
  allowedChars: 'a-zA-Z0-9-',
  trim: true,
  unknown: '',
  replace: {
    '&': ' and ',
  },
} as const

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (slug.length === 0) {
    throw new Error(`Unable to create slug from "${value}"`)
  }

  return slug
}

export function slugifyLocalized(value: string, fallbackSlug: string): string {
  const slug = transliterateSlugify(value, LOCALIZED_SLUG_OPTIONS)

  return slug.length === 0 ? fallbackSlug : slug
}

export function uniquifySlugLoc<T extends SlugLocRecord>(records: readonly T[]): T[] {
  const counts = new Map<string, number>()

  for (const record of records) {
    counts.set(record.slugLoc, (counts.get(record.slugLoc) ?? 0) + 1)
  }

  const used = new Set<string>()

  return records.map((record) => {
    const baseSlugLoc = record.slugLoc
    const hasBaseCollision = (counts.get(baseSlugLoc) ?? 0) > 1
    const firstSlugLoc = hasBaseCollision ? `${baseSlugLoc}-${record.id}` : baseSlugLoc
    let slugLoc = firstSlugLoc
    let attempt = 2

    while (used.has(slugLoc)) {
      slugLoc = `${firstSlugLoc}-${attempt}`
      attempt += 1
    }

    used.add(slugLoc)

    if (slugLoc === record.slugLoc) {
      return record
    }

    return {
      ...record,
      slugLoc,
    }
  })
}

export function toEnumName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

export function sanitizeString(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u202f]/g, '')
}

export function toNumber(value: string, field: string, context: string): number {
  const numberValue = Number(value)

  if (!Number.isInteger(numberValue)) {
    throw new Error(`Invalid numeric ${field} "${value}" in ${context}`)
  }

  return numberValue
}

export function createLabelMap(
  entries: readonly TextEntry[],
  source = 'text dataset',
): Map<string, TextEntry> {
  const labels = new Map<string, TextEntry>()

  for (const entry of entries) {
    if (labels.has(entry.LabelName)) {
      throw new Error(`Duplicate label ${entry.LabelName} in ${source}`)
    }

    labels.set(entry.LabelName, entry)
  }

  return labels
}

export function createTextMap(
  entries: readonly TextEntry[],
  source = 'text dataset',
): Map<string, string> {
  return new Map(
    [...createLabelMap(entries, source).entries()].map(([label, entry]) => [
      label,
      entry.OriginalText,
    ]),
  )
}

export function mapMoveTargetCode(code: number): MoveTarget {
  return lookupCode(MOVE_TARGET_BY_CODE, code, 'move target')
}

export function mapMoveClassificationCodes(codes: readonly number[]): MoveClass[] {
  return codes
    .filter((code) => code !== 0)
    .map((code) => lookupCode(MOVE_CLASSIFICATION_BY_CODE, code, 'move classification'))
}

export function mapItemCategoryCodes(codes: readonly number[]): ItemCategory[] {
  return codes
    .filter((code) => code !== 0)
    .map((code) => lookupCode(ITEM_CATEGORY_BY_CODE, code, 'item category'))
}

export function formatBuildWarning(warning: BuildWarning): string {
  const labels = warning.labels.map((label) => `${label.labelName} "${label.text}"`).join(', ')

  return [
    `Warning: ${warning.domain}/${warning.lang}`,
    `${warning.sourceFile} has ${warning.labels.length} labels with no ${warning.referenceFile} row`,
    labels,
  ].join(': ')
}

export function readTextDataset(
  datasetRoot: string,
  lang: I18nCode,
  fileName: string,
): TextEntry[] {
  return readTextDatasetFile(join(datasetRoot, 'rom-txt', lang, `${fileName}.json`))
}

export function readTextDatasetFile(filePath: string): TextEntry[] {
  const json = readJsonFile(filePath)

  if (!isRecord(json) || !Array.isArray(json.mSDataSet)) {
    throw new Error(`Expected ${filePath} to contain an mSDataSet array`)
  }

  return json.mSDataSet.map((entry, index) => {
    const context = `${filePath} mSDataSet[${index}]`
    const record = requireRecord(entry, context)
    const entryIndex = record.Index

    if (typeof entryIndex !== 'number' || !Number.isInteger(entryIndex)) {
      throw new Error(`Invalid Index in ${context}`)
    }

    return {
      Index: entryIndex,
      LabelName: stringField(record, 'LabelName', context),
      OriginalText: sanitizeString(stringField(record, 'OriginalText', context)),
    }
  })
}

export function parseBattleStateTexts(
  entries: readonly TextEntry[],
  source = 'battle state dataset',
): BattleStateText[] {
  const groups = new Map<number, Partial<BattleStateText>>()

  for (const entry of entries) {
    const match = /^BTR_STATE_SYN_(\d+)_(02|03)$/.exec(entry.LabelName)

    if (match === null) {
      continue
    }

    const stateCode = toNumber(match[1], 'state code', entry.LabelName)
    const group = groups.get(stateCode) ?? {
      id: String(stateCode),
      stateCode,
    }

    if (match[2] === '02') {
      group.description = entry.OriginalText
    } else {
      group.name = entry.OriginalText
    }

    groups.set(stateCode, group)
  }

  return [...groups.values()]
    .sort((a, b) => requiredNumber(a.stateCode, source) - requiredNumber(b.stateCode, source))
    .map((group) => {
      if (
        group.id === undefined ||
        group.stateCode === undefined ||
        group.name === undefined ||
        group.description === undefined
      ) {
        throw new Error(`Incomplete battle state pair in ${source}`)
      }

      return {
        id: group.id,
        stateCode: group.stateCode,
        name: group.name,
        description: group.description,
      }
    })
}

export function buildData(
  datasetRoot = DEFAULT_DATASET_ROOT,
  options: BuildDataOptions = {},
): BuiltData {
  const warnings = collectBuildWarnings(datasetRoot)

  for (const warning of warnings) {
    options.onWarning?.(warning)
  }

  const moves = buildMoves(datasetRoot, DEFAULT_LANGUAGE)
  const abilities = buildAbilities(datasetRoot, DEFAULT_LANGUAGE)
  const items = buildItems(datasetRoot, DEFAULT_LANGUAGE)
  const battleStates = buildBattleStates(datasetRoot, DEFAULT_LANGUAGE)
  const slugs = {
    moves: createSlugMap(moves),
    abilities: createSlugMap(abilities),
    items: createSlugMap(items),
    battleStates: createSlugMap(battleStates),
  }
  const i18n = {} as Record<I18nCode, DomainI18nData>

  for (const lang of I18N_CODE) {
    i18n[lang] = {
      moves: buildMoveI18n(datasetRoot, lang, slugs.moves),
      abilities: buildAbilityI18n(datasetRoot, lang, slugs.abilities),
      items: buildItemI18n(datasetRoot, lang, slugs.items),
      battleStates: buildBattleStateI18n(datasetRoot, lang, slugs.battleStates),
    }
  }

  return {
    moves,
    abilities,
    items,
    battleStates,
    i18n,
    warnings,
  }
}

export function buildMoves(
  datasetRoot = DEFAULT_DATASET_ROOT,
  lang: I18nCode = DEFAULT_LANGUAGE,
): MoveRecord[] {
  const names = readTextMap(datasetRoot, lang, 'wazaname')
  const descriptions = readTextMap(datasetRoot, lang, 'wazainfo_syn')

  return readMoveMasterRecords(datasetRoot)
    .filter((record) => names.has(record.msLbl))
    .sort(compareNumericIds)
    .map((record) => {
      const context = `move ${record.id}`
      const typeCode = toNumber(record.type, 'type', context)
      const categoryCode = toNumber(record.category, 'category', context)
      const targetCode = toNumber(record.target, 'target', context)
      const classificationCodes = [
        toNumber(record.classificationA, 'classification_a', context),
        toNumber(record.classificationB, 'classification_b', context),
      ].filter((code) => code !== 0)
      const name = requireText(names, record.msLbl, `${lang} move names`)
      const description = optionalInfoText(descriptions, record.msNameInfo, record.msLblInfo)

      return moveSchema.parse({
        id: record.id,
        slug: slugify(name),
        name,
        description,
        typeCode,
        type: lookupCode(POKEMON_TYPE_BY_CODE, typeCode, 'pokemon type'),
        categoryCode,
        category: lookupCode(MOVE_CATEGORY_BY_CODE, categoryCode, 'move category'),
        power: toNumber(record.power, 'power', context),
        pp: toNumber(record.pp, 'pp', context),
        accuracy: toNumber(record.accuracy, 'accuracy', context),
        priority: toNumber(record.priority, 'priority', context),
        targetCode,
        target: mapMoveTargetCode(targetCode),
        classificationCodes,
        classification: mapMoveClassificationCodes(classificationCodes),
        isDirect: toBoolean(record.direct, 'direct', context),
        isUsable: toBoolean(record.available, 'available', context),
      })
    })
}

export function buildMoveI18n(
  datasetRoot: string,
  lang: I18nCode,
  slugById: ReadonlyMap<string, string>,
): I18nRecord[] {
  const names = readTextMap(datasetRoot, lang, 'wazaname')
  const descriptions = readTextMap(datasetRoot, lang, 'wazainfo_syn')

  return uniquifySlugLoc(
    readMoveMasterRecords(datasetRoot)
      .filter((record) => slugById.has(record.id))
      .sort(compareNumericIds)
      .map((record) => {
        const slug = requireSlug(slugById, record.id)
        const name = requireText(names, record.msLbl, `${lang} move names`)

        return i18nSchema.parse({
          id: record.id,
          slug,
          slugLoc: slugifyLocalized(name, slug),
          name,
          description: optionalInfoText(descriptions, record.msNameInfo, record.msLblInfo),
        })
      }),
  )
}

export function buildAbilities(
  datasetRoot = DEFAULT_DATASET_ROOT,
  lang: I18nCode = DEFAULT_LANGUAGE,
): AbilityRecord[] {
  const names = readTextMap(datasetRoot, lang, 'tokusei')
  const descriptions = readTextMap(datasetRoot, lang, 'tokuseiinfo_syn')

  return abilityIds(names).map((id) => {
    const paddedId = pad3(id)
    const name = requireText(names, `TOKUSEI_${paddedId}`, `${lang} ability names`)

    return abilitySchema.parse({
      id: String(id),
      slug: slugify(name),
      name,
      description: requireText(
        descriptions,
        `TOKUSEIINFO_SYN_${paddedId}`,
        `${lang} ability descriptions`,
      ),
    })
  })
}

export function buildAbilityI18n(
  datasetRoot: string,
  lang: I18nCode,
  slugById: ReadonlyMap<string, string>,
): I18nRecord[] {
  const names = readTextMap(datasetRoot, lang, 'tokusei')
  const descriptions = readTextMap(datasetRoot, lang, 'tokuseiinfo_syn')

  return uniquifySlugLoc(
    [...slugById.keys()].sort(compareNumericStrings).map((id) => {
      const slug = requireSlug(slugById, id)
      const paddedId = pad3(toNumber(id, 'ability id', `${lang} ability i18n`))
      const name = requireText(names, `TOKUSEI_${paddedId}`, `${lang} ability names`)

      return i18nSchema.parse({
        id,
        slug,
        slugLoc: slugifyLocalized(name, slug),
        name,
        description: requireText(
          descriptions,
          `TOKUSEIINFO_SYN_${paddedId}`,
          `${lang} ability descriptions`,
        ),
      })
    }),
  )
}

export function buildItems(
  datasetRoot = DEFAULT_DATASET_ROOT,
  lang: I18nCode = DEFAULT_LANGUAGE,
): ItemRecord[] {
  const names = readTextMap(datasetRoot, lang, 'itemname')
  const pluralNames = readTextMap(datasetRoot, lang, 'itemname_plural')
  const descriptions = readTextMap(datasetRoot, lang, 'iteminfo_syn')

  return readItemMasterRecords(datasetRoot)
    .sort(compareNumericIds)
    .map((record) => {
      const context = `item ${record.id}`
      const categoryCodes = [
        toNumber(record.categoryA, 'category_a', context),
        toNumber(record.categoryB, 'category_b', context),
        toNumber(record.categoryC, 'category_c', context),
      ].filter((code) => code !== 0)
      const name = requireText(names, record.msLbl, `${lang} item names`)

      return itemSchema.parse({
        id: record.id,
        slug: slugify(name),
        name,
        pluralName: requireText(pluralNames, record.msLbl, `${lang} item plural names`),
        description: requireText(descriptions, record.msLblInfo, `${lang} item descriptions`),
        categoryCodes,
        categories: mapItemCategoryCodes(categoryCodes),
      })
    })
}

export function buildItemI18n(
  datasetRoot: string,
  lang: I18nCode,
  slugById: ReadonlyMap<string, string>,
): ItemI18nRecord[] {
  const names = readTextMap(datasetRoot, lang, 'itemname')
  const pluralNames = readTextMap(datasetRoot, lang, 'itemname_plural')
  const descriptions = readTextMap(datasetRoot, lang, 'iteminfo_syn')

  return uniquifySlugLoc(
    readItemMasterRecords(datasetRoot)
      .filter((record) => slugById.has(record.id))
      .sort(compareNumericIds)
      .map((record) => {
        const slug = requireSlug(slugById, record.id)
        const name = requireText(names, record.msLbl, `${lang} item names`)

        return itemI18nSchema.parse({
          id: record.id,
          slug,
          slugLoc: slugifyLocalized(name, slug),
          name,
          pluralName: requireText(pluralNames, record.msLbl, `${lang} item plural names`),
          description: requireText(descriptions, record.msLblInfo, `${lang} item descriptions`),
        })
      }),
  )
}

export function buildBattleStates(
  datasetRoot = DEFAULT_DATASET_ROOT,
  lang: I18nCode = DEFAULT_LANGUAGE,
): BattleStateRecord[] {
  return parseBattleStateTexts(
    readTextDataset(datasetRoot, lang, 'btl_state_syn'),
    `${lang} battle states`,
  ).map((record) => {
    const state = toEnumName(record.name)

    if (!isBattleStateName(state)) {
      throw new Error(`Unknown battle state enum ${state} for "${record.name}"`)
    }

    return battleStateSchema.parse({
      id: record.id,
      slug: slugify(record.name),
      name: record.name,
      description: record.description,
      stateCode: record.stateCode,
      state,
    })
  })
}

export function buildBattleStateI18n(
  datasetRoot: string,
  lang: I18nCode,
  slugById: ReadonlyMap<string, string>,
): I18nRecord[] {
  return uniquifySlugLoc(
    parseBattleStateTexts(
      readTextDataset(datasetRoot, lang, 'btl_state_syn'),
      `${lang} battle states`,
    )
      .filter((record) => slugById.has(record.id))
      .map((record) => {
        const slug = requireSlug(slugById, record.id)

        return i18nSchema.parse({
          id: record.id,
          slug,
          slugLoc: slugifyLocalized(record.name, slug),
          name: record.name,
          description: record.description,
        })
      }),
  )
}

export function writeBuiltData(data: BuiltData, outputRoot = DEFAULT_OUTPUT_ROOT): void {
  writeJsonFile(join(outputRoot, 'moves.json'), data.moves)
  writeJsonFile(join(outputRoot, 'abilities.json'), data.abilities)
  writeJsonFile(join(outputRoot, 'items.json'), data.items)
  writeJsonFile(join(outputRoot, 'battle-states.json'), data.battleStates)

  for (const lang of I18N_CODE) {
    const normalizedLang = langMap[lang].gameLocale.toLowerCase()
    const langRoot = join(outputRoot, 'i18n', normalizedLang)
    const langData = data.i18n[lang]

    writeJsonFile(join(langRoot, 'moves.json'), langData.moves)
    writeJsonFile(join(langRoot, 'abilities.json'), langData.abilities)
    writeJsonFile(join(langRoot, 'items.json'), langData.items)
    writeJsonFile(join(langRoot, 'battle-states.json'), langData.battleStates)
  }

  copyMissingLocales(outputRoot)
}

export function collectBuildWarnings(datasetRoot = DEFAULT_DATASET_ROOT): BuildWarning[] {
  const moveMasterLabels = new Set(readMoveMasterRecords(datasetRoot).map((record) => record.msLbl))

  return I18N_CODE.flatMap((lang) => {
    const labels = readTextDataset(datasetRoot, lang, 'wazaname')
      .filter((entry) => /^WAZANAME_\d+$/.test(entry.LabelName))
      .filter((entry) => !moveMasterLabels.has(entry.LabelName))
      .map((entry) => ({
        index: entry.Index,
        labelName: entry.LabelName,
        text: entry.OriginalText,
      }))

    if (labels.length === 0) {
      return []
    }

    return [
      {
        kind: 'orphan-text-labels',
        domain: 'moves',
        lang,
        sourceFile: `rom-txt/${lang}/wazaname.json`,
        referenceFile: 'masterdata/waza.json',
        labels,
      },
    ]
  })
}

function readTextMap(datasetRoot: string, lang: I18nCode, fileName: string): Map<string, string> {
  return createTextMap(readTextDataset(datasetRoot, lang, fileName), `${lang}/${fileName}`)
}

function readMoveMasterRecords(datasetRoot: string): MoveMasterRecord[] {
  return readJsonRecordArray(join(datasetRoot, 'masterdata/waza.json'), 'masterdata/waza.json').map(
    (record, index) => {
      const context = `masterdata/waza.json[${index}]`

      return {
        id: stringField(record, 'id', context),
        type: stringField(record, 'type', context),
        category: stringField(record, 'category', context),
        target: stringField(record, 'target', context),
        power: stringField(record, 'power', context),
        accuracy: stringField(record, 'accuracy', context),
        pp: stringField(record, 'pp', context),
        direct: stringField(record, 'direct', context),
        priority: stringField(record, 'priority', context),
        classificationA: stringField(record, 'classification_a', context),
        classificationB: stringField(record, 'classification_b', context),
        available: stringField(record, 'available', context),
        msLbl: stringField(record, 'ms_lbl', context),
        msNameInfo: stringField(record, 'ms_name_info', context),
        msLblInfo: stringField(record, 'ms_lbl_info', context),
      }
    },
  )
}

function readItemMasterRecords(datasetRoot: string): ItemMasterRecord[] {
  return readJsonRecordArray(join(datasetRoot, 'masterdata/item.json')).map((record, index) => {
    const context = `masterdata/item.json[${index}]`

    return {
      id: stringField(record, 'id', context),
      categoryA: stringField(record, 'category_a', context),
      categoryB: stringField(record, 'category_b', context),
      categoryC: stringField(record, 'category_c', context),
      msLbl: stringField(record, 'ms_lbl', context),
      msLblInfo: stringField(record, 'ms_lbl_info', context),
    }
  })
}

function abilityIds(names: ReadonlyMap<string, string>): number[] {
  return [...names.keys()]
    .map((label) => {
      const match = /^TOKUSEI_(\d+)$/.exec(label)

      if (match === null) {
        throw new Error(`Unexpected ability label ${label}`)
      }

      return toNumber(match[1], 'ability id', label)
    })
    .sort((a, b) => a - b)
}

function createSlugMap(records: readonly { id: string; slug: string }[]): Map<string, string> {
  return new Map(records.map((record) => [record.id, record.slug]))
}

function optionalInfoText(
  descriptions: ReadonlyMap<string, string>,
  msNameInfo: string,
  msLblInfo: string,
): string {
  if (msNameInfo !== 'wazainfo_syn' || msLblInfo === 'WAZAINFO_SYN_null') {
    return ''
  }

  return descriptions.get(msLblInfo) ?? ''
}

function requireText(
  textByLabel: ReadonlyMap<string, string>,
  label: string,
  source: string,
): string {
  const text = textByLabel.get(label)

  if (text === undefined) {
    throw new Error(`Missing label ${label} in ${source}`)
  }

  return text
}

function requireSlug(slugById: ReadonlyMap<string, string>, id: string): string {
  const slug = slugById.get(id)

  if (slug === undefined) {
    throw new Error(`Missing canonical slug for id ${id}`)
  }

  return slug
}

function lookupCode<T extends string>(
  map: Readonly<Partial<Record<number, T>>>,
  code: number,
  source: string,
): T {
  const value = map[code]

  if (value === undefined) {
    throw new Error(`Unknown ${source} code ${code}`)
  }

  return value
}

function isBattleStateName(value: string): value is BattleState {
  return BATTLE_STATE_SET.has(value)
}

function toBoolean(value: string, field: string, context: string): boolean {
  if (value === '0') {
    return false
  }

  if (value === '1') {
    return true
  }

  throw new Error(`Invalid boolean ${field} "${value}" in ${context}`)
}

function pad3(value: number): string {
  return String(value).padStart(3, '0')
}

function compareNumericIds(left: { id: string }, right: { id: string }): number {
  return compareNumericStrings(left.id, right.id)
}

function compareNumericStrings(left: string, right: string): number {
  return Number(left) - Number(right)
}

function requiredNumber(value: number | undefined, source: string): number {
  if (value === undefined) {
    throw new Error(`Missing numeric value in ${source}`)
  }

  return value
}

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function copyMissingLocales(outputRoot: string): void {
  const sourceRoot = join(outputRoot, 'i18n', DEFAULT_GAME_LOCALE.toLowerCase())

  for (const locale of missingLocales) {
    const targetRoot = join(outputRoot, 'i18n', locale.toLowerCase())

    mkdirSync(targetRoot, { recursive: true })

    for (const fileName of I18N_FILE_NAMES) {
      copyFileSync(join(sourceRoot, fileName), join(targetRoot, fileName))
    }
  }
}

function readJsonRecordArray(filePath: string, inputPath?: string): SourceRecord[] {
  const json =
    inputPath === undefined
      ? readJsonFile(filePath)
      : transformInputData({
          path: inputPath,
          data: readJsonFile(filePath),
        })

  if (!Array.isArray(json)) {
    throw new Error(`Expected ${filePath} to contain an array`)
  }

  return json.map((entry, index) => requireRecord(entry, `${filePath}[${index}]`))
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown
}

function requireRecord(value: unknown, context: string): SourceRecord {
  if (!isRecord(value)) {
    throw new Error(`Expected object in ${context}`)
  }

  return value
}

function isRecord(value: unknown): value is SourceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(record: SourceRecord, field: string, context: string): string {
  const value = record[field]

  if (typeof value !== 'string') {
    throw new Error(`Expected string field ${field} in ${context}`)
  }

  return value
}

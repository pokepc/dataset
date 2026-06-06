import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { slugify as transliterateSlugify } from 'transliteration'
import { expandLocalSlugAliases } from './fixtures/aliases'
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
  pokemonI18nSchema,
  pokemonMovesRecordSchema,
  pokemonSchema,
} from '../../lib-next/schemas'
import type {
  AbilityRecord,
  BattleStateRecord,
  I18nRecord,
  ItemI18nRecord,
  ItemRecord,
  MoveRecord,
  PokemonI18nRecord,
  PokemonMovesRecord,
  PokemonRecord,
} from '../../lib-next/schemas'
import {
  battleStates,
  type BattleState,
  type ItemCategory,
  type MoveClass,
  type MoveTarget,
  type PokemonType,
} from '../../lib-next/enums'
import { DEFAULT_GAME_LOCALE, type GameLocale } from '../../lib-next/languages'

export const DEFAULT_LANGUAGE: I18nCode = 'usa'
export const DEFAULT_DATASET_ROOT = join(process.cwd(), 'src/upstreams/projectpokemon-champout')
export const DEFAULT_LOCAL_DATA_ROOT = join(process.cwd(), 'data')
export const DEFAULT_OUTPUT_ROOT = join(process.cwd(), 'data-next/champions')
export const I18N_FILE_NAMES = [
  'moves.json',
  'abilities.json',
  'items.json',
  'battle-states.json',
  'pokemon.json',
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
  pokemon: PokemonI18nRecord[]
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
  pokemon: PokemonRecord[]
  pokemonMoves: PokemonMovesRecord[]
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

type PokemonPersonalRecord = {
  id: string
  no: string
  fo: string
  ffge: string
  msNameLbl: string
  msFormLbl: string
  type1: string
  type2: string
  hp: string
  atk: string
  def: string
  spatk: string
  spdef: string
  agi: string
}

type PokemonMoveLearnRecord = {
  id: string
  waza: string
}

type LocalPokemonRecord = {
  id: string
  nid: string
  dexNum: number
  pokeApiId: number | undefined
  pokeApiFormId: number | undefined
  showdownId: string
  type1: string
  type2: string | null
  abilities: string[]
  baseHp: number
  baseAtk: number
  baseDef: number
  baseSpAtk: number
  baseSpDef: number
  baseSpeed: number
  height: number
  weight: number
  isDefault: boolean
  isForm: boolean
  isCosmeticForm: boolean
  isBattleOnlyForm: boolean
  isFemaleForm: boolean
  isGmax: boolean
  baseSpecies: string | undefined
  names: Record<string, string | undefined>
  formNames: Record<string, string | undefined>
}

type LocalNamedRecord = {
  id: string
  name: string
  psName: string | undefined
}

type LocalChampionsMapRecord = {
  id: string
  championsId: string
  slug: string
}

type LocalChampionsMap = LocalChampionsMapRecord[]

type BattleStateText = {
  id: string
  stateCode: number
  name: string
  description: string
}

type PokemonMapIndexRecord = {
  id: string
  nid: string
  pokeApiId: number
  pokeApiFormId: number | undefined
  showdownId: string
  baseSpecies: string | undefined
  type1: string
  type2: string | null
  abilities: string[]
  baseHp: number
  baseAtk: number
  baseDef: number
  baseSpAtk: number
  baseSpDef: number
  baseSpeed: number
  height: number
  weight: number
  isForm: boolean
  isBattleOnly: boolean
  isCosmetic: boolean
  isFemale: boolean
  championsId: string
  nameLabel: string
  formLabel: string
}

type SlugLocRecord = {
  id: string
  slugLoc: string
}

const BATTLE_STATE_SET: ReadonlySet<string> = new Set(battleStates)
const IGNORED_POKEMON_PERSONAL_IDS = new Set(['0678003'])
const POKEMON_MAP_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  '0121001': ['starmie-mega'],
  '0678000': ['meowstic'],
  '0678001': ['meowstic-f'],
  '0678002': ['meowstic-mega'],
  '0711000': ['gourgeist'],
  '0711001': ['gourgeist-small'],
  '0711002': ['gourgeist-large'],
  '0711003': ['gourgeist-super'],
  '0902000': ['basculegion'],
  '0902001': ['basculegion-f'],
  '0925000': ['maushold-three'],
  '0925001': ['maushold'],
} as const satisfies Readonly<Record<string, readonly string[]>>
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
  const inputPath = `rom-txt/${lang}/${fileName}.json`

  return readTextDatasetFile(join(datasetRoot, inputPath), inputPath)
}

export function readTextDatasetFile(filePath: string, inputPath?: string): TextEntry[] {
  const json =
    inputPath === undefined
      ? readJsonFile(filePath)
      : transformInputData({
          path: inputPath,
          data: readJsonFile(filePath),
        })

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

  const championsMoves = buildMoves(datasetRoot, DEFAULT_LANGUAGE)
  const championsAbilities = buildAbilities(datasetRoot, DEFAULT_LANGUAGE)
  const championsItems = buildItems(datasetRoot, DEFAULT_LANGUAGE)
  const battleStates = buildBattleStates(datasetRoot, DEFAULT_LANGUAGE)
  const pokemonMapIndex = buildPokemonMapIndex(datasetRoot, DEFAULT_LOCAL_DATA_ROOT)
  const pokemon = localizePokemon(datasetRoot, DEFAULT_LANGUAGE, pokemonMapIndex)
  const movesMap = buildLocalChampionsMap(
    readLocalNamedRecords(DEFAULT_LOCAL_DATA_ROOT, 'moves'),
    championsMoves,
  )
  const abilitiesMap = buildLocalChampionsMap(
    readLocalNamedRecords(DEFAULT_LOCAL_DATA_ROOT, 'abilities'),
    championsAbilities,
  )
  const itemsMap = buildLocalChampionsMap(
    readLocalNamedRecords(DEFAULT_LOCAL_DATA_ROOT, 'items'),
    championsItems,
  )
  const moves = mergeLocalChampionsRecords(championsMoves, movesMap, moveSchema)
  const abilities = mergeLocalChampionsRecords(championsAbilities, abilitiesMap, abilitySchema)
  const items = mergeLocalChampionsRecords(championsItems, itemsMap, itemSchema)
  const pokemonMoves = buildPokemonMoves(datasetRoot, DEFAULT_LOCAL_DATA_ROOT, pokemon, moves)
  const battleStateSlugs = createSlugMap(battleStates)
  const i18n = {} as Record<I18nCode, DomainI18nData>

  for (const lang of I18N_CODE) {
    i18n[lang] = {
      moves: buildMoveI18n(datasetRoot, lang, movesMap),
      abilities: buildAbilityI18n(datasetRoot, lang, abilitiesMap),
      items: buildItemI18n(datasetRoot, lang, itemsMap),
      battleStates: buildBattleStateI18n(datasetRoot, lang, battleStateSlugs),
      pokemon: localizePokemonI18n(datasetRoot, lang, pokemonMapIndex),
    }
  }

  return {
    moves,
    abilities,
    items,
    battleStates,
    pokemon,
    pokemonMoves,
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
        championsId: record.id,
        slug: slugify(name),
        name,
        description,
        type: lookupCode(POKEMON_TYPE_BY_CODE, typeCode, 'pokemon type'),
        category: lookupCode(MOVE_CATEGORY_BY_CODE, categoryCode, 'move category'),
        power: toNumber(record.power, 'power', context),
        pp: toNumber(record.pp, 'pp', context),
        accuracy: toNumber(record.accuracy, 'accuracy', context),
        priority: toNumber(record.priority, 'priority', context),
        target: mapMoveTargetCode(targetCode),
        classification: mapMoveClassificationCodes(classificationCodes),
        contact: toBoolean(record.direct, 'direct', context),
        usable: toBoolean(record.available, 'available', context),
      })
    })
}

export function buildMoveI18n(
  datasetRoot: string,
  lang: I18nCode,
  localMap: LocalChampionsMap,
): I18nRecord[] {
  const names = readTextMap(datasetRoot, lang, 'wazaname')
  const descriptions = readTextMap(datasetRoot, lang, 'wazainfo_syn')
  const localByChampionsId = createLocalRecordByChampionsId(localMap, 'move')

  return uniquifySlugLoc(
    readMoveMasterRecords(datasetRoot)
      .filter((record) => localByChampionsId.has(record.id))
      .sort(compareNumericIds)
      .map((record) => {
        const localRecord = requireLocalChampionsRecord(localByChampionsId, record.id, 'move')
        const name = requireText(names, record.msLbl, `${lang} move names`)

        return i18nSchema.parse({
          id: localRecord.id,
          slug: localRecord.slug,
          slugLoc: slugifyLocalized(name, localRecord.slug),
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
      championsId: String(id),
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
  localMap: LocalChampionsMap,
): I18nRecord[] {
  const names = readTextMap(datasetRoot, lang, 'tokusei')
  const descriptions = readTextMap(datasetRoot, lang, 'tokuseiinfo_syn')
  const localByChampionsId = createLocalRecordByChampionsId(localMap, 'ability')

  return uniquifySlugLoc(
    [...localByChampionsId.keys()].sort(compareNumericStrings).map((id) => {
      const localRecord = requireLocalChampionsRecord(localByChampionsId, id, 'ability')
      const paddedId = pad3(toNumber(id, 'ability id', `${lang} ability i18n`))
      const name = requireText(names, `TOKUSEI_${paddedId}`, `${lang} ability names`)

      return i18nSchema.parse({
        id: localRecord.id,
        slug: localRecord.slug,
        slugLoc: slugifyLocalized(name, localRecord.slug),
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
        championsId: record.id,
        slug: slugify(name),
        name,
        pluralName: requireText(pluralNames, record.msLbl, `${lang} item plural names`),
        description: requireText(descriptions, record.msLblInfo, `${lang} item descriptions`),
        categories: mapItemCategoryCodes(categoryCodes),
      })
    })
}

export function buildItemI18n(
  datasetRoot: string,
  lang: I18nCode,
  localMap: LocalChampionsMap,
): ItemI18nRecord[] {
  const names = readTextMap(datasetRoot, lang, 'itemname')
  const pluralNames = readTextMap(datasetRoot, lang, 'itemname_plural')
  const descriptions = readTextMap(datasetRoot, lang, 'iteminfo_syn')
  const localByChampionsId = createLocalRecordByChampionsId(localMap, 'item')

  return uniquifySlugLoc(
    readItemMasterRecords(datasetRoot)
      .filter((record) => localByChampionsId.has(record.id))
      .sort(compareNumericIds)
      .map((record) => {
        const localRecord = requireLocalChampionsRecord(localByChampionsId, record.id, 'item')
        const name = requireText(names, record.msLbl, `${lang} item names`)

        return itemI18nSchema.parse({
          id: localRecord.id,
          slug: localRecord.slug,
          slugLoc: slugifyLocalized(name, localRecord.slug),
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

export function buildPokemonMap(
  datasetRoot = DEFAULT_DATASET_ROOT,
  lang: I18nCode = DEFAULT_LANGUAGE,
  localDataRoot = DEFAULT_LOCAL_DATA_ROOT,
): PokemonRecord[] {
  return localizePokemon(datasetRoot, lang, buildPokemonMapIndex(datasetRoot, localDataRoot))
}

function buildPokemonMapIndex(datasetRoot: string, localDataRoot: string): PokemonMapIndexRecord[] {
  const formNames = readTextMap(datasetRoot, DEFAULT_LANGUAGE, 'zkn_form_syn')
  const localPokemon = readLocalPokemonRecords(localDataRoot)
  const localById = new Map(localPokemon.map((pokemon) => [pokemon.id, pokemon]))
  const localByDex = groupLocalPokemonByDex(localPokemon)
  const usedLocalIds = new Set<string>()
  const rows: PokemonMapIndexRecord[] = []

  for (const personalRecord of readPokemonPersonalRecords(datasetRoot).sort(compareNumericIds)) {
    if (IGNORED_POKEMON_PERSONAL_IDS.has(personalRecord.id)) {
      continue
    }

    const localIds = resolvePokemonMapLocalIds(personalRecord, localByDex, localById, formNames)

    if (localIds.length === 0) {
      throw new Error(`Unable to map Champions Pokemon ${personalRecord.id}`)
    }

    for (const localId of localIds) {
      const localPokemon = localById.get(localId)

      if (localPokemon === undefined) {
        throw new Error(`Unknown local Pokemon id ${localId} for Champions ${personalRecord.id}`)
      }

      if (usedLocalIds.has(localId)) {
        throw new Error(`Duplicate local Pokemon id ${localId} in Champions Pokemon map`)
      }

      usedLocalIds.add(localId)
      rows.push({
        id: localId,
        nid: localPokemon.nid,
        pokeApiId: localPokemon.pokeApiId ?? localPokemon.dexNum,
        pokeApiFormId: localPokemon.pokeApiFormId,
        showdownId: localPokemon.showdownId,
        baseSpecies: localPokemon.baseSpecies,
        type1: localPokemon.type1,
        type2: localPokemon.type2,
        abilities: localPokemon.abilities,
        baseHp: localPokemon.baseHp,
        baseAtk: localPokemon.baseAtk,
        baseDef: localPokemon.baseDef,
        baseSpAtk: localPokemon.baseSpAtk,
        baseSpDef: localPokemon.baseSpDef,
        baseSpeed: localPokemon.baseSpeed,
        height: localPokemon.height,
        weight: localPokemon.weight,
        isForm: localPokemon.isForm,
        isBattleOnly: localPokemon.isBattleOnlyForm,
        isCosmetic: localPokemon.isCosmeticForm,
        isFemale: localPokemon.isFemaleForm,
        championsId: personalRecord.id,
        nameLabel: personalRecord.msNameLbl,
        formLabel: personalRecord.msFormLbl,
      })
    }
  }

  return rows
}

function localizePokemon(
  datasetRoot: string,
  lang: I18nCode,
  rows: readonly PokemonMapIndexRecord[],
): PokemonRecord[] {
  const names = readTextMap(datasetRoot, lang, 'monsname_syn')
  const formNames = readTextMap(datasetRoot, lang, 'zkn_form_syn')

  return rows.map((row) => {
    const formName = requireText(formNames, row.formLabel, `${lang} pokemon form names`)

    return pokemonSchema.parse({
      id: row.id,
      nid: row.nid,
      name: requireText(names, row.nameLabel, `${lang} pokemon names`),
      ...(formName === '' ? {} : { formName }),
      pokeApiId: row.pokeApiId,
      ...(row.pokeApiFormId === undefined ? {} : { pokeApiFormId: row.pokeApiFormId }),
      showdownId: row.showdownId,
      ...(row.baseSpecies === undefined ? {} : { baseSpecies: row.baseSpecies }),
      championsId: row.championsId,
      type1: row.type1,
      type2: row.type2,
      abilities: row.abilities,
      baseHp: row.baseHp,
      baseAtk: row.baseAtk,
      baseDef: row.baseDef,
      baseSpAtk: row.baseSpAtk,
      baseSpDef: row.baseSpDef,
      baseSpeed: row.baseSpeed,
      height: row.height,
      weight: row.weight,
      isForm: row.isForm,
      isBattleOnly: row.isBattleOnly,
      isCosmetic: row.isCosmetic,
      isFemale: row.isFemale,
    })
  })
}

function localizePokemonI18n(
  datasetRoot: string,
  lang: I18nCode,
  rows: readonly PokemonMapIndexRecord[],
): PokemonI18nRecord[] {
  const names = readTextMap(datasetRoot, lang, 'monsname_syn')
  const formNames = readTextMap(datasetRoot, lang, 'zkn_form_syn')

  return rows.map((row) => {
    const formName = requireText(formNames, row.formLabel, `${lang} pokemon form names`)

    return pokemonI18nSchema.parse({
      id: row.id,
      championsId: row.championsId,
      name: requireText(names, row.nameLabel, `${lang} pokemon names`),
      ...(formName === '' ? {} : { formName }),
    })
  })
}

function resolvePokemonMapLocalIds(
  record: PokemonPersonalRecord,
  localByDex: ReadonlyMap<number, LocalPokemonRecord[]>,
  localById: ReadonlyMap<string, LocalPokemonRecord>,
  formNames: ReadonlyMap<string, string>,
): string[] {
  const override = POKEMON_MAP_OVERRIDES[record.id]
  const localCandidates = localByDex.get(toNumber(record.no, 'dex number', record.id)) ?? []

  if (override !== undefined) {
    return appendFemaleVariantIfNeeded(record, [...override], localCandidates, localById)
  }

  const localIds =
    record.no === '869'
      ? resolveAlcremieLocalIds(record, localCandidates, formNames)
      : record.fo === '0'
        ? resolveDefaultPokemonLocalIds(record, localCandidates)
        : resolveFormPokemonLocalIds(record, localCandidates, formNames)

  return appendFemaleVariantIfNeeded(record, localIds, localCandidates, localById)
}

function resolveDefaultPokemonLocalIds(
  record: PokemonPersonalRecord,
  localCandidates: readonly LocalPokemonRecord[],
): string[] {
  const defaultPokemon = localCandidates.find(
    (pokemon) => pokemon.isDefault && !pokemon.isFemaleForm && !pokemon.isGmax,
  )

  if (defaultPokemon === undefined) {
    throw new Error(`Missing default local Pokemon for Champions ${record.id}`)
  }

  return [defaultPokemon.id]
}

function resolveFormPokemonLocalIds(
  record: PokemonPersonalRecord,
  localCandidates: readonly LocalPokemonRecord[],
  formNames: ReadonlyMap<string, string>,
): string[] {
  const formName = requireText(formNames, record.msFormLbl, 'usa pokemon form names')
  const normalizedFormName = normalizePokemonMapText(formName)
  const matches = localCandidates.filter(
    (pokemon) =>
      pokemon.isForm &&
      !pokemon.isFemaleForm &&
      !pokemon.isGmax &&
      pokemonTypesMatch(record, pokemon) &&
      pokemonStatsMatch(record, pokemon) &&
      localPokemonNameMatchesFormName(pokemon, normalizedFormName),
  )

  if (matches.length !== 1) {
    throw new Error(
      `Expected one local Pokemon match for Champions ${record.id} "${formName}", found ${
        matches.length
      }`,
    )
  }

  return matches.map((pokemon) => pokemon.id)
}

function resolveAlcremieLocalIds(
  record: PokemonPersonalRecord,
  localCandidates: readonly LocalPokemonRecord[],
  formNames: ReadonlyMap<string, string>,
): string[] {
  const formName = requireText(formNames, record.msFormLbl, 'usa pokemon form names')
  const formSlug = normalizePokemonMapText(formName).replace(/ /g, '-')

  if (formSlug === 'vanilla-cream') {
    return [
      'alcremie',
      ...localCandidates
        .filter((pokemon) => pokemon.id.startsWith('alcremie-vanilla-cream-') && !pokemon.isGmax)
        .map((pokemon) => pokemon.id),
    ]
  }

  return localCandidates
    .filter((pokemon) => pokemon.id.startsWith(`alcremie-${formSlug}-`) && !pokemon.isGmax)
    .map((pokemon) => pokemon.id)
}

function appendFemaleVariantIfNeeded(
  record: PokemonPersonalRecord,
  localIds: string[],
  localCandidates: readonly LocalPokemonRecord[],
  localById: ReadonlyMap<string, LocalPokemonRecord>,
): string[] {
  if (record.ffge !== '1' || localIds.length !== 1) {
    return localIds
  }

  const basePokemon = localById.get(localIds[0])

  if (basePokemon === undefined) {
    return localIds
  }

  const femalePokemon = localCandidates.find(
    (pokemon) =>
      pokemon.isFemaleForm &&
      (pokemon.id === `${basePokemon.id}-f` || pokemon.baseSpecies === basePokemon.id),
  )

  return femalePokemon === undefined ? localIds : [...localIds, femalePokemon.id]
}

function localPokemonNameMatchesFormName(
  pokemon: LocalPokemonRecord,
  normalizedFormName: string,
): boolean {
  const localName = normalizePokemonMapText(pokemon.names.eng)
  const localFormName = normalizePokemonMapText(pokemon.formNames.eng)

  return (
    normalizedFormName === localName ||
    normalizedFormName === localFormName ||
    localName.includes(normalizedFormName) ||
    normalizedFormName === localFormName.replace(/ size$/, ' variety')
  )
}

function pokemonTypesMatch(record: PokemonPersonalRecord, pokemon: LocalPokemonRecord): boolean {
  return (
    mapPokemonTypeCode(record.type1, `${record.id} type1`) === pokemon.type1 &&
    mapPokemonSecondaryType(record) === pokemon.type2
  )
}

function mapPokemonSecondaryType(record: PokemonPersonalRecord): PokemonType | null {
  const primaryType = mapPokemonTypeCode(record.type1, `${record.id} type1`)
  const secondaryType = mapPokemonTypeCode(record.type2, `${record.id} type2`)

  return primaryType === secondaryType ? null : secondaryType
}

function mapPokemonTypeCode(value: string, context: string): PokemonType {
  return lookupCode(POKEMON_TYPE_BY_CODE, toNumber(value, 'pokemon type', context), 'pokemon type')
}

function pokemonStatsMatch(record: PokemonPersonalRecord, pokemon: LocalPokemonRecord): boolean {
  return (
    toNumber(record.hp, 'hp', record.id) === pokemon.baseHp &&
    toNumber(record.atk, 'atk', record.id) === pokemon.baseAtk &&
    toNumber(record.def, 'def', record.id) === pokemon.baseDef &&
    toNumber(record.spatk, 'spatk', record.id) === pokemon.baseSpAtk &&
    toNumber(record.spdef, 'spdef', record.id) === pokemon.baseSpDef &&
    toNumber(record.agi, 'agi', record.id) === pokemon.baseSpeed
  )
}

function normalizePokemonMapText(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildLocalChampionsMap(
  localRecords: readonly LocalNamedRecord[],
  championsRecords: readonly { id: string; slug: string }[],
): LocalChampionsMap {
  const championsBySlug = new Map<string, { id: string; slug: string }>()

  for (const championsRecord of championsRecords) {
    if (championsBySlug.has(championsRecord.slug)) {
      throw new Error(`Duplicate Champions slug ${championsRecord.slug}`)
    }

    championsBySlug.set(championsRecord.slug, championsRecord)
  }

  const map: LocalChampionsMap = []
  const matchedLocalIds = new Set<string>()
  const matchedChampionsIds = new Set<string>()

  for (const localRecord of localRecords) {
    const championMatches = localRecordSlugCandidates(localRecord)
      .map((slug) => championsBySlug.get(slug))
      .filter((record): record is { id: string; slug: string } => record !== undefined)

    if (championMatches.length === 0) {
      continue
    }

    if (championMatches.length > 1) {
      throw new Error(`Multiple Champions matches for local id ${localRecord.id}`)
    }

    const championMatch = championMatches[0]

    if (matchedLocalIds.has(localRecord.id)) {
      throw new Error(`Duplicate local id ${localRecord.id} in Champions map`)
    }

    if (matchedChampionsIds.has(championMatch.id)) {
      throw new Error(`Duplicate Champions id ${championMatch.id} in local map`)
    }

    matchedLocalIds.add(localRecord.id)
    matchedChampionsIds.add(championMatch.id)
    map.push({
      id: localRecord.id,
      championsId: championMatch.id,
      slug: championMatch.slug,
    })
  }

  if (matchedChampionsIds.size !== championsRecords.length) {
    throw new Error(
      `Expected ${championsRecords.length} mapped Champions records, found ${
        matchedChampionsIds.size
      }`,
    )
  }

  return map
}

function mergeLocalChampionsRecords<T extends { id: string; championsId: string; slug: string }>(
  championsRecords: readonly T[],
  localMap: LocalChampionsMap,
  schema: { parse: (value: unknown) => T },
): T[] {
  const localByChampionsId = createLocalRecordByChampionsId(localMap, 'record')

  return championsRecords.map((championsRecord) => {
    const localRecord = requireLocalChampionsRecord(
      localByChampionsId,
      championsRecord.championsId,
      'record',
    )

    return schema.parse({
      ...championsRecord,
      id: localRecord.id,
      championsId: championsRecord.championsId,
      slug: localRecord.slug,
    })
  })
}

function createLocalRecordByChampionsId(
  records: readonly LocalChampionsMapRecord[],
  source: string,
): Map<string, LocalChampionsMapRecord> {
  const byChampionsId = new Map<string, LocalChampionsMapRecord>()

  for (const record of records) {
    if (byChampionsId.has(record.championsId)) {
      throw new Error(`Duplicate Champions ${source} id ${record.championsId}`)
    }

    byChampionsId.set(record.championsId, record)
  }

  return byChampionsId
}

function requireLocalChampionsRecord(
  records: ReadonlyMap<string, LocalChampionsMapRecord>,
  championsId: string,
  source: string,
): LocalChampionsMapRecord {
  const record = records.get(championsId)

  if (record === undefined) {
    throw new Error(`Missing local ${source} map for Champions id ${championsId}`)
  }

  return record
}

function localRecordSlugCandidates(record: LocalNamedRecord): string[] {
  const candidates = [
    slugify(record.name),
    record.psName === undefined ? undefined : slugify(record.psName),
  ]

  return Array.from(
    new Set(
      candidates
        .filter((slug): slug is string => slug !== undefined)
        .flatMap((slug) => expandLocalSlugAliases(slug)),
    ),
  )
}

function buildPokemonMoves(
  datasetRoot: string,
  localDataRoot: string,
  pokemon: readonly PokemonRecord[],
  moves: readonly MoveRecord[],
): PokemonMovesRecord[] {
  const learnsetPokemon = filterPokemonForLearnsets(pokemon, localDataRoot)
  const mappedChampionsPokemonIds = new Set(pokemon.map((record) => record.championsId))
  const localPokemonIdsByChampionsId = groupLocalIdsByChampionsId(learnsetPokemon)
  const localMoveIdByChampionsId = createLocalIdByChampionsId(moves, 'move')
  const rows: PokemonMovesRecord[] = []
  const usedLocalPokemonIds = new Set<string>()

  for (const learnRecord of readPokemonMoveLearnRecords(datasetRoot).sort(compareNumericIds)) {
    const localPokemonIds = localPokemonIdsByChampionsId.get(learnRecord.id)

    if (localPokemonIds === undefined) {
      if (
        IGNORED_POKEMON_PERSONAL_IDS.has(learnRecord.id) ||
        mappedChampionsPokemonIds.has(learnRecord.id)
      ) {
        continue
      }

      throw new Error(`Missing local Pokemon map for Champions Pokemon ${learnRecord.id}`)
    }

    const moves = localMoveIdsForLearnRecord(learnRecord, localMoveIdByChampionsId)

    for (const localPokemonId of localPokemonIds) {
      if (usedLocalPokemonIds.has(localPokemonId)) {
        throw new Error(`Duplicate local Pokemon id ${localPokemonId} in Pokemon moves`)
      }

      usedLocalPokemonIds.add(localPokemonId)
      rows.push(
        pokemonMovesRecordSchema.parse({
          id: localPokemonId,
          moves: [...moves],
        }),
      )
    }
  }

  if (usedLocalPokemonIds.size !== learnsetPokemon.length) {
    throw new Error(
      `Expected ${learnsetPokemon.length} Pokemon move rows, found ${usedLocalPokemonIds.size}`,
    )
  }

  return rows
}

function filterPokemonForLearnsets(
  pokemon: readonly PokemonRecord[],
  localDataRoot: string,
): PokemonRecord[] {
  const localPokemonById = new Map(
    readLocalPokemonRecords(localDataRoot).map((record) => [record.id, record]),
  )

  return pokemon.filter((pokemonRecord) => {
    const localPokemon = localPokemonById.get(pokemonRecord.id)

    if (localPokemon === undefined) {
      throw new Error(`Missing local Pokemon data for ${pokemonRecord.id}`)
    }

    return !localPokemon.isCosmeticForm && !localPokemon.isBattleOnlyForm
  })
}

function groupLocalIdsByChampionsId(
  records: readonly { id: string; championsId: string }[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>()

  for (const record of records) {
    const localIds = grouped.get(record.championsId) ?? []
    localIds.push(record.id)
    grouped.set(record.championsId, localIds)
  }

  return grouped
}

function createLocalIdByChampionsId(
  records: readonly { id: string; championsId: string }[],
  source: string,
): Map<string, string> {
  const byChampionsId = new Map<string, string>()

  for (const record of records) {
    if (byChampionsId.has(record.championsId)) {
      throw new Error(`Duplicate Champions ${source} id ${record.championsId}`)
    }

    byChampionsId.set(record.championsId, record.id)
  }

  return byChampionsId
}

function localMoveIdsForLearnRecord(
  learnRecord: PokemonMoveLearnRecord,
  localMoveIdByChampionsId: ReadonlyMap<string, string>,
): string[] {
  const moveIds = learnRecord.waza
    .split(',')
    .map((moveId) => moveId.trim())
    .filter((moveId) => moveId.length > 0)
  const localMoveIds = moveIds.map((moveId) => {
    const localMoveId = localMoveIdByChampionsId.get(moveId)

    if (localMoveId === undefined) {
      throw new Error(`Missing local move map for Champions move ${moveId}`)
    }

    return localMoveId
  })

  return Array.from(new Set(localMoveIds)).sort(compareStrings)
}

export function writeBuiltData(data: BuiltData, outputRoot = DEFAULT_OUTPUT_ROOT): void {
  writeJsonFile(join(outputRoot, 'moves.json'), data.moves)
  writeJsonFile(join(outputRoot, 'abilities.json'), data.abilities)
  writeJsonFile(join(outputRoot, 'items.json'), data.items)
  writeJsonFile(join(outputRoot, 'battle-states.json'), data.battleStates)
  writeJsonFile(join(outputRoot, 'pokemon.json'), data.pokemon)
  writeJsonFile(join(outputRoot, 'pokemon-moves.json'), data.pokemonMoves)

  for (const lang of I18N_CODE) {
    const normalizedLang = langMap[lang].gameLocale.toLowerCase()
    const langRoot = join(outputRoot, 'i18n', normalizedLang)
    const langData = data.i18n[lang]

    writeJsonFile(join(langRoot, 'moves.json'), langData.moves)
    writeJsonFile(join(langRoot, 'abilities.json'), langData.abilities)
    writeJsonFile(join(langRoot, 'items.json'), langData.items)
    writeJsonFile(join(langRoot, 'battle-states.json'), langData.battleStates)
    writeJsonFile(join(langRoot, 'pokemon.json'), langData.pokemon)
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

function readPokemonPersonalRecords(datasetRoot: string): PokemonPersonalRecord[] {
  return readJsonRecordArray(join(datasetRoot, 'masterdata/personal.json')).map((record, index) => {
    const context = `masterdata/personal.json[${index}]`

    return {
      id: stringField(record, 'id', context),
      no: stringField(record, 'no', context),
      fo: stringField(record, 'fo', context),
      ffge: stringField(record, 'ffge', context),
      msNameLbl: stringField(record, 'ms_name_lbl', context),
      msFormLbl: stringField(record, 'ms_form_lbl', context),
      type1: stringField(record, 'type1', context),
      type2: stringField(record, 'type2', context),
      hp: stringField(record, 'hp', context),
      atk: stringField(record, 'atk', context),
      def: stringField(record, 'def', context),
      spatk: stringField(record, 'spatk', context),
      spdef: stringField(record, 'spdef', context),
      agi: stringField(record, 'agi', context),
    }
  })
}

function readPokemonMoveLearnRecords(datasetRoot: string): PokemonMoveLearnRecord[] {
  return readJsonRecordArray(join(datasetRoot, 'masterdata/waza_learn.json')).map(
    (record, index) => {
      const context = `masterdata/waza_learn.json[${index}]`

      return {
        id: stringField(record, 'id', context),
        waza: stringField(record, 'waza', context),
      }
    },
  )
}

function readLocalPokemonRecords(localDataRoot: string): LocalPokemonRecord[] {
  const index = readStringArrayFile(join(localDataRoot, 'indices/pokemon.json'))

  return index.map((id) => {
    const filePath = join(localDataRoot, 'pokemon', `${id}.json`)
    const context = `data/pokemon/${id}.json`
    const record = requireRecord(readJsonFile(filePath), context)
    const refs = requireRecord(record.refs, `${context}.refs`)

    return {
      id: stringField(record, 'id', context),
      nid: stringField(record, 'nid', context),
      dexNum: numberField(record, 'dexNum', context),
      pokeApiId: optionalNumberField(refs, 'pkApiId', `${context}.refs`),
      pokeApiFormId: optionalNumberField(refs, 'pkApiFormId', `${context}.refs`),
      showdownId: stringField(refs, 'showdown', `${context}.refs`),
      type1: stringField(record, 'type1', context),
      type2: nullableStringField(record, 'type2', context),
      abilities: localPokemonAbilities(record, context),
      baseHp: numberField(record, 'baseHp', context),
      baseAtk: numberField(record, 'baseAtk', context),
      baseDef: numberField(record, 'baseDef', context),
      baseSpAtk: numberField(record, 'baseSpAtk', context),
      baseSpDef: numberField(record, 'baseSpDef', context),
      baseSpeed: numberField(record, 'baseSpeed', context),
      height: numberField(record, 'height', context),
      weight: numberField(record, 'weight', context),
      isDefault: booleanField(record, 'isDefault', context),
      isForm: booleanField(record, 'isForm', context),
      isCosmeticForm: booleanField(record, 'isCosmeticForm', context),
      isBattleOnlyForm: booleanField(record, 'isBattleOnlyForm', context),
      isFemaleForm: booleanField(record, 'isFemaleForm', context),
      isGmax: booleanField(record, 'isGmax', context),
      baseSpecies: optionalStringField(record, 'baseSpecies', context),
      names: stringMapField(record, 'names', context),
      formNames: stringMapField(record, 'formNames', context),
    }
  })
}

function readLocalNamedRecords(
  localDataRoot: string,
  fileName: 'moves' | 'abilities' | 'items',
): LocalNamedRecord[] {
  return readJsonRecordArray(join(localDataRoot, `${fileName}.json`)).map((record, index) => {
    const context = `data/${fileName}.json[${index}]`

    return {
      id: stringField(record, 'id', context),
      name: stringField(record, 'name', context),
      psName: optionalStringField(record, 'psName', context),
    }
  })
}

function localPokemonAbilities(record: SourceRecord, context: string): string[] {
  const abilities = [
    stringField(record, 'ability1', context),
    optionalStringField(record, 'ability2', context),
    optionalStringField(record, 'abilityHidden', context),
    optionalStringField(record, 'abilitySpecial', context),
  ].filter((ability): ability is string => ability !== undefined)

  return Array.from(new Set(abilities))
}

function groupLocalPokemonByDex(
  localPokemon: readonly LocalPokemonRecord[],
): Map<number, LocalPokemonRecord[]> {
  const localByDex = new Map<number, LocalPokemonRecord[]>()

  for (const pokemon of localPokemon) {
    const records = localByDex.get(pokemon.dexNum) ?? []
    records.push(pokemon)
    localByDex.set(pokemon.dexNum, records)
  }

  return localByDex
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

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
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

function readStringArrayFile(filePath: string): string[] {
  const json = readJsonFile(filePath)

  if (!Array.isArray(json) || json.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Expected ${filePath} to contain a string array`)
  }

  return json
}

function stringField(record: SourceRecord, field: string, context: string): string {
  const value = record[field]

  if (typeof value !== 'string') {
    throw new Error(`Expected string field ${field} in ${context}`)
  }

  return value
}

function optionalStringField(
  record: SourceRecord,
  field: string,
  context: string,
): string | undefined {
  const value = record[field]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error(`Expected optional string field ${field} in ${context}`)
  }

  return value
}

function nullableStringField(record: SourceRecord, field: string, context: string): string | null {
  const value = record[field]

  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`Expected nullable string field ${field} in ${context}`)
  }

  return value
}

function numberField(record: SourceRecord, field: string, context: string): number {
  const value = record[field]
  const numberValue = typeof value === 'string' ? Number(value) : value

  if (typeof numberValue !== 'number' || !Number.isInteger(numberValue)) {
    throw new Error(`Expected integer field ${field} in ${context}`)
  }

  return numberValue
}

function optionalNumberField(
  record: SourceRecord,
  field: string,
  context: string,
): number | undefined {
  const value = record[field]

  if (value === undefined || value === null) {
    return undefined
  }

  const numberValue = typeof value === 'string' ? Number(value) : value

  if (typeof numberValue !== 'number' || !Number.isInteger(numberValue)) {
    throw new Error(`Expected optional integer field ${field} in ${context}`)
  }

  return numberValue
}

function booleanField(record: SourceRecord, field: string, context: string): boolean {
  const value = record[field]

  if (typeof value !== 'boolean') {
    throw new Error(`Expected boolean field ${field} in ${context}`)
  }

  return value
}

function stringMapField(
  record: SourceRecord,
  field: string,
  context: string,
): Record<string, string | undefined> {
  const value = record[field]

  if (!isRecord(value)) {
    throw new Error(`Expected string map field ${field} in ${context}`)
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (typeof entry !== 'string') {
        throw new Error(`Expected string value ${field}.${key} in ${context}`)
      }

      return [key, entry]
    }),
  )
}

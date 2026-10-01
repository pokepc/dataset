/**
 * One-time migration of the v7 `data/` layout into the v8 base layout under `data-next/`
 * (Backlog task-4, layout in doc-2). Records lose their text, which moves to
 * `i18n/<locale>/` files; ids, `nid`, indices and code maps are kept as they are.
 *
 * The run ends with checks: every written file validates against the v8 schemas, every v7
 * record can be rebuilt from its v8 record and text, and code maps are byte-identical.
 *
 * Usage: bun src/scripts/migrate-v7-to-v8.ts [--v7-dir=data] [--out-dir=data-next], then
 * `pnpm format`.
 */
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { join, resolve } from 'node:path'
import type { z } from 'zod'
import { readJsonFile, writeJsonFile } from '../lib-next/fs'
import { localeCodeByV7Key, type LocaleCode, type V7LocaleKey } from '../lib-next/languages'
import {
  boxPresetTextFileSchema,
  classicBoxPresetFileSchema,
  codeMapSchema,
  collectionRecordSchemas,
  entityRecordSchemas,
  indexSchema,
  modernBoxPresetIndexSchema,
  modernBoxPresetSchema,
  pokemonMugshotsSchema,
  textFileSchemas,
  type CollectionKind,
  type EntityKind,
  type TextKind,
} from '../lib-next/schemas'

type Json = Record<string, any>
type I18nMap = Partial<Record<V7LocaleKey, string>>
/** Text per locale, then per entity id. */
type TextByLocale = Map<LocaleCode, Map<string, Json>>

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => arg.slice(2).split('=') as [string, string]),
)
const V7_DIR = resolve(args['v7-dir'] ?? 'data')
const OUT_DIR = resolve(args['out-dir'] ?? 'data-next')

/** v7 text fields per collection kind, all English (`eng`). */
const COLLECTION_TEXT_FIELDS: Record<Exclude<CollectionKind, 'battle-states'>, string[]> = {
  abilities: ['name', 'shortDesc', 'desc'],
  characters: ['name'],
  colors: ['name'],
  generations: [],
  items: ['name', 'shortDesc', 'desc'],
  languages: [],
  locations: ['name'],
  marks: ['name', 'title', 'conditions', 'shortDesc', 'desc'],
  moves: ['name', 'shortDesc', 'desc'],
  natures: ['name'],
  originmarks: ['name'],
  personalities: ['shortDesc'],
  pokeballs: ['name', 'shortDesc', 'desc'],
  regions: ['name'],
  ribbons: ['name', 'title', 'shortDesc', 'desc'],
  types: ['name'],
}

const POKEMON_TEXT_MAPS = [
  ['names', 'name'],
  ['speciesNames', 'speciesName'],
  ['formNames', 'formName'],
  ['genus', 'genus'],
] as const

// ---- Text helpers

function addText(
  text: TextByLocale,
  locale: LocaleCode,
  id: string,
  field: string,
  value: unknown,
) {
  if (value === undefined || value === null) return
  let byId = text.get(locale)
  if (!byId) text.set(locale, (byId = new Map()))
  const entry = byId.get(id) ?? {}
  entry[field] = value
  byId.set(id, entry)
}

function addI18nMap(text: TextByLocale, id: string, field: string, map: I18nMap = {}) {
  for (const [key, value] of Object.entries(map)) {
    const locale = localeCodeByV7Key[key as V7LocaleKey]
    if (!locale) throw new Error(`${id}: unknown v7 locale key "${key}" in ${field}`)
    addText(text, locale, id, field, value)
  }
}

/** Writes `i18n/<locale>/<path>.json` for each locale with entries, ordered by `ids`. */
function writeText(text: TextByLocale, path: string, ids: string[]) {
  for (const [locale, byId] of text) {
    const file: Json = {}
    for (const id of ids) if (byId.has(id)) file[id] = byId.get(id)
    if (Object.keys(file).length > 0)
      writeJsonFile(join(OUT_DIR, 'i18n', locale, `${path}.json`), file)
  }
}

function omit(record: Json, fields: readonly string[]): Json {
  const result: Json = {}
  for (const [key, value] of Object.entries(record)) if (!fields.includes(key)) result[key] = value
  return result
}

// ---- Kinds

function migrateCollection(kind: Exclude<CollectionKind, 'battle-states'>) {
  const records = readJsonFile<Json[]>(join(V7_DIR, `${kind}.json`))
  const fields = COLLECTION_TEXT_FIELDS[kind]
  const text: TextByLocale = new Map()
  const base = records.map((record) => {
    for (const field of fields) addText(text, 'eng', record.id, field, record[field])
    const migrated = omit(record, fields)
    if (kind === 'languages') migrated.code = localeCodeByV7Key[record.alpha3 as V7LocaleKey]
    return migrated
  })
  writeJsonFile(join(OUT_DIR, `${kind}.json`), base)
  writeText(
    text,
    kind,
    base.map((record) => String(record.id)),
  )
}

function migratePokemon() {
  const ids = readJsonFile<string[]>(join(V7_DIR, 'indices/pokemon.json'))
  const text: TextByLocale = new Map()
  for (const id of ids) {
    const record = readJsonFile<Json>(join(V7_DIR, 'pokemon', `${id}.json`))
    for (const [mapField, textField] of POKEMON_TEXT_MAPS)
      addI18nMap(text, id, textField, record[mapField])
    addText(text, 'eng', id, 'formsDesc', record.formsDesc)

    const migrated = omit(record, [...POKEMON_TEXT_MAPS.map(([field]) => field), 'formsDesc'])
    if (record.evoMethods) {
      migrated.evoMethods = record.evoMethods.map((method: Json, index: number) => {
        addMethodNotes(text, id, 'evoNotes', String(index), method.notes)
        return omit(method, ['notes'])
      })
    }
    if (record.formMethods) {
      migrated.formMethods = record.formMethods.map((method: Json, index: number) => {
        addMethodNotes(text, id, 'formNotes', String(index), method.notes)
        const result = omit(method, ['notes'])
        if (method.revert) {
          result.revert = method.revert.map((revert: unknown, revertIndex: number) => {
            if (!revert || typeof revert !== 'object') return revert
            addMethodNotes(
              text,
              id,
              'formNotes',
              `${index}.revert.${revertIndex}`,
              (revert as Json).notes,
            )
            return omit(revert as Json, ['notes'])
          })
        }
        return result
      })
    }
    writeJsonFile(join(OUT_DIR, 'pokemon', `${id}.json`), migrated)
  }
  writeText(text, 'pokemon', ids)
}

function addMethodNotes(
  text: TextByLocale,
  id: string,
  field: string,
  key: string,
  notes?: I18nMap,
) {
  for (const [v7Key, note] of Object.entries(notes ?? {})) {
    const locale = localeCodeByV7Key[v7Key as V7LocaleKey]
    if (!locale) throw new Error(`${id}: unknown v7 locale key "${v7Key}" in notes`)
    const byId = text.get(locale)?.get(id)
    addText(text, locale, id, field, { ...byId?.[field], [key]: note })
  }
}

function migrateGames() {
  const ids = readJsonFile<string[]>(join(V7_DIR, 'indices/games.json'))
  const text: TextByLocale = new Map()
  for (const id of ids) {
    const record = readJsonFile<Json>(join(V7_DIR, 'games', `${id}.json`))
    addText(text, 'eng', id, 'name', record.name)
    writeJsonFile(join(OUT_DIR, 'games', `${id}.json`), omit(record, ['name']))
  }
  writeText(text, 'games', ids)
}

/** Key of a Pokédex entry's text: its image nid without the dex-number prefix. */
export function pokedexEntryMetaId(meta: Json): string {
  const source = meta.imgNid ?? meta.names?.eng
  if (!source) throw new Error(`Pokédex entry meta has no imgNid or English name`)
  return String(source)
    .replace(/^\d+-/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function migratePokedexes() {
  const ids = readJsonFile<string[]>(join(V7_DIR, 'indices/pokedexes.json'))
  const text: TextByLocale = new Map()
  for (const id of ids) {
    const record = readJsonFile<Json>(join(V7_DIR, 'pokedexes', `${id}.json`))
    for (const field of ['name', 'shortDesc', 'desc'])
      addText(text, 'eng', id, field, record[field])
    const metaIds = new Set<string>()
    const entries = record.entries.map((entry: Json) => {
      if (!entry.meta) return entry
      const metaId = pokedexEntryMetaId(entry.meta)
      if (metaIds.has(metaId)) throw new Error(`${id}: duplicate entry meta id ${metaId}`)
      metaIds.add(metaId)
      const entryText: TextByLocale = new Map()
      for (const [mapField, textField] of POKEMON_TEXT_MAPS) {
        if (mapField !== 'genus') addI18nMap(entryText, metaId, textField, entry.meta[mapField])
      }
      for (const [locale, byId] of entryText) {
        const dexText = text.get(locale)?.get(id)
        addText(text, locale, id, 'entries', { ...dexText?.entries, [metaId]: byId.get(metaId) })
      }
      const meta = { id: metaId, ...omit(entry.meta, ['names', 'speciesNames', 'formNames']) }
      return { ...entry, meta }
    })
    writeJsonFile(join(OUT_DIR, 'pokedexes', `${id}.json`), {
      ...omit(record, ['name', 'shortDesc', 'desc']),
      entries,
    })
  }
  writeText(text, 'pokedexes', ids)
}

function migrateBoxPresets() {
  const classicDir = join(V7_DIR, 'boxpresets/classic')
  for (const file of readdirSync(classicDir).filter((name) => name.endsWith('.json'))) {
    const presets = readJsonFile<Record<string, Json>>(join(classicDir, file))
    const base: Json = {}
    const text: Json = {}
    for (const [presetId, preset] of Object.entries(presets)) {
      base[presetId] = {
        ...omit(preset, ['name', 'description']),
        boxes: preset.boxes.map((box: Json) => omit(box, ['title'])),
      }
      text[presetId] = presetText(preset.name, preset.description, preset.boxes, 'title')
    }
    writeJsonFile(join(OUT_DIR, 'boxpresets/classic', file), base)
    writeJsonFile(join(OUT_DIR, 'i18n/eng/boxpresets/classic', file), text)
  }

  const modernDir = join(V7_DIR, 'boxpresets/modern')
  for (const file of readdirSync(modernDir).filter((name) => name.endsWith('.json'))) {
    const set = file.slice(0, -'.json'.length)
    const index = readJsonFile<string[]>(join(modernDir, file))
    const text: Json = {}
    for (const presetId of index) {
      const preset = readJsonFile<Json>(join(modernDir, set, `${presetId}.json`))
      if (preset.schemaVersion !== 1)
        throw new Error(`${set}/${presetId}: unexpected schemaVersion`)
      writeJsonFile(join(OUT_DIR, 'boxpresets/modern', set, `${presetId}.json`), {
        ...omit(preset, ['name', 'description']),
        schemaVersion: 2,
        boxes: preset.boxes.map((box: Json) => omit(box, ['name'])),
      })
      text[presetId] = presetText(preset.name, preset.description, preset.boxes, 'name')
    }
    const presetDir = join(modernDir, set)
    const extra = (existsSync(presetDir) ? readdirSync(presetDir) : []).filter(
      (name) => !index.includes(name.replace(/\.json$/, '')),
    )
    if (extra.length > 0) throw new Error(`${set}: modern presets missing from index: ${extra}`)
    writeJsonFile(join(OUT_DIR, 'boxpresets/modern', file), index)
    writeJsonFile(join(OUT_DIR, 'i18n/eng/boxpresets/modern', file), text)
  }
}

function presetText(name: unknown, description: unknown, boxes: Json[], titleField: string): Json {
  const text: Json = {}
  if (name !== undefined) text.name = name
  if (description !== undefined) text.description = description
  if (boxes.some((box) => box[titleField] !== undefined)) {
    text.boxes = boxes.map((box) => box[titleField] ?? null)
  }
  return text
}

function copyUnchanged() {
  for (const dir of ['codes', 'indices', 'metadata']) {
    cpSync(join(V7_DIR, dir), join(OUT_DIR, dir), {
      recursive: true,
      filter: (source) => !source.endsWith('.DS_Store'),
    })
  }
}

/** Moves the preview's game-independent prose into `i18n/<locale>/pokemon-prose/`. */
function movePokemonProse() {
  const proseDir = join(OUT_DIR, 'pokemon-texts')
  if (!existsSync(proseDir)) return
  for (const locale of readdirSync(proseDir)) {
    if (!statSync(join(proseDir, locale)).isDirectory()) continue
    const target = join(OUT_DIR, 'i18n', locale, 'pokemon-prose')
    rmSync(target, { recursive: true, force: true })
    renameSync(join(proseDir, locale), target)
  }
  rmSync(proseDir, { recursive: true })
}

// ---- Checks

function check(label: string, problems: string[]) {
  if (problems.length > 0) {
    throw new Error(`${label}: ${problems.length} problem(s)\n${problems.slice(0, 20).join('\n')}`)
  }
  console.log(`✓ ${label}`)
}

function issues(path: string, schema: z.ZodType, data: unknown): string[] {
  const result = schema.safeParse(data)
  if (result.success) return []
  return result.error.issues
    .slice(0, 3)
    .map((issue) => `${path} ${issue.path.join('.')}: ${issue.message}`)
}

function validateOutput() {
  const problems: string[] = []
  for (const [kind, schema] of Object.entries(collectionRecordSchemas)) {
    if (kind === 'battle-states') continue
    const records = readJsonFile<unknown[]>(join(OUT_DIR, `${kind}.json`))
    records.forEach((record, index) =>
      problems.push(...issues(`${kind}[${index}]`, schema, record)),
    )
  }
  for (const [kind, schema] of Object.entries(entityRecordSchemas) as [EntityKind, z.ZodType][]) {
    const ids = readJsonFile<string[]>(join(OUT_DIR, 'indices', `${kind}.json`))
    problems.push(...issues(`indices/${kind}`, indexSchema, ids))
    for (const id of ids) {
      const record = readJsonFile<Json>(join(OUT_DIR, kind, `${id}.json`))
      if (record.id !== id) problems.push(`${kind}/${id}: id mismatch`)
      problems.push(...issues(`${kind}/${id}`, schema, record))
    }
  }
  for (const file of readdirSync(join(OUT_DIR, 'codes'))) {
    problems.push(
      ...issues(`codes/${file}`, codeMapSchema, readJsonFile(join(OUT_DIR, 'codes', file))),
    )
  }
  problems.push(
    ...issues(
      'metadata/pokemon-mugshots',
      pokemonMugshotsSchema,
      readJsonFile(join(OUT_DIR, 'metadata/pokemon-mugshots.json')),
    ),
  )
  for (const file of readdirSync(join(OUT_DIR, 'boxpresets/classic'))) {
    const path = join(OUT_DIR, 'boxpresets/classic', file)
    problems.push(
      ...issues(`boxpresets/classic/${file}`, classicBoxPresetFileSchema, readJsonFile(path)),
    )
  }
  const modernDir = join(OUT_DIR, 'boxpresets/modern')
  for (const file of readdirSync(modernDir).filter((name) => name.endsWith('.json'))) {
    const index = readJsonFile<string[]>(join(modernDir, file))
    problems.push(...issues(`boxpresets/modern/${file}`, modernBoxPresetIndexSchema, index))
    for (const id of index) {
      const path = join(modernDir, file.slice(0, -5), `${id}.json`)
      problems.push(...issues(`boxpresets/modern/${id}`, modernBoxPresetSchema, readJsonFile(path)))
    }
  }
  for (const locale of readdirSync(join(OUT_DIR, 'i18n'))) {
    const localeDir = join(OUT_DIR, 'i18n', locale)
    for (const file of readdirSync(localeDir).filter((name) => name.endsWith('.json'))) {
      const kind = file.slice(0, -5) as TextKind
      const schema = textFileSchemas[kind]
      if (!schema) problems.push(`i18n/${locale}/${file}: unknown kind`)
      else
        problems.push(
          ...issues(`i18n/${locale}/${file}`, schema, readJsonFile(join(localeDir, file))),
        )
    }
    for (const variant of ['classic', 'modern']) {
      const dir = join(localeDir, 'boxpresets', variant)
      if (!existsSync(dir)) continue
      for (const file of readdirSync(dir)) {
        const path = `i18n/${locale}/boxpresets/${variant}/${file}`
        problems.push(...issues(path, boxPresetTextFileSchema, readJsonFile(join(dir, file))))
      }
    }
  }
  check('migrated files validate against the v8 schemas', problems)
}

/** Text of one entity per v7 key, rebuilt from the locale files. */
function readTextById(kind: string): Map<string, Partial<Record<V7LocaleKey, Json>>> {
  const byId = new Map<string, Partial<Record<V7LocaleKey, Json>>>()
  for (const [v7Key, locale] of Object.entries(localeCodeByV7Key)) {
    const path = join(OUT_DIR, 'i18n', locale, `${kind}.json`)
    if (!existsSync(path)) continue
    for (const [id, text] of Object.entries(readJsonFile<Json>(path))) {
      byId.set(id, { ...byId.get(id), [v7Key]: text })
    }
  }
  return byId
}

function i18nMapOf(text: Partial<Record<V7LocaleKey, Json>> | undefined, field: string): I18nMap {
  const map: I18nMap = {}
  for (const [key, entry] of Object.entries(text ?? {})) {
    if (entry?.[field] !== undefined) map[key as V7LocaleKey] = entry[field]
  }
  return map
}

/** Drops `null` text values: v8 omits them, which carries the same meaning. */
function withoutNullFields(record: Json, fields: readonly string[]): Json {
  const result = { ...record }
  for (const field of fields) if (result[field] === null) delete result[field]
  return result
}

function verifyRoundTrip() {
  const problems: string[] = []

  for (const kind of Object.keys(
    COLLECTION_TEXT_FIELDS,
  ) as (keyof typeof COLLECTION_TEXT_FIELDS)[]) {
    const fields = COLLECTION_TEXT_FIELDS[kind]
    const v7 = readJsonFile<Json[]>(join(V7_DIR, `${kind}.json`))
    const v8 = readJsonFile<Json[]>(join(OUT_DIR, `${kind}.json`))
    const text = readTextById(kind)
    if (v7.length !== v8.length) problems.push(`${kind}: ${v7.length} → ${v8.length} records`)
    v7.forEach((original, index) => {
      const rebuilt: Json = { ...omit(v8[index] ?? {}, ['code']) }
      for (const field of fields) {
        const value = text.get(original.id)?.eng?.[field]
        if (value !== undefined) rebuilt[field] = value
      }
      if (!isDeepStrictEqual(withoutNullFields(original, fields), rebuilt)) {
        problems.push(`${kind}/${original.id}`)
      }
    })
  }

  const pokemonText = readTextById('pokemon')
  const pokemonIds = readJsonFile<string[]>(join(V7_DIR, 'indices/pokemon.json'))
  for (const id of pokemonIds) {
    const original = readJsonFile<Json>(join(V7_DIR, 'pokemon', `${id}.json`))
    const rebuilt = readJsonFile<Json>(join(OUT_DIR, 'pokemon', `${id}.json`))
    const text = pokemonText.get(id)
    for (const [mapField, textField] of POKEMON_TEXT_MAPS)
      rebuilt[mapField] = i18nMapOf(text, textField)
    if (text?.eng?.formsDesc !== undefined) rebuilt.formsDesc = text.eng.formsDesc
    const notesOf = (field: string, key: string) => {
      const notes = i18nMapOf(text, field)
      const result: I18nMap = {}
      for (const [v7Key, byKey] of Object.entries(notes)) {
        const note = (byKey as unknown as Json)[key]
        if (note !== undefined) result[v7Key as V7LocaleKey] = note
      }
      return Object.keys(result).length > 0 ? result : undefined
    }
    rebuilt.evoMethods = rebuilt.evoMethods?.map((method: Json, index: number) => {
      const notes = notesOf('evoNotes', String(index))
      return notes ? { ...method, notes } : method
    })
    rebuilt.formMethods = rebuilt.formMethods?.map((method: Json, index: number) => {
      const notes = notesOf('formNotes', String(index))
      const result: Json = notes ? { ...method, notes } : { ...method }
      if (method.revert) {
        result.revert = method.revert.map((revert: unknown, revertIndex: number) => {
          const revertNotes = notesOf('formNotes', `${index}.revert.${revertIndex}`)
          return revertNotes ? { ...(revert as Json), notes: revertNotes } : revert
        })
      }
      return result
    })
    if (rebuilt.evoMethods === undefined) delete rebuilt.evoMethods
    if (rebuilt.formMethods === undefined) delete rebuilt.formMethods
    if (!isDeepStrictEqual(original, rebuilt)) problems.push(`pokemon/${id}`)
  }

  const gameText = readTextById('games')
  for (const id of readJsonFile<string[]>(join(V7_DIR, 'indices/games.json'))) {
    const original = readJsonFile<Json>(join(V7_DIR, 'games', `${id}.json`))
    const rebuilt = { ...readJsonFile<Json>(join(OUT_DIR, 'games', `${id}.json`)) }
    rebuilt.name = gameText.get(id)?.eng?.name
    if (!isDeepStrictEqual(original, rebuilt)) problems.push(`games/${id}`)
  }

  const dexText = readTextById('pokedexes')
  for (const id of readJsonFile<string[]>(join(V7_DIR, 'indices/pokedexes.json'))) {
    const original = readJsonFile<Json>(join(V7_DIR, 'pokedexes', `${id}.json`))
    const v8 = readJsonFile<Json>(join(OUT_DIR, 'pokedexes', `${id}.json`))
    const text = dexText.get(id)
    const rebuilt: Json = { ...v8 }
    for (const field of ['name', 'shortDesc', 'desc']) {
      if (text?.eng?.[field] !== undefined) rebuilt[field] = text.eng[field]
    }
    rebuilt.entries = v8.entries.map((entry: Json, entryIndex: number) => {
      if (!entry.meta) return entry
      const { id: metaId, ...meta } = entry.meta
      const entryText: Partial<Record<V7LocaleKey, Json>> = {}
      for (const [key, localeText] of Object.entries(text ?? {})) {
        if (localeText?.entries?.[metaId])
          entryText[key as V7LocaleKey] = localeText.entries[metaId]
      }
      const names: Json = {}
      for (const [mapField, textField] of POKEMON_TEXT_MAPS) {
        if (mapField === 'genus') continue
        const map = i18nMapOf(entryText, textField)
        // v7 kept empty maps; the original only decides whether an empty map was present.
        if (Object.keys(map).length > 0 || original.entries[entryIndex]?.meta?.[mapField]) {
          names[mapField] = map
        }
      }
      return { ...entry, meta: { ...names, ...meta } }
    })
    const originalWithoutNulls = withoutNullFields(original, ['desc'])
    if (!isDeepStrictEqual(originalWithoutNulls, rebuilt)) problems.push(`pokedexes/${id}`)
  }
  check('v7 records rebuild from v8 records and text without loss', problems)
}

function verifyBoxPresetText() {
  const problems: string[] = []
  const classicDir = join(V7_DIR, 'boxpresets/classic')
  for (const file of readdirSync(classicDir).filter((name) => name.endsWith('.json'))) {
    const v7 = readJsonFile<Record<string, Json>>(join(classicDir, file))
    const base = readJsonFile<Record<string, Json>>(join(OUT_DIR, 'boxpresets/classic', file))
    const text = readJsonFile<Record<string, Json>>(
      join(OUT_DIR, 'i18n/eng/boxpresets/classic', file),
    )
    for (const [id, preset] of Object.entries(v7)) {
      const rebuilt: Json = {
        ...base[id],
        name: text[id]?.name,
        description: text[id]?.description,
      }
      rebuilt.boxes = base[id]?.boxes.map((box: Json, index: number) => {
        const title = text[id]?.boxes?.[index]
        return title === null || title === undefined ? box : { title, ...box }
      })
      if (!isDeepStrictEqual(preset, rebuilt)) problems.push(`classic/${file}/${id}`)
    }
  }
  const modernDir = join(V7_DIR, 'boxpresets/modern')
  for (const file of readdirSync(modernDir).filter((name) => name.endsWith('.json'))) {
    const set = file.slice(0, -5)
    const text = readJsonFile<Record<string, Json>>(
      join(OUT_DIR, 'i18n/eng/boxpresets/modern', file),
    )
    for (const id of readJsonFile<string[]>(join(modernDir, file))) {
      const preset = readJsonFile<Json>(join(modernDir, set, `${id}.json`))
      const base = readJsonFile<Json>(join(OUT_DIR, 'boxpresets/modern', set, `${id}.json`))
      const rebuilt: Json = { ...base, schemaVersion: 1, name: text[id]?.name }
      if (text[id]?.description !== undefined) rebuilt.description = text[id].description
      rebuilt.boxes = base.boxes.map((box: Json, index: number) => {
        const name = text[id]?.boxes?.[index]
        return name === null || name === undefined ? box : { name, ...box }
      })
      if (!isDeepStrictEqual(preset, rebuilt)) problems.push(`modern/${set}/${id}`)
    }
  }
  check('box presets rebuild from v8 presets and text without loss', problems)
}

function verifyCodes() {
  const problems: string[] = []
  for (const file of readdirSync(join(V7_DIR, 'codes'))) {
    const v7 = readFileSync(join(V7_DIR, 'codes', file))
    const v8 = readFileSync(join(OUT_DIR, 'codes', file))
    if (!v7.equals(v8)) problems.push(`codes/${file} differs`)
  }
  const liveIds: Record<string, string[]> = {
    pokemon: readJsonFile<string[]>(join(OUT_DIR, 'indices/pokemon.json')),
    moves: readJsonFile<Json[]>(join(OUT_DIR, 'moves.json')).map((record) => record.id),
    ribbons: readJsonFile<Json[]>(join(OUT_DIR, 'ribbons.json')).map((record) => record.id),
    marks: readJsonFile<Json[]>(join(OUT_DIR, 'marks.json')).map((record) => record.id),
  }
  for (const [kind, ids] of Object.entries(liveIds)) {
    const coded = new Set(
      readJsonFile<Json[]>(join(OUT_DIR, 'codes', `${kind}.json`))
        .filter((entry) => !entry.retired)
        .map((entry) => entry.id),
    )
    for (const id of ids) if (!coded.has(id)) problems.push(`${kind}/${id} has no code`)
  }
  check('code maps are byte-identical and cover every v8 id', problems)
}

// ---- Run

for (const kind of Object.keys(COLLECTION_TEXT_FIELDS) as (keyof typeof COLLECTION_TEXT_FIELDS)[]) {
  migrateCollection(kind)
}
migratePokemon()
migrateGames()
migratePokedexes()
migrateBoxPresets()
copyUnchanged()
movePokemonProse()
console.log(`Migrated ${V7_DIR} → ${OUT_DIR}`)

validateOutput()
verifyRoundTrip()
verifyBoxPresetText()
verifyCodes()

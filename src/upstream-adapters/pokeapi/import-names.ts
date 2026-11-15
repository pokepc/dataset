/**
 * Fills missing names in `data/i18n/<locale>/` from PokeAPI's CSV dump.
 *
 * Covers the `name` of moves, abilities, items, types, natures, colors and regions, plus the
 * species `name`, `speciesName` and `genus` of Pokémon. It only adds text a locale lacks: existing
 * values (many come from official game text) are never replaced, and a differing PokeAPI value is
 * reported as a conflict. A locale PokeAPI has no name for stays empty; nothing is copied from
 * another language.
 *
 * Examples:
 *   bun src/upstream-adapters/pokeapi/import-names.ts --dry-run
 *   bun src/upstream-adapters/pokeapi/import-names.ts
 *   bun src/upstream-adapters/pokeapi/import-names.ts --verbose   # list unmatched ids and conflicts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const CSV_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv'
const dataDir = resolve(import.meta.dirname, '../../../data')
const dryRun = process.argv.includes('--dry-run')
const verbose = process.argv.includes('--verbose')

/** PokeAPI `local_language_id` → dataset locale. Japanese uses the kana names, as the games do. */
const localeByLanguageId: Record<string, string> = {
  1: 'jpn',
  3: 'kor',
  4: 'cht',
  5: 'fra',
  6: 'deu',
  7: 'es-es',
  8: 'ita',
  12: 'chs',
  14: 'es-la',
}
const ENGLISH = '9'
/** PokeAPI's Latin American Spanish genus is a copy of the European Spanish one, so it is not imported. */
const localesWithoutGenus = new Set(['es-la'])
const JAPANESE_KANA = '1'
const JAPANESE_KANJI = '11'

/**
 * The text of one language. Japanese prefers the kana text; when PokeAPI only has the kanji-mode
 * text, it is used if it holds no kanji, because both modes then show the same string.
 */
function localText(
  byLanguage: Record<string, string | undefined> | undefined,
  languageId: string,
): string | undefined {
  const text = byLanguage?.[languageId]
  if (text || languageId !== JAPANESE_KANA) return text || undefined
  const kanjiMode = byLanguage?.[JAPANESE_KANJI]
  return kanjiMode && !/\p{Script=Han}/u.test(kanjiMode) ? kanjiMode : undefined
}

type Row = Record<string, string>
type TextFile = Record<string, Record<string, unknown>>

function parseCsv(source: string): Row[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') field += char
  }
  if (field || row.length) rows.push([...row, field])
  const [header, ...body] = rows
  return body.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ''])))
}

async function csv(name: string): Promise<Row[]> {
  const res = await fetch(`${CSV_BASE_URL}/${name}.csv`)
  if (!res.ok) throw new Error(`Failed to fetch ${name}.csv: HTTP ${res.status}`)
  return parseCsv(await res.text())
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(dataDir, path), 'utf8')) as T
}

function readText(locale: string, kind: string): TextFile {
  const path = `i18n/${locale}/${kind}.json`
  return existsSync(join(dataDir, path)) ? readJson<TextFile>(path) : {}
}

/** Slug comparison that ignores case, accents, spaces and punctuation. */
function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const report: string[] = []
const details: string[] = []

/** Writes `text` in base id order, dropping nothing; skips the file when no entry exists. */
function writeText(locale: string, kind: string, order: string[], text: TextFile): void {
  const ordered = Object.fromEntries(order.filter((id) => id in text).map((id) => [id, text[id]]))
  if (Object.keys(ordered).length === 0 || dryRun) return
  const path = join(dataDir, 'i18n', locale, `${kind}.json`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`)
}

/** Sets `field` when the locale lacks it; an existing, different value is kept and reported. */
function fill(
  entry: Record<string, unknown>,
  field: string,
  value: string | undefined,
  context: string,
): boolean {
  if (!value) return false
  if (entry[field] === undefined) {
    entry[field] = value
    return true
  }
  if (entry[field] !== value) details.push(`conflict ${context}.${field}: kept "${entry[field]}"`)
  return false
}

function withKeyOrder(entry: Record<string, unknown>, first: string[]): Record<string, unknown> {
  const keys = [...first.filter((key) => key in entry), ...Object.keys(entry)]
  return Object.fromEntries([...new Set(keys)].map((key) => [key, entry[key]]))
}

/** Names of one PokeAPI resource: resource id → language id → name. */
function namesById(rows: Row[], idColumn: string): Map<string, Record<string, string>> {
  const names = new Map<string, Record<string, string>>()
  for (const row of rows) {
    const byLanguage = names.get(row[idColumn]) ?? {}
    byLanguage[row.local_language_id] = row.name
    names.set(row[idColumn], byLanguage)
  }
  return names
}

async function importNamedKind(
  kind: string,
  resource: string,
  namesFile: string,
  idColumn: string,
): Promise<void> {
  const records = readJson<{ id: string; pokeApiId?: number | null }[]>(`${kind}.json`)
  const english = readText('eng', kind)
  const identifiers = await csv(resource)
  const names = namesById(await csv(namesFile), idColumn)

  const byIdentifier = new Map(identifiers.map((row) => [slug(row.identifier), row.id]))
  const byEnglishName = new Map<string, string>()
  for (const [id, byLanguage] of names)
    if (byLanguage[ENGLISH]) byEnglishName.set(slug(byLanguage[ENGLISH]), id)

  const matches = new Map<string, string>()
  for (const record of records) {
    const englishName = String(english[record.id]?.name ?? '')
    const apiId =
      (record.pokeApiId != null && names.has(String(record.pokeApiId))
        ? String(record.pokeApiId)
        : undefined) ??
      byEnglishName.get(slug(englishName)) ??
      byIdentifier.get(slug(record.id))
    if (apiId) matches.set(record.id, apiId)
    else details.push(`unmatched ${kind}/${record.id}`)
  }

  const order = records.map((record) => record.id)
  const counts: string[] = []
  for (const [languageId, locale] of Object.entries(localeByLanguageId)) {
    const text = readText(locale, kind)
    let added = 0
    for (const [id, apiId] of matches) {
      const entry = text[id] ?? {}
      if (fill(entry, 'name', localText(names.get(apiId), languageId), `${locale}/${kind}/${id}`)) {
        text[id] = withKeyOrder(entry, ['name'])
        added++
      }
    }
    writeText(locale, kind, order, text)
    const named = order.filter((id) => text[id]?.name !== undefined).length
    counts.push(`${locale} +${added} (${named}/${order.length})`)
  }
  report.push(`${kind}: matched ${matches.size}/${records.length}; ${counts.join(', ')}`)
}

async function importPokemon(): Promise<void> {
  const order = readJson<string[]>('indices/pokemon.json')
  const english = readText('eng', 'pokemon')
  const species = new Map<string, Record<string, Row>>()
  for (const row of await csv('pokemon_species_names')) {
    const byLanguage = species.get(row.pokemon_species_id) ?? {}
    byLanguage[row.local_language_id] = row
    species.set(row.pokemon_species_id, byLanguage)
  }
  const records = order.map((id) =>
    readJson<{ id: string; dexNum: number; isForm: boolean }>(`pokemon/${id}.json`),
  )

  const counts: string[] = []
  for (const [languageId, locale] of Object.entries(localeByLanguageId)) {
    const text = readText(locale, 'pokemon')
    const added = { name: 0, speciesName: 0, genus: 0 }
    for (const record of records) {
      const source = species.get(String(record.dexNum))
      const englishSource = source?.[ENGLISH]
      const pick = (field: 'name' | 'genus') =>
        localText(
          Object.fromEntries(Object.entries(source ?? {}).map(([id, row]) => [id, row[field]])),
          languageId,
        )
      const localSource = { name: pick('name'), genus: pick('genus') }
      const englishEntry = english[record.id]
      if (!englishSource || !englishEntry) continue
      const entry = { ...text[record.id] }
      const context = `${locale}/pokemon/${record.id}`
      let changed = false
      // Only where our English text is PokeAPI's species text, so form-specific names and genera
      // (for example a record whose `name` carries its form) are never overwritten by the species'.
      for (const field of ['name', 'speciesName'] as const)
        if (
          englishEntry[field] === englishSource.name &&
          fill(entry, field, localSource.name, context)
        ) {
          added[field]++
          changed = true
        }
      if (
        !localesWithoutGenus.has(locale) &&
        englishEntry.genus === englishSource.genus &&
        fill(entry, 'genus', localSource.genus, context)
      ) {
        added.genus++
        changed = true
      }
      if (changed)
        text[record.id] = record.isForm
          ? withKeyOrder(
              Object.fromEntries(
                ['name', 'speciesName', 'formName', 'genus']
                  .filter((key) => key in entry)
                  .map((key) => [key, entry[key]]),
              ),
              [],
            )
          : withKeyOrder(entry, ['name', 'genus'])
      if (changed && record.isForm)
        for (const [key, value] of Object.entries(entry))
          if (!(key in text[record.id])) text[record.id][key] = value
    }
    writeText(locale, 'pokemon', order, text)
    counts.push(
      `${locale} +${added.name} name, +${added.speciesName} speciesName, +${added.genus} genus`,
    )
  }
  report.push(`pokemon: ${counts.join('; ')}`)
}

await importNamedKind('moves', 'moves', 'move_names', 'move_id')
await importNamedKind('abilities', 'abilities', 'ability_names', 'ability_id')
await importNamedKind('items', 'items', 'item_names', 'item_id')
await importNamedKind('types', 'types', 'type_names', 'type_id')
await importNamedKind('natures', 'natures', 'nature_names', 'nature_id')
await importNamedKind('colors', 'pokemon_colors', 'pokemon_color_names', 'pokemon_color_id')
await importNamedKind('regions', 'regions', 'region_names', 'region_id')
await importPokemon()

console.log(report.join('\n'))
const conflicts = details.filter((line) => line.startsWith('conflict'))
const unmatched = details.filter((line) => line.startsWith('unmatched'))
console.log(`\n${unmatched.length} unmatched records, ${conflicts.length} conflicts kept as-is`)
if (verbose) console.log(details.join('\n'))
if (dryRun) console.log('\nDry run: no files written.')

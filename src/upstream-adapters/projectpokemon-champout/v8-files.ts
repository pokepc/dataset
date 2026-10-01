/** Reads the v8 base data Champions touches and writes base updates plus `mods/champions/`. */
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { join, relative } from 'node:path'
import { readJsonFile, writeJsonFile } from '../../lib/fs'
import { localeCodes } from '../../lib/languages'
import { moddableKinds, moddableRecordSchemas, type ModdableKind } from '../../lib/schemas'
import { CHAMPIONS_SET, type ChampionsV8, type ModdableBase } from './to-v8'

type Json = Record<string, unknown>

function readJsonIfExists<T>(path: string): T | undefined {
  return existsSync(path) ? readJsonFile<T>(path) : undefined
}

export function readModdableBase(dataDir: string): ModdableBase {
  const text: ModdableBase['text'] = {}
  for (const locale of localeCodes) {
    for (const kind of moddableKinds) {
      const file = readJsonIfExists<Json>(join(dataDir, 'i18n', locale, `${kind}.json`))
      if (file) ((text[locale] ??= {}) as Json)[kind] = file
    }
  }
  return {
    pokemon: readJsonFile<string[]>(join(dataDir, 'indices/pokemon.json')).map((id) =>
      readJsonFile(join(dataDir, 'pokemon', `${id}.json`)),
    ),
    moves: readJsonFile(join(dataDir, 'moves.json')),
    abilities: readJsonFile(join(dataDir, 'abilities.json')),
    items: readJsonFile(join(dataDir, 'items.json')),
    'battle-states': readJsonIfExists(join(dataDir, 'battle-states.json')) ?? [],
    text,
  }
}

/**
 * Keeps the key order of the current record and appends new keys in schema order, so updated
 * files show only real changes.
 */
function orderKeys(record: Json, previous: Json | undefined, schemaKeys: readonly string[]): Json {
  const keys = [
    ...Object.keys(previous ?? {}).filter((key) => key in record),
    ...schemaKeys.filter((key) => key in record && !(previous && key in previous)),
    ...Object.keys(record),
  ]
  return Object.fromEntries([...new Set(keys)].map((key) => [key, record[key]]))
}

export type WriteResult = { written: string[]; deleted: string[] }

/** Writes base updates and replaces `mods/champions/`; files whose data is unchanged are kept. */
export function writeChampionsV8(dataDir: string, result: ChampionsV8): WriteResult {
  const written: string[] = []
  const write = (path: string, data: unknown) => {
    const full = join(dataDir, path)
    if (existsSync(full) && isDeepStrictEqual(readJsonFile(full), data)) return
    writeJsonFile(full, data)
    written.push(path)
  }
  const keysOf = (kind: ModdableKind) => Object.keys(moddableRecordSchemas[kind].shape)

  // ---- Base
  for (const pokemon of result.base.pokemon) {
    const path = `pokemon/${pokemon.id}.json`
    const previous = readJsonIfExists<Json>(join(dataDir, path))
    write(path, orderKeys(pokemon, previous, keysOf('pokemon')))
  }
  for (const kind of ['moves', 'abilities', 'items', 'battle-states'] as const) {
    const previous = new Map(
      (readJsonIfExists<Json[]>(join(dataDir, `${kind}.json`)) ?? []).map((r) => [r.id, r]),
    )
    write(
      `${kind}.json`,
      result.base[kind].map((record) => orderKeys(record, previous.get(record.id), keysOf(kind))),
    )
  }
  for (const [locale, files] of Object.entries(result.base.text)) {
    for (const [kind, file] of Object.entries(files ?? {}))
      write(`i18n/${locale}/${kind}.json`, file)
  }

  // ---- Mods: generated as a whole, so stale files are removed.
  const modDir = join('mods', CHAMPIONS_SET)
  const desired = new Map<string, unknown>()
  const { roster, overrides, text } = result.mods
  desired.set(join(modDir, 'roster.json'), roster)
  for (const override of overrides.pokemon ?? []) {
    desired.set(join(modDir, 'pokemon', `${override.id}.json`), override)
  }
  for (const kind of ['moves', 'abilities', 'items', 'battle-states'] as const) {
    if (overrides[kind]?.length) desired.set(join(modDir, `${kind}.json`), overrides[kind])
  }
  for (const [locale, files] of Object.entries(text)) {
    for (const [kind, file] of Object.entries(files ?? {})) {
      desired.set(join(modDir, 'i18n', locale, `${kind}.json`), file)
    }
  }

  const deleted: string[] = []
  for (const path of listFiles(join(dataDir, modDir))) {
    const rel = relative(dataDir, path)
    if (!desired.has(rel)) {
      rmSync(path)
      deleted.push(rel)
    }
  }
  for (const [path, data] of desired) write(path, data)
  return { written, deleted }
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

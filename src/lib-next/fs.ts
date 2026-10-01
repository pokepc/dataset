import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { localeCodes, type LocaleCode } from './languages'
import type { GameSetMods, GameSetSource } from './merge'
import { moddableKinds, type ModdableKind } from './schemas'

export const DATA_NEXT_ROOT = join(process.cwd(), 'data-next')

export function writeJsonFile(fullPath: string, data: unknown): void {
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`)
}

export function writeJsonDataFile(relativePath: string, data: unknown): void {
  const fullPath = join(DATA_NEXT_ROOT, relativePath)
  writeJsonFile(fullPath, data)
}

export function readJsonFile<T>(fullPath: string): T {
  return JSON.parse(readFileSync(fullPath, 'utf8')) as T
}

function readJsonIfExists<T>(fullPath: string): T | undefined {
  return existsSync(fullPath) ? readJsonFile<T>(fullPath) : undefined
}

export type LoadGameSetOptions = {
  /** Data directory holding base files and `mods/` (default: `data-next/` in the working dir). */
  dataDir?: string
  /** Kinds to load (default: every moddable kind). */
  kinds?: readonly ModdableKind[]
  /** Locales to load text for (default: every locale; `[]` loads no text). */
  locales?: readonly LocaleCode[]
}

/** Lists the game sets that have mods, i.e. a `mods/<set>/` directory. */
export function listModdedGameSets(dataDir: string = DATA_NEXT_ROOT): string[] {
  const modsDir = join(dataDir, 'mods')
  if (!existsSync(modsDir)) return []
  return readdirSync(modsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/**
 * Reads the files `mergeGameSet` needs for one game set from a v8 data directory. A set without
 * `mods/<set>/` gets base data only.
 */
export function loadGameSetSource(set: string, options: LoadGameSetOptions = {}): GameSetSource {
  const dataDir = options.dataDir ?? DATA_NEXT_ROOT
  const kinds = options.kinds ?? moddableKinds
  const locales = options.locales ?? localeCodes
  const modDir = join(dataDir, 'mods', set)

  const base: GameSetSource['base'] = {}
  const text: NonNullable<GameSetSource['text']> = {}
  const mods: Required<GameSetMods> = {
    roster: readJsonIfExists(join(modDir, 'roster.json')) ?? {},
    overrides: {},
    text: {},
  }

  for (const kind of kinds) {
    ;(base as Record<string, unknown>)[kind] =
      kind === 'pokemon'
        ? readJsonFile<string[]>(join(dataDir, 'indices', 'pokemon.json')).map((id) =>
            readJsonFile(join(dataDir, 'pokemon', `${id}.json`)),
          )
        : readJsonFile(join(dataDir, `${kind}.json`))

    const overrides =
      kind === 'pokemon'
        ? readPokemonOverrides(modDir)
        : readJsonIfExists(join(modDir, `${kind}.json`))
    if (overrides) (mods.overrides as Record<string, unknown>)[kind] = overrides

    for (const locale of locales) {
      const baseText = readJsonIfExists(join(dataDir, 'i18n', locale, `${kind}.json`))
      if (baseText) ((text[locale] ??= {}) as Record<string, unknown>)[kind] = baseText
      const modText = readJsonIfExists(join(modDir, 'i18n', locale, `${kind}.json`))
      if (modText) ((mods.text[locale] ??= {}) as Record<string, unknown>)[kind] = modText
    }
  }

  return { base, text, mods: existsSync(modDir) ? mods : undefined }
}

function readPokemonOverrides(modDir: string): unknown[] | undefined {
  const dir = join(modDir, 'pokemon')
  if (!existsSync(dir)) return undefined
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const override = readJsonFile<{ id?: unknown }>(join(dir, name))
      if (override.id !== name.slice(0, -'.json'.length)) {
        throw new Error(`Override id ${String(override.id)} does not match ${join(dir, name)}`)
      }
      return override
    })
}

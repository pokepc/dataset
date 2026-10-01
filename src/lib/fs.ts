/**
 * Node readers and writers for the v8 data directory (layout in Backlog doc-2). The directory is
 * the installed package's `data/`, or `POKEPC_DATASET_DIR` when set.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveDatasetDirectory } from '../utils/dataset-directory'
import { MemoryCache } from '../utils/memory-cache'
import { arrayUnique } from '../utils/utils-internal'
import type { CodeMapKind } from './codes'
import { localeCodes, type LocaleCode } from './languages'
import { mergeGameSet, type GameSetMods, type GameSetSource, type MergedGameSet } from './merge'
import { moddableKinds, type ModdableKind, type TextKind } from './schemas'
import type {
  Ability,
  BattleState,
  BoxPresetText,
  Character,
  ClassicBoxPresetFile,
  CodeMapEntry,
  Color,
  Game,
  Generation,
  Item,
  Language,
  Location,
  Mark,
  ModernBoxPreset,
  Move,
  Nature,
  OriginMark,
  Personality,
  Pokeball,
  Pokedex,
  Pokemon,
  Region,
  Ribbon,
  TextFile,
  Type,
} from './types'

export const DATASET_DIR = resolveDatasetDirectory(import.meta.url, process.env.POKEPC_DATASET_DIR)

const DEFAULT_CACHE_TTL = 1000 * 10 // 10 seconds
const memoryCache = new MemoryCache(DEFAULT_CACHE_TTL)
const MEMORY_CACHE_DISABLED = process.env.POKEPC_DISABLE_MEMORY_CACHE === '1'

function cached<T>(key: string, fn: () => T, ttl: number = DEFAULT_CACHE_TTL): T {
  return MEMORY_CACHE_DISABLED ? fn() : memoryCache.cached(key, fn, ttl)
}

// ---- Files

export function readJsonFile<T>(fullPath: string): T {
  return JSON.parse(readFileSync(fullPath, 'utf8')) as T
}

export function writeJsonFile(fullPath: string, data: unknown): void {
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`)
}

function readJsonIfExists<T>(fullPath: string): T | undefined {
  return existsSync(fullPath) ? readJsonFile<T>(fullPath) : undefined
}

export function absDatasetFile(fileName: string): string {
  return join(DATASET_DIR, fileName)
}

export function readDatasetFile<T>(filePath: string): T {
  return readJsonFile<T>(absDatasetFile(filePath))
}

export function writeDatasetFile(data: unknown, filePath: string, minified: boolean = false) {
  const absFilePath = absDatasetFile(filePath)
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, minified ? 0 : 2)
  mkdirSync(dirname(absFilePath), { recursive: true })
  writeFileSync(absFilePath, json)
}

// ---- Base records

export type IndexName = 'pokemon' | 'games' | 'pokedexes'

export function readIndexFile(indexName: IndexName): string[] {
  return readDatasetFile<string[]>(`indices/${indexName}.json`)
}

function joinEntityFiles<T>(kind: IndexName, ids: string[]): T[] {
  return ids.map((id) => {
    const filePath = absDatasetFile(`${kind}/${id}.json`)
    if (!existsSync(filePath)) throw new Error(`${kind} ${id} not found at ${filePath}`)
    return readJsonFile<T>(filePath)
  })
}

export function loadAllPokemon(): Pokemon[] {
  return cached('allPokemon', () => joinEntityFiles<Pokemon>('pokemon', readIndexFile('pokemon')))
}

export function loadAllGames(): Game[] {
  return cached('allGames', () => joinEntityFiles<Game>('games', readIndexFile('games')))
}

export function loadAllPokedexes(): Pokedex[] {
  return cached('allPokedexes', () =>
    joinEntityFiles<Pokedex>('pokedexes', readIndexFile('pokedexes')),
  )
}

/** Game sets: `set` records and standalone games. */
export function loadAllGameSets(): Game[] {
  return loadAllGames().filter(
    (game) => game.type === 'set' || (game.type === 'game' && !game.gameSet),
  )
}

export function regeneratePokemonIndexFile(): string[] {
  const index = arrayUnique(loadAllPokemon().flatMap((pkm) => [pkm.id, ...pkm.forms]))
  writeDatasetFile(index, 'indices/pokemon.json', false)
  return index
}

function loadCollection<T>(kind: string): T[] {
  return cached(`collection:${kind}`, () => readDatasetFile<T[]>(`${kind}.json`))
}

export const loadAllAbilities = () => loadCollection<Ability>('abilities')
export const loadAllBattleStates = () => loadCollection<BattleState>('battle-states')
export const loadAllCharacters = () => loadCollection<Character>('characters')
export const loadAllColors = () => loadCollection<Color>('colors')
export const loadAllGenerations = () => loadCollection<Generation>('generations')
export const loadAllItems = () => loadCollection<Item>('items')
export const loadAllLanguages = () => loadCollection<Language>('languages')
export const loadAllLocations = () => loadCollection<Location>('locations')
export const loadAllMarks = () => loadCollection<Mark>('marks')
export const loadAllMoves = () => loadCollection<Move>('moves')
export const loadAllNatures = () => loadCollection<Nature>('natures')
export const loadAllOriginMarks = () => loadCollection<OriginMark>('originmarks')
export const loadAllPersonalities = () => loadCollection<Personality>('personalities')
export const loadAllPokeballs = () => loadCollection<Pokeball>('pokeballs')
export const loadAllRegions = () => loadCollection<Region>('regions')
export const loadAllRibbons = () => loadCollection<Ribbon>('ribbons')
export const loadAllTypes = () => loadCollection<Type>('types')

// ---- Box presets

/** Classic presets of one game set (`boxpresets/classic/<set>.json`), keyed by preset id. */
export function loadClassicBoxPresets(set: string): ClassicBoxPresetFile {
  return (
    readJsonIfExists<ClassicBoxPresetFile>(absDatasetFile(`boxpresets/classic/${set}.json`)) ?? {}
  )
}

/** Modern presets of one game set, in index order. */
export function loadModernBoxPresets(set: string): ModernBoxPreset[] {
  const index = readJsonIfExists<string[]>(absDatasetFile(`boxpresets/modern/${set}.json`)) ?? []
  return index.map((id) => readDatasetFile<ModernBoxPreset>(`boxpresets/modern/${set}/${id}.json`))
}

// ---- Text

/** Base text of one kind in one locale (`i18n/<locale>/<kind>.json`); `{}` when there is none. */
export function loadText<K extends TextKind>(kind: K, locale: LocaleCode): TextFile<K> {
  return cached(
    `text:${locale}:${kind}`,
    () => readJsonIfExists<TextFile<K>>(absDatasetFile(`i18n/${locale}/${kind}.json`)) ?? {},
  )
}

export function loadBoxPresetText(
  variant: 'classic' | 'modern',
  set: string,
  locale: LocaleCode,
): Record<string, BoxPresetText> {
  return (
    readJsonIfExists<Record<string, BoxPresetText>>(
      absDatasetFile(`i18n/${locale}/boxpresets/${variant}/${set}.json`),
    ) ?? {}
  )
}

/** Game-independent species prose (Markdown), when written for that locale. */
export function loadPokemonProse(id: string, locale: LocaleCode): string | undefined {
  const path = absDatasetFile(`i18n/${locale}/pokemon-prose/${id}.md`)
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined
}

// ---- Code maps

/** The code map of a kind, or an empty map when it has not been created yet. */
export function loadCodeMap(kind: CodeMapKind): CodeMapEntry[] {
  return readJsonIfExists<CodeMapEntry[]>(absDatasetFile(`codes/${kind}.json`)) ?? []
}

/** The ids a code map must cover, in the order new codes are assigned. */
export function loadCodeMapLiveIds(kind: CodeMapKind): string[] {
  if (kind === 'pokemon') return readIndexFile('pokemon')
  return readDatasetFile<Array<{ id: string }>>(`${kind}.json`).map((record) => record.id)
}

// ---- Game sets

export type LoadGameSetOptions = {
  /** Data directory holding base files and `mods/` (default: the dataset directory). */
  dataDir?: string
  /** Kinds to load (default: every moddable kind). */
  kinds?: readonly ModdableKind[]
  /** Locales to load text for (default: every locale; `[]` loads no text). */
  locales?: readonly LocaleCode[]
}

/** Lists the game sets that have mods, i.e. a `mods/<set>/` directory. */
export function listModdedGameSets(dataDir: string = DATASET_DIR): string[] {
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
  const dataDir = options.dataDir ?? DATASET_DIR
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

/** Loads and merges one game set (`mergeGameSet(loadGameSetSource(set, options))`). */
export function loadGameSet(set: string, options: LoadGameSetOptions = {}): MergedGameSet {
  return mergeGameSet(loadGameSetSource(set, options))
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

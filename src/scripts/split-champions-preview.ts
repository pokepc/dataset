/**
 * One-time split of the full-record Champions preview (`data-next/champions/`) into v8 base
 * updates and `mods/champions/` (Backlog task-5). Ongoing updates come from the Champions tool.
 *
 * The preview's `pt-br` text is a copy of English made by the old parser, not official text, so it
 * is not carried over (no language fallback, decision-2).
 *
 * Checks: every mod file validates, and merging base + mods reproduces the preview apart from the
 * representation changes documented in `diffMergedChampions`. Then the preview is removed.
 *
 * Usage: bun src/scripts/split-champions-preview.ts [--data-dir=data-next], then `pnpm format`.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { z } from 'zod'
import { loadGameSetSource, readJsonFile } from '../lib-next/fs'
import { localeCodes, type LocaleCode } from '../lib-next/languages'
import { mergeGameSet } from '../lib-next/merge'
import {
  moddableOverrideSchemas,
  moddableTextOverrideFileSchemas,
  rosterSchema,
  textFileSchemas,
  type ModdableKind,
} from '../lib-next/schemas'
import {
  CHAMPIONS_SET,
  championsToV8,
  diffMergedChampions,
  type ChampionsDump,
  type ChampionsLocaleText,
} from '../upstream-adapters/projectpokemon-champout/to-v8'
import {
  readModdableBase,
  writeChampionsV8,
} from '../upstream-adapters/projectpokemon-champout/v8-files'

const dataArg = process.argv.find((arg) => arg.startsWith('--data-dir='))
const DATA_DIR = resolve(dataArg?.slice('--data-dir='.length) ?? 'data-next')
const PREVIEW_DIR = join(DATA_DIR, 'champions')
/** Locales the preview filled with English copies. */
const COPIED_LOCALES: LocaleCode[] = ['pt-br']

function readPreview(): ChampionsDump {
  const read = <T>(file: string) => readJsonFile<T>(join(PREVIEW_DIR, file))
  const i18n: ChampionsDump['i18n'] = {}
  for (const locale of localeCodes) {
    const dir = join(PREVIEW_DIR, 'i18n', locale)
    if (!existsSync(dir) || COPIED_LOCALES.includes(locale)) continue
    const readText = <K extends keyof ChampionsLocaleText>(file: string) =>
      readJsonFile<NonNullable<ChampionsLocaleText[K]>>(join(dir, file))
    i18n[locale] = {
      pokemon: readText<'pokemon'>('pokemon.json'),
      moves: readText<'moves'>('moves.json'),
      abilities: readText<'abilities'>('abilities.json'),
      items: readText<'items'>('items.json'),
      battleStates: readText<'battleStates'>('battle-states.json'),
    }
  }
  return {
    pokemon: read('pokemon.json'),
    pokemonMoves: read('pokemon-moves.json'),
    moves: read('moves.json'),
    abilities: read('abilities.json'),
    items: read('items.json'),
    battleStates: read('battle-states.json'),
    i18n,
  }
}

function fail(label: string, problems: string[]): never {
  throw new Error(`${label}: ${problems.length} problem(s)\n${problems.slice(0, 30).join('\n')}`)
}

function issues(path: string, schema: z.ZodType, data: unknown): string[] {
  const result = schema.safeParse(data)
  return result.success
    ? []
    : result.error.issues
        .slice(0, 3)
        .map((issue) => `${path} ${issue.path.join('.')}: ${issue.message}`)
}

function validateModFiles() {
  const modDir = join(DATA_DIR, 'mods', CHAMPIONS_SET)
  const problems = issues('roster', rosterSchema, readJsonFile(join(modDir, 'roster.json')))
  for (const file of readdirSync(join(modDir, 'pokemon'))) {
    problems.push(
      ...issues(
        `pokemon/${file}`,
        moddableOverrideSchemas.pokemon,
        readJsonFile(join(modDir, 'pokemon', file)),
      ),
    )
  }
  for (const kind of ['moves', 'abilities', 'items', 'battle-states'] as const) {
    const path = join(modDir, `${kind}.json`)
    if (!existsSync(path)) continue
    readJsonFile<unknown[]>(path).forEach((override, index) =>
      problems.push(...issues(`${kind}[${index}]`, moddableOverrideSchemas[kind], override)),
    )
  }
  for (const locale of localeCodes) {
    for (const [root, schemas, label] of [
      [join(modDir, 'i18n', locale), moddableTextOverrideFileSchemas, 'mod'],
      [join(DATA_DIR, 'i18n', locale), textFileSchemas, 'base'],
    ] as const) {
      for (const kind of [
        'pokemon',
        'moves',
        'abilities',
        'items',
        'battle-states',
      ] as ModdableKind[]) {
        const path = join(root, `${kind}.json`)
        if (existsSync(path))
          problems.push(...issues(`${label} ${locale}/${kind}`, schemas[kind], readJsonFile(path)))
      }
    }
  }
  if (problems.length > 0) fail('mod and text files validate', problems)
  console.log('✓ mod and text files validate against the v8 schemas')
}

if (!existsSync(PREVIEW_DIR)) {
  console.log(`No preview at ${PREVIEW_DIR}; nothing to split.`)
  process.exit(0)
}

const dump = readPreview()
const result = championsToV8(dump, readModdableBase(DATA_DIR))
const { written, deleted } = writeChampionsV8(DATA_DIR, result)
console.log(`Wrote ${written.length} files, deleted ${deleted.length}`)

validateModFiles()
const merged = mergeGameSet(loadGameSetSource(CHAMPIONS_SET, { dataDir: DATA_DIR }))
console.log('✓ merged champions records validate against the v8 schemas')
const problems = diffMergedChampions(dump, merged)
if (problems.length > 0) fail('merged champions reproduces the preview', problems)
console.log('✓ merged champions reproduces the preview')

rmSync(PREVIEW_DIR, { recursive: true })
console.log(`Removed ${PREVIEW_DIR}`)

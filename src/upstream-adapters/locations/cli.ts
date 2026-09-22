import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { format } from 'oxfmt'
import { z } from 'zod'
import { locationSchema } from '../../lib/schemas.ts'
import { resolveDatasetDirectory } from '../../utils/dataset-directory.ts'
import { SourceCache } from './cache.ts'
import { fetchCandidates, pokeApiRevision } from './fetch.ts'
import { normalizeLocations } from './normalize.ts'
import {
  aliases,
  canonicalNames,
  gameEvidence,
  primaryPokeApiIds,
  sourceOverrides,
} from './overrides.ts'
import type { Game } from './types.ts'
import { locationExceptions } from './exceptions.ts'

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args: args.filter((arg, i) => !(i === 0 && arg === '--')),
    options: {
      write: { type: 'boolean' },
      offline: { type: 'boolean' },
      refresh: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(
      'Usage: pnpm locations:import [--write] [--offline | --refresh]\nPreview by default. Reports and source cache: .local/locations (LOCATIONS_CACHE_DIR overrides).\nPOKEPC_DATASET_DIR selects another dataset. --write refuses source failures and unreviewed removals.',
    )
    return
  }
  if (values.offline && values.refresh)
    throw new Error('--offline and --refresh cannot be combined')
  const data = resolveDatasetDirectory(import.meta.url, process.env.POKEPC_DATASET_DIR)
  const outputPath = resolve(data, 'locations.json')
  const original = await readFile(outputPath, 'utf8')
  const gameIds: string[] = JSON.parse(await readFile(resolve(data, 'indices/games.json'), 'utf8'))
  const games: Game[] = await Promise.all(
    gameIds.map(async (id) =>
      JSON.parse(await readFile(resolve(data, 'games', `${id}.json`), 'utf8')),
    ),
  )
  const regions: { id: string }[] = JSON.parse(
    await readFile(resolve(data, 'regions.json'), 'utf8'),
  )
  const directory = resolve(process.env.LOCATIONS_CACHE_DIR ?? '.local/locations')
  const cache = new SourceCache(directory, values.offline, values.refresh)
  const fetched = await fetchCandidates(cache, games)
  const result = normalizeLocations(fetched.candidates, games, regions)
  z.array(locationSchema).min(1).parse(result.locations)
  const seenIds = new Set<string>()
  const seenPokeApiIds = new Set<number>()
  for (const location of result.locations) {
    if (seenIds.has(location.id)) throw new Error(`Duplicate output ID: ${location.id}`)
    seenIds.add(location.id)
    if (location.pokeApiId !== null) {
      if (seenPokeApiIds.has(location.pokeApiId))
        throw new Error(`Duplicate output PokéAPI ID: ${location.pokeApiId}`)
      seenPokeApiIds.add(location.pokeApiId)
    }
  }
  const previous: { id: string }[] = JSON.parse(original)
  const removed = previous
    .filter((location) => !seenIds.has(location.id))
    .map((location) => location.id)
  const summary = {
    candidates: fetched.candidates.length,
    locations: result.locations.length,
    mappedToPokeApi: seenPokeApiIds.size,
    excludedCandidates: result.excluded.length,
    unresolvedCandidates: result.unresolved.length,
    unresolvedLocations: new Set(result.unresolved.map((row) => row.id)).size,
    fetchFailures: fetched.failures.length,
    removed,
    regions: Object.fromEntries(
      [null, ...regions.map((region) => region.id)].map((region) => [
        region ?? 'general',
        result.locations.filter((location) => location.region === region).length,
      ]),
    ),
  }
  await mkdir(directory, { recursive: true })
  const report = {
    summary,
    pokeApiRevision,
    sourceHashes: Object.fromEntries(
      [...cache.hashes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
    decisions: {
      aliases,
      canonicalNames,
      gameEvidence,
      primaryPokeApiIds,
      sourceOverrides,
      locationExceptions,
    },
    failures: fetched.failures,
    unresolved: result.unresolved,
    excluded: result.excluded,
    provenance: result.provenance,
  }
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  const formatConfig = JSON.parse(
    await readFile(new URL('../../../.oxfmtrc.json', import.meta.url), 'utf8'),
  )
  const formatted = await format(
    outputPath,
    JSON.stringify(result.locations, null, 2),
    formatConfig,
  )
  if (formatted.errors.length)
    throw new Error(`Location formatting failed: ${JSON.stringify(formatted.errors)}`)
  await writeFile(resolve(directory, 'candidate.json'), formatted.code)
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Review report: ${resolve(directory, 'report.json')}`)
  if (values.write) {
    if (fetched.failures.length)
      throw new Error('Source failures prevent writing; inspect the report.')
    if (removed.length)
      throw new Error(`Unreviewed removals prevent writing: ${removed.join(', ')}`)
    if ((await readFile(outputPath, 'utf8')) !== original)
      throw new Error('locations.json changed during import; rerun before writing.')
    if (original !== formatted.code) {
      const temporary = `${outputPath}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, formatted.code)
        await rename(temporary, outputPath)
      } finally {
        await rm(temporary, { force: true })
      }
      console.log(`Wrote ${result.locations.length} locations.`)
    } else console.log('locations.json is unchanged.')
  } else console.log('Preview only; pass --write to update locations.json.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

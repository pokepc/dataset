import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { format } from 'oxfmt'
import { encountersSchema } from '../../lib/schemas.ts'
import { resolveDatasetDirectory } from '../../utils/dataset-directory.ts'
import { SourceCache } from '../locations/cache.ts'
import { pokeApiRevision } from '../locations/fetch.ts'
import { excludedPokeApiLocations, pokeApiLocationAliases } from './overrides.ts'
import {
  encounterCsvFiles,
  parsePokeApiEncounters,
  type EncounterGame,
  type EncounterPokemon,
} from './pokeapi.ts'

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8'))

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args: args.filter((arg, i) => !(i === 0 && arg === '--')),
    options: {
      write: { type: 'boolean' },
      offline: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(
      'Usage: pnpm encounters:import [--write] [--offline]\nPreview by default. Report and source cache: .local/encounters (ENCOUNTERS_CACHE_DIR overrides).\nPOKEPC_DATASET_DIR selects another dataset. --write replaces data/encounters/.',
    )
    return
  }
  const data = resolveDatasetDirectory(import.meta.url, process.env.POKEPC_DATASET_DIR)
  const gameIds = await readJson<string[]>(resolve(data, 'indices/games.json'))
  const games = await Promise.all(
    gameIds.map((id) => readJson<EncounterGame>(resolve(data, 'games', `${id}.json`))),
  )
  const pokemonFiles = (await readdir(resolve(data, 'pokemon'))).filter((f) => f.endsWith('.json'))
  const pokemon = await Promise.all(
    pokemonFiles.map((file) => readJson<EncounterPokemon>(resolve(data, 'pokemon', file))),
  )
  const locations = await readJson<{ id: string; pokeApiId: number | null }[]>(
    resolve(data, 'locations.json'),
  )

  const directory = resolve(process.env.ENCOUNTERS_CACHE_DIR ?? '.local/encounters')
  const cache = new SourceCache(directory, values.offline)
  const csv: Record<string, string> = {}
  for (const file of encounterCsvFiles) {
    csv[file] = await cache.text(
      `https://raw.githubusercontent.com/PokeAPI/pokeapi/${pokeApiRevision}/data/v2/csv/${file}.csv`,
    )
  }
  const result = parsePokeApiEncounters(csv, { games, locations, pokemon })
  for (const [id, encounters] of result.encounters) {
    const parsed = encountersSchema.min(1).safeParse(encounters)
    if (!parsed.success) throw new Error(`Invalid encounters for ${id}: ${parsed.error.message}`)
  }

  const summary = {
    rows: result.rows,
    importedRows: result.importedRows,
    excludedRows: result.excludedRows,
    unresolvedRows: result.unresolved.reduce((sum, entry) => sum + entry.rows, 0),
    pokemon: result.encounters.size,
    encounters: [...result.encounters.values()].reduce((sum, list) => sum + list.length, 0),
  }
  await mkdir(directory, { recursive: true })
  await writeFile(
    resolve(directory, 'report.json'),
    JSON.stringify(
      {
        summary,
        pokeApiRevision,
        sourceHashes: Object.fromEntries([...cache.hashes].sort()),
        decisions: { pokeApiLocationAliases, excludedPokeApiLocations },
        unresolved: result.unresolved,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Review report: ${resolve(directory, 'report.json')}`)
  if (!values.write) {
    console.log('Preview only; pass --write to replace data/encounters/.')
    return
  }

  const formatConfig = await readJson<Record<string, unknown>>(
    fileURLToPath(new URL('../../../.oxfmtrc.json', import.meta.url)),
  )
  const outputDirectory = resolve(data, 'encounters')
  await mkdir(outputDirectory, { recursive: true })
  const written = new Set<string>()
  for (const [id, encounters] of result.encounters) {
    const path = resolve(outputDirectory, `${id}.json`)
    const formatted = await format(path, JSON.stringify(encounters, null, 2), formatConfig)
    if (formatted.errors.length)
      throw new Error(`Encounter formatting failed: ${JSON.stringify(formatted.errors)}`)
    await writeFile(path, formatted.code)
    written.add(`${id}.json`)
  }
  for (const file of await readdir(outputDirectory)) {
    if (file.endsWith('.json') && !written.has(file)) await rm(resolve(outputDirectory, file))
  }
  console.log(`Wrote encounters for ${written.size} Pokémon.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

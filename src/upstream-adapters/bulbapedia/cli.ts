import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  availabilityJson,
  bulbapediaUrl,
  formatAvailabilityChanges,
  formatAvailabilityTable,
  parseAvailability,
  resolvePokemon,
  type AvailabilityGame,
  type AvailabilityPokemon,
} from './availability.ts'

const datasetRoot = fileURLToPath(new URL('../../../data/', import.meta.url))
const help = `Usage: pnpm pokemon:availability <id|nid> [--json] [--patch] [--html <file>]

Examples:
  pnpm pokemon:availability pikachu
  pnpm pokemon:availability 0026-alola
  pnpm --silent pokemon:availability 25 --json
  pnpm pokemon:availability pikachu --patch
  pnpm pokemon:availability raichu --html /tmp/raichu.html

Print one row per concrete dataset game, folding DLC into its parent games.
--json         Print candidate id/nid and availability fields; diagnostics go to stderr.
--patch        Update and format the Pokémon JSON; print added/removed games per field.
               Overrides --json and table output. Uses the repository's Oxfmt config.
--html <file>  Parse a saved Bulbapedia species page instead of fetching it.
--help, -h     Show this help.

Existing values are retained where the source is inconclusive. storableIn is
always preserved. Files are modified only with --patch. No AI or API key is required.`

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function readCollection<T>(root: string, collection: string): Promise<T[]> {
  const ids = await readJson<string[]>(resolve(root, 'indices', `${collection}.json`))
  return Promise.all(ids.map((id) => readJson<T>(resolve(root, collection, `${id}.json`))))
}

export async function fetchSpeciesPage(url: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'PokePC-Dataset-Availability/1.0 (+https://github.com/pokepc/dataset)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not fetch Bulbapedia: ${reason}. Check the network, or use --html with a saved species page.`,
      { cause: error },
    )
  }
  if (!response.ok)
    throw new Error(
      `Bulbapedia returned HTTP ${response.status}. Use --html with a saved species page if access is blocked.`,
    )
  const html = await response.text()
  if (!/\bid=["']Game_locations["']/.test(html))
    throw new Error(
      'Bulbapedia did not return a species page with Game locations. Use --html with a saved species page.',
    )
  return html
}

export async function main(
  args = process.argv.slice(2),
  dataDirectory = datasetRoot,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args: args.filter((arg, index) => !(index === 0 && arg === '--')),
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      patch: { type: 'boolean' },
      html: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  if (positionals.length !== 1) throw new Error(`Expected one Pokémon id or nid.\n\n${help}`)
  const [pokemon, games] = await Promise.all([
    readCollection<AvailabilityPokemon>(dataDirectory, 'pokemon'),
    readCollection<AvailabilityGame>(dataDirectory, 'games'),
  ])
  const selected = resolvePokemon(positionals[0], pokemon)
  const url = bulbapediaUrl(selected)
  const html = values.html
    ? await readFile(resolve(values.html), 'utf8')
    : await fetchSpeciesPage(url)
  const report = parseAvailability(
    html,
    selected,
    games,
    pokemon.filter((entry) => entry.dexNum === selected.dexNum),
  )
  if (values.json && !values.patch)
    console.error(
      `Source: ${url}#Game_locations${values.html ? ` (saved HTML: ${resolve(values.html)})` : ''}`,
    )
  for (const warning of report.warnings) console.error(`Warning: ${warning}`)
  if (values.patch) {
    const { patchPokemonFile } = await import('./patch.ts')
    const file = resolve(dataDirectory, 'pokemon', `${selected.id}.json`)
    const changed = await patchPokemonFile(file, report)
    console.log(
      `${changed ? `Patched and formatted: ${file}` : `Already up to date: ${file}`}\n\n${formatAvailabilityChanges(report)}`,
    )
    return
  }
  if (values.json) console.log(JSON.stringify(availabilityJson(report), null, 2))
  else
    console.log(
      `${selected.names.eng ?? selected.id} (${selected.id} / ${selected.nid})\nSource: ${url}#Game_locations\n\n${formatAvailabilityTable(report)}`,
    )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

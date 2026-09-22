import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { parseArgs, styleText } from 'node:util'
import { fetchAvailabilityPage } from './fetch.ts'
import {
  availabilityJson,
  availabilityUrls,
  createAvailabilityReport,
  formatAvailabilityChanges,
  formatAvailabilityTable,
  parseAvailabilityTables,
  resolvePokemon,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityTables,
} from './availability.ts'

export const datasetRoot = fileURLToPath(new URL('../../../data/', import.meta.url))
const help = `Usage: pnpm pokemon:availability <id|nid> [--json] [--patch] [--html <file> --go-html <file>]

Examples:
  pnpm pokemon:availability pikachu
  pnpm pokemon:availability 0026-alola
  pnpm --silent pokemon:availability 25 --json
  pnpm pokemon:availability pikachu --patch
  pnpm pokemon:availability raichu --html /tmp/availability.html --go-html /tmp/go.html

Read Bulbapedia's complete main-game and Pokémon GO availability tables.
--json             Print id/nid and availability fields; diagnostics go to stderr.
--patch            Update and format the Pokémon JSON; print added/removed games per field.
                   Overrides --json and table output. Uses the repository's Oxfmt config.
--html <file>      Read the saved main availability table page.
--go-html <file>   Read the saved Pokémon GO availability page. Requires --html and vice versa.
                   Together these options run fully offline and bypass the cache.
--refresh-sources  Refresh both cached Bulbapedia table pages.
--help, -h         Show this help.

Only these two Bulbapedia sources are used. No AI or API key is required.
Unmatched forms and games outside the tables retain their existing values with diagnostics.
storableIn membership is always preserved. Files are modified only with --patch.`

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

export async function readCollection<T>(root: string, collection: string): Promise<T[]> {
  const ids = await readJson<string[]>(resolve(root, 'indices', `${collection}.json`))
  return Promise.all(ids.map((id) => readJson<T>(resolve(root, collection, `${id}.json`))))
}

export type SourceOptions = {
  html?: string
  goHtml?: string
  refreshSources?: boolean
}

export function validateSourceOptions(options: SourceOptions): void {
  if ((options.html === undefined) !== (options.goHtml === undefined))
    throw new Error('--html and --go-html must be supplied together for a fully offline run.')
}

/** Load each full-list page once; a bulk run shares the resulting parsed tables. */
export async function loadAvailabilityTables(
  options: SourceOptions = {},
  signal?: AbortSignal,
): Promise<AvailabilityTables> {
  validateSourceOptions(options)
  signal?.throwIfAborted()
  const [main, go] =
    options.html !== undefined && options.goHtml !== undefined
      ? await Promise.all([
          readFile(resolve(options.html), { encoding: 'utf8', signal }),
          readFile(resolve(options.goHtml), { encoding: 'utf8', signal }),
        ])
      : await Promise.all([
          fetchAvailabilityPage('main', signal, { forceRefresh: options.refreshSources }),
          fetchAvailabilityPage('go', signal, { forceRefresh: options.refreshSources }),
        ])
  signal?.throwIfAborted()
  return parseAvailabilityTables({ main, go })
}

export function formatAvailabilitySources(options: SourceOptions = {}): string {
  return `Sources:\n  ${availabilityUrls.main}${options.html !== undefined ? ` (saved HTML: ${resolve(options.html)})` : ''}\n  ${availabilityUrls.go}${options.goHtml !== undefined ? ` (saved HTML: ${resolve(options.goHtml)})` : ''}`
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
      'go-html': { type: 'string' },
      'refresh-sources': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  if (positionals.length !== 1) throw new Error(`Expected one Pokémon id or nid.\n\n${help}`)
  const sourceOptions = {
    html: values.html,
    goHtml: values['go-html'],
    refreshSources: values['refresh-sources'],
  }
  validateSourceOptions(sourceOptions)
  const [pokemon, games] = await Promise.all([
    readCollection<AvailabilityPokemon>(dataDirectory, 'pokemon'),
    readCollection<AvailabilityGame>(dataDirectory, 'games'),
  ])
  const selected = resolvePokemon(positionals[0], pokemon)
  const tables = await loadAvailabilityTables(sourceOptions)
  const report = createAvailabilityReport(
    tables,
    selected,
    games,
    pokemon.filter((entry) => entry.dexNum === selected.dexNum),
  )
  if (values.json && !values.patch) console.error(formatAvailabilitySources(sourceOptions))
  for (const warning of report.warnings)
    console.error(styleText('yellow', `Warning: ${warning}`, { stream: process.stderr }))
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
      `${selected.names.eng ?? selected.id} (${selected.id} / ${selected.nid})\n${formatAvailabilitySources(sourceOptions)}\n\n${formatAvailabilityTable(report)}`,
    )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(
      styleText('red', error instanceof Error ? error.message : String(error), {
        stream: process.stderr,
      }),
    )
    process.exitCode = 1
  })
}

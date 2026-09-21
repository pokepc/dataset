import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createAvailabilityCrossChecker, formatCrossChecks } from './cross-check.ts'
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

export const datasetRoot = fileURLToPath(new URL('../../../data/', import.meta.url))
const help = `Usage: pnpm pokemon:availability <id|nid> [--json] [--patch] [--with-ai] [--html <file>]

Examples:
  pnpm pokemon:availability pikachu
  pnpm pokemon:availability 0026-alola
  pnpm --silent pokemon:availability 25 --json
  pnpm pokemon:availability pikachu --patch
  pnpm pokemon:availability pikachu --with-ai --patch
  pnpm pokemon:availability raichu --html /tmp/raichu.html

Print one row per concrete dataset game, folding DLC into its parent games.
--json         Print candidate id/nid and availability fields; diagnostics go to stderr.
--patch        Update and format the Pokémon JSON; print added/removed games per field.
               Overrides --json and table output. Uses the repository's Oxfmt config.
--with-ai      Verify input, source HTML, and output with GPT-5.6 Terra before proceeding.
               Use its final candidate; explain differences from the parser in at most 25 words.
               Requires OPENAI_API_KEY (environment or repository .env); review goes to stderr.
--html <file>  Parse a saved Bulbapedia species page instead of fetching it.
--no-cross-check  Use Bulbapedia alone (also needed for fully offline --html runs).
--refresh-sources Refresh cached Bulbapedia, PokéAPI, and targeted Serebii evidence.
--help, -h     Show this help.

Every lookup cross-checks cached PokéAPI encounters and collects targeted Serebii evidence.
Unresolved source conflicts block patching until a successful AI review resolves them.
Existing values are retained where the source is inconclusive. storableIn is
always preserved. Files are modified only with --patch. No AI or API key is required
unless --with-ai is supplied. Failed or uncertain AI reviews prevent output and patching.`

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

export async function readCollection<T>(root: string, collection: string): Promise<T[]> {
  const ids = await readJson<string[]>(resolve(root, 'indices', `${collection}.json`))
  return Promise.all(ids.map((id) => readJson<T>(resolve(root, collection, `${id}.json`))))
}

export async function fetchSpeciesPage(
  url: string,
  signal?: AbortSignal,
  options: { cacheDir?: string; forceRefresh?: boolean } = {},
): Promise<string> {
  signal?.throwIfAborted()
  const cacheDir =
    options.cacheDir ??
    process.env.BULBAPEDIA_CACHE_DIR ??
    fileURLToPath(new URL('../../../.local/bulbapedia/', import.meta.url))
  const key = createHash('sha256').update(url).digest('hex')
  const cacheFile = resolve(cacheDir, `${key}.json`)
  const hasLocations = (html: string) => /\bid=["']Game_locations["']/.test(html)
  if (!options.forceRefresh) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf8'))
      signal?.throwIfAborted()
      if (
        cached?.version === 1 &&
        cached.url === url &&
        typeof cached.html === 'string' &&
        hasLocations(cached.html)
      )
        return cached.html
    } catch (error) {
      signal?.throwIfAborted()
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError))
        throw error
    }
  }
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
    : AbortSignal.timeout(30_000)
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'PokePC-Dataset-Availability/1.0 (+https://github.com/pokepc/dataset)',
        Accept: 'text/html',
      },
      signal: requestSignal,
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
  if (!hasLocations(html))
    throw new Error(
      'Bulbapedia did not return a species page with Game locations. Use --html with a saved species page.',
    )
  requestSignal.throwIfAborted()
  await mkdir(cacheDir, { recursive: true })
  const temporary = `${cacheFile}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, url, html }), 'utf8')
    requestSignal.throwIfAborted()
    await rename(temporary, cacheFile)
  } finally {
    await rm(temporary, { force: true })
  }
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
      'with-ai': { type: 'boolean' },
      html: { type: 'string' },
      'no-cross-check': { type: 'boolean' },
      'refresh-sources': { type: 'boolean' },
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
    : await fetchSpeciesPage(url, undefined, { forceRefresh: values['refresh-sources'] })
  let report = parseAvailability(
    html,
    selected,
    games,
    pokemon.filter((entry) => entry.dexNum === selected.dexNum),
  )
  if (!values['no-cross-check']) {
    console.error('Cross-checking cached PokéAPI encounters and targeted Serebii evidence…')
    const crossCheck = createAvailabilityCrossChecker({
      pokeApi: { forceRefresh: values['refresh-sources'] },
      serebii: { forceRefresh: values['refresh-sources'] },
    })
    report = await crossCheck(
      report,
      games,
      pokemon.filter((entry) => entry.dexNum === selected.dexNum),
    )
    console.error(formatCrossChecks(report))
  }
  if (values.json && !values.patch)
    console.error(
      `Source: ${url}#Game_locations${values.html ? ` (saved HTML: ${resolve(values.html)})` : ''}`,
    )
  for (const warning of report.warnings) console.error(`Warning: ${warning}`)
  if (values['with-ai']) {
    const { verifyAvailabilityWithAi, applyAiReview, formatAiReview, VERIFICATION_MODEL } =
      await import('./ai-verification.ts')
    console.error(`Verifying input and candidate JSON with ${VERIFICATION_MODEL}…`)
    const review = await verifyAvailabilityWithAi(report, html, games)
    console.error(formatAiReview(review))
    if (review.verdict !== 'pass')
      throw new Error(`AI verification ${review.verdict}; no output or patch was applied.`)
    report = applyAiReview(report, review)
  }
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

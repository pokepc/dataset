import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { parseArgs, styleText } from 'node:util'
import {
  datasetRoot,
  formatAvailabilitySources,
  loadAvailabilityTables,
  readCollection,
  validateSourceOptions,
  type SourceOptions,
} from './cli.ts'
import {
  availabilityChanges,
  createAvailabilityReport,
  formatAvailabilityProposal,
  resolvePokemon,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityReport,
} from './availability.ts'
import { patchPokemonFile } from './patch.ts'

const help = `Usage: pnpm pokemon:availability:all [--from <id|nid>] [--patch-all | --dry-run] [--skip-unchanged]

Review every Pokémon, including forms, in dataset index order.
Fetch and parse the two complete Bulbapedia availability lists once per run.
For each Pokémon, inspect the proposed availability changes, then type:
  p  Patch and format the file, then advance.
  s  Skip without changes, then advance.

Ctrl+C stops the review. Completed patches remain saved.
--patch-all       Patch and format automatically; stop at the first lookup or patch error.
--dry-run         Review the entire range without prompts or writes; summarize changes and warnings.
                  Cannot be combined with --patch-all.
--from <id|nid>   Start at this Pokémon (inclusive), bypassing earlier records.
--skip-unchanged  Advance without prompting when no availability membership changes.
--html <file>    Read the saved main availability page; requires --go-html.
--go-html <file> Read the saved GO availability page; requires --html.
                  Both saved pages make the run fully offline and bypass the cache.
--refresh-sources Refresh both cached Bulbapedia availability pages.
--help, -h       Show this help.

Only these two Bulbapedia sources are used. No AI or API key is required.
Warnings remain visible even for unchanged records; unmatched forms retain their current values.
storableIn membership is always preserved.`

type ReviewIO = {
  write: (message: string) => void
  read: (prompt: string) => Promise<string | null>
}

type ReviewOptions = SourceOptions & {
  from?: string
  patchAll?: boolean
  dryRun?: boolean
  skipUnchanged?: boolean
}

/** Share parsed tables across every record; only patch/skip orchestration is interactive. */
export async function reviewDataset(
  dataDirectory: string,
  io: ReviewIO,
  signal: AbortSignal,
  options: ReviewOptions = {},
): Promise<{ blocked: boolean }> {
  validateSourceOptions(options)
  if (options.patchAll && options.dryRun)
    throw new Error('--dry-run cannot be combined with --patch-all.')
  const [pokemon, games] = await Promise.all([
    readCollection<AvailabilityPokemon>(dataDirectory, 'pokemon'),
    readCollection<AvailabilityGame>(dataDirectory, 'games'),
  ])
  const startIndex =
    options.from === undefined ? 0 : pokemon.indexOf(resolvePokemon(options.from, pokemon))
  if (options.from !== undefined)
    io.write(`Starting at ${pokemon[startIndex].id}; ${startIndex} earlier records bypassed.`)
  io.write(formatAvailabilitySources(options))
  let tables: Awaited<ReturnType<typeof loadAvailabilityTables>>
  try {
    tables = await loadAvailabilityTables(options, signal)
  } catch (error) {
    if (!signal.aborted) throw error
    io.write('\nStopped: 0 patched, 0 already up to date, 0 skipped.')
    return { blocked: false }
  }
  const siblings = new Map<AvailabilityPokemon['dexNum'], AvailabilityPokemon[]>()
  for (const entry of pokemon) {
    const group = siblings.get(entry.dexNum) ?? []
    group.push(entry)
    siblings.set(entry.dexNum, group)
  }
  let patched = 0
  let unchanged = 0
  let skipped = 0
  let reviewed = 0
  let changed = 0
  let warned = 0
  let failed = 0
  let stopped = false
  let blocked = false
  const stopAtBlocker = (id: string, reason: string) => {
    stopped = true
    blocked = true
    io.write(styleText('red', `Automatic patching stopped at ${id}: ${reason}`))
    io.write(`Review this Pokémon with --from ${id} without --patch-all.`)
  }

  nextPokemon: for (let index = startIndex; index < pokemon.length; index++) {
    if (signal.aborted) break
    const selected = pokemon[index]
    io.write(
      `\n[${index + 1}/${pokemon.length}] ${selected.names.eng ?? selected.id} (${selected.id} / ${selected.nid})`,
    )
    let report: AvailabilityReport | undefined
    try {
      report = createAvailabilityReport(tables, selected, games, siblings.get(selected.dexNum))
      reviewed++
      if (report.warnings.length) warned++
      for (const warning of report.warnings) io.write(styleText('yellow', `Warning: ${warning}`))
      const hasChanges = availabilityChanges(report).some(
        ({ added, removed }) => added.length || removed.length,
      )
      if (options.dryRun) {
        if (hasChanges) changed++
        else unchanged++
        io.write(`\n${formatAvailabilityProposal(report)}\n`)
        continue nextPokemon
      }
      if (options.skipUnchanged && !hasChanges) {
        unchanged++
        io.write('Proposed changes: none.')
        io.write(`Already up to date: ${selected.id} (skipped automatically).`)
        continue nextPokemon
      }
      io.write(`\n${formatAvailabilityProposal(report)}\n`)
    } catch (error) {
      if (signal.aborted) break
      report = undefined
      failed++
      io.write(
        styleText(
          'red',
          `Lookup failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      if (options.dryRun) {
        blocked = true
        continue nextPokemon
      }
      if (options.patchAll) {
        stopAtBlocker(selected.id, 'lookup failed; no candidate is available.')
        break nextPokemon
      }
      io.write(styleText('yellow', 'No candidate is available. Skip this Pokémon to continue.'))
    }

    while (!signal.aborted) {
      const input = options.patchAll
        ? 'p'
        : await io.read(report ? 'p) patch  s) skip > ' : 's) skip > ')
      if (signal.aborted || input === null) {
        stopped = true
        break nextPokemon
      }
      const choice = input.trim().toLowerCase()
      if (choice === 's') {
        skipped++
        io.write(`Skipped ${selected.id}.`)
        continue nextPokemon
      }
      if (choice === 'p' && report) {
        try {
          const file = resolve(dataDirectory, 'pokemon', `${selected.id}.json`)
          const didChange = await patchPokemonFile(file, report)
          if (didChange) patched++
          else unchanged++
          io.write(didChange ? `Patched and formatted: ${file}` : `Already up to date: ${file}`)
          continue nextPokemon
        } catch (error) {
          io.write(
            styleText(
              'red',
              `Patch failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
          )
          if (options.patchAll) {
            stopAtBlocker(selected.id, 'patch failed.')
            break nextPokemon
          }
          continue
        }
      }
      io.write(`Type ${report ? 'p or s' : 's'}, then Enter.`)
    }
  }
  if (options.dryRun)
    io.write(
      `\n${signal.aborted ? 'Stopped dry run' : 'Dry run'}: ${reviewed} reviewed, ${changed} changed, ${unchanged} already up to date, ${warned} with warnings, ${failed} failed. No files written.`,
    )
  else
    io.write(
      `\n${signal.aborted || stopped ? 'Stopped' : 'Finished'}: ${patched} patched, ${unchanged} already up to date, ${skipped} skipped.`,
    )
  return { blocked }
}

export async function main(
  args = process.argv.slice(2),
  dataDirectory = datasetRoot,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args: args.filter((arg, index) => !(index === 0 && arg === '--')),
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      from: { type: 'string' },
      'patch-all': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      'skip-unchanged': { type: 'boolean' },
      html: { type: 'string' },
      'go-html': { type: 'string' },
      'refresh-sources': { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  if (positionals.length) throw new Error(`This command reviews the full Pokémon list.\n\n${help}`)
  const sourceOptions = {
    html: values.html,
    goHtml: values['go-html'],
    refreshSources: values['refresh-sources'],
  }
  validateSourceOptions(sourceOptions)
  if (values['dry-run'] && values['patch-all'])
    throw new Error('--dry-run cannot be combined with --patch-all.')
  const controller = new AbortController()
  const terminal =
    values['patch-all'] || values['dry-run']
      ? undefined
      : createInterface({
          input: process.stdin,
          output: process.stdout,
          crlfDelay: Infinity,
        })
  // Start listening immediately so piped input is not lost while the dataset loads.
  const lines = terminal?.[Symbol.asyncIterator]()
  let interrupted = false
  const stop = () => {
    interrupted = true
    controller.abort()
    terminal?.close()
  }
  terminal?.on('SIGINT', stop)
  process.on('SIGINT', stop)
  try {
    const result = await reviewDataset(
      dataDirectory,
      {
        write: (message) => console.log(message),
        read: async (prompt) => {
          process.stdout.write(prompt)
          const line = await lines?.next()
          return !line || line.done ? null : line.value
        },
      },
      controller.signal,
      {
        ...sourceOptions,
        from: values.from,
        patchAll: values['patch-all'],
        dryRun: values['dry-run'],
        skipUnchanged: values['skip-unchanged'],
      },
    )
    if (result.blocked) process.exitCode = 1
  } finally {
    terminal?.close()
    process.off('SIGINT', stop)
    if (interrupted) process.exitCode = 130
  }
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

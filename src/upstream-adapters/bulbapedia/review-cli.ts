import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { datasetRoot, fetchSpeciesPage, readCollection } from './cli.ts'
import {
  availabilityChanges,
  bulbapediaUrl,
  formatAvailabilityChanges,
  parseAvailability,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityReport,
} from './availability.ts'
import { patchPokemonFile } from './patch.ts'

const help = `Usage: pnpm pokemon:availability:all [--skip-unchanged]

Review every Pokémon, including forms, in dataset index order.
For each Pokémon, inspect the proposed availability changes, then type:
  p  Patch and format the file, then advance.
  s  Skip without changes, then advance.
  a  Run GPT-5.6 Terra verification, then choose p or s.

AI runs only when requested and reuses OPENAI_API_KEY from the environment or
repository .env. Failed or uncertain AI reviews block patching that Pokémon.
Ctrl+C stops the review. Completed patches remain saved.
--skip-unchanged  Automatically advance when no games are added or removed.
                  Lookup failures still prompt for skip.
--help, -h  Show this help.`

type ReviewIO = {
  write: (message: string) => void
  read: (prompt: string) => Promise<string | null>
}

/** Share the single-Pokémon tool's parser and writers; only orchestration is interactive. */
export async function reviewDataset(
  dataDirectory: string,
  io: ReviewIO,
  signal: AbortSignal,
  options: { skipUnchanged?: boolean } = {},
): Promise<void> {
  const [pokemon, games] = await Promise.all([
    readCollection<AvailabilityPokemon>(dataDirectory, 'pokemon'),
    readCollection<AvailabilityGame>(dataDirectory, 'games'),
  ])
  let patched = 0
  let unchanged = 0
  let skipped = 0
  let stopped = false
  // Forms are adjacent in the index. Keep only the last page, not hundreds of large articles.
  let page: { url: string; html: string } | undefined

  nextPokemon: for (const [index, selected] of pokemon.entries()) {
    if (signal.aborted) break
    io.write(
      `\n[${index + 1}/${pokemon.length}] ${selected.names.eng ?? selected.id} (${selected.id} / ${selected.nid})`,
    )
    let report: AvailabilityReport | undefined
    let html = ''
    try {
      const url = bulbapediaUrl(selected)
      io.write(`Source: ${url}#Game_locations`)
      if (page?.url !== url) page = { url, html: await fetchSpeciesPage(url, signal) }
      if (signal.aborted) break
      html = page.html
      report = parseAvailability(
        html,
        selected,
        games,
        pokemon.filter((entry) => entry.dexNum === selected.dexNum),
      )
      for (const warning of report.warnings) io.write(`Warning: ${warning}`)
      if (
        options.skipUnchanged &&
        availabilityChanges(report).every(({ added, removed }) => !added.length && !removed.length)
      ) {
        unchanged++
        io.write(`Already up to date: ${selected.id} (skipped automatically).`)
        continue nextPokemon
      }
      io.write(`\n${formatAvailabilityChanges(report)}\n`)
    } catch (error) {
      if (signal.aborted) break
      io.write(`Lookup failed: ${error instanceof Error ? error.message : String(error)}`)
      io.write('No candidate is available. Skip this Pokémon to continue.')
    }

    let aiReviewed = false
    let patchBlocked = false
    while (!signal.aborted) {
      const prompt = !report
        ? 's) skip > '
        : aiReviewed
          ? `p) patch${patchBlocked ? ' (blocked by AI review)' : ''}  s) skip > `
          : 'p) patch  s) skip  a) ai pass > '
      const input = await io.read(prompt)
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
        if (patchBlocked) {
          io.write('Patching is blocked because AI verification did not pass. Type s to skip.')
          continue
        }
        try {
          const file = resolve(dataDirectory, 'pokemon', `${selected.id}.json`)
          const changed = await patchPokemonFile(file, report)
          if (changed) patched++
          else unchanged++
          io.write(changed ? `Patched and formatted: ${file}` : `Already up to date: ${file}`)
          continue nextPokemon
        } catch (error) {
          io.write(`Patch failed: ${error instanceof Error ? error.message : String(error)}`)
          continue
        }
      }
      if (choice === 'a' && report && !aiReviewed) {
        aiReviewed = true
        patchBlocked = true
        try {
          const { verifyAvailabilityWithAi, formatAiReview, VERIFICATION_MODEL } =
            await import('./ai-verification.ts')
          if (signal.aborted) break
          io.write(`Verifying input and candidate JSON with ${VERIFICATION_MODEL}…`)
          const review = await verifyAvailabilityWithAi(report, html, games, undefined, signal)
          if (signal.aborted) break
          io.write(formatAiReview(review))
          patchBlocked = review.verdict !== 'pass'
        } catch (error) {
          if (signal.aborted) break
          io.write(
            `AI verification failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        io.write(`\n${formatAvailabilityChanges(report)}\n`)
        continue
      }
      io.write(`Type ${!report ? 's' : aiReviewed ? 'p or s' : 'p, s, or a'}, then Enter.`)
    }
  }
  io.write(
    `\n${signal.aborted || stopped ? 'Stopped' : 'Finished'}: ${patched} patched, ${unchanged} already up to date, ${skipped} skipped.`,
  )
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
      'skip-unchanged': { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  if (positionals.length) throw new Error(`This command reviews the full Pokémon list.\n\n${help}`)
  const controller = new AbortController()
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
    crlfDelay: Infinity,
  })
  // Start listening immediately so piped input is not lost while the dataset loads.
  const lines = terminal[Symbol.asyncIterator]()
  let interrupted = false
  const stop = () => {
    interrupted = true
    controller.abort()
    terminal.close()
  }
  terminal.on('SIGINT', stop)
  process.on('SIGINT', stop)
  try {
    await reviewDataset(
      dataDirectory,
      {
        write: (message) => console.log(message),
        read: async (prompt) => {
          process.stdout.write(prompt)
          const line = await lines.next()
          return line.done ? null : line.value
        },
      },
      controller.signal,
      { skipUnchanged: values['skip-unchanged'] },
    )
  } finally {
    terminal.close()
    process.off('SIGINT', stop)
    if (interrupted) process.exitCode = 130
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

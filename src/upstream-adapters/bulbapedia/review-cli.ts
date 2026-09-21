import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { parseArgs, styleText } from 'node:util'
import { datasetRoot, fetchSpeciesPage, readCollection } from './cli.ts'
import {
  availabilityChanges,
  bulbapediaUrl,
  formatAvailabilityProposal,
  parseAvailability,
  resolvePokemon,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityReport,
} from './availability.ts'
import { patchPokemonFile } from './patch.ts'
import { createAvailabilityCrossChecker, formatCrossChecks } from './cross-check.ts'

const help = `Usage: pnpm pokemon:availability:all [--from <id|nid>] [--patch-all] [--skip-unchanged] [--with-ai] [--ai-harder]

Review every Pokémon, including forms, in dataset index order.
For each Pokémon, inspect the proposed availability changes, then type:
  p  Patch and format the file, then advance.
  s  Skip without changes, then advance.
  a  Run GPT-5.6 Luna review (low reasoning), then choose p or s for its final candidate.

AI runs with a, --with-ai, or --ai-harder and reuses OPENAI_API_KEY from the environment or
repository .env. Failed or uncertain AI reviews block patching that Pokémon.
AI corrections replace the mechanical candidate and include a reason of at most 25 words.
Ctrl+C stops the review. Completed patches remain saved.
--patch-all       Patch and format automatically; stop at the first blocker with exit code 1.
                  Combines with AI flags; only passing AI candidates are patched.
                  No prompts. Lookup/patch errors and unresolved conflicts stop the run.
--from <id|nid>   Start at this Pokémon (inclusive), bypassing earlier records without lookups.
                  Example: --from mrmime-galar or --from 0122-galar.
--skip-unchanged  Advance when no games change and there are no unresolved source conflicts.
                  Also applies after a successful AI review.
                  Lookup failures still prompt for skip.
--with-ai         Verify each candidate automatically before the patch/skip prompt.
                  With --skip-unchanged, changed or conflicting candidates use AI.
--ai-harder       Use GPT-5.6 Terra with low reasoning. Enables automatic AI verification itself.
--no-cross-check  Use Bulbapedia alone; skip PokéAPI and targeted Serebii evidence.
--refresh-sources Refresh cached Bulbapedia, PokéAPI, and targeted Serebii evidence.
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
  options: {
    from?: string
    patchAll?: boolean
    skipUnchanged?: boolean
    withAi?: boolean
    aiHarder?: boolean
    noCrossCheck?: boolean
    refreshSources?: boolean
  } = {},
): Promise<{ blocked: boolean }> {
  const [pokemon, games] = await Promise.all([
    readCollection<AvailabilityPokemon>(dataDirectory, 'pokemon'),
    readCollection<AvailabilityGame>(dataDirectory, 'games'),
  ])
  const startIndex =
    options.from === undefined ? 0 : pokemon.indexOf(resolvePokemon(options.from, pokemon))
  if (options.from !== undefined)
    io.write(`Starting at ${pokemon[startIndex].id}; ${startIndex} earlier records bypassed.`)
  let patched = 0
  let unchanged = 0
  let skipped = 0
  let stopped = false
  let blocked = false
  const stopAtBlocker = (id: string, reason: string) => {
    stopped = true
    blocked = true
    io.write(styleText('red', `Automatic patching stopped at ${id}: ${reason}`))
    io.write(`Review this Pokémon with --from ${id} without --patch-all.`)
  }
  // Forms are adjacent in the index. Keep only the last page, not hundreds of large articles.
  let page: { url: string; html: string } | undefined
  const crossCheck = createAvailabilityCrossChecker({
    pokeApi: { forceRefresh: options.refreshSources },
    serebii: { forceRefresh: options.refreshSources },
  })

  nextPokemon: for (let index = startIndex; index < pokemon.length; index++) {
    if (signal.aborted) break
    const selected = pokemon[index]
    io.write(
      `\n[${index + 1}/${pokemon.length}] ${selected.names.eng ?? selected.id} (${selected.id} / ${selected.nid})`,
    )
    let report: AvailabilityReport | undefined
    let html = ''
    try {
      const url = bulbapediaUrl(selected)
      io.write(`Source: ${url}#Game_locations`)
      if (page?.url !== url)
        page = {
          url,
          html: await fetchSpeciesPage(url, signal, { forceRefresh: options.refreshSources }),
        }
      if (signal.aborted) break
      html = page.html
      report = parseAvailability(
        html,
        selected,
        games,
        pokemon.filter((entry) => entry.dexNum === selected.dexNum),
      )
      if (!options.noCrossCheck) {
        io.write('Cross-checking cached PokéAPI encounters and targeted Serebii evidence…')
        report = await crossCheck(
          report,
          games,
          pokemon.filter((entry) => entry.dexNum === selected.dexNum),
          signal,
        )
        io.write(formatCrossChecks(report))
      }
      for (const warning of report.warnings) io.write(styleText('yellow', `Warning: ${warning}`))
      io.write('AI verification: not run. Unchanged values are not proof of accuracy.')
      if (
        options.skipUnchanged &&
        !report.crossChecks?.unresolvedConflictIds.length &&
        availabilityChanges(report).every(({ added, removed }) => !added.length && !removed.length)
      ) {
        unchanged++
        io.write('Proposed changes: none.')
        io.write(`Already up to date: ${selected.id} (skipped automatically).`)
        continue nextPokemon
      }
      io.write(`\nMechanical candidate:\n${formatAvailabilityProposal(report)}\n`)
    } catch (error) {
      if (signal.aborted) break
      report = undefined
      io.write(
        styleText(
          'red',
          `Lookup failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      if (options.patchAll) {
        stopAtBlocker(selected.id, 'lookup failed; no candidate is available.')
        break nextPokemon
      }
      io.write(styleText('yellow', 'No candidate is available. Skip this Pokémon to continue.'))
    }

    let aiReviewed = false
    let patchBlocked = !!report?.crossChecks?.unresolvedConflictIds.length
    while (!signal.aborted) {
      const automaticAi = (options.withAi || options.aiHarder) && report && !aiReviewed
      if (options.patchAll && patchBlocked && !automaticAi) {
        stopAtBlocker(
          selected.id,
          aiReviewed ? 'AI verification did not pass.' : 'unresolved source conflicts.',
        )
        break nextPokemon
      }
      const prompt = !report
        ? 's) skip > '
        : aiReviewed
          ? `p) patch${patchBlocked ? styleText('red', ' (blocked by AI review)') : ''}  s) skip > `
          : `p) patch${patchBlocked ? styleText('yellow', ' (blocked by source conflict)') : ''}  s) skip  a) ai pass > `
      const input = automaticAi ? 'a' : options.patchAll ? 'p' : await io.read(prompt)
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
          io.write(
            styleText(
              'red',
              aiReviewed
                ? 'Patching is blocked because AI verification did not pass. Type s to skip.'
                : 'Patching is blocked by unresolved source conflicts. Type a for AI review or s to skip.',
            ),
          )
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
      if (choice === 'a' && report && !aiReviewed) {
        aiReviewed = true
        patchBlocked = true
        try {
          const { verifyAvailabilityWithAi, applyAiReview, formatAiReview, verificationModel } =
            await import('./ai-verification.ts')
          if (signal.aborted) break
          io.write(
            `Verifying input and candidate JSON with ${verificationModel(options.aiHarder)} (low reasoning)…`,
          )
          const review = await verifyAvailabilityWithAi(report, html, games, {
            signal,
            harder: options.aiHarder,
          })
          if (signal.aborted) break
          io.write(formatAiReview(review, options.aiHarder))
          patchBlocked = review.verdict !== 'pass'
          if (!patchBlocked) report = applyAiReview(report, review)
        } catch (error) {
          if (signal.aborted) break
          patchBlocked = true
          io.write(
            styleText(
              'red',
              `AI verification failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
          )
        }
        io.write(
          `\n${patchBlocked ? styleText('red', 'Mechanical candidate (AI review did not pass)') : 'AI candidate'}:\n${formatAvailabilityProposal(report)}\n`,
        )
        if (
          options.skipUnchanged &&
          !patchBlocked &&
          !report.crossChecks?.unresolvedConflictIds.length &&
          availabilityChanges(report).every(
            ({ added, removed }) => !added.length && !removed.length,
          )
        ) {
          unchanged++
          io.write(`Already up to date: ${selected.id} (skipped automatically after AI review).`)
          continue nextPokemon
        }
        continue
      }
      io.write(`Type ${!report ? 's' : aiReviewed ? 'p or s' : 'p, s, or a'}, then Enter.`)
    }
  }
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
      'skip-unchanged': { type: 'boolean' },
      'with-ai': { type: 'boolean' },
      'ai-harder': { type: 'boolean' },
      'no-cross-check': { type: 'boolean' },
      'refresh-sources': { type: 'boolean' },
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
    const result = await reviewDataset(
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
      {
        from: values.from,
        patchAll: values['patch-all'],
        skipUnchanged: values['skip-unchanged'],
        withAi: values['with-ai'],
        aiHarder: values['ai-harder'],
        noCrossCheck: values['no-cross-check'],
        refreshSources: values['refresh-sources'],
      },
    )
    if (result.blocked) process.exitCode = 1
  } finally {
    terminal.close()
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

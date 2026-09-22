import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import pikachu from '../../../data/pokemon/pikachu.json'
import femalePikachu from '../../../data/pokemon/pikachu-f.json'
import red from '../../../data/games/rb-r.json'
import gold from '../../../data/games/gs-g.json'
import { main, reviewDataset } from './review-cli'
import * as availability from './availability'
import * as source from './fetch'
import * as patcher from './patch'
import { mainPage, goPage } from './test-fixtures'

const records = [pikachu, femalePikachu].map((pokemon) => ({
  ...pokemon,
  obtainableIn: [],
  transferOnlyIn: [],
  eventOnlyIn: [],
  storableIn: ['gs-g'],
  unrelated: 'preserve me',
}))
const games: availability.AvailabilityGame[] = [red, gold].map((game) => ({
  ...game,
  type: 'game',
}))
function reportFor(record: availability.AvailabilityPokemon): availability.AvailabilityReport {
  return {
    pokemon: record,
    gameOrder: [red.id, gold.id],
    warnings: record.isFemaleForm ? ['Fixture retained-form warning'] : [],
    rows: games.map((game) => ({
      game,
      status: record.isFemaleForm && game.gen === 1 ? 'unavailable' : 'obtainableIn',
      basis: 'source',
      methods: [],
      storable: record.storableIn.includes(game.id),
    })),
  }
}

beforeEach(() => {
  vi.spyOn(source, 'fetchAvailabilityPage').mockImplementation(async (page) => `<h1>${page}</h1>`)
  vi.spyOn(availability, 'parseAvailabilityTables').mockReturnValue(
    {} as availability.AvailabilityTables,
  )
  vi.spyOn(availability, 'createAvailabilityReport').mockImplementation((_tables, record) =>
    reportFor(record),
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = undefined
})

async function withDataset(
  run: (directory: string, files: string[], originals: string[], saved: string[]) => Promise<void>,
  entries: availability.AvailabilityPokemon[] = records,
) {
  const directory = mkdtempSync(join(tmpdir(), 'pokepc-availability-review-'))
  try {
    for (const collection of ['indices', 'pokemon', 'games']) mkdirSync(join(directory, collection))
    const files = entries.map((pokemon) => join(directory, 'pokemon', `${pokemon.id}.json`))
    const originals = entries.map((pokemon) => JSON.stringify(pokemon))
    files.forEach((file, index) => writeFileSync(file, originals[index]))
    for (const game of [red, gold])
      writeFileSync(join(directory, 'games', `${game.id}.json`), JSON.stringify(game))
    writeFileSync(join(directory, 'indices/pokemon.json'), JSON.stringify(entries.map((p) => p.id)))
    writeFileSync(join(directory, 'indices/games.json'), JSON.stringify([red.id, gold.id]))
    const saved = ['main', 'go'].map((page) => {
      const path = join(directory, `${page}.html`)
      writeFileSync(path, `<h1>${page}</h1>`)
      return path
    })
    await run(directory, files, originals, saved)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function session(answers: (string | null)[], controller = new AbortController()) {
  const write = vi.fn<(message: string) => void>()
  const read = vi.fn<(prompt: string) => Promise<string | null>>(
    async () => answers.shift() ?? null,
  )
  return {
    io: { write, read },
    signal: controller.signal,
    output: () => write.mock.calls.map(([message]) => message).join('\n'),
    prompts: () => read.mock.calls.map(([prompt]) => prompt),
  }
}

describe('bulk source loading and dry runs', () => {
  it('fetches each full list once and shares parsed tables across every form', async () => {
    const review = session(['s', 's'])
    await withDataset(async (directory) => {
      await reviewDataset(directory, review.io, review.signal, { refreshSources: true })
      expect(source.fetchAvailabilityPage).toHaveBeenCalledTimes(2)
      expect(source.fetchAvailabilityPage).toHaveBeenCalledWith('main', review.signal, {
        forceRefresh: true,
      })
      expect(source.fetchAvailabilityPage).toHaveBeenCalledWith('go', review.signal, {
        forceRefresh: true,
      })
      expect(availability.parseAvailabilityTables).toHaveBeenCalledExactlyOnceWith({
        main: '<h1>main</h1>',
        go: '<h1>go</h1>',
      })
      expect(availability.createAvailabilityReport).toHaveBeenCalledTimes(2)
      expect(
        vi
          .mocked(availability.createAvailabilityReport)
          .mock.calls.every(
            ([tables, _record, _games, siblings]) =>
              tables === vi.mocked(availability.parseAvailabilityTables).mock.results[0].value &&
              siblings?.length === 2,
          ),
      ).toBe(true)
    })
  })

  it('reviews the full range without writes or prompts and summarizes changes and warnings', async () => {
    const review = session([])
    await withDataset(async (directory, files, originals, saved) => {
      expect(
        await reviewDataset(directory, review.io, review.signal, {
          dryRun: true,
          html: saved[0],
          goHtml: saved[1],
        }),
      ).toEqual({ blocked: false })
      expect(review.prompts()).toEqual([])
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
      expect(review.output()).toContain(
        'Dry run: 2 reviewed, 2 changed, 0 already up to date, 1 with warnings, 0 failed. No files written.',
      )
    })
  })

  it('counts individual report failures and finishes the rest of a dry run', async () => {
    vi.mocked(availability.createAvailabilityReport).mockImplementationOnce(() => {
      throw new Error('Fixture report failure')
    })
    const review = session([])
    await withDataset(async (directory, files, originals) => {
      expect(await reviewDataset(directory, review.io, review.signal, { dryRun: true })).toEqual({
        blocked: true,
      })
      expect(availability.createAvailabilityReport).toHaveBeenCalledTimes(2)
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      expect(review.output()).toContain(
        'Dry run: 1 reviewed, 1 changed, 0 already up to date, 1 with warnings, 1 failed.',
      )
    })
  })

  it('rejects malformed shared sources before producing candidates or writing any record', async () => {
    vi.mocked(availability.parseAvailabilityTables).mockImplementation(() => {
      throw new Error('Malformed availability table')
    })
    const review = session([])
    await withDataset(async (directory, files, originals) => {
      await expect(
        reviewDataset(directory, review.io, review.signal, { patchAll: true }),
      ).rejects.toThrow('Malformed availability table')
      expect(availability.createAvailabilityReport).not.toHaveBeenCalled()
      expect(review.prompts()).toEqual([])
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })

  it('rejects contradictory or partially offline options before loading data', async () => {
    const review = session([])
    await expect(
      reviewDataset('/nonexistent', review.io, review.signal, {
        dryRun: true,
        patchAll: true,
      }),
    ).rejects.toThrow('cannot be combined')
    await expect(
      reviewDataset('/nonexistent', review.io, review.signal, {
        html: 'main.html',
      }),
    ).rejects.toThrow('must be supplied together')
    expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
  })
})

describe('automatic availability patching', () => {
  it('patches and formats every candidate without reading input', async () => {
    const review = session([])
    await withDataset(async (directory, files) => {
      expect(await reviewDataset(directory, review.io, review.signal, { patchAll: true })).toEqual({
        blocked: false,
      })
      expect(review.prompts()).toEqual([])
      expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['rb-r', 'gs-g'])
      expect(JSON.parse(readFileSync(files[1], 'utf8')).obtainableIn).toEqual(['gs-g'])
      for (const file of files) {
        expect(readFileSync(file, 'utf8')).toMatch(/^\{\n  "id":/)
        expect(JSON.parse(readFileSync(file, 'utf8')).unrelated).toBe('preserve me')
      }
      expect(review.output()).toContain('Finished: 2 patched, 0 already up to date, 0 skipped.')
    })
  })

  it('stops at a patch failure and preserves earlier completed patches', async () => {
    const originalPatch = patcher.patchPokemonFile
    vi.spyOn(patcher, 'patchPokemonFile').mockImplementation(async (file, report) => {
      if (report.pokemon.isFemaleForm) throw new Error('Fixture patch error')
      return originalPatch(file, report)
    })
    const review = session([])
    await withDataset(async (directory, files, originals) => {
      expect(await reviewDataset(directory, review.io, review.signal, { patchAll: true })).toEqual({
        blocked: true,
      })
      expect(readFileSync(files[0], 'utf8')).not.toBe(originals[0])
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      expect(review.prompts()).toEqual([])
      expect(review.output()).toContain('Automatic patching stopped at pikachu-f: patch failed.')
      expect(review.output()).toContain('--from pikachu-f')
    })
  })

  it('stops at a report failure without advancing to later records', async () => {
    vi.mocked(availability.createAvailabilityReport).mockImplementationOnce(() => {
      throw new Error('Fixture lookup failure')
    })
    const review = session([])
    await withDataset(async (directory, files, originals) => {
      expect(await reviewDataset(directory, review.io, review.signal, { patchAll: true })).toEqual({
        blocked: true,
      })
      expect(availability.createAvailabilityReport).toHaveBeenCalledOnce()
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      expect(review.prompts()).toEqual([])
    })
  })

  it('honors cancellation after a completed patch', async () => {
    const controller = new AbortController()
    const review = session([], controller)
    review.io.write.mockImplementation((message) => {
      if (message.startsWith('Patched and formatted:')) controller.abort()
    })
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal, { patchAll: true })
      expect(readFileSync(files[0], 'utf8')).not.toBe(originals[0])
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      expect(review.output()).toContain('Stopped: 1 patched')
    })
  })
})

describe('interactive availability review', () => {
  it.each(['pikachu-f', '0025-f', '25-f'])(
    'starts at %s inclusively with original progress numbering',
    async (from) => {
      const review = session(['s'])
      await withDataset(async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, { from })
        expect(availability.createAvailabilityReport).toHaveBeenCalledOnce()
        expect(vi.mocked(availability.createAvailabilityReport).mock.calls[0][1].id).toBe(
          'pikachu-f',
        )
        expect(review.output()).toContain('1 earlier records bypassed.')
        expect(review.output()).toContain('[2/2]')
        expect(review.output()).not.toContain('[1/2]')
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      })
    },
  )

  it('rejects an unknown start record before source loading', async () => {
    const review = session([])
    await withDataset(async (directory) => {
      await expect(
        reviewDataset(directory, review.io, review.signal, { from: 'missing' }),
      ).rejects.toThrow('Unknown Pokémon')
      expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
    })
  })

  it('skips unchanged membership while preserving warnings and file bytes', async () => {
    const entries = records.map((record) => ({
      ...record,
      ...availability.availabilityJson(reportFor(record)),
    }))
    const review = session([])
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal, { skipUnchanged: true })
      expect(review.prompts()).toEqual([])
      expect(review.output()).toContain('Warning: Fixture retained-form warning')
      expect(review.output()).toContain('Finished: 0 patched, 2 already up to date, 0 skipped.')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    }, entries)
  })

  it('previews before prompting, rejects invalid input, patches only on p, and skips on s', async () => {
    const review = session(['invalid', 'p', 's'])
    await withDataset(async (directory, files, originals) => {
      review.io.read.mockImplementation(async () => {
        expect(review.output()).toContain('obtainableIn')
        return ['invalid', 'p', 's'][review.io.read.mock.calls.length - 1] ?? null
      })
      await reviewDataset(directory, review.io, review.signal)
      expect(readFileSync(files[0], 'utf8')).not.toBe(originals[0])
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      expect(review.output()).toContain('Type p or s, then Enter.')
      expect(review.prompts()).toEqual([
        'p) patch  s) skip > ',
        'p) patch  s) skip > ',
        'p) patch  s) skip > ',
      ])
    })
  })

  it('preserves concurrent changes and stays on the current Pokémon after patch failure', async () => {
    const review = session([])
    await withDataset(async (directory, files) => {
      review.io.read.mockImplementation(async () => {
        if (review.io.read.mock.calls.length === 1) {
          writeFileSync(files[0], JSON.stringify({ ...records[0], obtainableIn: ['gs-g'] }))
          return 'p'
        }
        return 's'
      })
      await reviewDataset(directory, review.io, review.signal)
      expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['gs-g'])
      expect(review.output()).toContain('changed during lookup')
      expect(review.output()).toContain('Finished: 0 patched, 0 already up to date, 2 skipped.')
    })
  })

  it('stops on end of input without writing or advancing', async () => {
    const review = session([null])
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal)
      expect(availability.createAvailabilityReport).toHaveBeenCalledOnce()
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      expect(review.output()).toContain('Stopped:')
    })
  })

  it('cancels active source fetches without offering a patch', async () => {
    const controller = new AbortController()
    const review = session([], controller)
    vi.mocked(source.fetchAvailabilityPage).mockImplementation(async (_page, signal) => {
      controller.abort()
      signal?.throwIfAborted()
      return ''
    })
    await withDataset(async (directory, files, originals) => {
      expect(await reviewDataset(directory, review.io, review.signal)).toEqual({ blocked: false })
      expect(review.prompts()).toEqual([])
      expect(availability.createAvailabilityReport).not.toHaveBeenCalled()
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      expect(review.output()).toContain('Stopped:')
    })
  })
})

describe('review CLI options', () => {
  const cli = fileURLToPath(new URL('./review-cli.ts', import.meta.url))
  const script = `import { main } from ${JSON.stringify(pathToFileURL(cli).href)}; await main(JSON.parse(process.argv[1]), process.argv[2])`

  it('preserves piped input while loading real saved tables', async () => {
    await withDataset(async (directory, files, originals, saved) => {
      writeFileSync(saved[0], mainPage())
      writeFileSync(saved[1], goPage())
      const args = ['--html', saved[0], '--go-html', saved[1]]
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '--eval', script, JSON.stringify(args), directory],
        {
          input: 'p\ns\n',
          encoding: 'utf8',
          cwd: directory,
        },
      )
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['rb-r', 'gs-g'])
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      expect(result.stdout).toContain('Finished: 1 patched, 0 already up to date, 1 skipped.')
    })
  })

  it('exits with 130 on SIGINT at a prompt and preserves completed patches', async () => {
    await withDataset(async (directory, files, originals, saved) => {
      writeFileSync(saved[0], mainPage())
      writeFileSync(saved[1], goPage())
      const args = ['--html', saved[0], '--go-html', saved[1]]
      const child = spawn(
        process.execPath,
        ['--input-type=module', '--eval', script, JSON.stringify(args), directory],
        { cwd: directory },
      )
      let output = ''
      let errors = ''
      let patched = false
      let interrupted = false
      child.stderr.on('data', (chunk) => {
        errors += String(chunk)
      })
      const result = await new Promise<number | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill('SIGKILL')
          reject(new Error(`CLI did not stop: ${errors}`))
        }, 10_000)
        child.on('error', reject)
        child.on('exit', (code) => {
          clearTimeout(timeout)
          resolve(code)
        })
        child.stdout.on('data', (chunk) => {
          output += String(chunk)
          if (!patched && output.includes('p) patch  s) skip > ')) {
            patched = true
            child.stdin.write('p\n')
          }
          if (!interrupted && output.split('p) patch  s) skip > ').length === 3) {
            interrupted = true
            child.kill('SIGINT')
          }
        })
      })
      expect(result, errors).toBe(130)
      expect(readFileSync(files[0], 'utf8')).not.toBe(originals[0])
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      expect(output).toContain('Stopped: 1 patched')
    })
  }, 15_000)

  it('shows help without fetching pages', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(['--help'], '/nonexistent')
    expect(output).toHaveBeenCalledWith(expect.stringContaining('--dry-run'))
    expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
  })

  it.each(['--with-ai', '--ai-harder', '--no-cross-check'])(
    'rejects removed %s',
    async (option) => {
      await expect(main([option], '/nonexistent')).rejects.toThrow('Unknown option')
    },
  )

  it('runs --dry-run with saved pages without stdin or file writes', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await withDataset(async (directory, files, originals, saved) => {
      await main(['--dry-run', '--html', saved[0], '--go-html', saved[1]], directory)
      expect(output.mock.calls.flat().join('\n')).toContain('No files written.')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
    })
  })

  it('sets a nonzero exit code after an automatic patch failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(patcher, 'patchPokemonFile').mockRejectedValue(new Error('Fixture patch error'))
    await withDataset(async (directory) => {
      await main(['--patch-all'], directory)
      expect(process.exitCode).toBe(1)
    })
  })
})

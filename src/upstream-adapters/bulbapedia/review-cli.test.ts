import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pikachu from '../../../data/pokemon/pikachu.json'
import femalePikachu from '../../../data/pokemon/pikachu-f.json'
import raichu from '../../../data/pokemon/raichu.json'
import red from '../../../data/games/rb-r.json'
import gold from '../../../data/games/gs-g.json'
import { reviewDataset } from './review-cli'
import type { AvailabilityPokemon } from './availability'
import * as ai from './ai-verification'

const page = (species = 'Pikachu') => `<h1>${species} (Pokémon)</h1>
  <h3 id="Game_locations">Game locations</h3><table>
  <tr><th>Red</th><td><a href="/wiki/Viridian_Forest">Viridian Forest</a></td></tr>
  <tr><th>Gold</th><td><a href="/wiki/Route_2">Route 2</a></td></tr></table>`
const records = [pikachu, femalePikachu].map((pokemon) => ({
  ...pokemon,
  obtainableIn: [],
  transferOnlyIn: [],
  eventOnlyIn: [],
  storableIn: ['gs-g'],
  unrelated: 'preserve me',
}))
const passed = { verdict: 'pass' as const, summary: 'Verified', checks: [], findings: [] }

async function withDataset(
  run: (directory: string, files: string[], originals: string[]) => Promise<void>,
  entries: (AvailabilityPokemon & { unrelated: string })[] = records,
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
    await run(directory, files, originals)
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('interactive availability review', () => {
  it('skips unchanged records and keeps AI and patch choices for the next changed candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi').mockResolvedValue(passed)
    const review = session(['a', 'p'])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, { skipUnchanged: true })
        expect(readFileSync(files[0], 'utf8')).toBe(originals[0])
        expect(JSON.parse(readFileSync(files[1], 'utf8')).obtainableIn).toEqual(['gs-g'])
        expect(verify).toHaveBeenCalledOnce()
        expect(verify.mock.calls[0][0].pokemon.id).toBe('pikachu-f')
        expect(review.prompts()).toEqual([
          'p) patch  s) skip  a) ai pass > ',
          'p) patch  s) skip > ',
        ])
        expect(review.output()).toContain('Already up to date: pikachu (skipped automatically).')
        expect(review.output()).toContain('Finished: 1 patched, 1 already up to date, 0 skipped.')
      },
      [{ ...records[0], obtainableIn: ['gs-g', 'rb-r'] }, records[1]],
    )
  })

  it.each([false, true])('only skips unchanged records when enabled: %s', async (skipUnchanged) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
    const review = session(['s', 's'])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, { skipUnchanged })
        expect(review.io.read).toHaveBeenCalledTimes(skipUnchanged ? 0 : 2)
        expect(verify).not.toHaveBeenCalled()
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
        expect(review.output()).toContain(
          skipUnchanged
            ? 'Finished: 0 patched, 2 already up to date, 0 skipped.'
            : 'Finished: 0 patched, 0 already up to date, 2 skipped.',
        )
      },
      [
        { ...records[0], obtainableIn: ['rb-r', 'gs-g'] },
        { ...records[1], obtainableIn: ['gs-g'] },
      ],
    )
  })

  it('prompts for removal-only changes with --skip-unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const review = session(['s'])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, { skipUnchanged: true })
        expect(review.io.read).toHaveBeenCalledOnce()
        expect(review.output()).toContain('obtainableIn:\n  Added: none\n  Removed: Red (rb-r)')
        expect(readFileSync(files[0], 'utf8')).toBe(originals[0])
      },
      [{ ...records[1], obtainableIn: ['rb-r', 'gs-g'] }],
    )
  })

  it('previews before prompting, patches only on p, then skips forms in dataset order', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(page()))
    vi.stubGlobal('fetch', fetch)
    const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
    const review = session(['invalid', ' P ', 's'])
    await withDataset(async (directory, files, originals) => {
      review.io.read.mockImplementationOnce(async () => {
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
        expect(review.output()).toContain('obtainableIn:\n  Added: Red (rb-r), Gold (gs-g)')
        expect(review.output()).toContain('storableIn: unchanged')
        return 'invalid'
      })
      // The first mocked read did not consume an answer.
      const remaining = [' P ', 's']
      review.io.read.mockImplementation(async () => remaining.shift() ?? null)
      await reviewDataset(directory, review.io, review.signal)
      expect(JSON.parse(readFileSync(files[0], 'utf8'))).toMatchObject({
        obtainableIn: ['rb-r', 'gs-g'],
        storableIn: ['gs-g'],
        unrelated: 'preserve me',
      })
      expect(readFileSync(files[0], 'utf8')).toMatch(/^\{\n  "id": "pikachu"/)
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      expect(review.output()).toContain('[1/2] Pikachu (pikachu / 0025)')
      expect(review.output()).toContain('[2/2] Pikachu (Female) (pikachu-f / 0025-f)')
      expect(review.output()).toContain('Finished: 1 patched, 0 already up to date, 1 skipped.')
      expect(review.prompts()).toHaveLength(3)
      expect(review.output()).not.toContain('┌')
      expect(fetch).toHaveBeenCalledOnce()
      expect(verify).not.toHaveBeenCalled()
    })
  })

  it('runs AI on the displayed candidate, then offers patch/skip without auto-patching', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const review = session(['a', 'p', 's'])
    await withDataset(async (directory, files, originals) => {
      const verify = vi
        .spyOn(ai, 'verifyAvailabilityWithAi')
        .mockImplementation(async (report, html, games, _client, signal) => {
          expect(readFileSync(files[0], 'utf8')).toBe(originals[0])
          expect(report.pokemon).toEqual(records[0])
          expect(html).toBe(page())
          expect(games).toEqual([red, gold])
          expect(signal).toBe(review.signal)
          return passed
        })
      await reviewDataset(directory, review.io, review.signal)
      expect(verify).toHaveBeenCalledOnce()
      expect(review.prompts()).toEqual([
        'p) patch  s) skip  a) ai pass > ',
        'p) patch  s) skip > ',
        'p) patch  s) skip  a) ai pass > ',
      ])
      expect(review.output()).toContain('AI verification (gpt-5.6-terra): PASS')
      expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['rb-r', 'gs-g'])
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
    })
  })

  it.each(['fail', 'uncertain', 'error'] as const)(
    'blocks patching after AI %s but allows skipping',
    async (verdict) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
      const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
      if (verdict === 'error') verify.mockRejectedValue(new Error('API unavailable'))
      else verify.mockResolvedValue({ ...passed, verdict })
      const review = session(['a', 'p', 'a', 's', 's'])
      await withDataset(async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal)
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
        expect(review.output()).toContain('Patching is blocked')
        expect(review.output()).toContain('Finished: 0 patched, 0 already up to date, 2 skipped.')
        expect(review.prompts()[1]).not.toContain('a)')
        expect(verify).toHaveBeenCalledOnce()
      })
    },
  )

  it.each([false, true])(
    'offers skip on a lookup error (skipUnchanged: %s)',
    async (skipUnchanged) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('Blocked', { status: 403 }))
        .mockResolvedValueOnce(new Response(page()))
      vi.stubGlobal('fetch', fetch)
      const review = session(['p', 's', 's'])
      await withDataset(async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, { skipUnchanged })
        expect(review.output()).toContain('Lookup failed: Bulbapedia returned HTTP 403')
        expect(review.prompts()).toEqual([
          's) skip > ',
          's) skip > ',
          'p) patch  s) skip  a) ai pass > ',
        ])
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      })
    },
  )

  it('keeps patch failures on the current Pokémon and preserves concurrent changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const review = session(['s', 's'])
    await withDataset(async (directory, files) => {
      const edited = JSON.stringify({ ...records[0], obtainableIn: ['gs-g'] })
      review.io.read.mockImplementationOnce(async () => {
        writeFileSync(files[0], edited)
        return 'p'
      })
      await reviewDataset(directory, review.io, review.signal)
      expect(review.output()).toContain('Patch failed:')
      expect(review.output()).toContain('changed during lookup')
      expect(readFileSync(files[0], 'utf8')).toBe(edited)
      expect(review.prompts()).toHaveLength(3)
    })
  })

  it('fetches a new page when the species changes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(page()))
      .mockResolvedValueOnce(new Response(page('Raichu')))
    vi.stubGlobal('fetch', fetch)
    const review = session(['s', 's'])
    await withDataset(
      async (directory) => {
        await reviewDataset(directory, review.io, review.signal)
        expect(fetch.mock.calls.map(([url]) => url)).toEqual([
          expect.stringContaining('/Pikachu_'),
          expect.stringContaining('/Raichu_'),
        ])
      },
      [records[0], { ...records[1], ...raichu }],
    )
  })

  it('stops on end of input without patching or advancing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const review = session([null])
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal)
      expect(review.output()).toContain('Stopped: 0 patched, 0 already up to date, 0 skipped.')
      expect(review.output()).not.toContain('[2/2]')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })

  it('cancels an active fetch without offering a patch or advancing', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        controller.abort()
        options.signal.throwIfAborted()
      }),
    )
    const review = session(['p'], controller)
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal)
      expect(review.io.read).not.toHaveBeenCalled()
      expect(review.output()).toContain('Stopped:')
      expect(review.output()).not.toContain('Lookup failed')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })

  it('cancels an active AI review without patching or advancing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const controller = new AbortController()
    vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(
      async (_report, _html, _games, _client, signal) => {
        controller.abort()
        signal!.throwIfAborted()
        return passed
      },
    )
    const review = session(['a', 'p'], controller)
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal)
      expect(review.io.read).toHaveBeenCalledOnce()
      expect(review.output()).toContain('Stopped:')
      expect(review.output()).not.toContain('[2/2]')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })
})

// Run the real terminal wrapper with an offline source and disposable dataset.
const entry = fileURLToPath(new URL('./review-cli.ts', import.meta.url))
const offlineProgram = `import { main } from ${JSON.stringify(entry)};
  globalThis.fetch = async () => new Response(${JSON.stringify(page())});
  await main(process.argv.slice(2), process.argv[1]);`

describe('review CLI input and interruption', () => {
  it('prints help without fetching any pages', () => {
    const result = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('pokemon:availability:all')
    expect(result.stdout).toContain('Ctrl+C')
    expect(result.stdout).toContain('--skip-unchanged')
  })

  it('accepts --skip-unchanged and consumes input only for changed candidates', async () => {
    await withDataset(
      async (directory, files, originals) => {
        const result = spawnSync(
          process.execPath,
          ['--input-type=module', '-e', offlineProgram, directory, '--skip-unchanged'],
          { input: 's\n', encoding: 'utf8', cwd: directory, timeout: 5000 },
        )
        expect(result.stderr).toBe('')
        expect(result.status).toBe(0)
        expect(result.stdout.match(/p\) patch  s\) skip  a\) ai pass >/g)).toHaveLength(1)
        expect(result.stdout).toContain('Finished: 0 patched, 1 already up to date, 1 skipped.')
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      },
      [{ ...records[0], obtainableIn: ['rb-r', 'gs-g'] }, records[1]],
    )
  })

  it('preserves buffered input while loading the dataset', async () => {
    await withDataset(async (directory, files, originals) => {
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', offlineProgram, directory],
        {
          input: 's\ns\n',
          encoding: 'utf8',
          cwd: directory,
          timeout: 5000,
        },
      )
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Finished: 0 patched, 0 already up to date, 2 skipped.')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })

  it('exits cleanly on SIGINT at a prompt and retains completed patches', async () => {
    await withDataset(async (directory, files, originals) => {
      const child = spawn(
        process.execPath,
        ['--input-type=module', '-e', offlineProgram, directory],
        {
          cwd: directory,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      )
      let output = ''
      let errors = ''
      let action = 0
      child.stdout.on('data', (chunk) => {
        output += String(chunk)
        if (action === 0 && output.includes('a) ai pass > ')) {
          action = 1
          child.stdin.write('p\n')
        } else if (action === 1 && output.includes('[2/2]') && output.endsWith('a) ai pass > ')) {
          action = 2
          child.kill('SIGINT')
        }
      })
      child.stderr.on('data', (chunk) => {
        errors += String(chunk)
      })
      const timeout = setTimeout(() => child.kill('SIGKILL'), 4000)
      try {
        const code = await new Promise<number | null>((resolve, reject) => {
          child.once('error', reject)
          child.once('exit', resolve)
        })
        expect(errors).toBe('')
        expect(code).toBe(130)
        expect(output).toContain('Stopped: 1 patched, 0 already up to date, 0 skipped.')
        expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['rb-r', 'gs-g'])
        expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      } finally {
        clearTimeout(timeout)
        child.kill()
      }
    })
  })
})

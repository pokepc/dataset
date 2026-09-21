import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchSpeciesPage, main } from './cli'
import { patchPokemonFile } from './patch'
import { availabilityJson, parseAvailability } from './availability'
import pikachu from '../../../data/pokemon/pikachu.json'
import { format } from 'oxfmt'
import * as aiVerification from './ai-verification'
import * as crossChecks from './cross-check'

let cacheDir: string
beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'pokepc-bulbapedia-cache-'))
  vi.stubEnv('BULBAPEDIA_CACHE_DIR', cacheDir)
  vi.spyOn(crossChecks, 'createAvailabilityCrossChecker').mockReturnValue(async (report) => report)
})

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url))
const html = `<h1>Pikachu (Pokémon)</h1><h3 id="Game_locations">Game locations</h3>
<table><tr><th>Red</th><td><a href="/wiki/Viridian_Forest">Viridian Forest</a></td></tr></table>`

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  rmSync(cacheDir, { recursive: true, force: true })
})

describe('availability CLI', () => {
  it('prints parseable JSON from a saved page, independent of working directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pokepc-availability-'))
    try {
      const file = join(directory, 'page.html')
      writeFileSync(file, html)
      const result = spawnSync(
        process.execPath,
        [cli, '25', '--json', '--html', file, '--no-cross-check'],
        {
          cwd: directory,
          encoding: 'utf8',
        },
      )
      expect(result.status).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json.id).toBe('pikachu')
      expect(json.nid).toBe('0025')
      expect(json.obtainableIn).toContain('rb-r')
      expect(Object.keys(json).sort()).toEqual(
        ['id', 'nid', 'obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'].sort(),
      )
      expect(result.stderr).toContain('storableIn is preserved')
      expect(result.stderr).toContain('Source: https://bulbapedia.')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
  it.each([
    { args: [] },
    { args: ['pikachu', 'raichu'] },
    { args: ['pikachu', '--unknown'] },
    { args: ['not-a-pokemon'] },
  ])('rejects invalid arguments %j', ({ args }) => {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr.length).toBeGreaterThan(0)
  })
  it('shows help without making a network request', () => {
    expect(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' })).toContain(
      'No AI or API key',
    )
  })
  it('fetches HTML with a timeout and an identifying user agent', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(html))
    vi.stubGlobal('fetch', fetch)
    await expect(
      fetchSpeciesPage('https://bulbapedia.bulbagarden.net/wiki/Pikachu_(Pokémon)'),
    ).resolves.toBe(html)
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(fetch.mock.calls[0][1].headers['User-Agent']).toContain('PokePC-Dataset')
  })
  it.each([403, 429, 503])('reports HTTP %i without emitting availability', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Blocked', { status })))
    await expect(fetchSpeciesPage('https://bulbapedia.bulbagarden.net/')).rejects.toThrow(
      `HTTP ${status}`,
    )
  })
  it('rejects a challenge served with HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<h1>Just a moment</h1>')))
    await expect(fetchSpeciesPage('https://bulbapedia.bulbagarden.net/')).rejects.toThrow(
      'did not return a species page',
    )
  })
  it('preserves the cause of network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection timed out')))
    await expect(fetchSpeciesPage('https://bulbapedia.bulbagarden.net/')).rejects.toThrow(
      'connection timed out',
    )
  })
})

describe('patching availability', () => {
  const games = [
    { id: 'rb-r', name: 'Red', gen: 1, type: 'game' as const, gameSet: 'rb', gameSuperSet: null },
    { id: 'rb-b', name: 'Blue', gen: 1, type: 'game' as const, gameSet: 'rb', gameSuperSet: null },
    { id: 'home', name: 'HOME', gen: 8, type: 'game' as const, gameSet: null, gameSuperSet: null },
  ]
  const pokemon = {
    ...pikachu,
    obtainableIn: ['rb-b', 'home'],
    transferOnlyIn: ['rb-r'],
    eventOnlyIn: [],
    storableIn: ['rb-r', 'rb-b', 'home'],
    customField: { keep: true },
  }
  const source = html.replace('</table>', '<tr><th>Blue</th><td>Unobtainable</td></tr></table>')

  it('reuses and refreshes Bulbapedia pages through the CLI flags, while --html bypasses caching', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetch = vi.fn().mockImplementation(async () => new Response(source))
    vi.stubGlobal('fetch', fetch)
    await withDataset(async (directory, _file, sourceFile) => {
      await main(['pikachu', '--json', '--no-cross-check'], directory)
      await main(['pikachu', '--json', '--no-cross-check'], directory)
      expect(fetch).toHaveBeenCalledOnce()
      await main(['pikachu', '--json', '--no-cross-check', '--refresh-sources'], directory)
      expect(fetch).toHaveBeenCalledTimes(2)
      const files = readdirSync(cacheDir)
      const cached = files.map((file) => readFileSync(join(cacheDir, file), 'utf8'))
      await main(
        ['pikachu', '--json', '--no-cross-check', '--refresh-sources', '--html', sourceFile],
        directory,
      )
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(readdirSync(cacheDir)).toEqual(files)
      expect(files.map((file) => readFileSync(join(cacheDir, file), 'utf8'))).toEqual(cached)
    })
  })

  async function withDataset(
    run: (directory: string, file: string, sourceFile: string) => Promise<void>,
  ) {
    const directory = mkdtempSync(join(tmpdir(), 'pokepc-availability-patch-'))
    try {
      for (const name of ['indices', 'games', 'pokemon']) mkdirSync(join(directory, name))
      writeFileSync(join(directory, 'indices/pokemon.json'), JSON.stringify(['pikachu']))
      writeFileSync(
        join(directory, 'indices/games.json'),
        JSON.stringify(games.map((game) => game.id)),
      )
      for (const game of games)
        writeFileSync(join(directory, 'games', `${game.id}.json`), JSON.stringify(game))
      const file = join(directory, 'pokemon/pikachu.json')
      const sourceFile = join(directory, 'page.html')
      writeFileSync(file, JSON.stringify(pokemon))
      writeFileSync(sourceFile, source)
      await run(directory, file, sourceFile)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }

  it('runs cross-checks by default and blocks patching unresolved source conflicts', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => {})
    const crossCheck = vi
      .fn<ReturnType<typeof crossChecks.createAvailabilityCrossChecker>>()
      .mockImplementation(async (report) => ({
        ...report,
        crossChecks: {
          pokeApi: {
            url: 'https://pokeapi.co/api/v2/pokemon/25/encounters/',
            status: 'checked',
            encounters: [],
          },
          serebii: [],
          warnings: [],
          conflicts: [
            {
              id: 'pokeapi:rb-b',
              gameId: 'rb-b',
              message: 'PokéAPI encounter contradicts unavailable.',
              evidence: 'Blue: Viridian Forest.',
            },
          ],
          unresolvedConflictIds: ['pokeapi:rb-b'],
        },
      }))
    vi.mocked(crossChecks.createAvailabilityCrossChecker).mockReturnValue(crossCheck)
    await withDataset(async (directory, file, sourceFile) => {
      const original = readFileSync(file, 'utf8')
      await expect(main(['pikachu', '--patch', '--html', sourceFile], directory)).rejects.toThrow(
        'Unresolved source conflicts',
      )
      expect(readFileSync(file, 'utf8')).toBe(original)
      expect(output).not.toHaveBeenCalled()
      expect(diagnostics.mock.calls.flat().join('\n')).toContain('Uncertain (rb-b)')
      await main(['pikachu', '--json', '--html', sourceFile], directory)
      expect(JSON.parse(String(output.mock.calls[0][0])).id).toBe('pikachu')
      expect(crossCheck).toHaveBeenCalledTimes(2)
      await main(['pikachu', '--json', '--html', sourceFile, '--no-cross-check'], directory)
      expect(crossCheck).toHaveBeenCalledTimes(2)
    })
  })

  it.each([{ extra: [] }, { extra: ['--json'] }])(
    'patches and formats only the selected file and prints a summary (%j)',
    async ({ extra }) => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await withDataset(async (directory, file, sourceFile) => {
        await main(['0025', '--patch', '--html', sourceFile, ...extra], directory)
        const written = readFileSync(file, 'utf8')
        expect(JSON.parse(written)).toEqual({
          ...pokemon,
          obtainableIn: ['rb-r', 'home'],
          transferOnlyIn: [],
        })
        const config = JSON.parse(
          readFileSync(new URL('../../../.oxfmtrc.json', import.meta.url), 'utf8'),
        )
        expect((await format(file, written, config)).code).toBe(written)
        expect(readdirSync(join(directory, 'pokemon'))).toEqual(['pikachu.json'])
        const summary = output.mock.calls.flat().join('\n')
        expect(summary).toContain('Patched and formatted:')
        expect(summary).toContain('obtainableIn:\n  Added: Red (rb-r)\n  Removed: Blue (rb-b)')
        expect(summary).toContain('transferOnlyIn:\n  Added: none\n  Removed: Red (rb-r)')
        expect(summary).toContain('eventOnlyIn: unchanged')
        expect(summary).toContain('storableIn: unchanged')
        expect(summary).not.toContain('┌')
        expect(summary).not.toContain('"obtainableIn"')
        output.mockClear()
        await main(['pikachu', '--patch', '--html', sourceFile], directory)
        expect(output.mock.calls.flat().join('\n')).toContain('Already up to date:')
        expect(readFileSync(file, 'utf8')).toBe(written)
      })
    },
  )

  it('does not modify a file without --patch and prints the terminal table', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await withDataset(async (directory, file, sourceFile) => {
      const original = readFileSync(file, 'utf8')
      await main(['pikachu', '--html', sourceFile], directory)
      expect(readFileSync(file, 'utf8')).toBe(original)
      expect(output.mock.calls.flat().join('\n')).toContain('┌')
    })
  })

  it('sorts stored games by the dataset index when patching, without changing membership', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await withDataset(async (directory, file, sourceFile) => {
      writeFileSync(file, JSON.stringify({ ...pokemon, storableIn: ['home', 'rb-b', 'rb-r'] }))
      await main(['pikachu', '--patch', '--html', sourceFile], directory)
      const patched = JSON.parse(readFileSync(file, 'utf8'))
      expect(patched.storableIn).toEqual(['rb-r', 'rb-b', 'home'])
      expect(patched.customField).toEqual(pokemon.customField)
    })
  })

  it('leaves the Pokémon untouched when the source is invalid', async () => {
    await withDataset(async (directory, file, sourceFile) => {
      const original = readFileSync(file, 'utf8')
      writeFileSync(sourceFile, '<h1>Access denied</h1>')
      await expect(main(['pikachu', '--patch', '--html', sourceFile], directory)).rejects.toThrow(
        'Game locations',
      )
      expect(readFileSync(file, 'utf8')).toBe(original)
    })
  })

  it('does not overwrite availability edited after the lookup began', async () => {
    await withDataset(async (_directory, file) => {
      const report = parseAvailability(source, pokemon, games)
      writeFileSync(file, JSON.stringify({ ...pokemon, obtainableIn: ['rb-b'] }))
      const current = readFileSync(file, 'utf8')
      await expect(patchPokemonFile(file, report)).rejects.toThrow('changed during lookup')
      expect(readFileSync(file, 'utf8')).toBe(current)
    })
  })

  it('verifies before patching and keeps AI diagnostics separate from the patch summary', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => {})
    await withDataset(async (directory, file, sourceFile) => {
      const original = readFileSync(file, 'utf8')
      const verify = vi
        .spyOn(aiVerification, 'verifyAvailabilityWithAi')
        .mockImplementation(async (report, html, currentGames) => {
          expect(readFileSync(file, 'utf8')).toBe(original)
          expect(report.pokemon).toEqual(pokemon)
          expect(html).toBe(source)
          expect(currentGames).toEqual(games)
          return {
            verdict: 'pass',
            summary: 'Reviewed',
            checks: [],
            findings: [],
            conflictResolutions: [],
            candidateJson: availabilityJson(report),
            differenceReason: null,
          }
        })
      await main(['pikachu', '--with-ai', '--patch', '--json', '--html', sourceFile], directory)
      expect(verify).toHaveBeenCalledOnce()
      expect(JSON.parse(readFileSync(file, 'utf8')).obtainableIn).toEqual(['rb-r', 'home'])
      expect(output.mock.calls.flat().join('\n')).toContain('Patched and formatted:')
      expect(output.mock.calls.flat().join('\n')).not.toContain('AI verification')
      expect(diagnostics.mock.calls.flat().join('\n')).toContain(
        'AI verification (gpt-5.6-luna): PASS',
      )
    })
  })

  it.each(['fail', 'uncertain', 'api-error'] as const)(
    'does not print or patch when AI verification returns %s',
    async (verdict) => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const verify = vi.spyOn(aiVerification, 'verifyAvailabilityWithAi')
      if (verdict === 'api-error') verify.mockRejectedValue(new Error('OpenAI unavailable'))
      else
        verify.mockImplementation(async (report) => ({
          verdict,
          summary: 'Needs review',
          checks: [],
          findings: [],
          conflictResolutions: [],
          candidateJson: availabilityJson(report),
          differenceReason: null,
        }))
      await withDataset(async (directory, file, sourceFile) => {
        const original = readFileSync(file, 'utf8')
        await expect(
          main(['pikachu', '--with-ai', '--patch', '--json', '--html', sourceFile], directory),
        ).rejects.toThrow()
        expect(readFileSync(file, 'utf8')).toBe(original)
        expect(output).not.toHaveBeenCalled()
      })
    },
  )

  it.each([
    { flags: ['--with-ai'], harder: false },
    { flags: ['--ai-harder'], harder: true },
    { flags: ['--with-ai', '--ai-harder'], harder: true },
  ])('selects the AI model and enables verification for %j', async ({ flags, harder }) => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => {})
    const verify = vi
      .spyOn(aiVerification, 'verifyAvailabilityWithAi')
      .mockImplementation(async (report) => ({
        verdict: 'pass',
        summary: 'Verified',
        checks: [],
        findings: [],
        conflictResolutions: [],
        candidateJson: availabilityJson(report),
        differenceReason: null,
      }))
    await withDataset(async (directory, file, sourceFile) => {
      const original = readFileSync(file, 'utf8')
      await main(['pikachu', '--json', '--html', sourceFile, ...flags], directory)
      expect(verify).toHaveBeenCalledOnce()
      expect(verify.mock.calls[0][3]).toEqual({ harder })
      expect(diagnostics.mock.calls.flat().join('\n')).toContain(
        `AI verification (gpt-5.6-${harder ? 'terra' : 'luna'}): PASS`,
      )
      expect(JSON.parse(String(output.mock.calls[0][0])).id).toBe('pikachu')
      expect(readFileSync(file, 'utf8')).toBe(original)
    })
  })

  it('keeps --with-ai --json output parseable and does not call AI without the flag', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const verify = vi
      .spyOn(aiVerification, 'verifyAvailabilityWithAi')
      .mockImplementation(async (report) => ({
        verdict: 'pass',
        summary: 'Reviewed',
        checks: [],
        findings: [],
        conflictResolutions: [],
        candidateJson: availabilityJson(report),
        differenceReason: null,
      }))
    await withDataset(async (directory, _file, sourceFile) => {
      await main(['pikachu', '--json', '--html', sourceFile], directory)
      expect(verify).not.toHaveBeenCalled()
      output.mockClear()
      await main(['pikachu', '--with-ai', '--json', '--html', sourceFile], directory)
      expect(JSON.parse(String(output.mock.calls[0][0])).id).toBe('pikachu')
      expect(output).toHaveBeenCalledOnce()
      expect(verify).toHaveBeenCalledOnce()
    })
  })

  it.each([false, true])(
    'uses the AI candidate for JSON and patch output (patch: %s)',
    async (patch) => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {})
      const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => {})
      const reason = 'The encounter applies to another form; the selected form requires transfer.'
      vi.spyOn(aiVerification, 'verifyAvailabilityWithAi').mockImplementation(async (report) =>
        aiVerification.validateAiReview(
          {
            summary: 'Corrected form attribution.',
            candidateJson: {
              ...availabilityJson(report),
              obtainableIn: ['home'],
              transferOnlyIn: ['rb-r'],
            },
            differenceReason: reason,
            checks: report.rows.map((row) => ({
              gameId: row.game.id,
              result: row.basis === 'dataset' ? 'retained' : 'accurate',
              evidence: 'Fixture form annotation supports the final classification.',
            })),
            findings: [],
            conflictResolutions: [],
          },
          report,
        ),
      )
      await withDataset(async (directory, file, sourceFile) => {
        const original = readFileSync(file, 'utf8')
        await main(
          ['pikachu', '--with-ai', '--json', '--html', sourceFile, ...(patch ? ['--patch'] : [])],
          directory,
        )
        const result = JSON.parse(
          patch ? readFileSync(file, 'utf8') : String(output.mock.calls[0][0]),
        )
        expect(result.obtainableIn).toEqual(['home'])
        expect(result.transferOnlyIn).toEqual(['rb-r'])
        expect(diagnostics.mock.calls.flat().join('\n')).toContain(`AI difference: ${reason}`)
        if (!patch) expect(readFileSync(file, 'utf8')).toBe(original)
      })
    },
  )
})

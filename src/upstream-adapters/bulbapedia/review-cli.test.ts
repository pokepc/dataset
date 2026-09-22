import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { availabilityJson, type AvailabilityPokemon, type AvailabilityReport } from './availability'
import * as ai from './ai-verification'
import * as crossChecks from './cross-check'
import * as pokeApi from '../pokeapi/client'
import * as serebii from '../serebii/availability-evidence'
import * as patcher from './patch'
import { bulbapediaUrl } from './availability'

let cacheDir: string
beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'pokepc-bulbapedia-review-cache-'))
  vi.stubEnv('BULBAPEDIA_CACHE_DIR', cacheDir)
  vi.spyOn(crossChecks, 'createAvailabilityCrossChecker').mockReturnValue(async (report) => report)
})

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
const passed = (report: AvailabilityReport) => ({
  verdict: 'pass' as const,
  summary: 'Verified',
  checks: [],
  findings: [],
  conflictResolutions: [],
  candidateJson: availabilityJson(report),
  differenceReason: null,
})

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
  vi.unstubAllEnvs()
  rmSync(cacheDir, { recursive: true, force: true })
})

describe('automatic availability patching', () => {
  it('patches and formats every candidate without reading input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => new Response(page())),
    )
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

  it.each([false, true])(
    'patches the AI-corrected candidate after review (harder: %s)',
    async (aiHarder) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => new Response(page())),
      )
      vi.mocked(crossChecks.createAvailabilityCrossChecker).mockReturnValue(async (report) => ({
        ...report,
        crossChecks: {
          pokeApi: { url: null, status: 'checked', encounters: [] },
          serebii: [],
          warnings: [],
          conflicts: [
            {
              id: 'fixture:gs-g',
              gameId: 'gs-g',
              message: 'Fixture conflict',
              evidence: 'Fixture evidence',
            },
          ],
          unresolvedConflictIds: ['fixture:gs-g'],
        },
      }))
      const verify = vi
        .spyOn(ai, 'verifyAvailabilityWithAi')
        .mockImplementation(async (report) => ({
          ...passed(report),
          checks: report.rows.map((row) => ({
            gameId: row.game.id,
            result: 'accurate' as const,
            evidence: 'Fixture evidence confirms the corrected candidate.',
          })),
          conflictResolutions: [
            {
              conflictId: 'fixture:gs-g',
              result: 'resolved' as const,
              evidence: 'Fixture source conflict resolved.',
              sourceUrls: [],
            },
          ],
          candidateJson: { ...availabilityJson(report), obtainableIn: ['gs-g'] },
          differenceReason: 'Fixture evidence excludes Red.',
        }))
      const review = session([])
      await withDataset(async (directory, files) => {
        await reviewDataset(directory, review.io, review.signal, {
          patchAll: true,
          withAi: !aiHarder,
          aiHarder,
        })
        expect(verify).toHaveBeenCalledTimes(2)
        expect(verify.mock.calls[0][0].crossChecks?.unresolvedConflictIds).toEqual(['fixture:gs-g'])
        expect(verify.mock.calls[0][3]?.harder).toBe(aiHarder)
        expect(review.prompts()).toEqual([])
        expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['gs-g'])
        expect(review.output()).toContain('Finished: 2 patched')
      })
    },
  )

  it.each(['source conflict', 'AI fail', 'AI uncertain', 'AI error', 'patch error'])(
    'stops at %s and preserves earlier patches without prompting',
    async (blocker) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => new Response(page())),
      )
      if (blocker === 'source conflict') {
        vi.mocked(crossChecks.createAvailabilityCrossChecker).mockReturnValue(async (report) =>
          report.pokemon.id === 'pikachu'
            ? report
            : {
                ...report,
                crossChecks: {
                  pokeApi: { url: null, status: 'checked', encounters: [] },
                  serebii: [],
                  warnings: [],
                  conflicts: [
                    {
                      id: 'pokeapi:gs-g',
                      gameId: 'gs-g',
                      message: 'Fixture conflict',
                      evidence: 'Fixture encounter',
                    },
                  ],
                  unresolvedConflictIds: ['pokeapi:gs-g'],
                },
              },
        )
      }
      if (blocker.startsWith('AI')) {
        vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(async (report) => {
          if (report.pokemon.id === 'pikachu') return passed(report)
          if (blocker === 'AI error') throw new Error('Fixture AI failure')
          return { ...passed(report), verdict: blocker === 'AI fail' ? 'fail' : 'uncertain' }
        })
      }
      if (blocker === 'patch error') {
        const original = patcher.patchPokemonFile
        vi.spyOn(patcher, 'patchPokemonFile').mockImplementation(async (file, report) => {
          if (report.pokemon.id === 'pikachu-f') throw new Error('Fixture write failure')
          return original(file, report)
        })
      }
      const review = session([])
      await withDataset(async (directory, files, originals) => {
        const result = await reviewDataset(directory, review.io, review.signal, {
          patchAll: true,
          withAi: blocker.startsWith('AI'),
        })
        expect(result.blocked).toBe(true)
        expect(review.prompts()).toEqual([])
        expect(readFileSync(files[0], 'utf8')).not.toBe(originals[0])
        expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
        expect(review.output()).toContain('Automatic patching stopped at pikachu-f:')
        expect(review.output()).toContain('--from pikachu-f without --patch-all')
        expect(review.output()).toContain('Stopped: 1 patched, 0 already up to date, 0 skipped.')
      })
    },
  )

  it('stops at a lookup failure before visiting later Pokémon', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    const review = session([])
    await withDataset(async (directory, files, originals) => {
      expect(
        (await reviewDataset(directory, review.io, review.signal, { patchAll: true })).blocked,
      ).toBe(true)
      expect(review.prompts()).toEqual([])
      expect(review.output()).not.toContain('[2/2]')
      expect(review.output()).toContain('lookup failed; no candidate is available.')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })

  it('combines --from and --skip-unchanged without rewriting skipped files or calling AI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
    const review = session([])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, {
          patchAll: true,
          from: 'pikachu-f',
          skipUnchanged: true,
          withAi: true,
        })
        expect(verify).not.toHaveBeenCalled()
        expect(review.prompts()).toEqual([])
        expect(review.output()).not.toContain('[1/2]')
        expect(review.output()).toContain('Finished: 0 patched, 1 already up to date, 0 skipped.')
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      },
      [records[0], { ...records[1], obtainableIn: ['gs-g'] }],
    )
  })

  it('honors cancellation after a completed patch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const controller = new AbortController()
    const review = session([], controller)
    review.io.write.mockImplementation((message) => {
      if (message.startsWith('Patched and formatted:')) controller.abort()
    })
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal, { patchAll: true })
      expect(review.prompts()).toEqual([])
      expect(review.output()).toContain('Stopped: 1 patched')
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
    })
  })
})

describe('interactive availability review', () => {
  it('reuses Bulbapedia across reviews and refreshes once for adjacent forms', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response(page()))
    vi.stubGlobal('fetch', fetch)
    await withDataset(async (directory) => {
      for (const refreshSources of [false, false, true]) {
        const review = session(['s', 's'])
        await reviewDataset(directory, review.io, review.signal, { refreshSources })
        expect(review.output()).toContain('Finished: 0 patched, 0 already up to date, 2 skipped.')
        expect(fetch).toHaveBeenCalledTimes(refreshSources ? 2 : 1)
      }
    })
  })

  it.each(['pikachu-f', '0025-f', '25-f'])(
    'starts inclusively from %s without reviewing earlier records',
    async (from) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(
            async (url: string) =>
              new Response(page(url.includes('/Raichu_') ? 'Raichu' : 'Pikachu')),
          ),
      )
      const checked: string[] = []
      vi.mocked(crossChecks.createAvailabilityCrossChecker).mockReturnValue(async (report) => {
        checked.push(report.pokemon.id)
        return report
      })
      const verify = vi
        .spyOn(ai, 'verifyAvailabilityWithAi')
        .mockImplementation(async (report) => passed(report))
      const review = session(['s', 's'])
      await withDataset(
        async (directory, files, originals) => {
          await reviewDataset(directory, review.io, review.signal, { from, withAi: true })
          expect(checked).toEqual(['pikachu-f', 'raichu'])
          expect(verify.mock.calls.map(([report]) => report.pokemon.id)).toEqual(checked)
          expect(review.io.read).toHaveBeenCalledTimes(2)
          expect(review.output()).toContain('Starting at pikachu-f; 1 earlier records bypassed.')
          expect(review.output()).not.toContain('[1/3]')
          expect(review.output()).toContain('[2/3]')
          expect(review.output()).toContain('[3/3]')
          expect(review.output()).toContain('Finished: 0 patched, 0 already up to date, 2 skipped.')
          expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
        },
        [...records, { ...raichu, unrelated: 'preserve me' }],
      )
    },
  )

  it('combines starting at the final record with --skip-unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
    const review = session([])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, {
          from: 'pikachu-f',
          skipUnchanged: true,
          withAi: true,
        })
        expect(review.io.read).not.toHaveBeenCalled()
        expect(verify).not.toHaveBeenCalled()
        expect(review.output()).toContain('[2/2]')
        expect(review.output()).not.toContain('[1/2]')
        expect(review.output()).toContain('Finished: 0 patched, 1 already up to date, 0 skipped.')
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      },
      [records[0], { ...records[1], obtainableIn: ['gs-g'] }],
    )
  })

  it.each(['unknown-pokemon', '', '26'])(
    'rejects invalid --from %j before any requests',
    async (from) => {
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      const review = session(['s'])
      await withDataset(async (directory, files, originals) => {
        await expect(reviewDataset(directory, review.io, review.signal, { from })).rejects.toThrow(
          'Unknown Pokémon',
        )
        expect(fetch).not.toHaveBeenCalled()
        expect(crossChecks.createAvailabilityCrossChecker).not.toHaveBeenCalled()
        expect(review.io.read).not.toHaveBeenCalled()
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      })
    },
  )

  it.each([false, true])(
    'cross-checks unchanged candidates, blocks conflicts, then patches a resolved AI candidate (automatic: %s)',
    async (withAi) => {
      vi.mocked(crossChecks.createAvailabilityCrossChecker).mockRestore()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(page().replace('Viridian Forest</a>', 'Trade</a>'))),
      )
      const order: string[] = []
      vi.spyOn(pokeApi, 'fetchPokeApiJson').mockImplementation(async () => {
        order.push('pokeapi')
        return [
          {
            location_area: {
              name: 'viridian-forest',
              url: 'https://pokeapi.co/api/v2/location-area/1/',
            },
            version_details: [
              {
                version: { name: 'red', url: 'https://pokeapi.co/api/v2/version/1/' },
                encounter_details: [
                  {
                    method: { name: 'walk', url: 'https://pokeapi.co/api/v2/encounter-method/1/' },
                    condition_values: [],
                  },
                ],
              },
            ],
          },
        ]
      })
      vi.spyOn(serebii, 'fetchSerebiiEvidence').mockImplementation(async (target) => {
        order.push('serebii')
        return { ...target, html: '<table><tr><td>Red</td><td>Viridian Forest</td></tr></table>' }
      })
      vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(async (report) => {
        order.push('ai')
        expect(report.crossChecks?.unresolvedConflictIds).toEqual(['pokeapi:rb-r'])
        return ai.validateAiReview(
          {
            summary: 'Resolved mislabeled encounter.',
            candidateJson: {
              ...availabilityJson(report),
              obtainableIn: ['rb-r', 'gs-g'],
              transferOnlyIn: [],
            },
            differenceReason:
              'PokéAPI and Serebii identify a wild encounter behind the mislabeled location link.',
            checks: report.rows.map((row) => ({
              gameId: row.game.id,
              result: 'accurate',
              evidence: 'Supplied sources establish ordinary acquisition.',
            })),
            findings: [],
            conflictResolutions: [
              {
                conflictId: 'pokeapi:rb-r',
                result: 'resolved',
                evidence:
                  'The location hyperlink is mislabeled Trade; the other sources establish the encounter.',
                sourceUrls: [
                  bulbapediaUrl(report.pokemon),
                  report.crossChecks!.pokeApi.url!,
                  report.crossChecks!.serebii[0].url,
                ],
              },
            ],
          },
          report,
        )
      })
      const review = session(withAi ? ['p'] : ['p', 'a', 'p'])
      await withDataset(
        async (directory, files) => {
          await reviewDataset(directory, review.io, review.signal, { withAi, skipUnchanged: true })
          expect(order).toEqual(['pokeapi', 'serebii', 'ai'])
          expect(review.output()).toContain('Uncertain (rb-r)')
          if (!withAi)
            expect(review.output()).toContain('Patching is blocked by unresolved source conflicts')
          expect(JSON.parse(readFileSync(files[0], 'utf8'))).toMatchObject({
            obtainableIn: ['rb-r', 'gs-g'],
            transferOnlyIn: [],
            unrelated: 'preserve me',
          })
          expect(review.output()).toContain('Finished: 1 patched')
        },
        [{ ...records[0], obtainableIn: ['gs-g'], transferOnlyIn: ['rb-r'] }],
      )
    },
  )

  it.each([false, true])(
    'displays and patches the AI correction (automatic: %s)',
    async (withAi) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
      const reason = 'The Red encounter describes another form, so this form requires transfer.'
      const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(async (report) =>
        ai.validateAiReview(
          {
            summary: 'Corrected form attribution.',
            candidateJson: {
              ...availabilityJson(report),
              obtainableIn: ['gs-g'],
              transferOnlyIn: ['rb-r'],
            },
            differenceReason: reason,
            checks: report.rows.map((row) => ({
              gameId: row.game.id,
              result: 'accurate',
              evidence: 'Fixture form annotation supports the final route.',
            })),
            findings: [],
            conflictResolutions: [],
          },
          report,
        ),
      )
      const review = session(withAi ? [] : ['a'])
      await withDataset(
        async (directory, files, originals) => {
          review.io.read.mockImplementation(async (prompt) => {
            if (prompt.includes('a) ai pass')) return 'a'
            expect(readFileSync(files[0], 'utf8')).toBe(originals[0])
            expect(review.output()).toContain(`AI difference: ${reason}`)
            expect(review.output()).toContain('transferOnlyIn:\n  Added: Red (rb-r)')
            expect(review.output()).toContain('AI candidate:')
            return 'p'
          })
          await reviewDataset(directory, review.io, review.signal, { withAi })
          expect(verify).toHaveBeenCalledOnce()
          expect(JSON.parse(readFileSync(files[0], 'utf8'))).toMatchObject({
            obtainableIn: ['gs-g'],
            transferOnlyIn: ['rb-r'],
            storableIn: ['gs-g'],
            unrelated: 'preserve me',
          })
        },
        [records[0]],
      )
    },
  )

  it('keeps concurrent-edit protection when patching an AI candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(async (report) => passed(report))
    const review = session(['s'])
    await withDataset(
      async (directory, files) => {
        const edited = JSON.stringify({ ...records[0], obtainableIn: ['gs-g'] })
        review.io.read.mockImplementationOnce(async () => {
          writeFileSync(files[0], edited)
          return 'p'
        })
        await reviewDataset(directory, review.io, review.signal, { withAi: true })
        expect(review.output()).toContain('changed during lookup')
        expect(readFileSync(files[0], 'utf8')).toBe(edited)
      },
      [records[0]],
    )
  })

  it.each([false, true])('uses Terra when aiHarder is enabled (withAi: %s)', async (withAi) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const verify = vi
      .spyOn(ai, 'verifyAvailabilityWithAi')
      .mockImplementation(async (report) => passed(report))
    const review = session(['s'])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, {
          withAi,
          aiHarder: true,
          skipUnchanged: true,
        })
        expect(verify).toHaveBeenCalledOnce()
        expect(verify.mock.calls[0][3]).toEqual({ signal: review.signal, harder: true })
        expect(review.output()).toContain(
          'Verifying input and candidate JSON with gpt-5.6-terra (low reasoning)',
        )
        expect(review.output()).toContain('AI verification (gpt-5.6-terra): PASS')
        expect(review.prompts()).toEqual(['p) patch  s) skip > '])
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      },
      [records[0]],
    )
  })

  it('runs automatic AI before every prompt and still requires p to patch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const review = session([])
    const verify = vi
      .spyOn(ai, 'verifyAvailabilityWithAi')
      .mockImplementation(async (report) => passed(report))
    await withDataset(async (directory, files, originals) => {
      review.io.read
        .mockImplementationOnce(async () => {
          expect(verify).toHaveBeenCalledTimes(1)
          expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
          expect(review.output()).toContain('AI verification (gpt-5.6-luna): PASS')
          return 'p'
        })
        .mockImplementationOnce(async () => {
          expect(verify).toHaveBeenCalledTimes(2)
          expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
          return 's'
        })
      await reviewDataset(directory, review.io, review.signal, { withAi: true })
      expect(verify.mock.calls.map(([report]) => report.pokemon.id)).toEqual([
        'pikachu',
        'pikachu-f',
      ])
      expect(review.prompts()).toEqual(['p) patch  s) skip > ', 'p) patch  s) skip > '])
      expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['rb-r', 'gs-g'])
      expect(readFileSync(files[1], 'utf8')).toBe(originals[1])
      expect(review.output()).toContain('Finished: 1 patched, 0 already up to date, 1 skipped.')
    })
  })

  it('skips unchanged candidates before automatic AI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const verify = vi
      .spyOn(ai, 'verifyAvailabilityWithAi')
      .mockImplementation(async (report) => passed(report))
    const review = session(['s'])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, {
          skipUnchanged: true,
          withAi: true,
        })
        expect(verify).toHaveBeenCalledOnce()
        expect(verify.mock.calls[0][0].pokemon.id).toBe('pikachu-f')
        const skippedOutput = review.output().split('[2/2]')[0]
        expect(skippedOutput).toContain('AI verification: not run.')
        expect(skippedOutput).toContain('Proposed changes: none.')
        expect(skippedOutput).not.toContain(': PASS')
        expect(review.prompts()).toEqual(['p) patch  s) skip > '])
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
        expect(review.output()).toContain('Finished: 0 patched, 1 already up to date, 1 skipped.')
      },
      [{ ...records[0], obtainableIn: ['rb-r', 'gs-g'] }, records[1]],
    )
  })

  it.each([false, true])(
    'skips after AI removes the proposed changes and prompts for the next changed record (automatic: %s)',
    async (withAi) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
      const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(async (report) => {
        const review = passed(report)
        if (report.pokemon.id === 'pikachu') {
          expect(review.candidateJson.obtainableIn).toEqual(['rb-r', 'gs-g'])
          review.candidateJson.obtainableIn = []
          return {
            ...review,
            differenceReason: 'The existing availability is correct.',
            checks: report.rows.map((row) => ({
              gameId: row.game.id,
              result: 'accurate' as const,
              evidence: 'Fixture evidence confirms the existing availability.',
            })),
          }
        }
        return review
      })
      const review = session(withAi ? ['s'] : ['a', 'a', 's'])
      await withDataset(async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, { withAi, skipUnchanged: true })
        expect(verify.mock.calls.map(([report]) => report.pokemon.id)).toEqual([
          'pikachu',
          'pikachu-f',
        ])
        expect(review.prompts()).toEqual(
          withAi
            ? ['p) patch  s) skip > ']
            : [
                'p) patch  s) skip  a) ai pass > ',
                'p) patch  s) skip  a) ai pass > ',
                'p) patch  s) skip > ',
              ],
        )
        expect(review.output()).toContain(
          'Already up to date: pikachu (skipped automatically after AI review).',
        )
        expect(review.output()).toContain('Finished: 0 patched, 1 already up to date, 1 skipped.')
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      })
    },
  )

  it('still prompts for an unchanged AI candidate without --skip-unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(async (report) => ({
      ...passed(report),
      candidateJson: { ...availabilityJson(report), obtainableIn: [] },
      differenceReason: 'The existing availability is correct.',
      checks: report.rows.map((row) => ({
        gameId: row.game.id,
        result: 'accurate' as const,
        evidence: 'Fixture evidence confirms the existing availability.',
      })),
    }))
    const review = session(['s'])
    await withDataset(
      async (directory, files, originals) => {
        await reviewDataset(directory, review.io, review.signal, { withAi: true })
        expect(review.prompts()).toEqual(['p) patch  s) skip > '])
        expect(review.output()).toContain('Finished: 0 patched, 0 already up to date, 1 skipped.')
        expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
      },
      [records[0]],
    )
  })

  it.each(['pass', 'fail', 'uncertain', 'error'] as const)(
    'only skips an unchanged conflicting candidate after AI passes (%s)',
    async (verdict) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
      vi.mocked(crossChecks.createAvailabilityCrossChecker).mockReturnValue(async (report) => ({
        ...report,
        crossChecks: {
          pokeApi: { url: null, status: 'unavailable', encounters: [] },
          serebii: [],
          conflicts: [
            { id: 'fixture', gameId: 'rb-r', message: 'Needs review', evidence: 'Fixture' },
          ],
          unresolvedConflictIds: ['fixture'],
          warnings: [],
        },
      }))
      const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
      if (verdict === 'error') verify.mockRejectedValue(new Error('API unavailable'))
      else verify.mockImplementation(async (report) => ({ ...passed(report), verdict }))
      const review = session(['s'])
      await withDataset(
        async (directory, files, originals) => {
          await reviewDataset(directory, review.io, review.signal, {
            withAi: true,
            skipUnchanged: true,
          })
          expect(verify).toHaveBeenCalledOnce()
          expect(review.prompts()).toEqual(
            verdict === 'pass' ? [] : ['p) patch (blocked by AI review)  s) skip > '],
          )
          expect(review.output()).toContain(
            verdict === 'pass'
              ? 'Finished: 0 patched, 1 already up to date, 0 skipped.'
              : 'Finished: 0 patched, 0 already up to date, 1 skipped.',
          )
          expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
        },
        [{ ...records[0], obtainableIn: ['gs-g', 'rb-r'] }],
      )
    },
  )

  it.each(['fail', 'uncertain', 'error'] as const)(
    'blocks patching after automatic AI %s without repeating the API call',
    async (verdict) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
      const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
      if (verdict === 'error') verify.mockRejectedValue(new Error('API unavailable'))
      else verify.mockImplementation(async (report) => ({ ...passed(report), verdict }))
      const review = session(['p', 's'])
      await withDataset(
        async (directory, files, originals) => {
          await reviewDataset(directory, review.io, review.signal, { withAi: true })
          expect(verify).toHaveBeenCalledOnce()
          expect(review.prompts()).toEqual([
            'p) patch (blocked by AI review)  s) skip > ',
            'p) patch (blocked by AI review)  s) skip > ',
          ])
          expect(review.output()).toContain('Patching is blocked')
          expect(review.output()).toContain(
            'The proposal below is the original mechanical candidate; rejected AI changes have not been applied.',
          )
          expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
        },
        [records[0]],
      )
    },
  )

  it('does not run automatic AI without a successful source lookup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Blocked', { status: 403 })))
    const verify = vi.spyOn(ai, 'verifyAvailabilityWithAi')
    const review = session(['s'])
    await withDataset(
      async (directory) => {
        await reviewDataset(directory, review.io, review.signal, { withAi: true })
        expect(verify).not.toHaveBeenCalled()
        expect(review.prompts()).toEqual(['s) skip > '])
      },
      [records[0]],
    )
  })

  it('skips unchanged records and keeps AI and patch choices for the next changed candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const verify = vi
      .spyOn(ai, 'verifyAvailabilityWithAi')
      .mockImplementation(async (report) => passed(report))
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
        .mockImplementation(async (report, html, games, { signal } = {}) => {
          expect(readFileSync(files[0], 'utf8')).toBe(originals[0])
          expect(report.pokemon).toEqual(records[0])
          expect(html).toBe(page())
          expect(games).toEqual([red, gold])
          expect(signal).toBe(review.signal)
          return passed(report)
        })
      await reviewDataset(directory, review.io, review.signal)
      expect(verify).toHaveBeenCalledOnce()
      expect(review.prompts()).toEqual([
        'p) patch  s) skip  a) ai pass > ',
        'p) patch  s) skip > ',
        'p) patch  s) skip  a) ai pass > ',
      ])
      expect(review.output()).toContain('AI verification (gpt-5.6-luna): PASS')
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
      else verify.mockImplementation(async (report) => ({ ...passed(report), verdict }))
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

  it.each([false, true])('cancels an active AI review (automatic: %s)', async (withAi) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(page())))
    const controller = new AbortController()
    vi.spyOn(ai, 'verifyAvailabilityWithAi').mockImplementation(
      async (report, _html, _games, { signal } = {}) => {
        controller.abort()
        signal!.throwIfAborted()
        return passed(report)
      },
    )
    const review = session(withAi ? ['p'] : ['a', 'p'], controller)
    await withDataset(async (directory, files, originals) => {
      await reviewDataset(directory, review.io, review.signal, { withAi })
      expect(review.io.read).toHaveBeenCalledTimes(withAi ? 0 : 1)
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
  await main([...process.argv.slice(2), '--no-cross-check'], process.argv[1]);`

describe('review CLI input and interruption', () => {
  it('prints help without fetching any pages', () => {
    const result = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('pokemon:availability:all')
    expect(result.stdout).toContain('Ctrl+C')
    expect(result.stdout).toContain('--skip-unchanged')
    expect(result.stdout).toContain('--with-ai')
    expect(result.stdout).toContain('--ai-harder')
    expect(result.stdout).toContain('--from <id|nid>')
    expect(result.stdout).toContain('--patch-all')
  })

  it('accepts --patch-all without stdin and exits successfully after patching', async () => {
    await withDataset(async (directory, files) => {
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', offlineProgram, directory, '--patch-all'],
        { encoding: 'utf8', cwd: directory, timeout: 5000 },
      )
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('Finished: 2 patched')
      expect(result.stdout).not.toContain('p) patch')
      expect(JSON.parse(readFileSync(files[0], 'utf8')).obtainableIn).toEqual(['rb-r', 'gs-g'])
    })
  })

  it('exits nonzero on the first automatic lookup blocker without prompts', async () => {
    await withDataset(async (directory, files, originals) => {
      const program = `import { main } from ${JSON.stringify(entry)};
        globalThis.fetch = async () => new Response('', { status: 404 });
        await main(['--patch-all', '--no-cross-check'], process.argv[1]);`
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', program, directory],
        { encoding: 'utf8', cwd: directory, timeout: 5000 },
      )
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('Automatic patching stopped at pikachu:')
      expect(result.stdout).not.toContain('s) skip >')
      expect(result.stdout).not.toContain('[2/2]')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })

  it('accepts --from on the real CLI and preserves original progress numbering', async () => {
    await withDataset(async (directory, files, originals) => {
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', offlineProgram, directory, '--from', '25-f'],
        { input: 's\n', encoding: 'utf8', cwd: directory, timeout: 5000 },
      )
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('[2/2]')
      expect(result.stdout).not.toContain('[1/2]')
      expect(result.stdout).toContain('Finished: 0 patched, 0 already up to date, 1 skipped.')
      expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(originals)
    })
  })

  it('rejects --from without a value before opening review', () => {
    const result = spawnSync(process.execPath, [entry, '--from'], {
      encoding: 'utf8',
      timeout: 5000,
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('--from')
  })

  it.each(['--with-ai', '--ai-harder'])(
    'accepts %s and blocks patching after a mocked API failure',
    async (flag) => {
      const program = `import { main } from ${JSON.stringify(entry)};
      globalThis.fetch = async (input) => String(input).startsWith('https://api.openai.com/')
        ? new Response(JSON.stringify({ error: { message: 'Fixture failure' } }), {
            status: 503, headers: { 'content-type': 'application/json' }
          })
        : new Response(${JSON.stringify(page())});
      await main([...process.argv.slice(2), '--no-cross-check'], process.argv[1]);`
      await withDataset(
        async (directory, files, originals) => {
          const result = spawnSync(
            process.execPath,
            ['--input-type=module', '-e', program, directory, flag],
            {
              input: 'p\ns\n',
              encoding: 'utf8',
              cwd: directory,
              timeout: 5000,
              env: { ...process.env, OPENAI_API_KEY: 'test-key' },
            },
          )
          expect(result.stderr).toBe('')
          expect(result.status).toBe(0)
          expect(result.stdout).toContain(
            `with gpt-5.6-${flag === '--ai-harder' ? 'terra' : 'luna'} (low reasoning)`,
          )
          expect(result.stdout).toContain('AI verification failed:')
          expect(result.stdout).toContain('p) patch (blocked by AI review)  s) skip > ')
          expect(result.stdout).toContain('Finished: 0 patched, 0 already up to date, 1 skipped.')
          expect(readFileSync(files[0], 'utf8')).toBe(originals[0])
        },
        [records[0]],
      )
    },
  )

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

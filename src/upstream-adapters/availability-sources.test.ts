import { beforeEach, describe, expect, it, vi } from 'vitest'
import pikachu from '../../data/pokemon/pikachu.json'
import pikachuFemale from '../../data/pokemon/pikachu-f.json'
import { loadAvailabilitySource } from '../lib/availability-sources.ts'
import {
  availabilityUrls,
  createAvailabilityReport,
  parseAvailabilityTables,
  type AvailabilityGame,
  type AvailabilityReport,
} from './bulbapedia/availability.ts'
import { fetchAvailabilityPage } from './bulbapedia/fetch.ts'

vi.mock('./bulbapedia/fetch.ts', () => ({ fetchAvailabilityPage: vi.fn() }))
vi.mock('./bulbapedia/availability.ts', async (original) => ({
  ...(await original<typeof import('./bulbapedia/availability.ts')>()),
  parseAvailabilityTables: vi.fn(),
  createAvailabilityReport: vi.fn(),
}))

const game = (id: string): AvailabilityGame => ({
  id,
  name: id,
  type: 'game',
  gameSet: null,
  gameSuperSet: null,
  gen: 9,
})
const games = ['sv-s', 'sv-v', 'swsh-sw', 'usum-um', 'go', 'home'].map(game)
const report = (): AvailabilityReport => ({
  pokemon: pikachu,
  gameOrder: games.map((game) => game.id),
  rows: games.map((game) => ({
    game,
    status: 'unknown',
    basis: 'unknown',
    methods: [],
    storable: false,
  })),
  warnings: ['Unmatched forms are not inferred from species rows.'],
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchAvailabilityPage).mockResolvedValue('<table>source</table>')
  vi.mocked(parseAvailabilityTables).mockReturnValue({
    gameIds: new Set(games.filter((game) => game.id !== 'home').map((game) => game.id)),
  } as ReturnType<typeof parseAvailabilityTables>)
  vi.mocked(createAvailabilityReport).mockReturnValue(report())
})

describe('availability source loader', () => {
  it('loads only the requested table and exposes direct parser classifications', async () => {
    const parsed = report()
    parsed.rows[0] = {
      ...parsed.rows[0]!,
      status: 'obtainableIn',
      basis: 'source',
      methods: [{ text: 'C', status: 'obtainableIn', note: 'Catchable in the wild.' }],
    }
    parsed.rows[1] = {
      ...parsed.rows[1]!,
      status: 'unavailable',
      basis: 'source',
      methods: [{ text: '—', status: 'unavailable' }],
    }
    parsed.rows[2] = {
      ...parsed.rows[2]!,
      status: 'transferOnlyIn',
      basis: 'source',
      methods: [{ text: 'T', status: 'transferOnlyIn' }],
    }
    parsed.rows[3] = {
      ...parsed.rows[3]!,
      status: 'eventOnlyIn',
      basis: 'source',
      methods: [{ text: 'E', status: 'eventOnlyIn' }],
    }
    vi.mocked(createAvailabilityReport).mockReturnValue(parsed)
    const result = await loadAvailabilitySource('bulbapedia', pikachu, games, {
      cacheDir: '/tmp/comparison',
      refresh: true,
      siblings: [pikachu, pikachuFemale],
    })
    expect(fetchAvailabilityPage).toHaveBeenCalledExactlyOnceWith('main', undefined, {
      cacheDir: '/tmp/comparison/bulbapedia',
      forceRefresh: true,
    })
    expect(parseAvailabilityTables).toHaveBeenCalledExactlyOnceWith({
      main: '<table>source</table>',
    })
    expect(createAvailabilityReport).toHaveBeenCalledWith(expect.anything(), pikachu, games, [
      pikachu,
      pikachuFemale,
    ])
    expect(result.rows[0]).toMatchObject({
      state: 'found',
      entries: [{ text: 'C', url: availabilityUrls.main, notes: ['Catchable in the wild.'] }],
      verdict: { status: 'obtainable', reason: 'C — Catchable in the wild.' },
    })
    expect(result.rows.slice(1, 4).map((row) => row.verdict?.status)).toEqual([
      'unavailable',
      'transfer-only',
      'event-only',
    ])
    expect(result.rows.slice(4).map((row) => row.state)).toEqual(['unsupported', 'unsupported'])
    expect(result.notes).toEqual(parsed.warnings)
  })

  it('uses only the GO table for GO and accepts explicit female-form rules', async () => {
    const parsed = report()
    parsed.rows[4] = {
      ...parsed.rows[4]!,
      status: 'obtainableIn',
      basis: 'rule',
      methods: [
        { text: 'Available', status: 'obtainableIn', note: 'Inherited cosmetic female row.' },
      ],
    }
    vi.mocked(createAvailabilityReport).mockReturnValue(parsed)
    const result = await loadAvailabilitySource('bulbapedia-go', pikachuFemale, games)
    expect(fetchAvailabilityPage).toHaveBeenCalledWith('go', undefined, expect.anything())
    expect(parseAvailabilityTables).toHaveBeenCalledWith({ go: '<table>source</table>' })
    expect(result.rows[4]).toMatchObject({
      state: 'found',
      entries: [{ url: availabilityUrls.go }],
      verdict: { status: 'obtainable' },
    })
    expect(
      result.rows.filter((row) => row.gameId !== 'go').every((row) => row.state === 'unsupported'),
    ).toBe(true)
  })

  it('never treats retained dataset values or unmatched forms as source evidence', async () => {
    const parsed = report()
    parsed.rows[0] = {
      ...parsed.rows[0]!,
      status: 'obtainableIn',
      basis: 'dataset',
      methods: [{ text: 'No matching form row; saved value retained.', status: 'unknown' }],
    }
    vi.mocked(createAvailabilityReport).mockReturnValue(parsed)
    const result = await loadAvailabilitySource('bulbapedia', pikachu, games)
    expect(result.rows[0]).toMatchObject({ state: 'missing', entries: [] })
    expect(result.rows[0]?.verdict).toBeUndefined()
    expect(result.rows[1]).toMatchObject({ state: 'missing', entries: [] })
  })

  it('exposes explicit HOME rules and preserves rule provenance', async () => {
    const parsed = report()
    parsed.rows[5] = {
      ...parsed.rows[5]!,
      status: 'eventOnlyIn',
      basis: 'rule',
      methods: [
        {
          text: 'HOME gift event for Gigantamax Melmetal.',
          status: 'eventOnlyIn',
          sourceUrl: null,
        },
      ],
    }
    parsed.rows[0] = {
      ...parsed.rows[0]!,
      status: 'unavailable',
      basis: 'rule',
      methods: [
        {
          text: 'Mega Evolution is unavailable.',
          status: 'unavailable',
          sourceUrl: 'https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution',
        },
      ],
    }
    vi.mocked(createAvailabilityReport).mockReturnValue(parsed)
    const result = await loadAvailabilitySource('bulbapedia', pikachu, games)
    expect(result.rows[5]).toMatchObject({
      state: 'found',
      verdict: { status: 'event-only' },
      entries: [{ url: '' }],
    })
    expect(result.rows[0].entries[0].url).toBe(
      'https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution',
    )
  })

  it('reports a failed table without inventing unavailability or fetching another source', async () => {
    vi.mocked(fetchAvailabilityPage).mockRejectedValue(new Error('Bulbapedia blocked'))
    const result = await loadAvailabilitySource('bulbapedia-go', pikachu, games)
    expect(result.error).toBe('Bulbapedia blocked')
    expect(result.rows[4]).toMatchObject({
      state: 'error',
      entries: [],
      message: 'Bulbapedia blocked',
    })
    expect(
      result.rows.filter((row) => row.gameId !== 'go').every((row) => row.state === 'unsupported'),
    ).toBe(true)
    expect(parseAvailabilityTables).not.toHaveBeenCalled()
    expect(fetchAvailabilityPage).toHaveBeenCalledTimes(1)
  })

  it('honors cancellation before and during requests', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Cancelled'))
    await expect(
      loadAvailabilitySource('bulbapedia', pikachu, games, { signal: controller.signal }),
    ).rejects.toThrow('Cancelled')
    expect(fetchAvailabilityPage).not.toHaveBeenCalled()
    const active = new AbortController()
    vi.mocked(fetchAvailabilityPage).mockImplementation(async () => {
      active.abort(new Error('Stopped'))
      throw new Error('Fetch aborted')
    })
    await expect(
      loadAvailabilitySource('bulbapedia-go', pikachu, games, { signal: active.signal }),
    ).rejects.toThrow('Stopped')
  })
})

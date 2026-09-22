import { beforeEach, describe, expect, it, vi } from 'vitest'
import pikachu from '../../data/pokemon/pikachu.json'
import pikachuFemale from '../../data/pokemon/pikachu-f.json'
import { loadAvailabilitySource } from '../lib/availability-sources.ts'
import type { AvailabilityGame } from './bulbapedia/availability.ts'
import { fetchSpeciesPage } from './bulbapedia/fetch.ts'
import { fetchPokeApiJson } from './pokeapi/client.ts'
import { fetchSerebiiEvidence } from './serebii/availability-evidence.ts'

vi.mock('./bulbapedia/fetch.ts', () => ({ fetchSpeciesPage: vi.fn() }))
vi.mock('./pokeapi/client.ts', () => ({ fetchPokeApiJson: vi.fn() }))
vi.mock('./serebii/availability-evidence.ts', async (original) => ({
  ...(await original<typeof import('./serebii/availability-evidence.ts')>()),
  fetchSerebiiEvidence: vi.fn(),
}))

const game = (id: string, name: string, versionId: number | null = null): AvailabilityGame => ({
  id,
  name,
  type: 'game',
  gameSet: null,
  gameSuperSet: null,
  gen: 9,
  pokeApiGameVersionId: versionId,
})
const games: AvailabilityGame[] = [
  game('rb-r', 'Red', 1),
  game('gs-g', 'Gold', 4),
  game('rs-r', 'Ruby', 7),
  game('dp-d', 'Diamond', 12),
  game('bw-b', 'Black', 17),
  game('xy-x', 'X', 23),
  game('sm-s', 'Sun', 27),
  game('swsh-sw', 'Sword', 33),
  game('swsh-sh', 'Shield', 34),
  game('sv-s', 'Scarlet', 40),
  game('sv-v', 'Violet', 41),
  { ...game('sv-tealmask', 'The Teal Mask'), type: 'dlc', gameSet: 'sv' },
  game('go', 'GO'),
  game('home', 'HOME'),
  game('lza', 'Legends: Z-A', 47),
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('availability source loader', () => {
  it('loads every supported Serebii generation and isolates a failed page', async () => {
    vi.mocked(fetchSerebiiEvidence).mockImplementation(async (target) => {
      if (target.url.includes('pokedex-sm')) throw new Error('Serebii returned HTTP 503')
      return {
        ...target,
        html: `<table><tr><td>Locations</td></tr>${target.gameIds.map((id) => `<tr><td>${games.find((game) => game.id === id)!.name}</td><td>Trade</td></tr>`).join('')}</table>`,
      }
    })
    const result = await loadAvailabilitySource('serebii', pikachu, games, {
      cacheDir: '/tmp/comparison',
      refresh: true,
    })
    expect(fetchSerebiiEvidence).toHaveBeenCalledTimes(9)
    expect(result.rows.find((row) => row.gameId === 'sm-s')).toMatchObject({
      state: 'error',
      entries: [],
      message: 'Serebii returned HTTP 503',
    })
    expect(result.rows.find((row) => row.gameId === 'sv-s')).toMatchObject({
      state: 'found',
      entries: [{ text: 'Trade' }],
    })
    for (const id of ['home', 'go'])
      expect(result.rows.find((row) => row.gameId === id)?.state).toBe('unsupported')
    expect(result.rows.find((row) => row.gameId === 'lza')?.state).toBe('missing')
    expect(result.error).toContain('Other pages are shown')
    expect(fetchSerebiiEvidence).toHaveBeenCalledWith(
      expect.anything(),
      pikachu,
      expect.objectContaining({ cacheDir: '/tmp/comparison/serebii', forceRefresh: true }),
    )
  })

  it('loads explicit Z-A rows from the shared Gen IX page even when only Z-A is requested', async () => {
    vi.mocked(fetchSerebiiEvidence).mockImplementation(async (target) => ({
      ...target,
      html: '<table><tr><td>Locations</td></tr><tr><td>Legends: Z-A</td><td>Wild Zone 20</td></tr></table>',
    }))
    const result = await loadAvailabilitySource('serebii', pikachu, [
      games.find((game) => game.id === 'lza')!,
    ])
    expect(fetchSerebiiEvidence).toHaveBeenCalledExactlyOnceWith(
      { url: 'https://www.serebii.net/pokedex-sv/pikachu/', gameIds: ['sv-s'] },
      pikachu,
      expect.anything(),
    )
    expect(result.rows).toMatchObject([
      { gameId: 'lza', state: 'found', entries: [{ text: 'Wild Zone 20' }] },
    ])
    expect(result.rows).toHaveLength(1)
  })

  it('marks Z-A as an error when its shared page fails', async () => {
    vi.mocked(fetchSerebiiEvidence).mockRejectedValue(new Error('HTTP 503'))
    const result = await loadAvailabilitySource('serebii', pikachu, [
      games.find((game) => game.id === 'lza')!,
    ])
    expect(result.rows).toMatchObject([
      { gameId: 'lza', state: 'error', entries: [], message: 'HTTP 503' },
    ])
  })

  it('reports empty PokéAPI results as missing records, never inferred unavailability', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue([])
    const result = await loadAvailabilitySource('pokeapi', pikachu, games, {
      siblings: [pikachu, pikachuFemale],
    })
    expect(result.rows.find((row) => row.gameId === 'rb-r')).toMatchObject({
      state: 'missing',
      entries: [],
    })
    expect(result.rows.find((row) => row.gameId === 'home')).toMatchObject({ state: 'unsupported' })
    expect(result.notes.join(' ')).toContain('pikachu-f')
    expect(result.notes.join(' ')).toContain('Empty results do not rule out')
    expect(result.error).toBeUndefined()
  })

  it('keeps raw encounter methods/conditions and maps DLC only to its explicit parent', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue([
      {
        location_area: {
          name: 'kitakami-route',
          url: 'https://pokeapi.co/api/v2/location-area/1/',
        },
        version_details: [
          {
            version: {
              name: 'the-teal-mask-scarlet',
              url: 'https://pokeapi.co/api/v2/version/42/',
            },
            encounter_details: [
              {
                method: { name: 'gift', url: 'https://pokeapi.co/api/v2/encounter-method/1/' },
                condition_values: [
                  {
                    name: 'event-active',
                    url: 'https://pokeapi.co/api/v2/encounter-condition-value/1/',
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
    const result = await loadAvailabilitySource('pokeapi', pikachu, games)
    expect(result.rows.find((row) => row.gameId === 'sv-s')).toMatchObject({
      state: 'found',
      entries: [
        {
          text: 'kitakami-route: gift (event-active)',
          notes: ['Source version: the-teal-mask-scarlet'],
        },
      ],
    })
    expect(result.rows.find((row) => row.gameId === 'sv-v')?.state).toBe('missing')
    expect(result.rows.some((row) => row.gameId === 'sv-tealmask')).toBe(false)
  })

  it('does not use current dataset availability when a source fails', async () => {
    vi.mocked(fetchSpeciesPage).mockRejectedValue(new Error('Bulbapedia blocked'))
    const result = await loadAvailabilitySource('bulbapedia', pikachu, games)
    expect(result.error).toBe('Bulbapedia blocked')
    expect(result.rows.every((row) => row.state === 'error' && row.entries.length === 0)).toBe(true)
  })

  it('honors cancellation before requests and propagates mid-request cancellation', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Cancelled'))
    await expect(
      loadAvailabilitySource('pokeapi', pikachu, games, { signal: controller.signal }),
    ).rejects.toThrow('Cancelled')
    expect(fetchPokeApiJson).not.toHaveBeenCalled()
    const active = new AbortController()
    vi.mocked(fetchSpeciesPage).mockImplementation(async () => {
      active.abort(new Error('Stopped'))
      throw new Error('Fetch aborted')
    })
    await expect(
      loadAvailabilitySource('bulbapedia', pikachu, games, { signal: active.signal }),
    ).rejects.toThrow('Stopped')
  })
})

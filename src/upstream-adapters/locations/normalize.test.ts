import { describe, expect, it } from 'vitest'
import { normalizeLocations, sortLocations } from './normalize.ts'
import type { Candidate, Game, Location } from './types.ts'

const games: Game[] = [
  { id: 'rb-b', type: 'game', pokeApiGameVersionId: 2 },
  { id: 'rb-r', type: 'game', pokeApiGameVersionId: 1 },
  { id: 'rb', type: 'set', pokeApiGameVersionId: null },
  { id: 'xy-x', type: 'game', pokeApiGameVersionId: 23 },
  { id: 'xy-y', type: 'game', pokeApiGameVersionId: 24 },
  { id: 'swsh-sw', type: 'game', pokeApiGameVersionId: 33 },
  { id: 'swsh-sh', type: 'game', pokeApiGameVersionId: 34 },
  { id: 'sv-s', type: 'game', pokeApiGameVersionId: 40 },
  { id: 'sv-v', type: 'game', pokeApiGameVersionId: 41 },
]
const regions = ['kanto', 'johto', 'unova', 'kalos', 'alola', 'galar', 'paldea', 'kitakami'].map(
  (id) => ({
    id,
  }),
)
const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  source: 'pokeapi',
  sourceId: 'kanto-route-1',
  url: 'https://pokeapi.co/api/v2/location/1/',
  name: 'Route 1',
  region: 'kanto',
  games: ['rb-r'],
  pokeApiId: 1,
  ...overrides,
})
const normalize = (candidates: Candidate[]) => normalizeLocations(candidates, games, regions)

describe('location normalization', () => {
  it('separates Emerald’s mountain hideout from the renamed Lilycove hideout', () => {
    const inputs = [
      candidate({
        sourceId: 'magma-hideout',
        name: 'Magma Hideout',
        region: 'hoenn',
        pokeApiId: 486,
        games: ['e'],
      }),
      candidate({
        sourceId: 'team-aqua-hideout',
        name: 'Team Aqua Hideout',
        region: 'hoenn',
        pokeApiId: 692,
        games: ['e', 'oras-as'],
      }),
      candidate({
        sourceId: 'team-magma-hideout',
        name: 'Team Magma Hideout',
        region: 'hoenn',
        pokeApiId: 694,
        games: ['oras-or'],
      }),
      candidate({
        source: 'serebii',
        sourceId: '/pokearth/hoenn/magmahideout.shtml',
        name: 'Magma Hideout',
        region: 'hoenn',
        pokeApiId: null,
        games: ['e', 'oras-or', 'oras-as'],
      }),
    ]
    const result = normalizeLocations(
      inputs,
      ['e', 'oras-or', 'oras-as'].map((id) => ({ id, type: 'game', pokeApiGameVersionId: null })),
      [{ id: 'hoenn' }],
    )
    expect(result.locations.filter((location) => location.region === 'hoenn')).toEqual([
      {
        id: 'hoenn-magma-hideout',
        name: 'Magma Hideout',
        region: 'hoenn',
        pokeApiId: 486,
        games: ['e'],
      },
      {
        id: 'hoenn-team-aqua-magma-hideout',
        name: 'Team Aqua/Magma Hideout',
        region: 'hoenn',
        pokeApiId: 692,
        games: ['e', 'oras-or', 'oras-as'],
      },
    ])
    expect(result.excluded).toHaveLength(1)
  })

  it('rejects a curated primary ID that disappeared from the upstream candidates', () => {
    expect(() => normalize([candidate({ name: 'Victory Road', pokeApiId: 159 })])).toThrow(
      'Primary PokéAPI ID 152 is absent',
    )
  })

  it('always includes the curated general labels with nullable numeric API IDs', () => {
    expect(normalize([]).locations).toEqual([
      { id: 'distant-land', name: 'Distant Land', games: null, region: null, pokeApiId: 260 },
      { id: 'faraway-place', name: 'Faraway Place', games: null, region: null, pokeApiId: 267 },
      {
        id: 'fateful-encounter',
        name: 'Fateful Encounter',
        games: null,
        region: null,
        pokeApiId: null,
      },
      { id: 'mystery-zone', name: 'Mystery Zone', games: null, region: null, pokeApiId: 264 },
    ])
  })

  it.each([
    ['Apple Hills', 'kitakami', '/pokearth/kitakami/applehills.shtml', 'kitakami-apple-hills'],
    ['Savanna Biome', 'unova', '/pokearth/terarium/savannabiome.shtml', 'unova-savanna-biome'],
  ])(
    'uses Pokéarth geography for %s instead of the game home region',
    (name, region, sourceId, id) => {
      const result = normalize([
        candidate({ sourceId: id, name, region: 'paldea', games: [], pokeApiId: 900 }),
        candidate({
          source: 'serebii',
          sourceId,
          name,
          region,
          games: ['sv-s', 'sv-v'],
          pokeApiId: null,
        }),
      ])
      expect(result.locations.filter((location) => location.region !== null)).toEqual([
        { id, name, region, games: ['sv-s', 'sv-v'], pokeApiId: 900 },
      ])
      expect(result.unresolved).toEqual([])
      expect(result.provenance.find((entry) => entry.id === id)?.sources).toHaveLength(2)
    },
  )

  it('unions positive individual-version evidence in the supplied game index order', () => {
    const result = normalize([
      candidate({ games: ['rb-r', 'rb-r'] }),
      candidate({ source: 'pokemondb', pokeApiId: null, games: ['rb-r', 'rb-b'] }),
    ])
    expect(result.locations.find((location) => location.id === 'kanto-route-1')?.games).toEqual([
      'rb-b',
      'rb-r',
    ])
    expect(result.provenance.find((entry) => entry.id === 'kanto-route-1')?.sources).toHaveLength(2)
  })

  it('reports a named location without game evidence instead of inferring games from its region', () => {
    const input = candidate({ games: [] })
    const result = normalize([input])
    expect(result.locations.some((location) => location.id === 'kanto-route-1')).toBe(false)
    expect(result.unresolved).toEqual([
      { id: 'kanto-route-1', candidate: input, reason: 'No positive individual-game evidence.' },
    ])
  })

  it.each(['rb', 'unmapped-version'])('rejects %s as an individual version', (game) => {
    expect(() => normalize([candidate({ games: [game] })])).toThrow(
      `Invalid individual game ${game}`,
    )
  })

  it('merges explicit renamed-place aliases under the canonical display name', () => {
    const result = normalize([
      candidate({
        sourceId: 'johto-tin-tower',
        name: 'Tin Tower',
        region: 'johto',
        games: ['rb-r'],
      }),
      candidate({
        source: 'serebii',
        sourceId: '/pokearth/johto/belltower.shtml',
        name: 'Bell Tower',
        region: 'johto',
        games: ['rb-b'],
        pokeApiId: null,
      }),
    ])
    expect(result.locations.filter((location) => location.region !== null)).toEqual([
      {
        id: 'johto-bell-tower',
        name: 'Bell Tower',
        region: 'johto',
        games: ['rb-b', 'rb-r'],
        pokeApiId: 1,
      },
    ])
  })

  it('corrects a source-specific mislabeled sublocation without renaming its parent', () => {
    const result = normalize([
      candidate({
        sourceId: 'steamdrift-way',
        name: 'Route 8',
        region: 'galar',
        games: ['swsh-sw', 'swsh-sh'],
        pokeApiId: 936,
      }),
      candidate({
        sourceId: 'galar-route-8',
        name: 'Route 8',
        region: 'galar',
        games: ['swsh-sw', 'swsh-sh'],
        pokeApiId: 882,
      }),
    ])
    expect(
      result.locations
        .filter((location) => location.region !== null)
        .map(({ id, name }) => ({ id, name })),
    ).toEqual([
      { id: 'galar-route-8', name: 'Route 8' },
      { id: 'galar-steamdrift-way', name: 'Steamdrift Way' },
    ])
  })

  it('keeps explicitly distinct Unova Victory Roads separate despite matching names', () => {
    const result = normalize([
      candidate({
        sourceId: 'unova-victory-road',
        name: 'Victory Road',
        region: 'unova',
        pokeApiId: 382,
      }),
      candidate({
        sourceId: 'unova-victory-road-2',
        name: 'Victory Road',
        region: 'unova',
        pokeApiId: 548,
      }),
    ])
    expect(
      result.locations
        .filter((location) => location.region !== null)
        .map(({ id, pokeApiId }) => ({ id, pokeApiId })),
    ).toEqual([
      { id: 'unova-victory-road-b2w2', pokeApiId: 548 },
      { id: 'unova-victory-road-bw', pokeApiId: 382 },
    ])
    expect(result.unresolved).toEqual([])
  })

  it('reports ambiguous same-name API identities instead of silently merging them', () => {
    const result = normalize([candidate(), candidate({ sourceId: 'other-route-1', pokeApiId: 2 })])
    expect(result.locations.some((location) => location.id === 'kanto-route-1')).toBe(false)
    expect(result.unresolved).toHaveLength(2)
    expect(
      result.unresolved.every((entry) => entry.reason === 'Ambiguous PokéAPI identities: 1, 2.'),
    ).toBe(true)
  })

  it('merges a Kalos route title with its numbered identity and keeps the numbered API ID', () => {
    const result = normalize([
      candidate({
        sourceId: 'avance-trail',
        name: 'Avance Trail',
        region: 'kalos',
        games: [],
        pokeApiId: 592,
      }),
      candidate({
        sourceId: 'kalos-route-2',
        name: 'Route 2',
        region: 'kalos',
        games: ['xy-x', 'xy-y'],
        pokeApiId: 591,
      }),
    ])
    expect(result.locations.find((location) => location.id === 'kalos-route-2')).toEqual({
      id: 'kalos-route-2',
      name: 'Route 2',
      region: 'kalos',
      games: ['xy-x', 'xy-y'],
      pokeApiId: 591,
    })
    expect(result.unresolved).toEqual([])
    expect(result.provenance.find((entry) => entry.id === 'kalos-route-2')?.sources).toHaveLength(2)
  })

  it('preserves the named Unknown Dungeon while excluding actual unknown encounter placeholders', () => {
    const result = normalize([
      candidate({
        sourceId: 'unknown-dungeon',
        name: 'Unknown Dungeon',
        region: 'kalos',
        games: ['xy-x', 'xy-y'],
        pokeApiId: 690,
      }),
      candidate({
        sourceId: 'unknown-all-poliwag',
        name: 'Unknown; all Poliwag',
        region: 'johto',
        pokeApiId: 148,
      }),
    ])
    expect(result.locations.find((location) => location.id === 'kalos-unknown-dungeon')).toEqual({
      id: 'kalos-unknown-dungeon',
      name: 'Unknown Dungeon',
      region: 'kalos',
      games: ['xy-x', 'xy-y'],
      pokeApiId: 690,
    })
    expect(result.excluded.map((entry) => entry.candidate.sourceId)).toEqual([
      'unknown-all-poliwag',
    ])
  })

  it('uses an explicit primary API ID for a documented duplicate and retains both sources', () => {
    const result = normalize([
      candidate({
        sourceId: 'kanto-victory-road-2',
        name: 'Victory Road',
        pokeApiId: 159,
        games: ['rb-b'],
      }),
      candidate({ sourceId: 'kanto-victory-road-1', name: 'Victory Road', pokeApiId: 152 }),
    ])
    expect(result.locations.find((location) => location.id === 'kanto-victory-road')).toEqual({
      id: 'kanto-victory-road',
      name: 'Victory Road',
      region: 'kanto',
      games: ['rb-b', 'rb-r'],
      pokeApiId: 152,
    })
    expect(result.unresolved).toEqual([])
    expect(
      result.provenance.find((entry) => entry.id === 'kanto-victory-road')?.sources,
    ).toHaveLength(2)
  })

  it.each([
    ['Distant Land', 'distant-land', 260],
    ['Mystery Zone', 'mystery-zone', 264],
    ['Faraway Place', 'faraway-place', 267],
    ['Fateful Encounter', 'fateful-encounter', null],
  ])('collapses duplicate %s labels into the curated generic record', (name, id, pokeApiId) => {
    const result = normalize([
      candidate({ source: 'manual', sourceId: id, name, region: null, pokeApiId: null }),
      candidate({ sourceId: `unova-${id}`, name, region: 'unova', pokeApiId: 999 }),
    ])
    expect(result.locations.filter((location) => location.name === name)).toEqual([
      { id, name, region: null, games: null, pokeApiId },
    ])
    expect(result.unresolved).toEqual([])
  })
})

describe('location ordering', () => {
  const location = (id: string, region: string | null): Location => ({
    id,
    name: id,
    region,
    games: region === null ? null : ['rb-r'],
    pokeApiId: null,
  })

  it('sorts all generic labels first, then regions in the supplied order, then IDs lexically', () => {
    const input = [
      location('kanto-route-2', 'kanto'),
      location('mystery-zone', null),
      location('johto-route-2', 'johto'),
      location('kanto-route-10', 'kanto'),
      location('faraway-place', null),
      location('johto-route-10', 'johto'),
    ]
    const original = input.map((entry) => entry.id)
    expect(
      sortLocations(input, [{ id: 'johto' }, { id: 'kanto' }]).map((entry) => entry.id),
    ).toEqual([
      'faraway-place',
      'mystery-zone',
      'johto-route-10',
      'johto-route-2',
      'kanto-route-10',
      'kanto-route-2',
    ])
    expect(input.map((entry) => entry.id)).toEqual(original)
  })

  it('rejects an unknown region even when there is only one location', () => {
    expect(() => sortLocations([location('unknown-place', 'missing-region')], regions)).toThrow(
      'Unknown location region: missing-region',
    )
  })
})

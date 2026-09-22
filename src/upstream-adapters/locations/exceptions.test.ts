import { describe, expect, it } from 'vitest'
import { loadAllGames, loadAllLocations } from '../../lib/fs.ts'
import { locationExceptions } from './exceptions.ts'
import { normalizeLocations } from './normalize.ts'
import type { Candidate } from './types.ts'

describe('reviewed Bulbapedia location exceptions', () => {
  const games = loadAllGames()
  const individualIds = new Set(games.filter((game) => game.type === 'game').map((game) => game.id))
  const locations = new Map(loadAllLocations().map((location) => [location.id, location]))

  it('retains the 98 distinct review decisions and Distant Land, with aliases handled separately', () => {
    expect(locationExceptions).toHaveLength(99)
    expect(new Set(locationExceptions.map((entry) => entry.id)).size).toBe(99)
    expect(
      locationExceptions.some((entry) =>
        ['sinnoh-gts', 'kalos-vaniville-pathway'].includes(entry.id),
      ),
    ).toBe(false)
    for (const entry of locationExceptions) {
      for (const game of entry.games)
        expect(individualIds.has(game), `${entry.id}: ${game}`).toBe(true)
    }
  })

  it('applies every include, general label, and exclusion to the catalog', () => {
    for (const entry of locationExceptions) {
      if (entry.decision === 'exclude') {
        expect(locations.has(entry.id), entry.id).toBe(false)
        continue
      }
      const record = locations.get(entry.canonicalId ?? entry.id)
      expect(record, entry.id).toBeDefined()
      if (entry.decision === 'general') {
        expect(record?.region, entry.id).toBeNull()
        expect(record?.games, entry.id).toBeNull()
      } else {
        expect(record?.games, entry.id).toEqual(expect.arrayContaining(entry.games))
      }
      if (entry.canonicalId) expect(locations.has(entry.id), entry.id).toBe(false)
    }
  })

  it('merges duplicate names before applying the exception for their shared location', () => {
    const candidate = (name: string, sourceId: string, pokeApiId: number): Candidate => ({
      source: 'pokeapi',
      sourceId,
      name,
      pokeApiId,
      region: 'sinnoh',
      games: [],
      url: `https://pokeapi.co/api/v2/location/${pokeApiId}/`,
    })
    const result = normalizeLocations(
      [candidate('GTS', 'gts', 195), candidate('Global Terminal', 'sinnoh-global-terminal', 220)],
      games,
      [{ id: 'sinnoh' }],
    )
    expect(result.locations.filter((entry) => entry.region === 'sinnoh')).toEqual([
      {
        id: 'sinnoh-global-terminal',
        name: 'Global Terminal',
        games: ['dp-d', 'dp-p', 'pt'],
        region: 'sinnoh',
        pokeApiId: 220,
      },
    ])
    expect(
      result.provenance
        .find((entry) => entry.id === 'sinnoh-global-terminal')
        ?.sources.filter((source) => source.source === 'bulbapedia'),
    ).toHaveLength(1)
    expect(result.unresolved).toEqual([])
  })

  it('supplies reviewed game evidence and excludes an accessory even if upstream later lists games', () => {
    const candidate = (
      name: string,
      sourceId: string,
      pokeApiId: number,
      memberGames: string[] = [],
    ): Candidate => ({
      source: 'pokeapi',
      sourceId,
      name,
      pokeApiId,
      region: 'johto',
      games: memberGames,
      url: `https://pokeapi.co/api/v2/location/${pokeApiId}/`,
    })
    const result = normalizeLocations(
      [
        candidate('Mt. Silver Cave', 'mt-silver-cave', 239),
        candidate('Pokéwalker', 'pokewalker', 249, ['hgss-hg']),
      ],
      games,
      [{ id: 'johto' }],
    )
    expect(result.locations.find((entry) => entry.id === 'johto-mt-silver-cave')?.games).toEqual([
      'gs-g',
      'gs-s',
      'c',
      'hgss-hg',
      'hgss-ss',
    ])
    expect(result.locations.some((entry) => entry.id === 'johto-pokewalker')).toBe(false)
    expect(result.excluded[0].reason).toContain('Bulbapedia review')
    expect(result.unresolved).toEqual([])
  })
})

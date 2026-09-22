import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllGames, loadAllLocations, loadAllRegions } from '../../src/lib/fs'
import { locationSchema } from '../../src/lib/schemas'
import { validate } from '../_utils'

const generalLocationIds = ['distant-land', 'faraway-place', 'fateful-encounter', 'mystery-zone']

describe('Validate locations.json data', () => {
  const recordList = loadAllLocations()
  const games = loadAllGames()
  const gamesById = new Map(games.map((game) => [game.id, game]))
  const gameOrder = new Map(games.map((game, index) => [game.id, index]))
  const regionOrder = new Map(loadAllRegions().map((region, index) => [region.id, index]))

  it('should be valid', () => {
    const validation = validate(z.array(locationSchema), recordList)
    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }
    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
    expect(recordList.length).toBeGreaterThan(generalLocationIds.length)
  })

  it('should have unique IDs and non-null PokéAPI IDs', () => {
    const ids = recordList.map((record) => record.id)
    expect(ids).toHaveLength(new Set(ids).size)
    const pokeApiIds = recordList.map((record) => record.pokeApiId).filter((id) => id !== null)
    expect(pokeApiIds).toHaveLength(new Set(pokeApiIds).size)
  })

  it('should have nonempty names without surrounding whitespace', () => {
    for (const record of recordList) {
      expect(record.name, record.id).toBe(record.name.trim())
      expect(record.name.length, record.id).toBeGreaterThan(0)
    }
  })

  it('should reference individual games in game index order without duplicates', () => {
    for (const record of recordList) {
      if (record.games === null) continue
      for (const gameId of record.games) {
        expect(gamesById.get(gameId)?.type, `${record.id}: ${gameId}`).toBe('game')
      }
      expect(record.games, record.id).toHaveLength(new Set(record.games).size)
      const sortedGames = [...record.games].sort(
        (left, right) => gameOrder.get(left)! - gameOrder.get(right)!,
      )
      expect(record.games, record.id).toEqual(sortedGames)
    }
  })

  it('should reference known regions', () => {
    for (const record of recordList) {
      if (record.region !== null) {
        expect(regionOrder.has(record.region), `${record.id}: ${record.region}`).toBe(true)
      }
    }
  })

  it('should reserve null games for explicit general locations with null regions', () => {
    const generalLocations = recordList.filter((record) => record.games === null)
    expect(generalLocations.map((record) => record.id).sort()).toEqual(generalLocationIds)
    for (const record of generalLocations) {
      expect(record.region, record.id).toBeNull()
    }
  })

  it('should sort null regions first, then by region index and lexical ID', () => {
    const sortedRecords = [...recordList].sort((left, right) => {
      const leftRegion = left.region === null ? -1 : regionOrder.get(left.region)!
      const rightRegion = right.region === null ? -1 : regionOrder.get(right.region)!
      return leftRegion - rightRegion || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    })
    expect(recordList.map((record) => record.id)).toEqual(sortedRecords.map((record) => record.id))
  })
})

describe('Location schema', () => {
  const location = {
    id: 'kitakami-apple-hills',
    name: 'Apple Hills',
    games: ['sv-s', 'sv-v'],
    region: 'kitakami',
    pokeApiId: 1058,
  }

  it('should accept mapped, unmapped, general, and extra-regional locations', () => {
    expect(locationSchema.safeParse(location).success).toBe(true)
    expect(locationSchema.safeParse({ ...location, pokeApiId: null }).success).toBe(true)
    expect(locationSchema.safeParse({ ...location, region: null }).success).toBe(true)
    expect(
      locationSchema.safeParse({
        id: 'fateful-encounter',
        name: 'Fateful Encounter',
        games: null,
        region: null,
        pokeApiId: null,
      }).success,
    ).toBe(true)
  })

  it('should reject nonpositive, fractional, or string PokéAPI IDs', () => {
    for (const pokeApiId of [0, -1, 1.5, '1058']) {
      expect(locationSchema.safeParse({ ...location, pokeApiId }).success).toBe(false)
    }
  })

  it('should require every field and reject legacy gameIds and empty game arrays', () => {
    for (const key of Object.keys(location)) {
      const incomplete = Object.fromEntries(
        Object.entries(location).filter(([entryKey]) => entryKey !== key),
      )
      expect(locationSchema.safeParse(incomplete).success, key).toBe(false)
    }
    expect(locationSchema.safeParse({ ...location, gameIds: '*' }).success).toBe(false)
    expect(locationSchema.safeParse({ ...location, games: [] }).success).toBe(false)
  })
})

import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  absDatasetFile,
  loadAllGames,
  loadAllLocations,
  loadAllPokemon,
  loadEncounters,
} from '../../src/lib/fs'
import { encountersSchema } from '../../src/lib/schemas'
import { validate } from '../_utils'

describe('Validate data/encounters', () => {
  const files = readdirSync(absDatasetFile('encounters')).filter((file) => file.endsWith('.json'))
  const pokemonIds = new Set(loadAllPokemon().flatMap((pokemon) => [pokemon.id, ...pokemon.forms]))
  const games = new Map(loadAllGames().map((game) => [game.id, game]))
  const locations = new Map(loadAllLocations().map((location) => [location.id, location]))
  const records = files.map((file) => {
    const id = file.replace(/\.json$/, '')
    return { id, encounters: loadEncounters(id) }
  })

  it('should name files after known Pokémon records', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const { id } of records) expect(pokemonIds.has(id), id).toBe(true)
  })

  it('should be valid and nonempty', () => {
    for (const { id, encounters } of records) {
      const validation = validate(encountersSchema.min(1), encounters)
      expect(validation.errorsSummary, id).toEqual([])
    }
  })

  it('should reference individual games and known locations available in them', () => {
    for (const { id, encounters } of records) {
      for (const encounter of encounters) {
        const context = `${id}: ${encounter.game} ${encounter.location}`
        expect(games.get(encounter.game)?.type, context).toBe('game')
        const location = locations.get(encounter.location)
        expect(location, context).toBeDefined()
        if (location?.games) expect(location.games, context).toContain(encounter.game)
      }
    }
  })

  it('should not repeat an encounter', () => {
    for (const { id, encounters } of records) {
      const keys = encounters.map((e) =>
        [e.game, e.location, e.method, e.conditions.join('+'), e.source].join('|'),
      )
      expect(keys, id).toHaveLength(new Set(keys).size)
    }
  })
})

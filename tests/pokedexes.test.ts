import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { loadAllPokedexes, loadAllPokemon } from '../lib/fs'
import { pokedexSchema } from '../lib/schemas'
import { validate } from './_utils'

const pokemonById = Object.fromEntries(loadAllPokemon().map((pokemon) => [pokemon.id, pokemon]))

describe('Validate pokedexes.json data', () => {
  const recordList = loadAllPokedexes()

  it('should be valid', () => {
    const listSchema = z.array(pokedexSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('should have no duplicate ids', () => {
    const ids = recordList.map((record) => record.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it.each(recordList)('should have non duplicated and valid pokemon ids for %s', (record) => {
    const pokemonIds = record.entries.map((entry) => entry.pid)
    const uniquePokemonIds = new Set(pokemonIds)
    expect(uniquePokemonIds.size).toBe(pokemonIds.length)

    for (const id of uniquePokemonIds) {
      expect(id).toBeDefined()
      expect(pokemonById[id]?.id).toBe(id)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllGames, loadAllPokedexes, originMarksFs, regionsFs } from '../../src/lib/fs'
import { gameSchema } from '../../src/lib/schemas'
import { validate } from '../_utils'

const pokemonRegionsMap = Object.fromEntries(regionsFs.all().map((region) => [region.id, region]))
const pokedexesById = Object.fromEntries(loadAllPokedexes().map((pokedex) => [pokedex.id, pokedex]))
const originMarksById = Object.fromEntries(
  originMarksFs.all().map((originMark) => [originMark.id, originMark]),
)

describe('Validate games/*.json data', () => {
  const recordList = loadAllGames()

  it('should be valid', () => {
    const listSchema = z.array(gameSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)

    // Empty lists remain advisory while some game records are incomplete.
    const missingPokedexes = recordList
      .filter(
        (record) => record.type !== 'superset' && record.maxBoxes > 0 && !record.pokedexes.length,
      )
      .map((record) => record.id)
    if (missingPokedexes.length) {
      console.warn(`Games with storage but no pokedex references: ${missingPokedexes.join(', ')}`)
    }
  })

  it('should have unique IDs', () => {
    const ids = recordList.map((record) => record.id)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })

  it('should have unique nameSlugs', () => {
    const ids = recordList.map((record) => record.nameSlug)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })

  it('should have unique direct PokéAPI version IDs and a group for each mapped version', () => {
    const mapped = recordList.filter((record) => record.pokeApiGameVersionId !== null)
    const ids = mapped.map((record) => record.pokeApiGameVersionId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(mapped.every((record) => record.pokeApiGameVersionGroupId !== null)).toBe(true)
    expect(mapped.every((record) => record.type === 'game' || record.type === 'dlc')).toBe(true)
  })

  it('should not assign a single PokéAPI group or version to a superset', () => {
    for (const game of recordList.filter((record) => record.type === 'superset')) {
      expect(game.pokeApiGameVersionId).toBeNull()
      expect(game.pokeApiGameVersionGroupId).toBeNull()
    }
  })

  it('should have the party feature in sync with maxPartySize', () => {
    const mismatchedIds = recordList
      .filter((record) => record.features.party !== record.maxPartySize > 0)
      .map((record) => record.id)
    expect(mismatchedIds).toEqual([])
  })

  it('should have the battleTeams feature in sync with maxBattleTeams', () => {
    const mismatchedIds = recordList
      .filter((record) => record.features.battleTeams !== record.maxBattleTeams > 0)
      .map((record) => record.id)
    expect(mismatchedIds).toEqual([])
  })

  it('should have valid region IDs', () => {
    recordList.forEach((record) => {
      expect(record.region === null || pokemonRegionsMap[record.region]).not.toBeUndefined()
    })
  })

  it('should have valid originMark IDs', () => {
    recordList.forEach((record) => {
      expect(record.originMark === null || originMarksById[record.originMark] !== undefined).toBe(
        true,
      )
    })
  })
})

describe('Validate games/*.json references', () => {
  const recordList = loadAllGames()
  const gamesIndexById = Object.fromEntries(loadAllGames().map((game) => [game.id, game]))

  for (const record of recordList) {
    describe(`Game '${record.id}'`, () => {
      const dexIds = record.pokedexes

      it('should not have any pokedexes if game type is "superset"', () => {
        if (record.type === 'superset') {
          expect(record.pokedexes).toHaveLength(0)
        }
      })

      it('should have valid pokedex IDs', () => {
        for (const id of dexIds) {
          expect(pokedexesById[id], `Unknown pokedex ID: ${id}`).toBeDefined()
        }
      })

      it('should not have duplicate pokedex IDs', () => {
        expect(dexIds).toHaveLength(new Set(dexIds).size)
      })

      it('should have valid gameset ID', () => {
        if (record.gameSet !== null) {
          expect(
            gamesIndexById[record.gameSet],
            `Unknown gameset ID: ${record.gameSet}`,
          ).toBeDefined()
        }
      })

      it('should have valid game superset ID', () => {
        if (record.gameSuperSet !== null) {
          expect(
            gamesIndexById[record.gameSuperSet],
            `Unknown game superset ID: ${record.gameSuperSet}`,
          ).toBeDefined()
        }
      })

      it('should have valid region ID', () => {
        expect(record.region === null || pokemonRegionsMap[record.region]).not.toBeUndefined()
      })
    })
  }
})

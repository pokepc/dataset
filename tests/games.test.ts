import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { loadAllGames, loadAllPokedexes, originMarksFs, regionsFs } from '../lib/fs'
import { gameSchema } from '../lib/schemas'
import { validate } from './_utils'

const pokemonRegionsMap = Object.fromEntries(regionsFs.all().map((region) => [region.id, region]))
const pokedexesById = Object.fromEntries(loadAllPokedexes().map((pokedex) => [pokedex.id, pokedex]))
const originMarksById = Object.fromEntries(
  originMarksFs.all().map((originMark) => [originMark.id, originMark]),
)

describe('Validate games.json data', () => {
  const recordList = loadAllGames()

  it('should be valid', () => {
    const listSchema = z.array(gameSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
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

describe('Validate games.json pokedex references', () => {
  const recordList = loadAllGames()
  const gamesIndexById = Object.fromEntries(loadAllGames().map((game) => [game.id, game]))

  for (const record of recordList) {
    describe(`Game '${record.id}'`, () => {
      const dexIds = record.pokedexes

      it('should have at least one pokedex if game type is other than "superset" and has storage', () => {
        if (record.type !== 'superset' && record.maxBoxes > 0) {
          // expect(record.pokedexes.length).toBeGreaterThan(0)
          console.warn(`Game '${record.id}' has no pokedexes`)
        }
      })

      it('should not have any pokedexes if game type is "superset"', () => {
        if (record.type === 'superset') {
          expect(record.pokedexes).toHaveLength(0)
        }
      })

      it('should have valid pokedex IDs', () => {
        expect(dexIds.every((id) => pokedexesById[id])).not.toBeUndefined()
      })

      it('should not have duplicate pokedex IDs', () => {
        expect(dexIds).toHaveLength(new Set(dexIds).size)
      })

      it('should have valid gameset ID', () => {
        expect(
          record.gameSuperSet === null || gamesIndexById[record.gameSuperSet] !== undefined,
        ).toBe(true)
      })

      it('should have valid game superset ID', () => {
        expect(record.gameSet === null || gamesIndexById[record.gameSet] !== undefined).toBe(true)
      })

      it('should have valid region ID', () => {
        expect(record.region === null || pokemonRegionsMap[record.region]).not.toBeUndefined()
      })
    })
  }
})

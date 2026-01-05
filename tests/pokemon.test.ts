import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { loadAllAbilities, loadAllGames, loadAllPokemon } from '../lib/fs'
import { pokemonSchema } from '../lib/schemas'
import { validate } from './_utils'

describe('Validate pokemon/*.json data', () => {
  const recordList = loadAllPokemon()

  it('should be valid', () => {
    const listSchema = z.array(pokemonSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it.each(recordList.map((record) => [record.id, record]))(
    'should have names.eng in pokemon %s',
    (recordId, record) => {
      if (!record.names?.eng) {
        console.warn(`Pokemon "${recordId}" has no names.eng or is empty`)
      }
      expect(record.names?.eng).toBeDefined()
      expect(record.names?.eng).not.toBe('')
    },
  )
})

describe('Validate pokemon/*.json data references', () => {
  const recordList = loadAllPokemon()

  const pokemonMap = new Map(recordList.map((record) => [record.id, record]))
  const abilityMap = new Map(loadAllAbilities().map((ability) => [ability.id, ability]))
  const gameMap = new Map(loadAllGames().map((game) => [game.id, game]))
  it.each(recordList.map((record) => [record.id, record]))(
    'should have valid abilities in pokemon %s',
    (_recordId, record) => {
      if (record.ability1) {
        expect(abilityMap.get(record.ability1)).toBeDefined()
      }
      if (record.ability2) {
        expect(abilityMap.get(record.ability2)).toBeDefined()
      }
      if (record.abilityHidden) {
        expect(abilityMap.get(record.abilityHidden)).toBeDefined()
      }
      if (record.evoFromAbility) {
        expect(abilityMap.get(record.evoFromAbility)).toBeDefined()
      }
    },
  )

  it.each(recordList.map((record) => [record.id, record]))(
    'should have valid pokemon refs in pokemon %s',
    (_recordId, record) => {
      const allRefs = [
        ...(record.forms ?? []),
        ...(record.baseSpecies ? [record.baseSpecies] : []),
        ...(record.shinyBase ? [record.shinyBase] : []),
        ...(record.evolvesFrom ? [record.evolvesFrom] : []),
        ...(record.baseForms ?? []),
        ...(record.paradoxSpecies ?? []),
        ...(record.convergentSpecies ?? []),
      ]
      for (const ref of allRefs) {
        expect(pokemonMap.get(ref)).toBeDefined()
      }
    },
  )

  it.each(recordList.map((record) => [record.id, record]))(
    'should have valid game refs in pokemon %s',
    (_recordId, record) => {
      const allRefs = [
        ...(record.debutIn ? [record.debutIn] : []),
        ...(record.storableIn ?? []),
        ...(record.eventOnlyIn ?? []),
        ...(record.obtainableIn ?? []),
      ]
      for (const ref of allRefs) {
        expect(gameMap.get(ref)).toBeDefined()
      }
    },
  )
})

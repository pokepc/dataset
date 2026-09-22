import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllAbilities, loadAllGames, loadAllPokemon } from '../../src/lib/fs'
import { pokemonSchema } from '../../src/lib/schemas'
import { requiresHeldItemForForm } from '../../src/upstream-adapters/bulbapedia/form-availability-inheritance'
import { validate } from '../_utils'

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
    'should keep eventOnlyIn disjoint from other acquisition fields in pokemon %s',
    (_recordId, record) => {
      expect({
        obtainableIn: record.eventOnlyIn.filter((gameId) => record.obtainableIn.includes(gameId)),
        transferOnlyIn: record.eventOnlyIn.filter((gameId) =>
          record.transferOnlyIn.includes(gameId),
        ),
      }).toEqual({ obtainableIn: [], transferOnlyIn: [] })
    },
  )

  it('should exclude HOME from all availability fields for forms requiring held items', () => {
    expect(
      recordList
        .filter(requiresHeldItemForForm)
        .flatMap((record) =>
          (['obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'] as const)
            .filter((field) => record[field].includes('home'))
            .map((field) => `${record.id}.${field}`),
        ),
    ).toEqual([])
  })

  it('should exclude Champions from obtainableIn while recruited Pokémon cannot be exported', () => {
    expect(
      recordList
        .filter((record) => record.obtainableIn.includes('champions'))
        .map((record) => record.id),
    ).toEqual([])
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

  it('should use the canonical Bulbapedia species title for every Pokémon and form', () => {
    const speciesMap = new Map(
      recordList.filter((record) => record.isDefault).map((record) => [record.dexNum, record]),
    )
    for (const record of recordList) {
      const name = speciesMap.get(record.dexNum)?.names.eng
      if (!name) throw new Error(`Missing English species name for ${record.id}`)
      // Cached Bulbapedia titles match English species names, with straight apostrophes.
      // Some default forms include a parenthesized form name that is not part of the title.
      const title = name.split(' (')[0].normalize('NFC').replaceAll('’', "'")
      expect(record.refs.bulbapedia, record.id).toBe(title)
    }
  })

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
        ...(record.transferOnlyIn ?? []),
      ]
      for (const ref of allRefs) {
        expect(gameMap.get(ref)).toBeDefined()
      }
    },
  )
})

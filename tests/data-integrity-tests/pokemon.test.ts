import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllAbilities, loadAllGames, loadAllPokemon, loadText } from '../../src/lib/fs'
import { localeCodes } from '../../src/lib/languages'
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

  it.each(['bank', 'home'])(
    'should exclude %s from all availability fields for forms requiring held items',
    (game) => {
      expect(
        recordList
          .filter(requiresHeldItemForForm)
          .flatMap((record) =>
            (['obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'] as const)
              .filter((field) => record[field].includes(game))
              .map((field) => `${record.id}.${field}`),
          ),
      ).toEqual([])
    },
  )

  it('should exclude Champions from obtainableIn while recruited Pokémon cannot be exported', () => {
    expect(
      recordList
        .filter((record) => record.obtainableIn.includes('champions'))
        .map((record) => record.id),
    ).toEqual([])
  })

  it.each(['meowth-alola', 'persian-alola'])(
    'should retain Scarlet/Violet acquisition and storage for %s',
    (id) => {
      const record = recordList.find((pokemon) => pokemon.id === id)!
      for (const game of ['sv-s', 'sv-v']) {
        expect(record.obtainableIn).toContain(game)
        expect(record.storableIn).toContain(game)
      }
    },
  )

  it.each(recordList.map((record) => [record.id]))(
    'should have an English name for %s',
    (recordId) => {
      expect(loadText('pokemon', 'eng')[recordId]?.name).toBeTruthy()
    },
  )
})

describe('Validate pokemon/*.json data references', () => {
  const recordList = loadAllPokemon()

  const pokemonMap = new Map(recordList.map((record) => [record.id, record]))
  const abilityMap = new Map(loadAllAbilities().map((ability) => [ability.id, ability]))
  const gameMap = new Map(loadAllGames().map((game) => [game.id, game]))
  const englishText = loadText('pokemon', 'eng')

  it('should use the canonical Bulbapedia species title for every Pokémon and form', () => {
    const speciesMap = new Map(
      recordList.filter((record) => record.isDefault).map((record) => [record.dexNum, record]),
    )
    for (const record of recordList) {
      const name = englishText[speciesMap.get(record.dexNum)?.id ?? '']?.name
      if (!name) throw new Error(`Missing English species name for ${record.id}`)
      // Cached Bulbapedia titles match English species names, with straight apostrophes.
      // Some default forms include a parenthesized form name that is not part of the title.
      const title = name.split(' (')[0].normalize('NFC').replaceAll('’', "'")
      expect(record.refs.bulbapedia, record.id).toBe(title)
    }
  })

  it('should include the form name in the full name of every named form', () => {
    for (const locale of localeCodes) {
      const text = loadText('pokemon', locale)
      for (const record of recordList.filter((record) => record.isForm)) {
        const { name, speciesName, formName } = text[record.id] ?? {}
        if (!formName || !speciesName) continue
        expect(name, `${record.id}: ${locale}`).not.toBe(speciesName)
      }
    }
  })

  it.each(recordList.map((record) => [record.id, record]))(
    'should have valid abilities in pokemon %s',
    (_recordId, record) => {
      const current = [
        record.ability1,
        record.ability2,
        record.abilityHidden,
        record.abilitySpecial,
      ].filter((ability) => ability !== undefined)
      const legacy = record.legacyAbilities ?? []
      for (const ability of [...current, ...legacy])
        expect(abilityMap.get(ability), `${record.id}: ${ability}`).toBeDefined()
      expect(new Set(legacy).size).toBe(legacy.length)
      expect(legacy.filter((ability) => current.includes(ability))).toEqual([])
    },
  )

  it.each(recordList.map((record) => [record.id, record]))(
    'should have valid pokemon refs in pokemon %s',
    (_recordId, record) => {
      const allRefs = [
        ...(record.forms ?? []),
        ...(record.baseSpecies ? [record.baseSpecies] : []),
        ...(record.shinyBase ? [record.shinyBase] : []),
        ...(record.evoMethods?.flatMap((method) => method.from) ?? []),
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

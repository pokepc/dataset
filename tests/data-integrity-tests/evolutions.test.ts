import { describe, expect, it } from 'vitest'
import {
  loadAllAbilities,
  loadAllGames,
  loadAllItems,
  loadAllMoves,
  loadAllNatures,
  loadAllPokemon,
  loadAllRegions,
} from '../../src/lib/fs'
import { pokemonSchema } from '../../src/lib/schemas'

const pokemon = loadAllPokemon()
const byId = new Map(pokemon.map((record) => [record.id, record]))
const items = new Set(loadAllItems().map((record) => record.id))
const moves = new Set(loadAllMoves().map((record) => record.id))
const abilities = new Set(loadAllAbilities().map((record) => record.id))
const natures = new Set(loadAllNatures().map((record) => record.id))
const regions = new Set(loadAllRegions().map((record) => record.id))
const games = new Map(loadAllGames().map((record) => [record.id, record]))

describe('evolution method data', () => {
  it('validates methods and excludes transformations and redundant legacy fields', () => {
    for (const record of pokemon) {
      expect(
        Object.keys(record).filter(
          (key) => key === 'evolutionMethods' || key === 'evolvesFrom' || key.startsWith('evoFrom'),
        ),
        record.id,
      ).toEqual([])
      if (
        record.isBattleOnlyForm ||
        record.isMega ||
        record.isGmax ||
        record.isPrimal ||
        record.isFusion
      ) {
        expect(record.evoMethods, record.id).toBeUndefined()
      }
      expect(pokemonSchema.parse(record).evoMethods, record.id).toEqual(record.evoMethods)
    }
  })

  it('validates every method reference and concrete game scope', () => {
    for (const record of pokemon) {
      for (const method of record.evoMethods ?? []) {
        expect(new Set(method.from).size, record.id).toBe(method.from.length)
        for (const from of method.from) {
          expect(byId.has(from), `${record.id}: ${from}`).toBe(true)
          expect(from).not.toBe(record.id)
        }
        for (const game of method.games ?? []) {
          expect(games.get(game)?.type, `${record.id}: ${game}`).toBe('game')
          expect(games.get(game)?.series).not.toBe('storage')
        }
        if (method.item) expect(items.has(method.item.id), record.id).toBe(true)
        for (const condition of method.conditions) {
          if ('pokemon' in condition)
            expect(byId.has(condition.pokemon), `${record.id}: ${condition.key}`).toBe(true)
          if ('move' in condition) expect(moves.has(condition.move), record.id).toBe(true)
          if ('item' in condition) expect(items.has(condition.item), record.id).toBe(true)
          if (condition.key === 'region')
            expect(regions.has(condition.region), record.id).toBe(true)
          if (condition.key === 'ability')
            for (const ability of condition.abilities)
              expect(abilities.has(ability), record.id).toBe(true)
          if (condition.key === 'nature')
            for (const nature of condition.natures)
              expect(natures.has(nature), record.id).toBe(true)
        }
      }
    }
  })

  it('preserves item-use alternatives and form-specific evolution restrictions', () => {
    const alakazam = byId.get('alakazam')!.evoMethods!
    expect(alakazam.some((method) => method.trigger === 'trade')).toBe(true)
    expect(alakazam).toContainEqual(
      expect.objectContaining({
        games: ['la'],
        trigger: 'use_item',
        item: { id: 'linkingcord', role: 'used' },
        activation: 'manual',
      }),
    )
    expect(byId.get('gastrodon-east')!.evoMethods![0].from).toEqual(['shellos-east'])
    expect(byId.get('mothim')!.evoMethods![0].from).toEqual(['burmy', 'burmy-sandy', 'burmy-trash'])
    expect(byId.get('gholdengo')!.evoMethods![0].from).toContain('gimmighoul-roaming')
    expect(byId.get('melmetal')!.evoMethods![0]).toMatchObject({
      from: ['meltan'],
      games: ['go'],
      conditions: [{ key: 'candy', pokemon: 'meltan', count: 400 }],
    })
    for (const id of [
      'ursaluna-bloodmoon',
      'floette-eternal',
      'vivillon-pokeball',
      'silvally-fire',
    ])
      expect(byId.get(id)!.evoMethods, id).toBeUndefined()
  })

  it('retains translated special keys, distinct recipes, and unresolved evidence', () => {
    expect(byId.get('malamar')!.evoMethods![0].conditions).toContainEqual({
      key: 'device_upside_down',
    })
    expect(byId.get('palafin')!.evoMethods![0].conditions).toContainEqual({
      key: 'union_circle',
    })
    const alcremie = pokemon.filter((record) => record.dexNum === 869 && record.evoMethods)
    expect(alcremie).toHaveLength(63)
    expect(
      new Set(
        alcremie.map((record) =>
          JSON.stringify([record.evoMethods![0].item, record.evoMethods![0].conditions]),
        ),
      ).size,
    ).toBe(63)
    expect(
      byId.get('overqwil')!.evoMethods!.find((method) => method.games?.includes('lza'))?.notes?.eng,
    ).toContain('Exact counter semantics need verification')
    expect(
      byId
        .get('runerigus')!
        .evoMethods!.every((method) => method.notes?.eng?.includes('Sources disagree')),
    ).toBe(true)
  })
})

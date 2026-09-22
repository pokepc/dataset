import { describe, expect, it } from 'vitest'
import {
  loadAllAbilities,
  loadAllGames,
  loadAllItems,
  loadAllMoves,
  loadAllPokemon,
} from '../../src/lib/fs'
import { pokemonSchema } from '../../src/lib/schemas'
import { formMethods } from '../../src/scripts/migrate-pokemon-forms'

const pokemon = loadAllPokemon()
const byId = new Map(pokemon.map((p) => [p.id, p]))
const games = new Set(
  loadAllGames()
    .filter((g) => g.type === 'game')
    .map((g) => g.id),
)
const items = new Set(loadAllItems().map((i) => i.id))
const moves = new Set(loadAllMoves().map((m) => m.id))
const abilities = new Set(loadAllAbilities().map((a) => a.id))

describe('form transition data', () => {
  it('matches the reviewed manifest without legacy fields or cross-species transformations', () => {
    for (const p of pokemon) {
      expect(p, p.id).not.toHaveProperty('formItem')
      expect(pokemonSchema.parse(p).formMethods, p.id).toEqual(p.formMethods)
      expect(p.formMethods, p.id).toEqual(formMethods[p.id])
      for (const method of p.formMethods ?? []) {
        expect(method.from, p.id).not.toContain(p.id)
        for (const from of method.from)
          expect(byId.get(from)?.dexNum, `${from} -> ${p.id}`).toBe(p.dexNum)
        for (const game of method.games ?? [])
          expect(games.has(game), `${p.id}: ${game}`).toBe(true)
        if (method.item) expect(items.has(method.item.id), `${p.id}: ${method.item.id}`).toBe(true)
        for (const c of method.conditions) {
          if ('move' in c) expect(moves.has(c.move), p.id).toBe(true)
          if ('pokemon' in c) expect(byId.has(c.pokemon), p.id).toBe(true)
          if ('forms' in c)
            for (const id of c.forms) expect(byId.get(id)?.dexNum, p.id).toBe(p.dexNum)
          if ('items' in c) for (const id of c.items) expect(items.has(id), p.id).toBe(true)
          if ('abilities' in c)
            for (const id of c.abilities) expect(abilities.has(id), p.id).toBe(true)
        }
      }
    }
  })

  it('preserves exact forms through collapsed battle states', () => {
    const alcremie = pokemon.filter((p) => p.dexNum === 869 && !p.isGmax)
    expect(byId.get('alcremie-gmax')!.formMethods![0].from.sort()).toEqual(
      alcremie.map((p) => p.id).sort(),
    )
    for (const p of alcremie)
      for (const m of p.formMethods!)
        expect(m.conditions).toContainEqual({ key: 'original_form', forms: [p.id] })
    expect(byId.get('zygarde-complete-mega')!.formMethods![0].from).toEqual(['zygarde-complete'])
    expect(byId.get('magearna-original-mega')!.formMethods![0].from).toEqual(['magearna-original'])
    expect(byId.get('tatsugiri-droopy-mega')!.formMethods![0].from).toEqual(['tatsugiri-droopy'])
    expect(byId.get('kyurem-black')!.formMethods![0]).toMatchObject({
      from: ['kyurem'],
      conditions: expect.arrayContaining([{ key: 'fusion_partner', pokemon: 'zekrom' }]),
    })
    for (const m of byId
      .get('necrozma-dusk-mane')!
      .formMethods!.filter((m) => m.from.includes('necrozma-ultra')))
      expect(m.conditions).toContainEqual({ key: 'original_form', forms: ['necrozma-dusk-mane'] })
  })

  it('keeps title-specific item use, fixed forms and non-player animations distinct', () => {
    const giratina = byId.get('giratina-origin')!.formMethods!
    expect(giratina).toContainEqual(
      expect.objectContaining({
        games: ['la'],
        item: { id: 'griseouscore', role: 'used', consumed: false },
      }),
    )
    expect(giratina).toContainEqual(
      expect.objectContaining({
        games: ['sv-s', 'sv-v'],
        item: { id: 'griseouscore', role: 'held', consumed: false },
      }),
    )
    expect(
      byId.get('charizard-mega-x')!.formMethods!.find((m) => m.games?.includes('lgpe-lgp'))!.item
        ?.role,
    ).toBe('bag')
    for (const id of [
      'vulpix-alola',
      'unown-b',
      'gimmighoul-roaming',
      'vivillon-pokeball',
      'ursaluna-bloodmoon',
      'eternatus-eternamax',
    ])
      expect(byId.get(id)!.formMethods, id).toBeUndefined()
    for (const p of pokemon.filter((p) => p.dexNum === 493))
      for (const m of p.formMethods ?? [])
        if (
          m.games?.some((g) =>
            [
              'dp-d',
              'dp-p',
              'pt',
              'hgss-hg',
              'hgss-ss',
              'bw-b',
              'bw-w',
              'b2w2-b2',
              'b2w2-w2',
            ].includes(g),
          )
        )
          expect(m.from).not.toContain('arceus-fairy')
  })
})

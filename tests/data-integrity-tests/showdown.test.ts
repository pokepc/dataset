import { Dex } from '@pkmn/dex'
import { describe, expect, it } from 'vitest'
import { loadAllAbilities, loadAllItems, loadAllMoves, loadAllPokemon } from '../../src/lib/fs'

/**
 * Showdown refs (Pokémon `refs.showdown` / `refs.showdownName`, and `psName` on abilities, moves
 * and items) must match Pokémon Showdown's own ids and names, as published by @pkmn/dex.
 */

/** In Showdown's master branch but not yet in the @pkmn/dex release we depend on. */
const notYetInPkmnDex = new Set(['auraguard'])

/** Items Showdown does not have: key items and form-change items that cannot be held in battle. */
const itemsNotInShowdown = new Set([
  'blackaugurite',
  'blankplate',
  'dnasplicers',
  'gimmighoulcoin',
  'gracidea',
  'leaderscrest',
  'legendplate',
  'linkingcord',
  'meteorite',
  'nlunarizer',
  'nsolarizer',
  'peatblock',
  'pinknectar',
  'prisonbottle',
  'purplenectar',
  'reinsofunity',
  'rednectar',
  'revealglass',
  'rotomcatalog',
  'scrollofdarkness',
  'scrollofwaters',
  'yellownectar',
  'zygardecube',
])

type ShowdownLookup = (name: string) => { exists: boolean; id: string; name: string }

function mismatches(
  records: { id: string; showdownId: string; showdownName: string }[],
  lookup: ShowdownLookup,
): string[] {
  return records.flatMap(({ id, showdownId, showdownName }) => {
    const byId = lookup(showdownId)
    if (!byId.exists) return [`${id}: no Showdown entry for ${showdownId}`]
    if (byId.id !== showdownId || byId.name !== showdownName) {
      return [`${id}: ${showdownId} / ${showdownName}, Showdown has ${byId.id} / ${byId.name}`]
    }
    return []
  })
}

describe('Showdown refs', () => {
  it('should match Showdown species for every Pokémon', () => {
    const records = loadAllPokemon().map((record) => ({
      id: record.id,
      showdownId: record.refs.showdown,
      showdownName: record.refs.showdownName,
    }))
    expect(mismatches(records, (name) => Dex.species.get(name))).toEqual([])
  })

  it.each([
    ['abilities', loadAllAbilities, (name: string) => Dex.abilities.get(name), notYetInPkmnDex],
    ['moves', loadAllMoves, (name: string) => Dex.moves.get(name), new Set<string>()],
    ['items', loadAllItems, (name: string) => Dex.items.get(name), itemsNotInShowdown],
  ] as const)('should match Showdown psName for %s', (_kind, load, lookup, exceptions) => {
    const records = load()
      .filter((record) => !exceptions.has(record.id))
      .map((record) => ({ id: record.id, showdownId: record.id, showdownName: record.psName }))
    expect(mismatches(records, lookup)).toEqual([])
  })

  it('should keep exception lists free of entries Showdown now has', () => {
    const lookups: [Set<string>, ShowdownLookup][] = [
      [notYetInPkmnDex, (name) => Dex.abilities.get(name)],
      [itemsNotInShowdown, (name) => Dex.items.get(name)],
    ]
    expect(lookups.flatMap(([ids, lookup]) => [...ids].filter((id) => lookup(id).exists))).toEqual(
      [],
    )
  })
})

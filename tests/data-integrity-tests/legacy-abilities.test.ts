import { describe, expect, it } from 'vitest'
import { loadAllPokemon } from '../../src/lib/fs'
import { pokemonSchema } from '../../src/lib/schemas'

const pokemon = new Map(loadAllPokemon().map((record) => [record.id, record]))

// Exact-form history and release distinctions are documented in the ability-change audit.
describe('historical ability assignments', () => {
  it.each([
    ['shiftry', 'earlybird'],
    ['shiftry-f', 'earlybird'],
    ['basculin-blue-striped', 'reckless'],
    ['gengar', 'levitate'],
    ['empoleon', 'defiant'],
    ['piplup', 'defiant'],
    ['prinplup', 'defiant'],
    ['venipede', 'quickfeet'],
    ['whirlipede', 'quickfeet'],
    ['scolipede', 'quickfeet'],
  ])('preserves %s history through the public schema', (id, ability) => {
    expect(pokemonSchema.parse(pokemon.get(id)).legacyAbilities).toContain(ability)
  })

  it.each([
    'basculin',
    'basculin-white-striped',
    'gengar-mega',
    'gengar-gmax',
    'zapdos-galar',
    'sneasel',
    'enamorus-therian',
    'chandelure-mega',
    'scolipede-mega',
    'sneasler',
    'rockruff',
    'greninja',
    'zygarde',
  ])('does not invent legacy abilities for distinct forms or retained abilities: %s', (id) => {
    const record = pokemon.get(id)!
    expect(record).toBeDefined()
    expect(record.legacyAbilities ?? []).toEqual([])
  })

  it.each([
    'zapdos',
    'litwick',
    'lampent',
    'chandelure',
    'raikou',
    'entei',
    'suicune',
    'kubfu',
    'growlithe-hisui',
    'arcanine-hisui',
    'typhlosion-hisui',
    'sneasel-hisui',
    'sneasel-hisui-f',
    'samurott-hisui',
    'braviary-hisui',
    'sliggoo-hisui',
    'goodra-hisui',
    'decidueye-hisui',
    'kleavor',
    'basculegion',
    'basculegion-f',
    'enamorus',
  ])('excludes unreleased and unused historical assignments: %s', (id) => {
    const record = pokemon.get(id)!
    expect(record).toBeDefined()
    expect(record.legacyAbilities ?? []).toEqual([])
  })
})

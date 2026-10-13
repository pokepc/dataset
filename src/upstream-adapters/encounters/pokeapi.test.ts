import { describe, expect, it } from 'vitest'
import { parsePokeApiEncounters } from './pokeapi.ts'

const csv = {
  versions: 'id,identifier\n1,red\n2,blue\n44,red-japan\n35,the-isle-of-armor-sword\n33,sword',
  location_areas: 'id,location_id\n10,100\n11,100\n12,159\n13,799\n14,555\n15,300',
  encounter_slots: 'id,encounter_method_id\n1,1\n2,2',
  encounter_methods: 'id,identifier,order\n1,walk,1\n2,surf,14',
  encounter_condition_values: 'id,identifier\n3,time-morning\n5,time-night',
  encounter_condition_value_map: 'encounter_id,encounter_condition_value_id\n4,5\n4,3',
  pokemon: 'id,identifier\n25,pikachu\n201,unown\n999,mystery',
  encounters: [
    'id,version_id,location_area_id,encounter_slot_id,pokemon_id,min_level,max_level',
    '1,1,10,1,25,3,5', // two areas of one place merge into one level range
    '2,1,11,1,25,4,7',
    '3,1,10,2,25,10,10', // another method stays separate
    '4,1,10,1,25,8,8', // conditions are sorted and keep their own entry
    '5,1,12,1,25,30,30', // reviewed location alias
    '6,1,13,1,25,30,30', // excluded roaming pseudo-location
    '7,44,10,1,25,3,5', // version with no dataset game
    '8,1,14,1,25,3,5', // place missing from the catalog
    '9,1,10,1,201,5,5', // shared PokéAPI id resolves to the default record
    '10,1,10,1,999,5,5', // unknown Pokémon
    '11,35,15,1,25,20,22', // DLC version maps to its base game
  ].join('\n'),
}

const data = {
  games: [
    { id: 'rb-r', type: 'game', pokeApiGameVersionId: 1 },
    { id: 'rb-b', type: 'game', pokeApiGameVersionId: 2 },
    { id: 'swsh-sw', type: 'game', pokeApiGameVersionId: 33 },
  ],
  locations: [
    { id: 'kanto-viridian-forest', pokeApiId: 100 },
    { id: 'kanto-victory-road', pokeApiId: 152 },
    { id: 'galar-isle-of-armor', pokeApiId: 300 },
    { id: 'hoenn-team-aqua-magma-hideout', pokeApiId: 692 },
  ],
  pokemon: [
    { id: 'pikachu', isDefault: true, refs: { pkApiId: '25' } },
    { id: 'unown', isDefault: true, refs: { pkApiId: '201' } },
    { id: 'unown-b', isDefault: false, refs: { pkApiId: '201' } },
  ],
}

describe('parsePokeApiEncounters', () => {
  const result = parsePokeApiEncounters(csv, data)

  it('aggregates rows per game, place, method and condition set', () => {
    const base = { game: 'rb-r', location: 'kanto-viridian-forest', source: 'pokeapi' }
    expect(result.encounters.get('pikachu')).toEqual([
      {
        ...base,
        location: 'kanto-victory-road',
        method: 'walk',
        minLevel: 30,
        maxLevel: 30,
        conditions: [],
      },
      { ...base, method: 'walk', minLevel: 3, maxLevel: 7, conditions: [] },
      {
        ...base,
        method: 'walk',
        minLevel: 8,
        maxLevel: 8,
        conditions: ['time-morning', 'time-night'],
      },
      { ...base, method: 'surf', minLevel: 10, maxLevel: 10, conditions: [] },
      {
        ...base,
        game: 'swsh-sw',
        location: 'galar-isle-of-armor',
        method: 'walk',
        minLevel: 20,
        maxLevel: 22,
        conditions: [],
      },
    ])
  })

  it('attaches a shared PokéAPI id to the default record', () => {
    expect(result.encounters.get('unown')).toHaveLength(1)
    expect(result.encounters.has('unown-b')).toBe(false)
  })

  it('reports unmapped and excluded rows instead of guessing', () => {
    expect(result).toMatchObject({ rows: 11, importedRows: 7, excludedRows: 1 })
    expect(result.unresolved).toEqual(
      expect.arrayContaining([
        { reason: 'unmapped-version', key: 'red-japan', rows: 1 },
        { reason: 'unmapped-location', key: '555', rows: 1 },
        { reason: 'unknown-pokemon', key: 'mystery', rows: 1 },
      ]),
    )
  })

  it('rejects encounters with no method', () => {
    const broken = { ...csv, encounter_slots: 'id,encounter_method_id\n1,9' }
    expect(() => parsePokeApiEncounters(broken, data)).toThrow('no encounter method')
  })
})

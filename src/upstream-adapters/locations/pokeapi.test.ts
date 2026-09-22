import { describe, expect, it } from 'vitest'
import { parseCsv, parsePokeApiLocations, pokeApiFallbackNames } from './pokeapi.ts'

const games = [
  { id: 'rb-r', type: 'game', pokeApiGameVersionId: 1 },
  { id: 'rb-b', type: 'game', pokeApiGameVersionId: 2 },
  { id: 'swsh-sw', type: 'game', pokeApiGameVersionId: 33 },
  { id: 'swsh-sh', type: 'game', pokeApiGameVersionId: 34 },
  { id: 'sv-s', type: 'game', pokeApiGameVersionId: 40 },
  { id: 'sv-v', type: 'game', pokeApiGameVersionId: 41 },
  { id: 'lza', type: 'game', pokeApiGameVersionId: 47 },
  { id: 'lza-megadimension', type: 'dlc', pokeApiGameVersionId: 48 },
  { id: 'rb', type: 'set', pokeApiGameVersionId: null },
]

const encounterHeader =
  'id,version_id,location_area_id,encounter_slot_id,pokemon_id,min_level,max_level\n'
const fixture = (overrides: Record<string, string> = {}): Record<string, string> => ({
  regions: 'id,identifier\n1,kanto\n8,galar\n10,paldea\n',
  locations: 'id,region_id,identifier\n10,1,kanto-route-1\n20,,fateful-encounter\n',
  location_names:
    'location_id,local_language_id,name,subtitle\n10,9,Route 1,\n10,5,Route 1,\n20,9,Fateful Encounter,\n',
  location_areas: 'id,location_id,game_index,identifier\n8,10,1,grass\n9,10,2,water\n',
  versions: `id,version_group_id,identifier
1,1,red
2,1,blue
33,20,sword
34,20,shield
35,21,the-isle-of-armor-sword
36,22,the-crown-tundra-sword
40,25,scarlet
41,25,violet
42,26,the-teal-mask-scarlet
43,27,the-indigo-disk-scarlet
44,28,red-japan
47,30,legends-za
48,31,mega-dimension
50,21,the-isle-of-armor-shield
51,22,the-crown-tundra-shield
52,26,the-teal-mask-violet
53,27,the-indigo-disk-violet
`,
  encounters: `${encounterHeader}1,1,8,1,25,1,5\n2,1,9,1,25,1,5\n3,2,8,1,25,1,5\n`,
  ...overrides,
})

describe('PokéAPI CSV parsing', () => {
  it('preserves quoted commas, escaped quotes, Unicode and embedded newlines', () => {
    expect(parseCsv('\uFEFFid,name,note\r\n1,"Café, Route ""A""","first\nsecond"\r\n')).toEqual([
      { id: '1', name: 'Café, Route "A"', note: 'first\nsecond' },
    ])
  })

  it.each([
    ['id,name\n1,"open', 'Unterminated'],
    ['id,name\n1,bad"quote', 'Malformed'],
    ['id,name\n1,"closed"tail', 'Malformed'],
    ['id,name\n1', 'expected 2 fields'],
    ['id,id\n1,2', 'Duplicate CSV column'],
  ])('rejects malformed CSV %#', (csv, message) => {
    expect(() => parseCsv(csv)).toThrow(message)
  })
})

describe('PokéAPI location candidates', () => {
  it('joins areas to their parent location and deduplicates exact individual games', () => {
    expect(parsePokeApiLocations(fixture(), games)).toEqual([
      {
        source: 'pokeapi',
        sourceId: 'kanto-route-1',
        url: 'https://pokeapi.co/api/v2/location/10/',
        name: 'Route 1',
        region: 'kanto',
        games: ['rb-r', 'rb-b'],
        pokeApiId: 10,
      },
      {
        source: 'pokeapi',
        sourceId: 'fateful-encounter',
        url: 'https://pokeapi.co/api/v2/location/20/',
        name: 'Fateful Encounter',
        region: null,
        games: [],
        pokeApiId: 20,
      },
    ])
  })

  it('keeps locations when encounter data is empty', () => {
    const result = parsePokeApiLocations(fixture({ encounters: encounterHeader }), games)
    expect(result).toHaveLength(2)
    expect(result.every((location) => location.games.length === 0)).toBe(true)
  })

  it('preserves meaningful English subtitles as separately named sublocations', () => {
    const csv = fixture({
      location_names:
        'location_id,local_language_id,name,subtitle\n10,9,Hau’oli City,Beachfront\n20,9,Fateful Encounter,\n',
    })
    expect(parsePokeApiLocations(csv, games)[0].name).toBe('Hau’oli City (Beachfront)')
  })

  it.each([
    [35, 'swsh-sw'],
    [36, 'swsh-sw'],
    [50, 'swsh-sh'],
    [51, 'swsh-sh'],
    [42, 'sv-s'],
    [43, 'sv-s'],
    [52, 'sv-v'],
    [53, 'sv-v'],
    [48, 'lza'],
  ])('resolves DLC version %i to only %s', (version, game) => {
    const csv = fixture({ encounters: `${encounterHeader}1,${version},8,1,25,1,5\n` })
    expect(parsePokeApiLocations(csv, games)[0].games).toEqual([game])
  })

  it('does not alias unsupported Japanese versions to international games', () => {
    const csv = fixture({ encounters: `${encounterHeader}1,44,8,1,25,1,5\n` })
    expect(parsePokeApiLocations(csv, games)[0].games).toEqual([])
  })

  it('uses only explicit English fallback names and exposes them for reporting', () => {
    const csv = fixture({
      locations: 'id,region_id,identifier\n10,1,kalos-berry-fields\n20,,fateful-encounter\n',
      location_names: 'location_id,local_language_id,name,subtitle\n20,9,Fateful Encounter,\n',
    })
    expect(parsePokeApiLocations(csv, games)[0].name).toBe('Berry Fields')
    expect(Object.keys(pokeApiFallbackNames)).toHaveLength(8)
    expect(() =>
      parsePokeApiLocations(fixture({ location_names: csv.location_names }), games),
    ).toThrow('Missing English name for location 10')
  })

  it.each([
    ['locations', 'id,region_id,identifier\n10,1,route-1\n10,1,route-2\n', 'Duplicate location id'],
    [
      'location_names',
      'location_id,local_language_id,name,subtitle\n999,9,Unknown,\n',
      'missing location 999',
    ],
    [
      'location_names',
      'location_id,local_language_id,name,subtitle\n10,9,Route 1,\n10,9,Route 2,\n',
      'Duplicate English name',
    ],
    [
      'location_areas',
      'id,location_id,game_index,identifier\n8,999,1,grass\n',
      'missing location 999',
    ],
    ['encounters', `${encounterHeader}1,1,999,1,25,1,5\n`, 'missing location area 999'],
    ['encounters', `${encounterHeader}1,999,8,1,25,1,5\n`, 'missing version 999'],
    ['encounters', `${encounterHeader}1,1,8,1,25,1,5\n1,1,8,1,25,1,5\n`, 'Duplicate encounter id'],
  ])('rejects broken %s references or duplicates', (table, contents, message) => {
    expect(() => parsePokeApiLocations(fixture({ [table]: contents }), games)).toThrow(message)
  })
})

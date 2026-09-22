// Confirmed upstream errors only. Match individual methods, not entire species,
// games, or locations, so unrelated contradictory evidence remains blocking.
export const encounterExceptions = [
  ...[
    'brooklet-hill-north',
    'brooklet-hill-south',
    'malie-garden-area',
    'vast-poni-canyon-northwest',
  ].flatMap((location) =>
    ['bubbling-spots', 'super-rod'].map((method) => ({
      id: `pokeapi:550:ultra-moon:${location}:${method}`,
      source: 'pokeapi' as const,
      pokemonId: '550',
      gameId: 'usum-um',
      versionId: 30,
      version: 'ultra-moon',
      location,
      method,
      reason:
        'These Ultra Moon fishing encounters are Blue-Striped Basculin, not the Red-Striped form identified by endpoint 550. Red-Striped fishing encounters are in Ultra Sun.',
      evidenceUrls: [
        'https://bulbapedia.bulbagarden.net/wiki/Basculin_(Pok%C3%A9mon)#Game_locations',
      ],
    })),
  ),
  ...['100', '101'].map((pokemonId) => ({
    id: `pokeapi:${pokemonId}:sun:new-mauville:static`,
    source: 'pokeapi' as const,
    pokemonId,
    gameId: 'sm-s',
    versionId: 27,
    version: 'sun',
    location: 'new-mauville-area',
    method: 'static',
    reason:
      'New Mauville is a Hoenn location in Generation III/VI games, not Sun. This static encounter is assigned to the wrong version.',
    evidenceUrls: [
      'https://bulbapedia.bulbagarden.net/wiki/New_Mauville',
      `https://bulbapedia.bulbagarden.net/wiki/${pokemonId === '100' ? 'Voltorb' : 'Electrode'}_(Pok%C3%A9mon)#Game_locations`,
    ],
  })),
  ...[
    { pokemonId: '179', location: 'kanto-altering-cave-b' },
    { pokemonId: '190', location: 'kanto-altering-cave-f' },
    { pokemonId: '204', location: 'kanto-altering-cave-c' },
    { pokemonId: '213', location: 'kanto-altering-cave-g' },
    { pokemonId: '216', location: 'kanto-altering-cave-e' },
    { pokemonId: '228', location: 'kanto-altering-cave-d' },
    { pokemonId: '234', location: 'kanto-altering-cave-h' },
    { pokemonId: '235', location: 'kanto-altering-cave-i' },
  ].flatMap((pokemon) =>
    [
      { gameId: 'frlg-fr', versionId: 10, version: 'firered' },
      { gameId: 'frlg-lg', versionId: 11, version: 'leafgreen' },
    ].map((version) => ({
      id: `pokeapi:${pokemon.pokemonId}:${version.version}:altering-cave:walk`,
      source: 'pokeapi' as const,
      ...pokemon,
      ...version,
      method: 'walk',
      reason:
        'These encounters in Altering Cave required a Mystery Gift distribution that was never released. Programmed encounter slots are not obtainable encounters.',
      evidenceUrls: ['https://bulbapedia.bulbagarden.net/wiki/Altering_Cave#Pok%C3%A9mon'],
    })),
  ),
]

export type EncounterException = (typeof encounterExceptions)[number]

export function findEncounterException(
  pokemonId: string,
  encounter: { gameId: string; versionId: number; version: string; location: string },
  method: { name: string; conditions: string[] },
): EncounterException | undefined {
  return encounterExceptions.find(
    (entry) =>
      entry.pokemonId === pokemonId &&
      entry.gameId === encounter.gameId &&
      entry.versionId === encounter.versionId &&
      entry.version === encounter.version &&
      entry.location === encounter.location &&
      entry.method === method.name &&
      method.conditions.length === 0,
  )
}

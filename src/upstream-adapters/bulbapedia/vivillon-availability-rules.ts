import type { AvailabilityPokemon, LocationMethod } from './availability.ts'
import type { MainAvailability } from './main-availability.ts'

export const vivillonAvailabilityReferences = {
  reviewedAt: '2026-09-22',
  forms: 'https://bulbapedia.bulbagarden.net/wiki/Vivillon_(Pok%C3%A9mon)#Form_data',
  museum: 'https://bulbapedia.bulbagarden.net/wiki/Lumiose_Museum#Pokémon_Legends:_Z-A',
  champions:
    'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_in_Pok%C3%A9mon_Champions',
} as const

const regionalPatterns = new Set([
  'icy-snow',
  'polar',
  'tundra',
  'continental',
  'garden',
  'elegant',
  'meadow',
  'modern',
  'marine',
  'archipelago',
  'high-plains',
  'sandstorm',
  'river',
  'monsoon',
  'savanna',
  'sun',
  'ocean',
  'jungle',
])

function patternOf(pokemon: AvailabilityPokemon): string | undefined {
  // Our unsuffixed record is Icy Snow, not an aggregate species or Meadow Pattern.
  if (pokemon.id === 'vivillon') return 'icy-snow'
  if (!pokemon.id.startsWith('vivillon-')) return undefined
  const pattern = pokemon.id.slice('vivillon-'.length)
  return regionalPatterns.has(pattern) || pattern === 'fancy' || pattern === 'pokeball'
    ? pattern
    : undefined
}

/** Curated acquisition routes, not species-row inheritance. GO remains independently parsed. */
export function resolveVivillonAvailability(
  main: MainAvailability,
  pokemon: AvailabilityPokemon,
  gameId: string,
): LocationMethod | undefined {
  const pattern = patternOf(pokemon)
  if (!pattern || gameId === 'go') return undefined
  const regional = regionalPatterns.has(pattern)
  const method = (
    status: LocationMethod['status'],
    text: string,
    sourceUrl: string = vivillonAvailabilityReferences.forms,
  ): LocationMethod => ({ status, text, sourceUrl })

  if (['xy-x', 'xy-y', 'usum-us', 'usum-um'].includes(gameId))
    return regional
      ? method(
          'obtainableIn',
          'This regional Vivillon pattern can be obtained through the save’s Nintendo 3DS region setting and native Scatterbug/Spewpa.',
        )
      : method(
          'transferOnlyIn',
          'Fancy/Poké Ball patterns require a distribution or transfer here; breeding does not reproduce these special patterns. Distributions follow the Ev → transferOnlyIn policy.',
        )

  if (['oras-or', 'oras-as', 'sm-s', 'sm-m'].includes(gameId))
    return method(
      'transferOnlyIn',
      'Vivillon requires an external acquisition route here. Breeding imported parents does not remove that dependency; the two special patterns cannot be bred.',
    )

  if (gameId === 'sv-s' || gameId === 'sv-v')
    return pattern === 'fancy'
      ? method(
          'obtainableIn',
          'Fancy is the native Scarlet/Violet pattern, including wild encounters and offspring.',
        )
      : method(
          'transferOnlyIn',
          pattern === 'pokeball'
            ? 'Poké Ball Pattern must be imported; GO postcards cannot generate it.'
            : 'This regional pattern requires a GO postcard or an imported Pokémon. Per dataset policy, postcard-dependent encounters (including Union Circle) are simplified to transferOnlyIn.',
        )

  if (gameId === 'lza') {
    if (pattern === 'meadow')
      return method('obtainableIn', 'Meadow Pattern is native to Lumiose City.')
    if (pattern === 'garden')
      return method(
        'obtainableIn',
        'Garden Pattern is native to Hyperspace Lumiose in the Mega Dimension DLC.',
      )
    if (pattern === 'marine')
      return method(
        'obtainableIn',
        'Evolve the Marine Pattern Spewpa gifted by Side Mission 021, Spewpa in the Museum. This is an ordinary permanent quest reward.',
        vivillonAvailabilityReferences.museum,
      )
    return method(
      'transferOnlyIn',
      'This pattern has no native Legends: Z-A acquisition route and must be transferred through HOME.',
    )
  }

  if (gameId === 'champions')
    return method(
      'transferOnlyIn',
      pattern === 'high-plains'
        ? 'High Plains Pattern can visit from HOME. Roster Ranch recruits cannot be exported, so recruiting does not count as obtainableIn.'
        : 'This pattern must visit from HOME; Roster Ranch recruits only High Plains Pattern.',
      vivillonAvailabilityReferences.champions,
    )

  if (gameId === 'home')
    return method(
      'transferOnlyIn',
      'All Vivillon patterns retain their form in HOME and must arrive through transfer or trade.',
    )

  // Only use the species row for explicit incompatibility, never for positive form availability.
  const speciesMethod = main.rows
    .get(666)
    ?.find((row) => !row.form)
    ?.methods.get(gameId)
  if (speciesMethod?.status === 'unavailable') return speciesMethod
  return main.gameIds.has(gameId)
    ? method(
        'unknown',
        'No curated Vivillon pattern route for this game; a positive species cell does not establish its patterns.',
      )
    : undefined
}

/**
 * Reviewed decisions for PokéAPI encounter rows the importer cannot map by id alone. Location
 * keys are PokéAPI location ids at the revision pinned in `../locations/fetch.ts`.
 */

const pokeApiLocation = (id: number) => `https://pokeapi.co/api/v2/location/${id}/`

/** Alternate PokéAPI records of a place the catalog already holds under another id. */
export const pokeApiLocationAliases: Readonly<
  Record<string, { location: string; source: string; note: string }>
> = {
  '159': {
    location: 'kanto-victory-road',
    source: pokeApiLocation(159),
    note: 'kanto-victory-road-2 is the Generation 1 and FireRed/LeafGreen Victory Road; the catalog keeps one Kanto Victory Road.',
  },
  '694': {
    location: 'hoenn-team-aqua-magma-hideout',
    source: pokeApiLocation(694),
    note: 'team-magma-hideout holds the Ruby, Sapphire, Emerald and Omega Ruby hideout encounters, the catalog place of both team hideouts.',
  },
  '1113': {
    location: 'kanto-underground-path-5-6',
    source: 'https://www.serebii.net/rb/trades.shtml',
    note: 'kanto-underground-path holds the in-game trades at the Route 5 entrance of the Routes 5-6 Underground Path (Nidoran in Red, Blue and FireRed/LeafGreen, Machoke in Yellow; https://www.serebii.net/yellow/trades.shtml).',
  },
}

/** PokéAPI pseudo-locations with no single place to attach encounters to. */
export const excludedPokeApiLocations: Readonly<Record<string, string>> = {
  '148': 'unknown-all-poliwag: placeholder for an unlocated Poliwag encounter',
  '149': 'unknown-all-rattata: placeholder for an unlocated Rattata encounter',
  '150': 'unknown-all-bugs: placeholder for unlocated Bug-type encounters',
  '799': 'roaming-kanto: roaming Pokémon have no fixed place',
  '800': 'roaming-johto: roaming Pokémon have no fixed place',
  '801': 'roaming-hoenn: roaming Pokémon have no fixed place',
  '802': 'roaming-sinnoh: roaming Pokémon have no fixed place',
  '1056': 'roaming-kalos: roaming Pokémon have no fixed place',
  '1089':
    'hoenn-pokecenter: event distributions (Celebi, Jirachi, Pikachu) picked up from a Poké Center deliveryman, not an in-game encounter',
  '1091':
    'kanto-pokecenter: event distributions (Celebi, Pikachu) picked up from a Poké Center deliveryman, not an in-game encounter',
  '1092':
    'sinnoh-pokemart: the Manaphy Egg distribution picked up at a Poké Mart, not an in-game encounter',
  '1093':
    'johto-pokemart: the Manaphy Egg distribution picked up at a Poké Mart, not an in-game encounter',
  '1116':
    'isle-of-armor-caves: in-game trades without a named place, and the traded forms (regional or not) are not stated',
  '1117': 'roaming-galar-wild-area: roaming Pokémon (Galarian Zapdos) have no fixed place',
  '1118': 'roaming-isle-of-armor: roaming Pokémon (Galarian Moltres) have no fixed place',
  '1119': 'roaming-crown-tundra: roaming Pokémon (Galarian Articuno) have no fixed place',
  '1120':
    'galar-wild-area-max-dens: Max Raid Battles spread over dens in many Wild Area places, with no single place per row',
}

/**
 * PokéAPI Pokémon that the dataset keeps as an ability variant of another record rather than a
 * form of its own. Keys are PokéAPI identifiers.
 */
export const pokeApiPokemonAliases: Readonly<Record<string, { pokemon: string; note: string }>> = {
  'rockruff-own-tempo': {
    pokemon: 'rockruff',
    note: 'Own Tempo Rockruff is a Rockruff with a special ability; the dataset has no separate record.',
  },
  'zygarde-50-power-construct': {
    pokemon: 'zygarde',
    note: 'Power Construct Zygarde 50% is Zygarde 50% with the Power Construct ability; the dataset has no separate record.',
  },
}

/**
 * Forms decided by the place of the encounter. PokéAPI files these encounters under the shared
 * species, which the importer attaches to the default record; a matching game and place moves
 * the encounter to `form`. Forms decided by season, flower colour, terrain or the player's region
 * (Deerling, Flabébé, Burmy, Vivillon) stay on the default record as species-level encounters.
 */
export const placeFormOverrides: readonly {
  pokemon: string
  form: string
  games: readonly string[]
  locations: readonly string[]
  source: string
  note: string
}[] = [
  ...['shellos', 'gastrodon'].map((pokemon) => ({
    pokemon,
    form: `${pokemon}-east`,
    games: ['dp-d', 'dp-p', 'pt'],
    locations: [
      'sinnoh-route-212',
      'sinnoh-route-213',
      'sinnoh-route-222',
      'sinnoh-route-224',
      'sinnoh-route-230',
      'sinnoh-pastoria-city',
    ],
    source: `https://bulbapedia.bulbagarden.net/wiki/${pokemon === 'shellos' ? 'Shellos' : 'Gastrodon'}_(Pok%C3%A9mon)`,
    note: 'East Sea forms live east of Mt. Coronet (Routes 212 south to 230 and Pastoria City); every other Sinnoh place gives the West Sea default form. Route 221 is West Sea.',
  })),
]

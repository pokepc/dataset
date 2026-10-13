/**
 * Reviewed decisions for PokéAPI encounter locations the place catalog does not map by
 * `pokeApiId`. Keys are PokéAPI location ids at the revision pinned in `../locations/fetch.ts`.
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
}

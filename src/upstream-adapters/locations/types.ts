export type Candidate = {
  source: 'pokeapi' | 'pokemondb' | 'serebii' | 'bulbapedia' | 'manual'
  sourceId: string
  url: string
  name: string
  region: string | null
  games: string[]
  pokeApiId: number | null
}

/** A location record with its English name, split into `locations.json` and `i18n/eng/locations.json` on write. */
export type Location = Pkds.Location & { name: string }

export type CatalogEntry = Candidate & { pages: string[] }

export type Game = { id: string; type: string; pokeApiGameVersionId: number | null }

export type Candidate = {
  source: 'pokeapi' | 'pokemondb' | 'serebii' | 'bulbapedia' | 'manual'
  sourceId: string
  url: string
  name: string
  region: string | null
  games: string[]
  pokeApiId: number | null
}

export type Location = Pkds.Location

export type CatalogEntry = Candidate & { pages: string[] }

export type Game = { id: string; type: string; pokeApiGameVersionId: number | null }

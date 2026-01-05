import {
  dexNumToGen,
  formatDexNum,
  generatePokemonSearchableText,
  sanitizeSearchQuery,
} from './utils'

const MIN_SEARCH_LENGTH = 2

export function searchPokemon(
  pokemon: Array<Pkds.TranslatedPokemon>,
  filters: Partial<Pkds.PokemonSearchFilter>,
  requiresSearchString: boolean = true,
): Pkds.PokemonSearchResults {
  const searchQuery = sanitizeSearchQuery(filters.q ?? '')

  if (requiresSearchString && searchQuery.length < MIN_SEARCH_LENGTH) {
    return {
      pokemon: pokemon,
      meta: { total: pokemon.length, skipped: true },
    }
  }

  const filteredPokes = pokemon.filter((p) => {
    // const filterGen = filter.q ? 0 : (filter.gen ?? 0)
    const filterGen = filters.gen ?? 0

    if (!filters.forms && p.isForm) return false
    if (filters.color && p.color.toLowerCase() !== filters.color.toLowerCase()) return false
    if (filters.type && ![p.type1, p.type2].filter(Boolean).includes(filters.type)) return false
    if (filterGen > 0 && p.speciesGen !== filters.gen) return false

    if (filters.q) {
      const search = sanitizeSearchQuery(filters.q).split(' ')
      if (!search.every((s) => p.searchableText.includes(s))) return false
    }

    return true
  })

  return {
    pokemon: filteredPokes,
    meta: { total: pokemon.length, skipped: false },
  }
}

export function createSearchablePokemonList(
  pokemon: Array<Pkds.Pokemon>,
): Array<Pkds.TranslatedPokemon> {
  return pokemon.map(
    (pokemon: Pkds.Pokemon): Pkds.TranslatedPokemon => ({
      ...pokemon,
      speciesGen: dexNumToGen(pokemon.dexNum),
      dexNum: formatDexNum(pokemon.dexNum),
      name: pokemon.names['eng'] ?? '',
      speciesName: pokemon.speciesNames?.['eng'],
      formName: pokemon.formNames?.['eng'],
      lang: 'eng',
      searchableText: generatePokemonSearchableText(pokemon),
    }),
  )
}

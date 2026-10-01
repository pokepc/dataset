import { z } from 'zod'
import { POKEPC_LATEST_GENERATION } from './constants'
import type { LocaleCode } from './languages'
import type { Pokemon, TextFile } from './types'
import { formatDexNum, translatePokemonList, type TranslatedPokemon } from './utils'
import { matchesSearchQuery, sanitizeSearchQuery } from '../utils/utils-internal'
export { matchesSearchQuery, sanitizeSearchQuery } from '../utils/utils-internal'

const MIN_SEARCH_LENGTH = 2

export const pokemonSearchFilterSchema = z.object({
  q: z.string().optional().catch(undefined),
  gen: z.coerce.number().min(1).max(POKEPC_LATEST_GENERATION).optional().catch(undefined),
  lang: z.string().optional().default('en'),
  // pokemon-specific filters:
  color: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  forms: z.coerce.boolean().optional().catch(undefined),
  shiny: z.coerce.boolean().optional().catch(undefined),
})
export type PokemonSearchFilter = Partial<z.infer<typeof pokemonSearchFilterSchema>>
export type PokemonSearchResults = {
  pokemon: TranslatedPokemon[]
  meta: { total: number; skipped: boolean }
}

export function searchPokemon(
  pokemon: TranslatedPokemon[],
  filters: PokemonSearchFilter,
  requiresSearchString: boolean = true,
): PokemonSearchResults {
  const searchQuery = sanitizeSearchQuery(filters.q ?? '')

  if (requiresSearchString && searchQuery.length < MIN_SEARCH_LENGTH) {
    return { pokemon, meta: { total: pokemon.length, skipped: true } }
  }

  const filteredPokes = pokemon.filter((p) => {
    const filterGen = filters.gen ?? 0

    if (!filters.forms && p.isForm) return false
    if (filters.color && p.color.toLowerCase() !== filters.color.toLowerCase()) return false
    if (filters.type && ![p.type1, p.type2].filter(Boolean).includes(filters.type)) return false
    if (filterGen > 0 && p.speciesGen !== filters.gen) return false
    if (filters.q && !matchesSearchQuery(p.searchableText, filters.q)) return false

    return true
  })

  return { pokemon: filteredPokes, meta: { total: pokemon.length, skipped: false } }
}

/**
 * Pokémon with their text in one locale (English by default), searchable by the names in
 * `searchTextFiles`, with 4-digit dex numbers.
 */
export function createSearchablePokemonList(
  pokemon: Pokemon[],
  textFile: TextFile<'pokemon'>,
  locale: LocaleCode = 'eng',
  searchTextFiles: Array<TextFile<'pokemon'>> = [textFile],
): TranslatedPokemon[] {
  return translatePokemonList(pokemon, textFile, locale, searchTextFiles).map((p) => ({
    ...p,
    dexNum: formatDexNum(p.dexNum),
  }))
}

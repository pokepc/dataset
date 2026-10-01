import fs from 'node:fs'
import {
  absDatasetFile,
  loadAllPokemon,
  loadText,
  readDatasetFile,
  writeDatasetFile,
} from '@pokepc/dataset/lib/fs'
import { localeCodes } from '@pokepc/dataset/lib/languages'
import { createSearchablePokemonList } from '@pokepc/dataset/lib/search'
import type { Pokemon } from '@pokepc/dataset/lib/types'

/** English name of an entity from `i18n/eng/<kind>.json`, or its id when there is none. */
export function englishName(
  kind: 'games' | 'pokedexes' | 'regions' | 'pokemon',
  id: string,
): string {
  return loadText(kind, 'eng')[id]?.name ?? id
}

/**
 * Pokémon with their English text, searchable by their names in every locale (as in v7, where
 * records carried all names).
 */
export function loadSearchablePokemon(pokemon: Pokemon[] = loadAllPokemon()) {
  return createSearchablePokemonList(
    pokemon,
    loadText('pokemon', 'eng'),
    'eng',
    localeCodes.map((locale) => loadText('pokemon', locale)),
  )
}

/**
 * Sets or removes one entity's text in a locale file, keeping the order of existing entries and
 * appending new ones. Callers validate before writing.
 */
export function updateTextFile(
  filePath: string,
  id: string,
  entry: Record<string, unknown> | undefined,
): void {
  const absPath = absDatasetFile(filePath)
  const file: Record<string, unknown> = fs.existsSync(absPath)
    ? readDatasetFile<Record<string, unknown>>(filePath)
    : {}
  if (entry === undefined) delete file[id]
  else file[id] = entry
  writeDatasetFile(file, filePath, false)
}

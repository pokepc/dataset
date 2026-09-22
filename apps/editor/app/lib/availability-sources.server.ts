import {
  loadAvailabilitySource,
  type AvailabilitySourceId,
  type AvailabilitySourceResult,
} from '@pokepc/dataset/lib/availability-sources'
import { absDatasetFile, loadAllGames, loadAllPokemon } from '@pokepc/dataset/lib/fs'
import { resolve } from 'node:path'

export type AvailabilitySourceResponse =
  | { ok: true; result: AvailabilitySourceResult }
  | { ok: false; error: string }

const sources = new Set<AvailabilitySourceId>(['bulbapedia', 'bulbapedia-go'])

export async function loadPokemonAvailabilitySource(
  request: Request,
): Promise<AvailabilitySourceResponse> {
  const params = new URL(request.url).searchParams
  const source = params.get('source') as AvailabilitySourceId
  if (!sources.has(source)) return { ok: false, error: 'Unknown availability source.' }

  const pokemonId = params.get('pokemonId')
  const allPokemon = loadAllPokemon()
  const pokemon = allPokemon.find((entry) => entry.id === pokemonId)
  if (!pokemon) return { ok: false, error: 'Unknown Pokemon.' }

  try {
    return {
      ok: true,
      result: await loadAvailabilitySource(source, pokemon, loadAllGames(), {
        signal: request.signal,
        cacheDir:
          process.env.POKEPC_AVAILABILITY_CACHE_DIR ?? resolve(absDatasetFile('.'), '..', '.local'),
        refresh: params.get('refresh') === '1',
        siblings: allPokemon.filter((entry) => entry.dexNum === pokemon.dexNum),
      }),
    }
  } catch (error) {
    request.signal.throwIfAborted()
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not load availability evidence.',
    }
  }
}

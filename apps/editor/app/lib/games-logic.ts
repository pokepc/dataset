import { sortStringsInGivenOrder } from '@pokepc/dataset/lib/utils'

export type GameAvailabilityState = {
  debutedPokemon: string[]
  obtainablePokemon: string[]
  storablePokemon: string[]
  transferOnlyPokemon: string[]
  shinyLockedPokemon: string[]
  eventOnlyPokemon: string[]
}

export const availabilityKeys = [
  'debutedPokemon',
  'obtainablePokemon',
  'storablePokemon',
  'transferOnlyPokemon',
  'shinyLockedPokemon',
  'eventOnlyPokemon',
] as const

export type AvailabilityKey = (typeof availabilityKeys)[number]

export function cloneAvailabilityState(state: GameAvailabilityState): GameAvailabilityState {
  return {
    debutedPokemon: [...state.debutedPokemon],
    obtainablePokemon: [...state.obtainablePokemon],
    storablePokemon: [...state.storablePokemon],
    transferOnlyPokemon: [...state.transferOnlyPokemon],
    shinyLockedPokemon: [...state.shinyLockedPokemon],
    eventOnlyPokemon: [...state.eventOnlyPokemon],
  }
}

function normalizePokemonIdList(
  ids: unknown,
  pokemonOrder: string[],
  validPokemonIds: Set<string>,
): string[] {
  const deduped = [...new Set(Array.isArray(ids) ? ids : [])].filter(
    (id): id is string => typeof id === 'string' && validPokemonIds.has(id),
  )
  return sortStringsInGivenOrder(deduped, pokemonOrder)
}

export function normalizeGameAvailabilityState(
  state: GameAvailabilityState,
  pokemonOrder: string[],
  validPokemonIds: Set<string>,
): GameAvailabilityState {
  return {
    debutedPokemon: normalizePokemonIdList(state.debutedPokemon, pokemonOrder, validPokemonIds),
    obtainablePokemon: normalizePokemonIdList(
      state.obtainablePokemon,
      pokemonOrder,
      validPokemonIds,
    ),
    storablePokemon: normalizePokemonIdList(state.storablePokemon, pokemonOrder, validPokemonIds),
    transferOnlyPokemon: normalizePokemonIdList(
      state.transferOnlyPokemon,
      pokemonOrder,
      validPokemonIds,
    ),
    shinyLockedPokemon: normalizePokemonIdList(
      state.shinyLockedPokemon,
      pokemonOrder,
      validPokemonIds,
    ),
    eventOnlyPokemon: normalizePokemonIdList(state.eventOnlyPokemon, pokemonOrder, validPokemonIds),
  }
}

export function getPrefilledTransferOnlyPokemonIds(
  state: GameAvailabilityState,
  pokemonOrder: string[],
  battleOnlyPokemonIds: string[] = [],
  excludedPokemonIds: string[] = [],
): string[] {
  const obtainableIdSet = new Set(state.obtainablePokemon)
  const eventOnlyIdSet = new Set(state.eventOnlyPokemon)
  const candidateIdSet = new Set([...state.storablePokemon, ...battleOnlyPokemonIds])
  const excludedIdSet = new Set(excludedPokemonIds)

  return sortStringsInGivenOrder(
    [...candidateIdSet].filter(
      (id) => !obtainableIdSet.has(id) && !eventOnlyIdSet.has(id) && !excludedIdSet.has(id),
    ),
    pokemonOrder,
  )
}

export function getMissingObtainablePokemonIds(
  state: GameAvailabilityState,
  pokemonOrder: string[],
  allowedPokemonIds: string[],
  excludedPokemonIds: string[] = [],
): string[] {
  const allowedPokemonIdSet = new Set(allowedPokemonIds)
  const blockedIdSet = new Set([
    ...state.obtainablePokemon,
    ...state.transferOnlyPokemon,
    ...state.eventOnlyPokemon,
    ...excludedPokemonIds,
  ])

  return pokemonOrder.filter((id) => allowedPokemonIdSet.has(id) && !blockedIdSet.has(id))
}

export function getAddableFemaleTransferOnlyPokemonIds(
  state: GameAvailabilityState,
  pokemonOrder: string[],
  femaleFormByPokemonId: Record<string, string>,
  allowedPokemonIds: string[],
  battleOnlyPokemonIds: string[] = [],
  excludedPokemonIds: string[] = [],
): string[] {
  const existingIdSet = new Set(state.transferOnlyPokemon)
  const allowedPokemonIdSet = new Set(allowedPokemonIds)
  const battleOnlyIdSet = new Set(battleOnlyPokemonIds)
  const excludedIdSet = new Set(excludedPokemonIds)

  return sortStringsInGivenOrder(
    [
      ...new Set(
        state.transferOnlyPokemon
          .map((pokemonId) => femaleFormByPokemonId[pokemonId])
          .filter(
            (pokemonId): pokemonId is string =>
              typeof pokemonId === 'string' &&
              allowedPokemonIdSet.has(pokemonId) &&
              !existingIdSet.has(pokemonId) &&
              !battleOnlyIdSet.has(pokemonId) &&
              !excludedIdSet.has(pokemonId),
          ),
      ),
    ],
    pokemonOrder,
  )
}

export function getMissingTransferOnlyPokemonIds(
  state: GameAvailabilityState,
  pokemonOrder: string[],
  allowedPokemonIds: string[],
  battleOnlyPokemonIds: string[] = [],
  excludedPokemonIds: string[] = [],
): string[] {
  const allowedPokemonIdSet = new Set(allowedPokemonIds)
  const excludedIdSet = new Set([
    ...state.obtainablePokemon,
    ...state.eventOnlyPokemon,
    ...state.transferOnlyPokemon,
    ...battleOnlyPokemonIds,
    ...excludedPokemonIds,
  ])

  return pokemonOrder.filter((id) => allowedPokemonIdSet.has(id) && !excludedIdSet.has(id))
}

export function getUnobtainablePokemonIds(
  state: GameAvailabilityState,
  pokemonOrder: string[],
  allowedPokemonIds: string[],
): string[] {
  const allowedPokemonIdSet = new Set(allowedPokemonIds)
  const obtainableByAnyMeansIdSet = new Set([
    ...state.obtainablePokemon,
    ...state.transferOnlyPokemon,
    ...state.eventOnlyPokemon,
  ])

  return pokemonOrder.filter(
    (id) => allowedPokemonIdSet.has(id) && !obtainableByAnyMeansIdSet.has(id),
  )
}

import { sortStringsInGivenOrder } from '@pokepc/dataset/lib/utils'

export type AvailabilityState = {
  debutIn: string
  obtainableIn: string[]
  storableIn: string[]
  transferOnlyIn: string[]
  eventOnlyIn: string[]
  shinyLockedIn: string[]
  shinyUnavailableIn: string[]
}

export function toAvailabilityState(
  pokemon: Pkds.Pokemon | Pkds.TranslatedPokemon,
): AvailabilityState {
  const safeArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []

  return {
    debutIn: pokemon.debutIn,
    obtainableIn: safeArray(pokemon.obtainableIn),
    storableIn: safeArray(pokemon.storableIn),
    transferOnlyIn: safeArray(pokemon.transferOnlyIn),
    eventOnlyIn: safeArray(pokemon.eventOnlyIn),
    shinyLockedIn: safeArray(pokemon.shinyLockedIn),
    shinyUnavailableIn: safeArray(pokemon.shinyUnavailableIn),
  }
}

export function sanitizeAvailabilityState(
  input: AvailabilityState,
  gameIdOrder: string[],
  validGameIds: Set<string>,
  debutIdOrder: string[],
  validDebutIds: Set<string>,
): AvailabilityState {
  const normalizeArray = (ids: unknown) => {
    const deduped = [...new Set(Array.isArray(ids) ? ids : [])].filter(
      (id): id is string => typeof id === 'string' && validGameIds.has(id),
    )
    return sortStringsInGivenOrder(deduped, gameIdOrder)
  }
  const obtainableIn = normalizeArray(input.obtainableIn)
  const storableIn = normalizeArray(input.storableIn)
  const transferOnlyIn = normalizeArray(input.transferOnlyIn)
  const eventOnlyIn = normalizeArray(input.eventOnlyIn)
  const shinyLockedIn = normalizeArray(input.shinyLockedIn)
  // A game where the form cannot be stored needs no shiny verdict.
  const shinyUnavailableIn = normalizeArray(input.shinyUnavailableIn).filter((id) =>
    storableIn.includes(id),
  )

  const rawDebutIn = typeof input.debutIn === 'string' ? input.debutIn : ''
  const debutCandidates = [
    rawDebutIn,
    ...obtainableIn,
    ...storableIn,
    ...transferOnlyIn,
    ...eventOnlyIn,
    ...shinyLockedIn,
    debutIdOrder[0],
  ]
  const debutIn =
    debutCandidates.find((candidate) => typeof candidate === 'string' && candidate.length > 0) ?? ''
  const safeDebutIn = validDebutIds.has(debutIn) ? debutIn : rawDebutIn || debutIn

  return {
    debutIn: safeDebutIn,
    obtainableIn,
    storableIn,
    transferOnlyIn,
    eventOnlyIn,
    shinyLockedIn,
    shinyUnavailableIn,
  }
}

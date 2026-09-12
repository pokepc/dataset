import type { PokemonOption } from '@/components/pokemon-option-combobox'
import type { GameOption } from '@/components/types'
import {
  type AvailabilityKey,
  type GameAvailabilityState,
  normalizeGameAvailabilityState,
} from '@/lib/games-logic'
import { gameSpriteUrl, pokemonSpriteUrl } from '@/lib/utils'
import {
  loadAllGames,
  loadAllPokemon,
  readDatasetFile,
  writeDatasetFile,
} from '@pokepc/dataset/lib/fs'
import { pokemonSchema } from '@pokepc/dataset/lib/schemas'
import { createSearchablePokemonList } from '@pokepc/dataset/lib/search'
import { sortStringsInGivenOrder } from '@pokepc/dataset/lib/utils'

const gameAvailabilitySchema = pokemonSchema.pick({
  debutIn: true,
  obtainableIn: true,
  storableIn: true,
  transferOnlyIn: true,
  eventOnlyIn: true,
  shinyLockedIn: true,
})

const availabilityKeys = [
  'debutedPokemon',
  'obtainablePokemon',
  'storablePokemon',
  'transferOnlyPokemon',
  'shinyLockedPokemon',
  'eventOnlyPokemon',
] as const satisfies readonly AvailabilityKey[]

type SectionDiff = {
  toAdd: Set<string>
  toRemove: Set<string>
}

function buildGameAvailabilityState(
  pokemonList: Pkds.Pokemon[],
  gameId: string,
  pokemonOrder: string[],
  validPokemonIds: Set<string>,
): GameAvailabilityState {
  const raw: GameAvailabilityState = {
    debutedPokemon: [],
    obtainablePokemon: [],
    storablePokemon: [],
    transferOnlyPokemon: [],
    shinyLockedPokemon: [],
    eventOnlyPokemon: [],
  }

  for (const pokemon of pokemonList) {
    if (pokemon.debutIn === gameId) {
      raw.debutedPokemon.push(pokemon.id)
    }
    if (pokemon.obtainableIn.includes(gameId)) {
      raw.obtainablePokemon.push(pokemon.id)
    }
    if (pokemon.storableIn.includes(gameId)) {
      raw.storablePokemon.push(pokemon.id)
    }
    if (pokemon.transferOnlyIn.includes(gameId)) {
      raw.transferOnlyPokemon.push(pokemon.id)
    }
    if ((pokemon.shinyLockedIn ?? []).includes(gameId)) {
      raw.shinyLockedPokemon.push(pokemon.id)
    }
    if (pokemon.eventOnlyIn.includes(gameId)) {
      raw.eventOnlyPokemon.push(pokemon.id)
    }
  }

  return normalizeGameAvailabilityState(raw, pokemonOrder, validPokemonIds)
}

function deriveFallbackDebut(
  pokemon: Pick<
    Pkds.Pokemon,
    'obtainableIn' | 'storableIn' | 'transferOnlyIn' | 'eventOnlyIn' | 'shinyLockedIn'
  >,
  removedGameId: string,
  debutIdOrder: string[],
  validDebutIds: Set<string>,
): string {
  const candidates = [
    ...pokemon.obtainableIn,
    ...pokemon.storableIn,
    ...pokemon.transferOnlyIn,
    ...pokemon.eventOnlyIn,
    ...(pokemon.shinyLockedIn ?? []),
    ...debutIdOrder,
  ]

  return (
    candidates.find((id) => id !== removedGameId && validDebutIds.has(id)) ??
    debutIdOrder.find((id) => id !== removedGameId && validDebutIds.has(id)) ??
    debutIdOrder[0] ??
    removedGameId
  )
}

function normalizeGameMembership(
  ids: string[] | undefined,
  gameIdOrder: string[],
  validGameIds: Set<string>,
): string[] {
  return sortStringsInGivenOrder(
    [...new Set((ids ?? []).filter((id) => typeof id === 'string' && validGameIds.has(id)))],
    gameIdOrder,
  )
}

function buildFemaleFormByPokemonId(pokemonList: Pkds.Pokemon[]): Record<string, string> {
  const pokemonById = new Map(pokemonList.map((pokemon) => [pokemon.id, pokemon]))
  const femaleFormByPokemonId: Record<string, string> = {}

  const resolveFemaleFormId = (pokemon: Pkds.Pokemon): string | null => {
    if (!pokemon.hasGenderDifferences || pokemon.isFemaleForm) {
      return null
    }

    const ownForms = pokemon.forms ?? []
    const ownFemaleForm = ownForms.find((formId) => pokemonById.get(formId)?.isFemaleForm)
    if (ownFemaleForm) {
      return ownFemaleForm
    }

    const baseSpeciesId = pokemon.baseSpecies
    if (!baseSpeciesId) {
      return null
    }

    const basePokemon = pokemonById.get(baseSpeciesId)
    if (!basePokemon) {
      return null
    }

    const baseCandidates = [basePokemon.id, ...(basePokemon.forms ?? [])]
    const baseFemaleForm = baseCandidates.find(
      (candidateId) => pokemonById.get(candidateId)?.isFemaleForm,
    )
    return baseFemaleForm ?? null
  }

  for (const pokemon of pokemonList) {
    const femaleFormId = resolveFemaleFormId(pokemon)
    if (femaleFormId) {
      femaleFormByPokemonId[pokemon.id] = femaleFormId
    }
  }

  return femaleFormByPokemonId
}

export function loadGamesIndexData() {
  const games = loadAllGames().map((game) => ({
    id: game.id,
    gen: game.gen,
    label: game.name ?? game.id,
    image: gameSpriteUrl(game.id),
  }))
  return { games }
}

export function loadGameAvailabilityEditorData(gameId: string | undefined) {
  if (!gameId) {
    throw new Response('Missing game id.', { status: 400 })
  }

  const allGames = loadAllGames()
  const selectedGame = allGames.find((game) => game.id === gameId)
  if (!selectedGame) {
    throw new Response('Game not found.', { status: 404 })
  }

  const allPokemon = loadAllPokemon()
  const searchablePokemon = createSearchablePokemonList(allPokemon)
  const pokemonOrder = allPokemon.map((pokemon) => pokemon.id)
  const validPokemonIds = new Set(pokemonOrder)
  const shouldCapPokemonByGen = selectedGame.gen > 0
  const allowedPokemonIdsForGame = allPokemon
    .filter((pokemon) => !shouldCapPokemonByGen || pokemon.gen <= selectedGame.gen)
    .map((pokemon) => pokemon.id)
  const battleOnlyPokemonIdsForGame = allPokemon
    .filter(
      (pokemon) =>
        (!shouldCapPokemonByGen || pokemon.gen <= selectedGame.gen) && pokemon.isBattleOnlyForm,
    )
    .map((pokemon) => pokemon.id)
  const femaleFormByPokemonId = buildFemaleFormByPokemonId(allPokemon)
  const initialAvailability = buildGameAvailabilityState(
    allPokemon,
    gameId,
    pokemonOrder,
    validPokemonIds,
  )
  const gameOptions: GameOption[] = allGames.map((game) => ({
    id: game.id,
    label: game.name ?? game.id,
    image: gameSpriteUrl(game.id),
    modes: ['games'],
  }))
  const availabilityByGameId = Object.fromEntries(
    gameOptions.map((gameOption) => [
      gameOption.id,
      buildGameAvailabilityState(allPokemon, gameOption.id, pokemonOrder, validPokemonIds),
    ]),
  )

  const pokemonOptions: PokemonOption[] = searchablePokemon.map((pokemon) => ({
    id: pokemon.id,
    label: pokemon.name || pokemon.id,
    image: pokemonSpriteUrl(pokemon.nid),
    dexNum: pokemon.dexNum,
    searchableText: pokemon.searchableText,
  }))

  return {
    game: {
      id: selectedGame.id,
      label: selectedGame.name ?? selectedGame.id,
      image: gameSpriteUrl(selectedGame.id),
      gen: selectedGame.gen,
    },
    pokemonOptions,
    allowedPokemonIdsForGame,
    battleOnlyPokemonIdsForGame,
    femaleFormByPokemonId,
    pokemonOrder,
    initialAvailability,
    gameOptions,
    availabilityByGameId,
  }
}

export type SaveGameAvailabilityResult =
  | { success: false; error: string }
  | { success: true; availability: GameAvailabilityState; updatedPokemonCount: number }

export async function saveGameAvailabilityFromForm(
  request: Request,
  params: { id?: string },
): Promise<SaveGameAvailabilityResult> {
  const formData = await request.formData()
  const intent = formData.get('intent')
  if (intent !== 'save-game-availability') {
    return { success: false, error: 'Unsupported action intent.' }
  }

  const gameId = formData.get('gameId')
  if (typeof gameId !== 'string' || !gameId) {
    return { success: false, error: 'Missing game id.' }
  }
  if (params.id && params.id !== gameId) {
    return { success: false, error: 'Mismatched game id.' }
  }

  const draftRaw = formData.get('draft')
  const baselineRaw = formData.get('baseline')
  if (typeof draftRaw !== 'string') {
    return { success: false, error: 'Missing draft payload.' }
  }

  const allGames = loadAllGames()
  const selectedGame = allGames.find((game) => game.id === gameId)
  if (!selectedGame) {
    return { success: false, error: 'Invalid game id.' }
  }

  const allPokemon = loadAllPokemon()
  const pokemonOrder = allPokemon.map((pokemon) => pokemon.id)
  const validPokemonIds = new Set(pokemonOrder)
  const gameIdOrder = allGames.map((game) => game.id)
  const validGameIds = new Set(gameIdOrder)
  const debutIdOrder = allGames
    .filter((game) => game.type === 'set' || (game.type === 'game' && !game.gameSet))
    .map((game) => game.id)
  const validDebutIds = new Set(debutIdOrder)

  let parsedDraft: GameAvailabilityState
  try {
    parsedDraft = JSON.parse(draftRaw) as GameAvailabilityState
  } catch {
    return { success: false, error: 'Invalid draft payload.' }
  }

  const normalizedDraft = normalizeGameAvailabilityState(parsedDraft, pokemonOrder, validPokemonIds)

  let normalizedBaseline = buildGameAvailabilityState(
    allPokemon,
    gameId,
    pokemonOrder,
    validPokemonIds,
  )
  if (typeof baselineRaw === 'string') {
    try {
      normalizedBaseline = normalizeGameAvailabilityState(
        JSON.parse(baselineRaw) as GameAvailabilityState,
        pokemonOrder,
        validPokemonIds,
      )
    } catch {
      // Ignore invalid baseline and use current snapshot as fallback baseline.
    }
  }

  const diffs = availabilityKeys.reduce<Record<AvailabilityKey, SectionDiff>>(
    (accumulator, key) => {
      const baselineSet = new Set(normalizedBaseline[key])
      const draftSet = new Set(normalizedDraft[key])
      accumulator[key] = {
        toAdd: new Set([...draftSet].filter((id) => !baselineSet.has(id))),
        toRemove: new Set([...baselineSet].filter((id) => !draftSet.has(id))),
      }
      return accumulator
    },
    {} as Record<AvailabilityKey, SectionDiff>,
  )

  const impactedPokemonIds = new Set<string>()
  for (const key of availabilityKeys) {
    for (const id of diffs[key].toAdd) {
      impactedPokemonIds.add(id)
    }
    for (const id of diffs[key].toRemove) {
      impactedPokemonIds.add(id)
    }
  }

  if (impactedPokemonIds.size === 0) {
    return { success: true, availability: normalizedDraft, updatedPokemonCount: 0 }
  }

  for (const pokemonId of impactedPokemonIds) {
    const pokemonPath = `pokemon/${pokemonId}.json`
    const currentPokemon = readDatasetFile<Pkds.Pokemon>(pokemonPath)
    let didChange = false

    const nextObtainable = normalizeGameMembership(
      [
        ...currentPokemon.obtainableIn,
        ...(diffs.obtainablePokemon.toAdd.has(pokemonId) ? [gameId] : []),
      ].filter((id) => !(diffs.obtainablePokemon.toRemove.has(pokemonId) && id === gameId)),
      gameIdOrder,
      validGameIds,
    )
    if (JSON.stringify(nextObtainable) !== JSON.stringify(currentPokemon.obtainableIn)) {
      currentPokemon.obtainableIn = nextObtainable
      didChange = true
    }

    const nextStorable = normalizeGameMembership(
      [
        ...currentPokemon.storableIn,
        ...(diffs.storablePokemon.toAdd.has(pokemonId) ? [gameId] : []),
      ].filter((id) => !(diffs.storablePokemon.toRemove.has(pokemonId) && id === gameId)),
      gameIdOrder,
      validGameIds,
    )
    if (JSON.stringify(nextStorable) !== JSON.stringify(currentPokemon.storableIn)) {
      currentPokemon.storableIn = nextStorable
      didChange = true
    }

    const nextTransferOnly = normalizeGameMembership(
      [
        ...currentPokemon.transferOnlyIn,
        ...(diffs.transferOnlyPokemon.toAdd.has(pokemonId) ? [gameId] : []),
      ].filter((id) => !(diffs.transferOnlyPokemon.toRemove.has(pokemonId) && id === gameId)),
      gameIdOrder,
      validGameIds,
    )
    if (JSON.stringify(nextTransferOnly) !== JSON.stringify(currentPokemon.transferOnlyIn)) {
      currentPokemon.transferOnlyIn = nextTransferOnly
      didChange = true
    }

    const nextEventOnly = normalizeGameMembership(
      [
        ...currentPokemon.eventOnlyIn,
        ...(diffs.eventOnlyPokemon.toAdd.has(pokemonId) ? [gameId] : []),
      ].filter((id) => !(diffs.eventOnlyPokemon.toRemove.has(pokemonId) && id === gameId)),
      gameIdOrder,
      validGameIds,
    )
    if (JSON.stringify(nextEventOnly) !== JSON.stringify(currentPokemon.eventOnlyIn)) {
      currentPokemon.eventOnlyIn = nextEventOnly
      didChange = true
    }

    const nextShinyLocked = normalizeGameMembership(
      [
        ...(currentPokemon.shinyLockedIn ?? []),
        ...(diffs.shinyLockedPokemon.toAdd.has(pokemonId) ? [gameId] : []),
      ].filter((id) => !(diffs.shinyLockedPokemon.toRemove.has(pokemonId) && id === gameId)),
      gameIdOrder,
      validGameIds,
    )
    if (JSON.stringify(nextShinyLocked) !== JSON.stringify(currentPokemon.shinyLockedIn ?? [])) {
      currentPokemon.shinyLockedIn = nextShinyLocked.length > 0 ? nextShinyLocked : undefined
      didChange = true
    }

    const debutDiff = diffs.debutedPokemon
    if (debutDiff.toAdd.has(pokemonId)) {
      if (currentPokemon.debutIn !== gameId) {
        currentPokemon.debutIn = gameId
        didChange = true
      }
    } else if (debutDiff.toRemove.has(pokemonId) && currentPokemon.debutIn === gameId) {
      const nextDebut = deriveFallbackDebut(currentPokemon, gameId, debutIdOrder, validDebutIds)
      if (nextDebut !== currentPokemon.debutIn) {
        currentPokemon.debutIn = nextDebut
        didChange = true
      }
    }

    if (!didChange) {
      continue
    }

    try {
      gameAvailabilitySchema.parse({
        debutIn: currentPokemon.debutIn,
        obtainableIn: currentPokemon.obtainableIn,
        storableIn: currentPokemon.storableIn,
        transferOnlyIn: currentPokemon.transferOnlyIn,
        eventOnlyIn: currentPokemon.eventOnlyIn,
        shinyLockedIn: currentPokemon.shinyLockedIn,
      })
    } catch {
      return {
        success: false,
        error: `Availability update failed validation for ${pokemonId}.`,
      }
    }

    writeDatasetFile(currentPokemon, pokemonPath, false)
  }

  return {
    success: true,
    availability: normalizedDraft,
    updatedPokemonCount: impactedPokemonIds.size,
  }
}

import {
  type AvailabilityState,
  sanitizeAvailabilityState,
  toAvailabilityState,
} from '@/lib/pokemon-logic'
import { gameSpriteUrl } from '@/lib/utils'
import {
  loadAllGames,
  loadAllPokemon,
  readDatasetFile,
  writeDatasetFile,
} from '@pokepc/dataset/lib/fs'
import { pokemonSchema } from '@pokepc/dataset/lib/schemas'
import { createSearchablePokemonList } from '@pokepc/dataset/lib/search'

const MIN_DEX_NUM = 1
const MAX_DEX_NUM = 1386

const availabilitySchema = pokemonSchema.pick({
  debutIn: true,
  obtainableIn: true,
  storableIn: true,
  transferOnlyIn: true,
  eventOnlyIn: true,
  shinyLockedIn: true,
})

function buildPokemonPageGameOptions(allGames: Pkds.Game[]) {
  return allGames
    .map((game) => {
      const modes = [
        game.type === 'game' ? 'games' : null,
        game.type === 'set' || (game.type === 'game' && !game.gameSet) ? 'gamesets' : null,
      ].filter((mode): mode is 'games' | 'gamesets' => mode !== null)
      if (modes.length === 0) return null
      return {
        id: game.id,
        label: game.name ?? game.id,
        image: gameSpriteUrl(game.id),
        modes,
      }
    })
    .filter((game): game is NonNullable<typeof game> => game !== null)
    .map((game) => ({
      id: game.id,
      label: game.label,
      image: game.image,
      modes: game.modes,
    }))
}

export function loadPokemonEditorData() {
  const allGames = loadAllGames()
  const gameOptions = buildPokemonPageGameOptions(allGames)

  return {
    pokemon: createSearchablePokemonList(
      loadAllPokemon().filter(
        (pokemon) => Number(pokemon.dexNum) >= MIN_DEX_NUM && Number(pokemon.dexNum) <= MAX_DEX_NUM,
      ),
    ),
    gameOptions,
    gameIdOrder: gameOptions.filter((game) => game.modes.includes('games')).map((game) => game.id),
  }
}

export type SavePokemonAvailabilityResult =
  | { success: false; error: string }
  | {
      success: true
      pokemonId: string
      availability: {
        debutIn: string
        obtainableIn: string[]
        storableIn: string[]
        transferOnlyIn: string[]
        eventOnlyIn: string[]
        shinyLockedIn: string[]
      }
    }

export function savePokemonAvailabilityFromForm(formData: FormData): SavePokemonAvailabilityResult {
  const intent = formData.get('intent')
  if (intent !== 'save-availability') {
    return { success: false, error: 'Unsupported action intent.' }
  }

  const pokemonId = formData.get('pokemonId')
  const availabilityRaw = formData.get('availability')
  if (typeof pokemonId !== 'string' || !pokemonId) {
    return { success: false, error: 'Missing pokemon id.' }
  }
  if (typeof availabilityRaw !== 'string') {
    return { success: false, error: 'Missing availability payload.' }
  }

  const allGames = loadAllGames()
  const gameIdOrder = allGames.filter((game) => game.type === 'game').map((game) => game.id)
  const validGameIds = new Set(gameIdOrder)
  const debutIdOrder = allGames
    .filter((game) => game.type === 'set' || (game.type === 'game' && !game.gameSet))
    .map((game) => game.id)
  const validDebutIds = new Set(debutIdOrder)

  let parsedPayload: AvailabilityState
  try {
    parsedPayload = JSON.parse(availabilityRaw) as AvailabilityState
  } catch {
    return { success: false, error: 'Invalid availability payload.' }
  }
  const pokemonPath = `pokemon/${pokemonId}.json`
  const currentPokemon = readDatasetFile<Pkds.Pokemon>(pokemonPath)

  const normalizedDraft = sanitizeAvailabilityState(
    parsedPayload,
    gameIdOrder,
    validGameIds,
    debutIdOrder,
    validDebutIds,
  )
  const fallbackCurrent = sanitizeAvailabilityState(
    toAvailabilityState(currentPokemon),
    gameIdOrder,
    validGameIds,
    debutIdOrder,
    validDebutIds,
  )
  const safeDebut = normalizedDraft.debutIn || fallbackCurrent.debutIn

  if (!safeDebut) {
    return { success: false, error: 'Debut game is invalid. Please select a valid game.' }
  }

  let normalizedAvailability: ReturnType<typeof availabilitySchema.parse>
  try {
    normalizedAvailability = availabilitySchema.parse({
      ...normalizedDraft,
      debutIn: safeDebut,
    })
  } catch {
    return { success: false, error: 'Availability data is invalid.' }
  }

  if ((normalizedAvailability.shinyLockedIn?.length ?? 0) === 0) {
    normalizedAvailability.shinyLockedIn = undefined
  }

  const updatedPokemon: Pkds.Pokemon = {
    ...currentPokemon,
    ...normalizedAvailability,
  }

  writeDatasetFile(updatedPokemon, pokemonPath, false)

  return {
    success: true,
    pokemonId,
    availability: {
      ...normalizedAvailability,
      shinyLockedIn: normalizedAvailability.shinyLockedIn ?? [],
    },
  }
}

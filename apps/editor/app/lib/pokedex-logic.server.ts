import type { PokemonOption } from '@/components/pokemon-option-combobox'
import {
  normalizePokedexDraft,
  type PokedexDraft,
  toPokedexDraft,
  validatePokedexDraft,
} from '@/lib/pokedex-logic'
import { pokemonSpriteUrl } from '@/lib/utils'
import {
  loadAllPokedexes,
  loadAllPokemon,
  loadAllRegions,
  readDatasetFile,
  writeDatasetFile,
} from '@pokepc/dataset/lib/fs'
import { pokedexSchema } from '@pokepc/dataset/lib/schemas'
import { createSearchablePokemonList } from '@pokepc/dataset/lib/search'

export type PokedexIndexItem = {
  id: string
  label: string
  gen: number
  entryCount: number
}

type SimpleOption = {
  id: string
  label: string
}

export function loadPokedexesIndexData() {
  const pokedexes: PokedexIndexItem[] = loadAllPokedexes().map((pokedex) => ({
    id: pokedex.id,
    label: pokedex.name,
    gen: pokedex.gen,
    entryCount: pokedex.entries.length,
  }))

  return { pokedexes }
}

export function loadPokedexEditorData(pokedexId: string | undefined) {
  if (!pokedexId) {
    throw new Response('Missing pokedex id.', { status: 400 })
  }

  const allPokedexes = loadAllPokedexes()
  const selectedPokedex = allPokedexes.find((pokedex) => pokedex.id === pokedexId)
  if (!selectedPokedex) {
    throw new Response('Pokedex not found.', { status: 404 })
  }

  const allPokemon = loadAllPokemon()
  const nationalDexNumByPokemonId = Object.fromEntries(
    allPokemon.map((pokemon) => [pokemon.id, pokemon.dexNum]),
  )
  const isFormByPokemonId = Object.fromEntries(
    allPokemon.map((pokemon) => [pokemon.id, pokemon.isForm]),
  )
  const formsByPokemonId = Object.fromEntries(
    allPokemon.map((pokemon) => [pokemon.id, pokemon.forms ?? []]),
  )
  const searchablePokemon = createSearchablePokemonList(allPokemon)
  const pokemonOptions: PokemonOption[] = searchablePokemon.map((pokemon) => ({
    id: pokemon.id,
    label: pokemon.name || pokemon.id,
    image: pokemonSpriteUrl(pokemon.nid),
    dexNum: pokemon.dexNum,
    searchableText: pokemon.searchableText,
  }))

  const regionOptions: SimpleOption[] = loadAllRegions().map((region) => ({
    id: region.id,
    label: region.name,
  }))

  const baseDexOptions: SimpleOption[] = allPokedexes
    .filter((pokedex) => pokedex.id !== selectedPokedex.id)
    .map((pokedex) => ({
      id: pokedex.id,
      label: pokedex.name,
    }))

  return {
    pokedex: selectedPokedex,
    initialDraft: toPokedexDraft(selectedPokedex),
    pokemonOptions,
    nationalDexNumByPokemonId,
    isFormByPokemonId,
    formsByPokemonId,
    regionOptions,
    baseDexOptions,
  }
}

export type SavePokedexResult =
  | { success: false; error: string }
  | { success: true; pokedex: Pkds.Pokedex }

export async function savePokedexFromForm(
  request: Request,
  params: { id?: string },
): Promise<SavePokedexResult> {
  const formData = await request.formData()
  const intent = formData.get('intent')
  if (intent !== 'save-pokedex') {
    return { success: false, error: 'Unsupported action intent.' }
  }

  const pokedexId = formData.get('pokedexId')
  const draftRaw = formData.get('draft')
  if (typeof pokedexId !== 'string' || !pokedexId) {
    return { success: false, error: 'Missing pokedex id.' }
  }
  if (params.id && params.id !== pokedexId) {
    return { success: false, error: 'Mismatched pokedex id.' }
  }
  if (typeof draftRaw !== 'string') {
    return { success: false, error: 'Missing draft payload.' }
  }

  let parsedDraft: PokedexDraft
  try {
    parsedDraft = JSON.parse(draftRaw) as PokedexDraft
  } catch {
    return { success: false, error: 'Invalid draft payload.' }
  }

  if (parsedDraft.id !== pokedexId) {
    return { success: false, error: 'Pokedex id is read-only and cannot be changed.' }
  }

  const allPokedexes = loadAllPokedexes()
  const existingPokedex = allPokedexes.find((pokedex) => pokedex.id === pokedexId)
  if (!existingPokedex) {
    return { success: false, error: 'Pokedex not found.' }
  }
  const allPokemon = loadAllPokemon()
  const validPokemonIds = new Set(allPokemon.map((pokemon) => pokemon.id))

  const validation = validatePokedexDraft(
    parsedDraft,
    validPokemonIds,
    new Set(loadAllRegions().map((region) => region.id)),
    new Set(
      allPokedexes.filter((pokedex) => pokedex.id !== pokedexId).map((pokedex) => pokedex.id),
    ),
  )
  if (
    Object.keys(validation.generalErrors).length > 0 ||
    Object.keys(validation.entryErrors).length > 0
  ) {
    return { success: false, error: 'Pokedex data is invalid. Please fix the highlighted fields.' }
  }

  const normalizedDraft = normalizePokedexDraft(parsedDraft)

  for (const entry of normalizedDraft.entries) {
    if (!validPokemonIds.has(entry.pid)) {
      return { success: false, error: `Entry Pokemon id "${entry.pid}" does not exist.` }
    }
  }

  let parsedPokedex: Pkds.Pokedex
  try {
    parsedPokedex = pokedexSchema.parse({
      ...readDatasetFile<Pkds.Pokedex>(`pokedexes/${pokedexId}.json`),
      ...normalizedDraft,
    })
  } catch {
    return { success: false, error: 'Pokedex data does not match the schema.' }
  }

  writeDatasetFile(parsedPokedex, `pokedexes/${pokedexId}.json`, false)

  return {
    success: true,
    pokedex: parsedPokedex,
  }
}

import {
  BOX_PRESET_VARIANTS,
  createBoxPresetDraft,
  boxPresetDraftToPersisted,
  boxPresetToDraft,
  cleanBoxPokemonId,
  fillBoxPresetDraftCells,
  normalizeBoxPresetDraft,
  parseBoxPresetVariant,
  summarizeBoxPresetDraft,
  type BoxPresetDraft,
  type BoxPresetPersisted,
  type BoxPresetVariant,
} from '@/lib/box-presets'
import { gameSpriteUrl, pokemonSpriteUrl } from '@/lib/utils'
import {
  loadAllGames,
  loadAllGameSets,
  loadAllPokemon,
  absDatasetFile,
  readDatasetFile,
  writeDatasetFile,
} from '@pokepc/dataset/lib/fs'
import { createSearchablePokemonList } from '@pokepc/dataset/lib/search'
import {
  boxPresetSchema,
  modernBoxPresetIndexSchema,
  modernBoxPresetSchema,
} from '@pokepc/dataset/lib/schemas'
import fs from 'node:fs'

export type BoxPresetIndexPreset = {
  id: string
  label: string
  isHidden: boolean
  legacyId: string | null
  tags?: Pkds.ModernBoxPresetTag[]
}

export type BoxPresetIndexGameSet = {
  id: string
  label: string
  image: string
  boxCellCount: number
  maxBoxCount: number
  presetCount: number
  presets: BoxPresetIndexPreset[]
}

export type BoxPresetIndexVariant = {
  id: BoxPresetVariant
  label: string
  gameSets: BoxPresetIndexGameSet[]
  presetCount: number
}

export type AvailableBoxPresetPokemon = {
  id: string
  label: string
  image: string
  dexNum: number | string
  searchableText: string
  placedCount: number
  isFemale?: boolean
  isFemaleForm?: boolean
}

export type BoxPresetEditorData = {
  variant: BoxPresetVariant
  variantLabel: string
  gameSet: BoxPresetIndexGameSet
  preset: BoxPresetPersisted
  initialDraft: BoxPresetDraft
  siblingPresets: BoxPresetIndexPreset[]
  availablePokemon: AvailableBoxPresetPokemon[]
  boxCellCount: number
  maxBoxCount: number
}

type ClassicBoxPresetWithStableFields = Pkds.LegacyBoxPreset & {
  fullId?: string
  [key: string]: unknown
}
type ClassicBoxPresetMap = Record<string, ClassicBoxPresetWithStableFields>

export function loadBoxPresetIndexData() {
  const gameSets = loadAllGameSets()

  const variants: BoxPresetIndexVariant[] = BOX_PRESET_VARIANTS.map((variant) => {
    const indexGameSets = gameSets.map((gameSet) => {
      const presets =
        variant === 'classic'
          ? mapClassicPresetOptions(readClassicBoxPresetMapIfPresent(gameSet.id) ?? {})
          : readModernPresetOptionsIfPresent(gameSet.id)

      return {
        id: gameSet.id,
        label: gameSet.name,
        image: gameSpriteUrl(gameSet.id),
        boxCellCount: getGameSetBoxCellCount(gameSet),
        maxBoxCount: getGameSetMaxBoxCount(gameSet),
        presetCount: presets.length,
        presets,
      }
    })

    return {
      id: variant,
      label: variantLabel(variant),
      gameSets: indexGameSets,
      presetCount: indexGameSets.reduce((count, gameSet) => count + gameSet.presetCount, 0),
    }
  })

  return { variants }
}

export function loadBoxPresetEditorData(params: {
  variant?: string
  gameSet?: string
  presetId?: string
}): BoxPresetEditorData {
  const variant = parseRequiredVariant(params.variant)
  const gameSetId = parseRequiredSlug(params.gameSet, 'Missing game set id.')
  const presetId = parseRequiredSlug(params.presetId, 'Missing preset id.')
  const gameSet = loadAllGameSets().find((item) => item.id === gameSetId)
  if (!gameSet) {
    throw new Response('Game set not found.', { status: 404 })
  }

  const preset = readRequiredBoxPreset(variant, gameSetId, presetId)
  const boxCellCount = getGameSetBoxCellCount(gameSet)
  const maxBoxCount = getGameSetMaxBoxCount(gameSet)
  const initialDraft = fillBoxPresetDraftCells(
    variant === 'classic'
      ? boxPresetToDraft('classic', preset as Pkds.LegacyBoxPreset)
      : boxPresetToDraft('modern', preset as Pkds.ModernBoxPreset),
    boxCellCount,
  )
  const siblingPresets =
    variant === 'classic'
      ? mapClassicPresetOptions(readRequiredClassicBoxPresetMap(gameSetId))
      : readRequiredModernPresetOptions(gameSetId)

  return {
    variant,
    variantLabel: variantLabel(variant),
    gameSet: {
      id: gameSet.id,
      label: gameSet.name,
      image: gameSpriteUrl(gameSet.id),
      boxCellCount,
      maxBoxCount,
      presetCount: siblingPresets.length,
      presets: siblingPresets,
    },
    preset,
    initialDraft,
    siblingPresets,
    availablePokemon: loadAvailableStorablePokemonForGameSet(gameSetId, initialDraft),
    boxCellCount,
    maxBoxCount,
  }
}

export function loadAvailableStorablePokemonForGameSet(
  gameSetId: string,
  preset?: BoxPresetDraft,
): AvailableBoxPresetPokemon[] {
  const allGames = loadAllGames()
  const memberGameIds = new Set<string>([gameSetId])
  for (const game of allGames) {
    if (game.gameSet === gameSetId) {
      memberGameIds.add(game.id)
    }
  }

  const placedCountById = preset
    ? normalizeBoxPresetDraft(preset).boxes.reduce<Record<string, number>>((counts, box) => {
        for (const value of box.cells) {
          const pokemonId = cleanBoxPokemonId(value)
          if (!pokemonId) continue
          counts[pokemonId] = (counts[pokemonId] ?? 0) + 1
        }
        return counts
      }, {})
    : {}

  return createSearchablePokemonList(loadAllPokemon())
    .filter((pokemon) => pokemon.storableIn.some((gameId) => memberGameIds.has(gameId)))
    .map((pokemon) => ({
      id: pokemon.id,
      label: pokemon.name || pokemon.names.eng || pokemon.id,
      image: pokemonSpriteUrl(pokemon.imgNid ?? pokemon.nid),
      dexNum: pokemon.dexNum,
      searchableText: pokemon.searchableText,
      placedCount: placedCountById[pokemon.id] ?? 0,
      isFemale: Boolean((pokemon as Pkds.TranslatedPokemon & { isFemale?: boolean }).isFemale),
      isFemaleForm: Boolean(pokemon.isFemaleForm),
    }))
}

export type SaveBoxPresetResult =
  | { success: false; error: string }
  | {
      success: true
      draft: BoxPresetDraft
      preset: BoxPresetPersisted
      summary: ReturnType<typeof summarizeBoxPresetDraft>
    }

export async function saveBoxPresetFromForm(
  request: Request,
  params: { variant?: string; gameSet?: string; presetId?: string },
): Promise<SaveBoxPresetResult> {
  const formData = await request.formData()
  const intent = formData.get('intent')
  if (intent !== 'save-box-preset') {
    return { success: false, error: 'Unsupported action intent.' }
  }

  const variant = parseBoxPresetVariant(params.variant)
  if (!variant) {
    return { success: false, error: 'Invalid box preset variant.' }
  }

  const gameSetId = params.gameSet
  const presetId = params.presetId
  if (!gameSetId || !presetId) {
    return { success: false, error: 'Missing box preset route parameters.' }
  }

  if (!loadAllGameSets().some((gameSet) => gameSet.id === gameSetId)) {
    return { success: false, error: 'Game set not found.' }
  }

  const draftRaw = formData.get('draft')
  if (typeof draftRaw !== 'string') {
    return { success: false, error: 'Missing draft payload.' }
  }

  let parsedDraft: BoxPresetDraft
  try {
    parsedDraft = normalizeBoxPresetDraft(JSON.parse(draftRaw) as BoxPresetDraft)
  } catch {
    return { success: false, error: 'Invalid draft payload.' }
  }

  if (parsedDraft.variant !== variant) {
    return { success: false, error: 'Box preset variant is read-only and cannot be changed.' }
  }
  if (parsedDraft.id !== presetId) {
    return { success: false, error: 'Box preset id is read-only and cannot be changed.' }
  }
  if (parsedDraft.gameSet !== gameSetId) {
    return { success: false, error: 'Box preset game set is read-only and cannot be changed.' }
  }

  if (variant === 'classic') {
    return saveClassicBoxPreset(gameSetId, presetId, parsedDraft)
  }

  return saveModernBoxPreset(gameSetId, presetId, parsedDraft)
}

export type CreateBoxPresetResult =
  | { success: false; error: string }
  | { success: true; location: string; preset: BoxPresetPersisted }

export async function createBoxPresetFromForm(request: Request): Promise<CreateBoxPresetResult> {
  const formData = await request.formData()
  const variant = parseBoxPresetVariant(stringFormValue(formData.get('variant')))
  const gameSetId = stringFormValue(formData.get('gameSet'))
  const presetId = stringFormValue(formData.get('presetId'))
  const name = stringFormValue(formData.get('name'))

  if (!variant) return { success: false, error: 'Invalid box preset variant.' }
  if (!gameSetId || !presetId || !name) {
    return { success: false, error: 'Variant, game set, preset id, and name are required.' }
  }

  const gameSet = loadAllGameSets().find((item) => item.id === gameSetId)
  if (!gameSet) return { success: false, error: 'Game set not found.' }

  const draft = createBoxPresetDraft({
    variant,
    id: presetId,
    name,
    gameSet: gameSetId,
    boxCellCount: getGameSetBoxCellCount(gameSet),
  })
  const location = `/box-presets/${variant}/${gameSetId}/${presetId}`

  if (variant === 'classic') {
    const currentMap = readClassicBoxPresetMapIfPresent(gameSetId) ?? {}
    if (currentMap[presetId]) return { success: false, error: 'Box preset already exists.' }
    const preset = withClassicPresetStableFields(
      boxPresetSchema.parse(boxPresetDraftToPersisted(draft)),
      undefined,
      gameSetId,
      presetId,
    )
    writeDatasetFile(
      { ...currentMap, [presetId]: preset },
      classicBoxPresetFilePath(gameSetId),
      false,
    )
    return { success: true, location, preset }
  }

  const currentIndex = readModernPresetIndexIfPresent(gameSetId) ?? []
  if (currentIndex.includes(presetId) || readModernBoxPresetIfPresent(gameSetId, presetId)) {
    return { success: false, error: 'Box preset already exists.' }
  }
  const preset = modernBoxPresetSchema.parse(boxPresetDraftToPersisted(draft))
  writeDatasetFile([...currentIndex, presetId], modernBoxPresetIndexFilePath(gameSetId), false)
  writeDatasetFile(preset, modernBoxPresetFilePath(gameSetId, presetId), false)
  return { success: true, location, preset }
}

export type DeleteBoxPresetResult =
  | { success: false; error: string }
  | { success: true; location: string }

export async function deleteBoxPresetFromForm(
  request: Request,
  params: { variant?: string; gameSet?: string; presetId?: string },
): Promise<DeleteBoxPresetResult> {
  const formData = await request.formData()
  if (formData.get('intent') !== 'delete-box-preset') {
    return { success: false, error: 'Unsupported action intent.' }
  }

  const variant = parseBoxPresetVariant(params.variant)
  const gameSetId = params.gameSet
  const presetId = params.presetId
  if (!variant) return { success: false, error: 'Invalid box preset variant.' }
  if (!gameSetId || !presetId)
    return { success: false, error: 'Missing box preset route parameters.' }

  const location = `/box-presets?variant=${variant}&gameSet=${gameSetId}`

  if (variant === 'classic') {
    const currentMap = readClassicBoxPresetMapIfPresent(gameSetId)
    if (!currentMap?.[presetId]) return { success: false, error: 'Box preset not found.' }
    const nextMap = { ...currentMap }
    delete nextMap[presetId]
    writeDatasetFile(nextMap, classicBoxPresetFilePath(gameSetId), false)
    return { success: true, location }
  }

  const currentIndex = readModernPresetIndexIfPresent(gameSetId)
  if (!currentIndex?.includes(presetId)) return { success: false, error: 'Box preset not found.' }
  writeDatasetFile(
    currentIndex.filter((id) => id !== presetId),
    modernBoxPresetIndexFilePath(gameSetId),
    false,
  )
  deleteDatasetFileIfPresent(modernBoxPresetFilePath(gameSetId, presetId))
  return { success: true, location }
}

function saveClassicBoxPreset(
  gameSetId: string,
  presetId: string,
  draft: BoxPresetDraft,
): SaveBoxPresetResult {
  let currentMap: ClassicBoxPresetMap
  try {
    currentMap = readRequiredClassicBoxPresetMap(gameSetId)
  } catch (error) {
    if (error instanceof Response) {
      return {
        success: false,
        error: error.status === 404 ? 'Box preset file not found.' : error.statusText,
      }
    }
    return { success: false, error: 'Box preset file could not be read.' }
  }

  if (!currentMap[presetId]) {
    return { success: false, error: 'Box preset not found.' }
  }

  let parsedPreset: ClassicBoxPresetWithStableFields
  try {
    parsedPreset = withClassicPresetStableFields(
      boxPresetSchema.parse(boxPresetDraftToPersisted(draft)),
      currentMap[presetId],
      gameSetId,
      presetId,
    )
  } catch {
    return { success: false, error: 'Box preset data does not match the schema.' }
  }

  const nextMap = {
    ...currentMap,
    [presetId]: parsedPreset,
  }

  writeDatasetFile(nextMap, classicBoxPresetFilePath(gameSetId), false)

  return {
    success: true,
    draft: savedPresetToFilledDraft('classic', parsedPreset, gameSetId),
    preset: parsedPreset,
    summary: summarizeBoxPresetDraft(draft),
  }
}

function saveModernBoxPreset(
  gameSetId: string,
  presetId: string,
  draft: BoxPresetDraft,
): SaveBoxPresetResult {
  let presetIndex: Pkds.ModernBoxPresetIndex
  try {
    presetIndex = readRequiredModernPresetIndex(gameSetId)
  } catch (error) {
    if (error instanceof Response) {
      return {
        success: false,
        error: error.status === 404 ? 'Box preset file not found.' : error.statusText,
      }
    }
    return { success: false, error: 'Box preset file could not be read.' }
  }

  if (!presetIndex.includes(presetId)) {
    return { success: false, error: 'Box preset not found.' }
  }

  if (!readModernBoxPresetIfPresent(gameSetId, presetId)) {
    return { success: false, error: 'Box preset not found.' }
  }

  let parsedPreset: Pkds.ModernBoxPreset
  try {
    parsedPreset = modernBoxPresetSchema.parse(boxPresetDraftToPersisted(draft))
  } catch {
    return { success: false, error: 'Box preset data does not match the schema.' }
  }

  writeDatasetFile(parsedPreset, modernBoxPresetFilePath(gameSetId, presetId), false)

  return {
    success: true,
    draft: savedPresetToFilledDraft('modern', parsedPreset, gameSetId),
    preset: parsedPreset,
    summary: summarizeBoxPresetDraft(draft),
  }
}

function parseRequiredVariant(value: string | undefined): BoxPresetVariant {
  const variant = parseBoxPresetVariant(value)
  if (!variant) {
    throw new Response('Invalid box preset variant.', { status: 404 })
  }
  return variant
}

function parseRequiredSlug(value: string | undefined, message: string): string {
  if (!value) {
    throw new Response(message, { status: 400 })
  }
  return value
}

function stringFormValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getGameSetBoxCellCount(gameSet: Pkds.Game): number {
  return gameSet.maxBoxSize > 0 ? gameSet.maxBoxSize : 30
}

function getGameSetMaxBoxCount(gameSet: Pkds.Game): number {
  return gameSet.maxBoxes > 0 ? gameSet.maxBoxes : 999
}

function savedPresetToFilledDraft(
  variant: 'classic',
  preset: Pkds.LegacyBoxPreset,
  gameSetId: string,
): BoxPresetDraft
function savedPresetToFilledDraft(
  variant: 'modern',
  preset: Pkds.ModernBoxPreset,
  gameSetId: string,
): BoxPresetDraft
function savedPresetToFilledDraft(
  variant: BoxPresetVariant,
  preset: BoxPresetPersisted,
  gameSetId: string,
): BoxPresetDraft {
  const gameSet = loadAllGameSets().find((item) => item.id === gameSetId)
  const boxCellCount = gameSet ? getGameSetBoxCellCount(gameSet) : 30
  const draft =
    variant === 'classic'
      ? boxPresetToDraft('classic', preset as Pkds.LegacyBoxPreset)
      : boxPresetToDraft('modern', preset as Pkds.ModernBoxPreset)
  return fillBoxPresetDraftCells(draft, boxCellCount)
}

function deleteDatasetFileIfPresent(filePath: string) {
  const absPath = absDatasetFile(filePath)
  if (fs.existsSync(absPath)) {
    fs.unlinkSync(absPath)
  }
}

function classicBoxPresetFilePath(gameSet: string): string {
  return `boxpresets/classic/${gameSet}.json`
}

function modernBoxPresetIndexFilePath(gameSet: string): string {
  return `boxpresets/modern/${gameSet}.json`
}

function modernBoxPresetFilePath(gameSet: string, presetId: string): string {
  return `boxpresets/modern/${gameSet}/${presetId}.json`
}

function readClassicBoxPresetMapIfPresent(gameSet: string): ClassicBoxPresetMap | null {
  try {
    return readDatasetFile<ClassicBoxPresetMap>(classicBoxPresetFilePath(gameSet))
  } catch {
    return null
  }
}

function readRequiredClassicBoxPresetMap(gameSet: string): ClassicBoxPresetMap {
  const map = readClassicBoxPresetMapIfPresent(gameSet)
  if (!map) {
    throw new Response('Box preset file not found.', { status: 404 })
  }
  return map
}

function readModernPresetIndexIfPresent(gameSet: string): Pkds.ModernBoxPresetIndex | null {
  try {
    return modernBoxPresetIndexSchema.parse(
      readDatasetFile<Pkds.ModernBoxPresetIndex>(modernBoxPresetIndexFilePath(gameSet)),
    )
  } catch {
    return null
  }
}

function readRequiredModernPresetIndex(gameSet: string): Pkds.ModernBoxPresetIndex {
  const index = readModernPresetIndexIfPresent(gameSet)
  if (!index) {
    throw new Response('Box preset file not found.', { status: 404 })
  }
  return index
}

function readModernBoxPresetIfPresent(
  gameSet: string,
  presetId: string,
): Pkds.ModernBoxPreset | null {
  try {
    return modernBoxPresetSchema.parse(
      readDatasetFile<Pkds.ModernBoxPreset>(modernBoxPresetFilePath(gameSet, presetId)),
    )
  } catch {
    return null
  }
}

function readRequiredBoxPreset(
  variant: BoxPresetVariant,
  gameSet: string,
  presetId: string,
): BoxPresetPersisted {
  if (variant === 'classic') {
    const preset = readRequiredClassicBoxPresetMap(gameSet)[presetId]
    if (!preset) {
      throw new Response('Box preset not found.', { status: 404 })
    }
    return preset
  }

  const index = readRequiredModernPresetIndex(gameSet)
  if (!index.includes(presetId)) {
    throw new Response('Box preset not found.', { status: 404 })
  }

  const preset = readModernBoxPresetIfPresent(gameSet, presetId)
  if (!preset) {
    throw new Response('Box preset not found.', { status: 404 })
  }
  return preset
}

function readModernPresetOptionsIfPresent(gameSet: string): BoxPresetIndexPreset[] {
  const index = readModernPresetIndexIfPresent(gameSet)
  if (!index) return []
  return index.flatMap((presetId) => {
    const preset = readModernBoxPresetIfPresent(gameSet, presetId)
    return preset ? [mapModernPresetOption(preset)] : []
  })
}

function readRequiredModernPresetOptions(gameSet: string): BoxPresetIndexPreset[] {
  const index = readRequiredModernPresetIndex(gameSet)
  return index.flatMap((presetId) => {
    const preset = readModernBoxPresetIfPresent(gameSet, presetId)
    return preset ? [mapModernPresetOption(preset)] : []
  })
}

function mapClassicPresetOptions(presetMap: ClassicBoxPresetMap): BoxPresetIndexPreset[] {
  return Object.values(presetMap).map((preset) => ({
    id: preset.id,
    label: preset.name,
    isHidden: preset.isHidden ?? false,
    legacyId: preset.legacyId ?? null,
  }))
}

function withClassicPresetStableFields(
  preset: Pkds.LegacyBoxPreset,
  existing: ClassicBoxPresetWithStableFields | undefined,
  gameSetId: string,
  presetId: string,
): ClassicBoxPresetWithStableFields {
  return {
    ...existing,
    ...preset,
    fullId: existing?.fullId ?? `${gameSetId}-${presetId}`,
  }
}

function mapModernPresetOption(preset: Pkds.ModernBoxPreset): BoxPresetIndexPreset {
  return {
    id: preset.id,
    label: preset.name,
    isHidden: false,
    legacyId: preset.source?.legacyId ?? null,
    tags: preset.tags ? [...preset.tags] : undefined,
  }
}

function variantLabel(variant: BoxPresetVariant): string {
  if (variant === 'classic') return 'Classic'
  return 'Modern'
}

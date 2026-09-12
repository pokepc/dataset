export const BOX_PRESET_DND_KIND = 'BOX_CELL'
export const BOX_PRESET_VARIANTS = ['classic', 'modern'] as const
export const BOX_PRESET_BOX_TITLE_MAX_LENGTH = 16

export type BoxPresetVariant = (typeof BOX_PRESET_VARIANTS)[number]

export type BoxPresetCellObject = {
  pokemonId: string
  gmax?: boolean
  shinyLocked?: boolean
  shiny?: boolean
}

export type BoxPresetCellValue = string | null | BoxPresetCellObject

export type BoxPresetBoxDraft = {
  name?: string
  cells: BoxPresetCellValue[]
}

export type BoxPresetDraft =
  | {
      variant: 'classic'
      id: string
      name: string
      gameSet: string
      description: string
      boxes: BoxPresetBoxDraft[]
      metadata: {
        kind: 'classic'
        version: number
        legacyId?: string
        isHidden?: boolean
      }
    }
  | {
      variant: 'modern'
      id: string
      name: string
      gameSet: string
      description: string
      boxes: BoxPresetBoxDraft[]
      metadata: {
        kind: 'modern'
        schemaVersion: 1
        source?: Pkds.ModernBoxPreset['source']
        tags?: Pkds.ModernBoxPresetTag[]
      }
    }

export type BoxPresetPersisted = Pkds.LegacyBoxPreset | Pkds.ModernBoxPreset

export type ReferenceCellPosition = {
  box: number
  cell: number
}

export type BoxPresetCellPosition = {
  kind: 'cell'
  boxIndex: number
  cellIndex: number
}

export type BoxPresetBoxMoveTarget = -1 | 1 | 'first' | 'last'
export type BoxPresetCellMoveTarget = 'first' | 'up' | 'down' | 'last'

export type BoxPresetDrawerPosition = {
  kind: 'drawer'
  pokemonId: string
}

export type BoxPresetTrashPosition = {
  kind: 'trash'
}

export type BoxPresetDndPosition =
  | BoxPresetCellPosition
  | BoxPresetDrawerPosition
  | BoxPresetTrashPosition

export type BoxPresetDragItem = {
  source: 'cell' | 'drawer'
  pokemonId: string
  pokemon: BoxPresetCellValue
  previewSize: { width: number; height: number }
  sourceCell?: BoxPresetCellPosition
}

export type BoxPresetDropResult = {
  draft: BoxPresetDraft
  changed: boolean
  reason?: string
  changedBoxIndices: number[]
}

export type BoxPresetDraftSummary = {
  boxCount: number
  storedCellCount: number
  placedPokemonCount: number
  emptyCellCount: number
  duplicatePokemonIds: string[]
}

export type CreateBoxPresetDraftInput = {
  variant: BoxPresetVariant
  id: string
  name: string
  gameSet: string
  boxCellCount: number
}

export function isBoxPresetVariant(value: string | undefined): value is BoxPresetVariant {
  return BOX_PRESET_VARIANTS.includes(value as BoxPresetVariant)
}

export function parseBoxPresetVariant(value: string | undefined): BoxPresetVariant | null {
  return isBoxPresetVariant(value) ? value : null
}

export function boxPresetToDraft(variant: 'classic', preset: Pkds.LegacyBoxPreset): BoxPresetDraft
export function boxPresetToDraft(variant: 'modern', preset: Pkds.ModernBoxPreset): BoxPresetDraft
export function boxPresetToDraft(
  variant: BoxPresetVariant,
  preset: BoxPresetPersisted,
): BoxPresetDraft {
  if (variant === 'classic') {
    const classicPreset = preset as Pkds.LegacyBoxPreset

    return normalizeBoxPresetDraft({
      variant,
      id: classicPreset.id,
      name: classicPreset.name,
      gameSet: classicPreset.gameSet ?? '',
      description: classicPreset.description,
      boxes: classicPreset.boxes.map((box) => ({
        name: box.title,
        cells: box.pokemon.map(classicCellToDraftCell),
      })),
      metadata: {
        kind: 'classic',
        version: classicPreset.version,
        legacyId: classicPreset.legacyId,
        isHidden: classicPreset.isHidden,
      },
    })
  }

  const modernPreset = preset as Pkds.ModernBoxPreset
  return normalizeBoxPresetDraft({
    variant,
    id: modernPreset.id,
    name: modernPreset.name,
    gameSet: modernPreset.gameSet,
    description: modernPreset.description ?? '',
    boxes: modernPreset.boxes.map((box) => ({
      name: box.name,
      cells: box.slots.map(modernSlotToDraftCell),
    })),
    metadata: {
      kind: 'modern',
      schemaVersion: modernPreset.schemaVersion,
      source: modernPreset.source,
      tags: modernPreset.tags ? [...modernPreset.tags] : undefined,
    },
  })
}

export function boxPresetDraftToPersisted(draft: BoxPresetDraft): BoxPresetPersisted {
  const normalizedDraft = normalizeBoxPresetDraft(draft)

  if (normalizedDraft.variant === 'classic') {
    return {
      id: normalizedDraft.id,
      legacyId: normalizedDraft.metadata.legacyId,
      name: normalizedDraft.name,
      version: normalizedDraft.metadata.version,
      gameSet: normalizedDraft.gameSet,
      description: normalizedDraft.description,
      boxes: normalizedDraft.boxes.map((box) => ({
        title: box.name,
        pokemon: trimTrailingEmptyBoxCells(box.cells).map(draftCellToClassicCell),
      })),
      isHidden: normalizedDraft.metadata.isHidden,
    }
  }

  return {
    schemaVersion: 1,
    id: normalizedDraft.id,
    gameSet: normalizedDraft.gameSet,
    name: normalizedDraft.name,
    description: normalizedDraft.description || undefined,
    source: normalizedDraft.metadata.source,
    tags: normalizedDraft.metadata.tags ? [...normalizedDraft.metadata.tags] : undefined,
    boxes: normalizedDraft.boxes.map((box) => ({
      name: box.name,
      slots: trimTrailingEmptyBoxCells(box.cells).map(draftCellToModernSlot),
    })),
  }
}

export function normalizeBoxPresetDraft(preset: BoxPresetDraft): BoxPresetDraft {
  return {
    ...preset,
    description: preset.description ?? '',
    boxes: preset.boxes.map((box) => ({
      name: box.name,
      cells: box.cells.map((pokemon) => cloneBoxCellValue(pokemon)),
    })),
    metadata:
      preset.metadata.kind === 'modern'
        ? {
            ...preset.metadata,
            tags: preset.metadata.tags ? [...preset.metadata.tags] : undefined,
          }
        : { ...preset.metadata },
  } as BoxPresetDraft
}

export function ensureBoxCellCount(
  box: BoxPresetBoxDraft,
  minCells: number = 30,
): BoxPresetCellValue[] {
  const cells = box.cells.map((pokemon) => cloneBoxCellValue(pokemon))
  while (cells.length < minCells) {
    cells.push(null)
  }
  return cells
}

export function fillBoxPresetDraftCells(
  draft: BoxPresetDraft,
  boxCellCount: number,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  for (const box of nextDraft.boxes) {
    while (box.cells.length < boxCellCount) {
      box.cells.push(null)
    }
  }
  return nextDraft
}

export function createEmptyBox(boxCellCount: number, name?: string): BoxPresetBoxDraft {
  return {
    name,
    cells: Array.from<BoxPresetCellValue>({ length: boxCellCount }).fill(null),
  }
}

export function createBoxPresetDraft(input: CreateBoxPresetDraftInput): BoxPresetDraft {
  const base = {
    variant: input.variant,
    id: input.id,
    name: input.name,
    gameSet: input.gameSet,
    description: '',
    boxes: [createEmptyBox(input.boxCellCount, 'Box 1')],
  }

  if (input.variant === 'classic') {
    return normalizeBoxPresetDraft({
      ...base,
      variant: 'classic',
      metadata: {
        kind: 'classic',
        version: 1,
      },
    })
  }

  return normalizeBoxPresetDraft({
    ...base,
    variant: 'modern',
    metadata: {
      kind: 'modern',
      schemaVersion: 1,
      tags: ['recommended'],
    },
  })
}

export function updateBoxPresetMetadata(
  draft: BoxPresetDraft,
  updates: { name?: string; description?: string },
): BoxPresetDraft {
  return normalizeBoxPresetDraft({
    ...draft,
    name: updates.name ?? draft.name,
    description: updates.description ?? draft.description,
  })
}

export function updateBoxPresetBoxName(
  draft: BoxPresetDraft,
  boxIndex: number,
  name: string,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  const box = nextDraft.boxes[boxIndex]
  if (!box) return nextDraft
  box.name = name.trim().slice(0, BOX_PRESET_BOX_TITLE_MAX_LENGTH) || undefined
  return nextDraft
}

export function moveBoxPresetBox(
  draft: BoxPresetDraft,
  boxIndex: number,
  target: BoxPresetBoxMoveTarget,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  const targetIndex = getTargetBoxIndex(boxIndex, nextDraft.boxes.length, target)
  if (
    boxIndex < 0 ||
    boxIndex >= nextDraft.boxes.length ||
    targetIndex < 0 ||
    targetIndex >= nextDraft.boxes.length ||
    targetIndex === boxIndex
  ) {
    return nextDraft
  }
  const [box] = nextDraft.boxes.splice(boxIndex, 1)
  if (!box) return nextDraft
  nextDraft.boxes.splice(targetIndex, 0, box)
  return nextDraft
}

export function insertBoxPresetBoxAfter(
  draft: BoxPresetDraft,
  boxIndex: number,
  boxCellCount: number,
  maxBoxes?: number,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  if (maxBoxes && nextDraft.boxes.length >= maxBoxes) {
    return nextDraft
  }
  const insertIndex = Math.min(Math.max(boxIndex + 1, 0), nextDraft.boxes.length)
  nextDraft.boxes.splice(insertIndex, 0, createEmptyBox(boxCellCount, `Box ${insertIndex + 1}`))
  return nextDraft
}

export function deleteBoxPresetBox(draft: BoxPresetDraft, boxIndex: number): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  if (nextDraft.boxes.length <= 1 || boxIndex < 0 || boxIndex >= nextDraft.boxes.length) {
    return nextDraft
  }
  nextDraft.boxes.splice(boxIndex, 1)
  return nextDraft
}

export function compactBoxPresetBoxSlots(draft: BoxPresetDraft, boxIndex: number): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  const box = nextDraft.boxes[boxIndex]
  if (!box || !hasCompactableBoxSlots(box)) return nextDraft

  const filledCells = box.cells.filter((cell) => !!getBoxPokemonIdentity(cell))
  box.cells = [
    ...filledCells.map((cell) => cloneBoxCellValue(cell)),
    ...Array.from<BoxPresetCellValue>({ length: box.cells.length - filledCells.length }).fill(null),
  ]
  return nextDraft
}

export function hasCompactableBoxSlots(box: BoxPresetBoxDraft): boolean {
  let hasEmptySlot = false

  for (const cell of box.cells) {
    if (!getBoxPokemonIdentity(cell)) {
      hasEmptySlot = true
      continue
    }

    if (hasEmptySlot) return true
  }

  return false
}

export function moveBoxPresetBoxCell(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
  target: BoxPresetCellMoveTarget,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  const box = nextDraft.boxes[position.boxIndex]
  if (!box || !getBoxPokemonIdentity(box.cells[position.cellIndex] ?? null)) return nextDraft

  const targetCellIndex = getTargetBoxCellIndex(position.cellIndex, box.cells.length, target)
  if (targetCellIndex === position.cellIndex) return nextDraft

  const [cell] = box.cells.splice(position.cellIndex, 1)
  box.cells.splice(targetCellIndex, 0, cloneBoxCellValue(cell))
  return nextDraft
}

export function removeBoxPresetBoxCell(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  const box = nextDraft.boxes[position.boxIndex]
  if (!box || !getBoxPokemonIdentity(box.cells[position.cellIndex] ?? null)) return nextDraft

  box.cells[position.cellIndex] = null
  return nextDraft
}

export function canInsertEmptyBoxSlotAfter(
  box: BoxPresetBoxDraft,
  cellIndex: number,
  maxCells: number,
): boolean {
  if (
    maxCells <= 0 ||
    cellIndex < 0 ||
    cellIndex >= maxCells ||
    !getBoxPokemonIdentity(box.cells[cellIndex] ?? null)
  ) {
    return false
  }

  return findAvailableBoxCellAfterExistingEmptyRun(box, cellIndex, maxCells) !== null
}

export function insertEmptyBoxSlotAfter(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
  maxCells: number,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)
  const box = nextDraft.boxes[position.boxIndex]
  if (!box || !canInsertEmptyBoxSlotAfter(box, position.cellIndex, maxCells)) return nextDraft

  const insertIndex = position.cellIndex + 1
  const availableIndex = findAvailableBoxCellAfterExistingEmptyRun(
    box,
    position.cellIndex,
    maxCells,
  )
  if (availableIndex === null) return nextDraft

  if (box.cells.length < maxCells) {
    box.cells.splice(insertIndex, 0, null)
    return nextDraft
  }

  box.cells.splice(availableIndex, 1)
  box.cells.splice(insertIndex, 0, null)
  return nextDraft
}

export function canInsertEmptyBoxSlotAfterAcrossBoxes(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
  maxCells: number,
): boolean {
  return !!findAvailableBoxSlotAfter(draft, position, maxCells)
}

export function insertEmptyBoxSlotAfterAcrossBoxes(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
  maxCells: number,
): BoxPresetDraft {
  const availableSlot = findAvailableBoxSlotAfter(draft, position, maxCells)
  if (!availableSlot) return normalizeBoxPresetDraft(draft)

  const nextDraft = normalizeBoxPresetDraft(draft)
  const coordinates = getBoxSlotCoordinatesBetween(
    nextDraft,
    getNextBoxSlotCoordinate(position, maxCells),
    availableSlot,
    maxCells,
  )
  if (!coordinates.length) return nextDraft

  for (let index = coordinates.length - 1; index > 0; index -= 1) {
    const target = coordinates[index]
    const source = coordinates[index - 1]
    if (!target || !source) continue
    setBoxSlotValue(nextDraft, target, getBoxSlotValue(nextDraft, source))
  }

  const firstCoordinate = coordinates[0]
  if (firstCoordinate) {
    setBoxSlotValue(nextDraft, firstCoordinate, null)
  }
  return nextDraft
}

export function getBoxPokemonIdentity(value: BoxPresetCellValue): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value.pokemonId === 'string') return value.pokemonId
  return null
}

export function cleanBoxPokemonId(value: BoxPresetCellValue | string): string | null {
  const pokemonId = typeof value === 'string' ? value : getBoxPokemonIdentity(value)
  if (!pokemonId) return null
  if (pokemonId.includes('--')) return pokemonId.split('--')[0] ?? pokemonId
  return pokemonId
}

export function hasUnsupportedBoxPokemonId(value: BoxPresetCellValue | string): boolean {
  const pokemonId = typeof value === 'string' ? value : getBoxPokemonIdentity(value)
  return pokemonId?.includes('--') ?? false
}

export function getPlacedPokemonCounts(draft: BoxPresetDraft): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const box of draft.boxes) {
    for (const pokemon of box.cells) {
      const pokemonId = getBoxPokemonIdentity(pokemon)
      if (!pokemonId) continue
      counts[pokemonId] = (counts[pokemonId] ?? 0) + 1
    }
  }

  return counts
}

export function getRepeatedBoxPokemonCellKeys(draft: BoxPresetDraft): Set<string> {
  const seenPokemonIds = new Set<string>()
  const repeatedCellKeys = new Set<string>()

  draft.boxes.forEach((box, boxIndex) => {
    box.cells.forEach((pokemon, cellIndex) => {
      const pokemonId = cleanBoxPokemonId(pokemon)
      if (!pokemonId) return

      if (seenPokemonIds.has(pokemonId)) {
        repeatedCellKeys.add(`${boxIndex}:${cellIndex}`)
        return
      }

      seenPokemonIds.add(pokemonId)
    })
  })

  return repeatedCellKeys
}

export function summarizeBoxPresetDraft(draft: BoxPresetDraft): BoxPresetDraftSummary {
  const counts = getPlacedPokemonCounts(draft)
  const storedCellCount = draft.boxes.reduce((count, box) => count + box.cells.length, 0)
  const placedPokemonCount = Object.values(counts).reduce(
    (count, itemCount) => count + itemCount,
    0,
  )

  return {
    boxCount: draft.boxes.length,
    storedCellCount,
    placedPokemonCount,
    emptyCellCount: storedCellCount - placedPokemonCount,
    duplicatePokemonIds: Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([pokemonId]) => pokemonId),
  }
}

export function countChangedCells(before: BoxPresetDraft, after: BoxPresetDraft): number {
  let changed = 0
  const maxBoxes = Math.max(before.boxes.length, after.boxes.length)

  for (let boxIndex = 0; boxIndex < maxBoxes; boxIndex += 1) {
    const beforeBox = before.boxes[boxIndex]
    const afterBox = after.boxes[boxIndex]
    const maxCells = Math.max(beforeBox?.cells.length ?? 0, afterBox?.cells.length ?? 0)

    for (let cellIndex = 0; cellIndex < maxCells; cellIndex += 1) {
      if (!boxCellValuesEqual(beforeBox?.cells[cellIndex], afterBox?.cells[cellIndex])) {
        changed += 1
      }
    }
  }

  return changed
}

export function hasBoxPresetDraftChanges(before: BoxPresetDraft, after: BoxPresetDraft): boolean {
  return (
    JSON.stringify(normalizeBoxPresetDraft(before)) !==
    JSON.stringify(normalizeBoxPresetDraft(after))
  )
}

export function applyBoxPresetDrop(
  draft: BoxPresetDraft,
  sourcePosition: BoxPresetDndPosition,
  targetPosition: BoxPresetDndPosition,
  sourceItem: BoxPresetDragItem,
): BoxPresetDropResult {
  if (targetPosition.kind === 'drawer') {
    return unchangedDrop(draft, 'Cannot drop onto the Pokemon drawer.')
  }

  if (sourcePosition.kind === 'trash') {
    return unchangedDrop(draft, 'Cannot drag from the trash target.')
  }

  if (sourcePosition.kind === 'cell' && targetPosition.kind === 'trash') {
    const sourceValue = getStoredCellValue(draft, sourcePosition)
    if (!sourceValue) return unchangedDrop(draft, 'Source cell is empty.')

    const nextDraft = cloneDraftWithCell(draft, sourcePosition, null)
    return {
      draft: nextDraft,
      changed: true,
      changedBoxIndices: [sourcePosition.boxIndex],
    }
  }

  if (targetPosition.kind !== 'cell') {
    return unchangedDrop(draft, 'Unsupported drop target.')
  }

  if (!isStoredCellPosition(draft, targetPosition)) {
    return unchangedDrop(draft, 'Cannot drop onto visual padding.')
  }

  const targetValue = getStoredCellValue(draft, targetPosition)

  if (sourcePosition.kind === 'drawer') {
    if (targetValue) {
      return unchangedDrop(draft, 'Drawer Pokemon can only be inserted into empty cells.')
    }

    const nextDraft = cloneDraftWithCell(
      draft,
      targetPosition,
      cloneBoxCellValue(sourceItem.pokemon),
    )
    return {
      draft: nextDraft,
      changed: true,
      changedBoxIndices: [targetPosition.boxIndex],
    }
  }

  if (!isStoredCellPosition(draft, sourcePosition)) {
    return unchangedDrop(draft, 'Cannot drag from visual padding.')
  }

  if (
    sourcePosition.boxIndex === targetPosition.boxIndex &&
    sourcePosition.cellIndex === targetPosition.cellIndex
  ) {
    return unchangedDrop(draft)
  }

  const sourceValue = getStoredCellValue(draft, sourcePosition)
  if (!sourceValue) return unchangedDrop(draft, 'Source cell is empty.')

  const nextDraft = cloneDraftWithCells(draft, [
    { position: targetPosition, value: cloneBoxCellValue(sourceValue) },
    { position: sourcePosition, value: cloneBoxCellValue(targetValue) },
  ])
  const changedBoxIndices = Array.from(
    new Set([sourcePosition.boxIndex, targetPosition.boxIndex]),
  ).sort((a, b) => a - b)

  return {
    draft: nextDraft,
    changed: true,
    changedBoxIndices,
  }
}

function classicCellToDraftCell(value: Pkds.LegacyBoxPresetBoxPokemon): BoxPresetCellValue {
  if (!value) return null
  if (typeof value === 'string') return value
  return {
    pokemonId: value.pid,
    gmax: value.gmax,
    shinyLocked: value.shinyLocked,
    shiny: value.shiny,
  }
}

function modernSlotToDraftCell(value: Pkds.ModernBoxPresetSlot): BoxPresetCellValue {
  if (!value) return null
  if (typeof value === 'string') return value
  return {
    pokemonId: value.pokemon,
    gmax: value.gmax,
    shinyLocked: value.shinyLocked,
    shiny: value.shiny,
  }
}

function draftCellToClassicCell(value: BoxPresetCellValue): Pkds.LegacyBoxPresetBoxPokemon {
  if (!value) return null
  if (typeof value === 'string') return value
  return {
    pid: value.pokemonId,
    gmax: value.gmax,
    shinyLocked: value.shinyLocked,
    shiny: value.shiny,
  }
}

function draftCellToModernSlot(value: BoxPresetCellValue): Pkds.ModernBoxPresetSlot {
  if (!value) return null
  if (typeof value === 'string') return value
  return {
    pokemon: value.pokemonId,
    gmax: value.gmax,
    shinyLocked: value.shinyLocked,
    shiny: value.shiny,
  }
}

function trimTrailingEmptyBoxCells(cells: BoxPresetCellValue[]): BoxPresetCellValue[] {
  let end = cells.length
  while (end > 0 && !getBoxPokemonIdentity(cells[end - 1] ?? null)) {
    end -= 1
  }
  return cells.slice(0, end)
}

function cloneBoxCellValue(value: BoxPresetCellValue | undefined): BoxPresetCellValue {
  if (!value) return null
  if (typeof value === 'string') return value
  return { ...value }
}

function boxCellValuesEqual(
  left: BoxPresetCellValue | undefined,
  right: BoxPresetCellValue | undefined,
) {
  return JSON.stringify(cloneBoxCellValue(left)) === JSON.stringify(cloneBoxCellValue(right))
}

function getTargetBoxCellIndex(
  cellIndex: number,
  cellCount: number,
  target: BoxPresetCellMoveTarget,
): number {
  if (cellCount <= 0) return cellIndex

  if (target === 'first') return 0
  if (target === 'last') return cellCount - 1
  if (target === 'up') return Math.max(0, cellIndex - 1)
  return Math.min(cellCount - 1, cellIndex + 1)
}

function getTargetBoxIndex(
  boxIndex: number,
  boxCount: number,
  target: BoxPresetBoxMoveTarget,
): number {
  if (boxCount <= 0) return boxIndex

  if (target === 'first') return 0
  if (target === 'last') return boxCount - 1
  return boxIndex + target
}

type BoxSlotCoordinate = {
  boxIndex: number
  cellIndex: number
}

function findAvailableBoxSlotAfter(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
  maxCells: number,
): BoxSlotCoordinate | null {
  if (maxCells <= 0 || position.cellIndex >= maxCells) return null

  const selectedBox = draft.boxes[position.boxIndex]
  if (!selectedBox || !getBoxPokemonIdentity(selectedBox.cells[position.cellIndex] ?? null)) {
    return null
  }

  const scanStart = getCoordinateAfterExistingEmptyRun(
    draft,
    getNextBoxSlotCoordinate(position, maxCells),
    maxCells,
  )
  if (!scanStart) return null

  for (let boxIndex = scanStart.boxIndex; boxIndex < draft.boxes.length; boxIndex += 1) {
    const box = draft.boxes[boxIndex]
    if (!box) continue

    const startCellIndex = boxIndex === scanStart.boxIndex ? scanStart.cellIndex : 0
    const storedCellCount = Math.min(box.cells.length, maxCells)
    for (let cellIndex = startCellIndex; cellIndex < storedCellCount; cellIndex += 1) {
      if (!getBoxPokemonIdentity(box.cells[cellIndex] ?? null)) {
        return { boxIndex, cellIndex }
      }
    }

    if (box.cells.length < maxCells && startCellIndex <= box.cells.length) {
      return { boxIndex, cellIndex: box.cells.length }
    }
  }

  return null
}

function findAvailableBoxCellAfterExistingEmptyRun(
  box: BoxPresetBoxDraft,
  cellIndex: number,
  maxCells: number,
): number | null {
  let startCellIndex = cellIndex + 1
  const storedCellCount = Math.min(box.cells.length, maxCells)

  while (
    startCellIndex < storedCellCount &&
    !getBoxPokemonIdentity(box.cells[startCellIndex] ?? null)
  ) {
    startCellIndex += 1
  }

  if (startCellIndex >= maxCells) return null

  for (let index = startCellIndex; index < storedCellCount; index += 1) {
    if (!getBoxPokemonIdentity(box.cells[index] ?? null)) return index
  }

  if (box.cells.length < maxCells && startCellIndex <= box.cells.length) {
    return box.cells.length
  }

  return null
}

function getCoordinateAfterExistingEmptyRun(
  draft: BoxPresetDraft,
  start: BoxSlotCoordinate,
  maxCells: number,
): BoxSlotCoordinate | null {
  let boxIndex = start.boxIndex
  let cellIndex = start.cellIndex

  while (boxIndex < draft.boxes.length) {
    const box = draft.boxes[boxIndex]
    if (!box) return null

    if (cellIndex >= maxCells) {
      boxIndex += 1
      cellIndex = 0
      continue
    }

    if (cellIndex >= box.cells.length) {
      return { boxIndex, cellIndex }
    }

    if (getBoxPokemonIdentity(box.cells[cellIndex] ?? null)) {
      return { boxIndex, cellIndex }
    }

    cellIndex += 1
  }

  return null
}

function getNextBoxSlotCoordinate(
  position: BoxPresetCellPosition,
  maxCells: number,
): BoxSlotCoordinate {
  if (position.cellIndex + 1 < maxCells) {
    return { boxIndex: position.boxIndex, cellIndex: position.cellIndex + 1 }
  }

  return { boxIndex: position.boxIndex + 1, cellIndex: 0 }
}

function getBoxSlotCoordinatesBetween(
  draft: BoxPresetDraft,
  start: BoxSlotCoordinate,
  end: BoxSlotCoordinate,
  maxCells: number,
): BoxSlotCoordinate[] {
  const coordinates: BoxSlotCoordinate[] = []

  for (let boxIndex = start.boxIndex; boxIndex <= end.boxIndex; boxIndex += 1) {
    const box = draft.boxes[boxIndex]
    if (!box) break

    const startCellIndex = boxIndex === start.boxIndex ? start.cellIndex : 0
    const endCellIndex = boxIndex === end.boxIndex ? end.cellIndex : maxCells - 1
    for (let cellIndex = startCellIndex; cellIndex <= endCellIndex; cellIndex += 1) {
      coordinates.push({ boxIndex, cellIndex })
    }
  }

  return coordinates
}

function getBoxSlotValue(draft: BoxPresetDraft, coordinate: BoxSlotCoordinate): BoxPresetCellValue {
  return cloneBoxCellValue(draft.boxes[coordinate.boxIndex]?.cells[coordinate.cellIndex])
}

function setBoxSlotValue(
  draft: BoxPresetDraft,
  coordinate: BoxSlotCoordinate,
  value: BoxPresetCellValue,
) {
  const box = draft.boxes[coordinate.boxIndex]
  if (!box) return
  box.cells[coordinate.cellIndex] = cloneBoxCellValue(value)
}

function isStoredCellPosition(draft: BoxPresetDraft, position: BoxPresetCellPosition): boolean {
  const box = draft.boxes[position.boxIndex]
  return !!box && position.cellIndex >= 0 && position.cellIndex < box.cells.length
}

function getStoredCellValue(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
): BoxPresetCellValue | null {
  if (!isStoredCellPosition(draft, position)) return null
  return cloneBoxCellValue(draft.boxes[position.boxIndex]?.cells[position.cellIndex])
}

function cloneDraftWithCell(
  draft: BoxPresetDraft,
  position: BoxPresetCellPosition,
  value: BoxPresetCellValue,
): BoxPresetDraft {
  return cloneDraftWithCells(draft, [{ position, value }])
}

function cloneDraftWithCells(
  draft: BoxPresetDraft,
  updates: Array<{ position: BoxPresetCellPosition; value: BoxPresetCellValue }>,
): BoxPresetDraft {
  const nextDraft = normalizeBoxPresetDraft(draft)

  for (const update of updates) {
    const box = nextDraft.boxes[update.position.boxIndex]
    if (!box || update.position.cellIndex < 0 || update.position.cellIndex >= box.cells.length) {
      continue
    }
    box.cells[update.position.cellIndex] = cloneBoxCellValue(update.value)
  }

  return nextDraft
}

function unchangedDrop(draft: BoxPresetDraft, reason?: string): BoxPresetDropResult {
  return {
    draft,
    changed: false,
    reason,
    changedBoxIndices: [],
  }
}

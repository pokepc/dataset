import { BoxPresetBox } from '@/components/box-preset-box'
import { type BoxPresetPokemonDisplay } from '@/components/box-preset-cell'
import { BoxPresetDrawer, type BoxPresetDrawerPokemon } from '@/components/box-preset-drawer'
import { BoxPresetTrash } from '@/components/box-preset-trash'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  applyBoxPresetDrop,
  BOX_PRESET_DND_KIND,
  canInsertEmptyBoxSlotAfter,
  canInsertEmptyBoxSlotAfterAcrossBoxes,
  cleanBoxPokemonId,
  compactBoxPresetBoxSlots,
  deleteBoxPresetBox,
  hasCompactableBoxSlots,
  getRepeatedBoxPokemonCellKeys,
  insertEmptyBoxSlotAfter,
  insertEmptyBoxSlotAfterAcrossBoxes,
  insertBoxPresetBoxAfter,
  moveBoxPresetBoxCell,
  moveBoxPresetBox,
  removeBoxPresetBoxCell,
  updateBoxPresetBoxName,
  type BoxPresetCellMoveTarget,
  type BoxPresetCellPosition,
  type BoxPresetDndPosition,
  type BoxPresetDragItem,
  type BoxPresetDraft,
  type BoxPresetDropResult,
} from '@/lib/box-presets'
import { cn } from '@/lib/utils'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type BoxPresetGridProps = {
  draft: BoxPresetDraft
  pokemon: BoxPresetDrawerPokemon[]
  boxCellCount: number
  maxBoxCount: number
  disabled?: boolean
  changedCellCount: number
  isDirty: boolean
  isSaving: boolean
  presetName: string
  onChange: (draft: BoxPresetDraft, result: BoxPresetDropResult) => void
  onDraftChange: (draft: BoxPresetDraft, message?: string) => void
  onDropMessage: (message: string | null) => void
  onSave: () => void
}

type DragPreviewState = {
  item: BoxPresetDragItem
  x: number
  y: number
  width: number
  height: number
}

type PointerDragState = {
  pointerId?: number
  startX: number
  startY: number
  sourcePosition: BoxPresetDndPosition
  item: BoxPresetDragItem
  started: boolean
  width: number
  height: number
}

const DRAG_AUTO_SCROLL_EDGE_SIZE = 96
const DRAG_AUTO_SCROLL_MAX_SPEED = 28

export function BoxPresetGrid({
  draft,
  pokemon,
  boxCellCount,
  maxBoxCount,
  disabled = false,
  changedCellCount,
  isDirty,
  isSaving,
  presetName,
  onChange,
  onDraftChange,
  onDropMessage,
  onSave,
}: BoxPresetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  const dragStateRef = useRef<PointerDragState | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const autoScrollPointRef = useRef<{ x: number; y: number } | null>(null)
  const contextMenuCellRef = useRef<BoxPresetCellPosition | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null)
  const [activeSource, setActiveSource] = useState<BoxPresetDndPosition | null>(null)
  const [activeTarget, setActiveTarget] = useState<BoxPresetDndPosition | null>(null)
  const [contextMenuCell, setContextMenuCell] = useState<BoxPresetCellPosition | null>(null)
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const pokemonWithPlacedCounts = useMemo(() => {
    const placedCountById = draft.boxes.reduce<Record<string, number>>((counts, box) => {
      for (const value of box.cells) {
        const pokemonId = cleanBoxPokemonId(value)
        if (!pokemonId) continue
        counts[pokemonId] = (counts[pokemonId] ?? 0) + 1
      }
      return counts
    }, {})

    return pokemon.map((option) => ({
      ...option,
      placedCount: placedCountById[option.id] ?? 0,
    }))
  }, [draft.boxes, pokemon])
  const pokemonById = useMemo(
    () =>
      new Map<string, BoxPresetPokemonDisplay>(
        pokemonWithPlacedCounts.map((option) => [
          option.id,
          {
            id: option.id,
            label: option.label,
            image: option.image,
            isFemale: option.isFemale,
            isFemaleForm: option.isFemaleForm,
          },
        ]),
      ),
    [pokemonWithPlacedCounts],
  )
  const repeatedCellKeys = useMemo(() => getRepeatedBoxPokemonCellKeys(draft), [draft])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (disabled) return

    function stopAutoScroll() {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
        autoScrollFrameRef.current = null
      }
      autoScrollPointRef.current = null
    }

    function runAutoScroll() {
      autoScrollFrameRef.current = null
      const state = dragStateRef.current
      const point = autoScrollPointRef.current
      if (!state?.started || !point) return

      const scrollVelocity = getDragAutoScrollVelocity(point.y)
      if (scrollVelocity === 0) return

      window.scrollBy(0, scrollVelocity)
      setActiveTarget(readDndPositionFromPoint(point.x, point.y))
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
    }

    function updateAutoScrollPoint(x: number, y: number) {
      autoScrollPointRef.current = { x, y }
      if (getDragAutoScrollVelocity(y) === 0) {
        if (autoScrollFrameRef.current !== null) {
          window.cancelAnimationFrame(autoScrollFrameRef.current)
          autoScrollFrameRef.current = null
        }
        return
      }

      if (autoScrollFrameRef.current === null) {
        autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
      }
    }

    function handleMove(event: PointerEvent | MouseEvent) {
      const state = dragStateRef.current
      if (!state || ('pointerId' in event && state.pointerId !== event.pointerId)) return

      const deltaX = event.clientX - state.startX
      const deltaY = event.clientY - state.startY
      const distance = Math.hypot(deltaX, deltaY)
      if (!state.started && distance < 8) return

      event.preventDefault()
      if (!state.started) {
        state.started = true
        setActiveSource(state.sourcePosition)
      }

      setDragPreview({
        item: state.item,
        x: event.clientX,
        y: event.clientY,
        width: state.width,
        height: state.height,
      })
      setActiveTarget(readDndPositionFromPoint(event.clientX, event.clientY))
      updateAutoScrollPoint(event.clientX, event.clientY)
    }

    function handleEnd(event: PointerEvent | MouseEvent) {
      const state = dragStateRef.current
      if (!state || ('pointerId' in event && state.pointerId !== event.pointerId)) return
      dragStateRef.current = null
      stopAutoScroll()

      const targetPosition = readDndPositionFromPoint(event.clientX, event.clientY)
      setDragPreview(null)
      setActiveSource(null)
      setActiveTarget(null)

      if (!state.started || !targetPosition) return

      const result = applyBoxPresetDrop(
        draftRef.current,
        state.sourcePosition,
        targetPosition,
        state.item,
      )

      if (!result.changed) {
        onDropMessage(result.reason ?? null)
        return
      }

      draftRef.current = result.draft
      onDropMessage(null)
      onChange(result.draft, result)
    }

    function handleCancel(event: PointerEvent) {
      const state = dragStateRef.current
      if (!state || event.pointerId !== state.pointerId) return
      dragStateRef.current = null
      stopAutoScroll()
      setDragPreview(null)
      setActiveSource(null)
      setActiveTarget(null)
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('mousemove', handleMove, { passive: false })
    window.addEventListener('mouseup', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      stopAutoScroll()
    }
  }, [disabled, onChange, onDropMessage])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return
    const target = event.target instanceof HTMLElement ? event.target : null
    const element = target?.closest<HTMLElement>(`[data-kind="${BOX_PRESET_DND_KIND}"]`)
    if (!element) return

    const position = readDndPosition(element)
    if (!position || position.kind === 'trash') return

    const item = getDragItem(element, position)
    if (!item) return

    const rect = element.getBoundingClientRect()
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      sourcePosition: position,
      item,
      started: false,
      width: rect.width,
      height: rect.height,
    }
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || dragStateRef.current) return
    const target = event.target instanceof HTMLElement ? event.target : null
    const element = target?.closest<HTMLElement>(`[data-kind="${BOX_PRESET_DND_KIND}"]`)
    if (!element) return

    const position = readDndPosition(element)
    if (!position || position.kind === 'trash') return

    const item = getDragItem(element, position)
    if (!item) return

    const rect = element.getBoundingClientRect()
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      sourcePosition: position,
      item,
      started: false,
      width: rect.width,
      height: rect.height,
    }
  }

  function getDragItem(
    element: HTMLElement,
    position: Exclude<BoxPresetDndPosition, { kind: 'trash' }>,
  ): BoxPresetDragItem | null {
    const rect = element.getBoundingClientRect()

    if (position.kind === 'drawer') {
      return {
        source: 'drawer',
        pokemonId: position.pokemonId,
        pokemon: position.pokemonId,
        previewSize: { width: rect.width, height: rect.height },
      }
    }

    const pokemonValue = draftRef.current.boxes[position.boxIndex]?.cells[position.cellIndex]
    const pokemonId = cleanBoxPokemonId(pokemonValue ?? null)
    if (!pokemonValue || !pokemonId) return null

    return {
      source: 'cell',
      pokemonId,
      pokemon: pokemonValue,
      previewSize: { width: rect.width, height: rect.height },
      sourceCell: position,
    }
  }

  function updateDraft(nextDraft: BoxPresetDraft, message?: string) {
    draftRef.current = nextDraft
    onDraftChange(nextDraft, message)
  }

  function handleContextMenuOpenChange(open: boolean) {
    const nextCell = contextMenuCellRef.current
    setIsContextMenuOpen(open && !!nextCell)
    if (!open) {
      setContextMenuCell(null)
    }
  }

  function captureContextMenuTarget(
    event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) {
    const position = readContextMenuCellPosition(event.target, draftRef.current)
    if (!position || disabled) {
      contextMenuCellRef.current = null
      setContextMenuCell(null)
      event.preventDefault()
      event.stopPropagation()
      return
    }

    contextMenuCellRef.current = position
    setContextMenuCell(position)
  }

  function handleCellContextAction(target: BoxPresetCellMoveTarget) {
    const position = contextMenuCellRef.current ?? contextMenuCell
    if (!position) return

    updateDraft(moveBoxPresetBoxCell(draftRef.current, position, target), 'Box cell moved.')
  }

  function handleRemoveContextCell() {
    const position = contextMenuCellRef.current ?? contextMenuCell
    if (!position) return

    updateDraft(removeBoxPresetBoxCell(draftRef.current, position), 'Pokemon removed from box.')
  }

  function handleAddEmptySlotAfterContextCell() {
    const position = contextMenuCellRef.current ?? contextMenuCell
    if (!position) return

    updateDraft(
      insertEmptyBoxSlotAfter(draftRef.current, position, boxCellCount),
      'Empty slot added.',
    )
  }

  function handleInsertSlotAndPushDownContextCell() {
    const position = contextMenuCellRef.current ?? contextMenuCell
    if (!position) return

    updateDraft(
      insertEmptyBoxSlotAfterAcrossBoxes(draftRef.current, position, boxCellCount),
      'Empty slot inserted.',
    )
  }

  function canMoveContextCell(target: BoxPresetCellMoveTarget): boolean {
    if (!contextMenuCell) return false
    const box = draft.boxes[contextMenuCell.boxIndex]
    if (!box || !cleanBoxPokemonId(box.cells[contextMenuCell.cellIndex] ?? null)) return false

    if (target === 'first' || target === 'up') return contextMenuCell.cellIndex > 0
    return contextMenuCell.cellIndex < box.cells.length - 1
  }

  function canAddEmptySlotAfterContextCell(): boolean {
    if (!contextMenuCell) return false
    const box = draft.boxes[contextMenuCell.boxIndex]
    return box ? canInsertEmptyBoxSlotAfter(box, contextMenuCell.cellIndex, boxCellCount) : false
  }

  function canInsertSlotAndPushDownContextCell(): boolean {
    return contextMenuCell
      ? canInsertEmptyBoxSlotAfterAcrossBoxes(draft, contextMenuCell, boxCellCount)
      : false
  }

  const previewPokemonId = dragPreview ? cleanBoxPokemonId(dragPreview.item.pokemon) : null
  const previewPokemon = previewPokemonId ? pokemonById.get(previewPokemonId) : null
  const activeSourceCell = activeSource?.kind === 'cell' ? activeSource : null
  const activeTargetCell = activeTarget?.kind === 'cell' ? activeTarget : null
  const activeDrawerPokemonId = activeSource?.kind === 'drawer' ? activeSource.pokemonId : null
  const canAddBox = draft.boxes.length < maxBoxCount

  return (
    <div
      ref={containerRef}
      className="space-y-5 pb-4"
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      data-testid="box-preset-grid"
    >
      <div
        className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 shadow-xl backdrop-blur"
        data-testid="box-preset-sticky-actions"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{presetName}</p>
          <p className="text-muted-foreground text-xs">
            {isDirty
              ? changedCellCount > 0
                ? `${changedCellCount} changed cells`
                : 'Unsaved metadata changes'
              : 'No unsaved changes'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSave} disabled={!isDirty || disabled} size="sm">
            <SaveIcon data-icon="inline-start" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <BoxPresetTrash compact isDropTarget={activeTarget?.kind === 'trash'} />
        </div>
      </div>

      <ContextMenu open={isContextMenuOpen} onOpenChange={handleContextMenuOpenChange}>
        <ContextMenuTrigger
          className="grid gap-4"
          onContextMenuCapture={captureContextMenuTarget}
          onTouchStartCapture={captureContextMenuTarget}
        >
          <div
            className={cn(
              'grid gap-4',
              draft.boxes.length === 1 && 'xl:grid-cols-1',
              draft.boxes.length === 2 && 'xl:grid-cols-2',
              draft.boxes.length > 2 && 'xl:grid-cols-3',
            )}
          >
            {draft.boxes.map((box, boxIndex) => (
              <BoxPresetBox
                key={boxIndex}
                box={box}
                boxIndex={boxIndex}
                boxCellCount={boxCellCount}
                canMoveUp={boxIndex > 0}
                canMoveDown={boxIndex < draft.boxes.length - 1}
                canDelete={draft.boxes.length > 1}
                canInsertAfter={canAddBox}
                canCompactSlots={hasCompactableBoxSlots(box)}
                activeSource={activeSourceCell}
                activeTarget={activeTargetCell}
                repeatedCellKeys={repeatedCellKeys}
                pokemonById={pokemonById}
                onRename={(targetBoxIndex, name) =>
                  updateDraft(
                    updateBoxPresetBoxName(draftRef.current, targetBoxIndex, name),
                    'Box title updated.',
                  )
                }
                onMove={(targetBoxIndex, direction) =>
                  updateDraft(
                    moveBoxPresetBox(draftRef.current, targetBoxIndex, direction),
                    'Box moved.',
                  )
                }
                onDelete={(targetBoxIndex) =>
                  updateDraft(deleteBoxPresetBox(draftRef.current, targetBoxIndex), 'Box deleted.')
                }
                onInsertAfter={(targetBoxIndex) =>
                  updateDraft(
                    insertBoxPresetBoxAfter(
                      draftRef.current,
                      targetBoxIndex,
                      boxCellCount,
                      maxBoxCount,
                    ),
                    'Box added.',
                  )
                }
                onCompactSlots={(targetBoxIndex) =>
                  updateDraft(
                    compactBoxPresetBoxSlots(draftRef.current, targetBoxIndex),
                    'Box slots compacted.',
                  )
                }
              />
            ))}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            disabled={!canMoveContextCell('first')}
            onClick={() => handleCellContextAction('first')}
          >
            <ChevronsUpIcon />
            Move first
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canMoveContextCell('up')}
            onClick={() => handleCellContextAction('up')}
          >
            <ArrowUpIcon />
            Move up
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canMoveContextCell('down')}
            onClick={() => handleCellContextAction('down')}
          >
            <ArrowDownIcon />
            Move down
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canMoveContextCell('last')}
            onClick={() => handleCellContextAction('last')}
          >
            <ChevronsDownIcon />
            Move last
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!canAddEmptySlotAfterContextCell()}
            onClick={handleAddEmptySlotAfterContextCell}
          >
            <PlusIcon />
            Add empty slot after
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canInsertSlotAndPushDownContextCell()}
            onClick={handleInsertSlotAndPushDownContextCell}
          >
            <PlusIcon />
            Insert slot and push down
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={handleRemoveContextCell}>
            <Trash2Icon />
            Remove
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <BoxPresetDrawer
        pokemon={pokemonWithPlacedCounts}
        disabled={disabled}
        activePokemonId={activeDrawerPokemonId}
      />

      {dragPreview ? (
        <div
          className="border-primary/70 bg-card/95 ring-primary/40 pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border p-1 shadow-2xl ring-2"
          style={{
            left: dragPreview.x,
            top: dragPreview.y,
            width: `${dragPreview.width}px`,
            height: `${dragPreview.height}px`,
          }}
          data-testid="box-preset-drag-preview"
        >
          {previewPokemon ? (
            <img
              src={previewPokemon.image}
              alt=""
              aria-hidden
              className="size-full object-contain"
              draggable={false}
            />
          ) : (
            <span className="text-muted-foreground px-2 text-xs">{dragPreview.item.pokemonId}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

function readDndPositionFromPoint(x: number, y: number): BoxPresetDndPosition | null {
  const elementFromPoint = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>(`[data-kind="${BOX_PRESET_DND_KIND}"]`)
  if (elementFromPoint) return readDndPosition(elementFromPoint)

  const element = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-kind="${BOX_PRESET_DND_KIND}"]`),
  ).find((candidate) => {
    const rect = candidate.getBoundingClientRect()
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  })
  return element ? readDndPosition(element) : null
}

function getDragAutoScrollVelocity(clientY: number): number {
  const viewportHeight = window.innerHeight
  const topDistance = clientY
  const bottomDistance = viewportHeight - clientY

  if (topDistance < DRAG_AUTO_SCROLL_EDGE_SIZE) {
    const intensity = (DRAG_AUTO_SCROLL_EDGE_SIZE - topDistance) / DRAG_AUTO_SCROLL_EDGE_SIZE
    return -Math.ceil(Math.min(1, intensity) * DRAG_AUTO_SCROLL_MAX_SPEED)
  }

  if (bottomDistance < DRAG_AUTO_SCROLL_EDGE_SIZE) {
    const intensity = (DRAG_AUTO_SCROLL_EDGE_SIZE - bottomDistance) / DRAG_AUTO_SCROLL_EDGE_SIZE
    return Math.ceil(Math.min(1, intensity) * DRAG_AUTO_SCROLL_MAX_SPEED)
  }

  return 0
}

function readDndPosition(element: HTMLElement): BoxPresetDndPosition | null {
  const source = element.dataset.source
  if (source === 'trash') {
    return { kind: 'trash' }
  }

  if (source === 'drawer') {
    const pokemonId = element.dataset.pokemonId
    return pokemonId ? { kind: 'drawer', pokemonId } : null
  }

  if (source !== 'cell' || element.dataset.padding === 'true') {
    return null
  }

  const boxIndex = Number.parseInt(element.dataset.boxIndex ?? '', 10)
  const cellIndex = Number.parseInt(element.dataset.cellIndex ?? '', 10)
  if (!Number.isInteger(boxIndex) || !Number.isInteger(cellIndex)) {
    return null
  }

  return { kind: 'cell', boxIndex, cellIndex }
}

function readContextMenuCellPosition(
  target: EventTarget | null,
  draft: BoxPresetDraft,
): BoxPresetCellPosition | null {
  const element =
    target instanceof HTMLElement
      ? target.closest<HTMLElement>(`[data-source="cell"][data-kind="${BOX_PRESET_DND_KIND}"]`)
      : null
  if (!element || element.dataset.empty === 'true' || element.dataset.padding === 'true') {
    return null
  }

  const position = readDndPosition(element)
  if (!position || position.kind !== 'cell') return null

  const value = draft.boxes[position.boxIndex]?.cells[position.cellIndex] ?? null
  return cleanBoxPokemonId(value) ? position : null
}

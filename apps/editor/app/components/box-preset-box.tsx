import { BoxPresetCell, type BoxPresetPokemonDisplay } from '@/components/box-preset-cell'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  BOX_PRESET_BOX_TITLE_MAX_LENGTH,
  ensureBoxCellCount,
  type BoxPresetCellPosition,
  type BoxPresetDraft,
} from '@/lib/box-presets'
import { cn } from '@/lib/utils'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  ListCollapseIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'

type BoxPresetBoxProps = {
  box: BoxPresetDraft['boxes'][number]
  boxIndex: number
  boxCellCount: number
  canMoveUp: boolean
  canMoveDown: boolean
  canDelete: boolean
  canInsertAfter: boolean
  canCompactSlots: boolean
  activeSource?: BoxPresetCellPosition | null
  activeTarget?: BoxPresetCellPosition | null
  repeatedCellKeys: Set<string>
  pokemonById: Map<string, BoxPresetPokemonDisplay>
  onRename: (boxIndex: number, name: string) => void
  onMove: (boxIndex: number, target: -1 | 1 | 'first' | 'last') => void
  onDelete: (boxIndex: number) => void
  onInsertAfter: (boxIndex: number) => void
  onCompactSlots: (boxIndex: number) => void
}

export function BoxPresetBox({
  box,
  boxIndex,
  boxCellCount,
  canMoveUp,
  canMoveDown,
  canDelete,
  canInsertAfter,
  canCompactSlots,
  activeSource,
  activeTarget,
  repeatedCellKeys,
  pokemonById,
  onRename,
  onMove,
  onDelete,
  onInsertAfter,
  onCompactSlots,
}: BoxPresetBoxProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(box.name ?? '')
  const [titleBeforeEdit, setTitleBeforeEdit] = useState(box.name ?? '')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const renderedCells = ensureBoxCellCount(box, boxCellCount)
  const title = box.name || `Box ${boxIndex + 1}`
  const isTitleOverLimit = title.length > BOX_PRESET_BOX_TITLE_MAX_LENGTH
  const isTitleDraftOverLimit = titleDraft.length > BOX_PRESET_BOX_TITLE_MAX_LENGTH

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(box.name ?? '')
      setTitleBeforeEdit(box.name ?? '')
    }
  }, [box.name, isEditingTitle])

  useEffect(() => {
    if (!isEditingTitle) return
    titleInputRef.current?.focus()
    titleInputRef.current?.select()
  }, [isEditingTitle])

  function commitTitle() {
    onRename(boxIndex, titleDraft)
    setIsEditingTitle(false)
  }

  function cancelTitleEdit() {
    setTitleDraft(titleBeforeEdit)
    onRename(boxIndex, titleBeforeEdit)
    setIsEditingTitle(false)
  }

  function startTitleEdit() {
    setTitleDraft(title)
    setTitleBeforeEdit(box.name ?? '')
    setIsEditingTitle(true)
  }

  function handleHeaderDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (isEditingTitle) return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('button, input, textarea, select, a, [role="button"], [role="menuitem"]')) {
      return
    }
    startTitleEdit()
  }

  return (
    <section
      data-testid="box-preset-box"
      className="border-border bg-card ring-foreground/5 space-y-2 rounded-2xl border p-3 ring-1 [contain-intrinsic-size:auto_390px] [content-visibility:auto]"
    >
      <div
        data-testid="box-preset-box-header"
        className="bg-input/30 flex items-center justify-between gap-3 rounded-xl px-3 py-2"
        onDoubleClick={handleHeaderDoubleClick}
      >
        {isEditingTitle ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(event) => {
                const nextTitle = event.target.value.slice(0, BOX_PRESET_BOX_TITLE_MAX_LENGTH)
                setTitleDraft(nextTitle)
                onRename(boxIndex, nextTitle)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitTitle()
                if (event.key === 'Escape') cancelTitleEdit()
              }}
              className={cn(
                'h-8 min-w-0 rounded-xl',
                isTitleDraftOverLimit &&
                  'border-red-400/80 text-red-200 focus-visible:border-red-400 focus-visible:ring-red-400/40',
              )}
              maxLength={BOX_PRESET_BOX_TITLE_MAX_LENGTH}
              aria-label={`Box ${boxIndex + 1} title`}
            />
            <Button type="button" size="icon-xs" onClick={commitTitle} aria-label="Save box title">
              <CheckIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={cancelTitleEdit}
              aria-label="Cancel box title edit"
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ) : (
          <h2
            className={cn('truncate text-sm font-medium', isTitleOverLimit && 'text-red-300')}
            title={isTitleOverLimit ? `${title} (${title.length} characters)` : title}
          >
            {title}
          </h2>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground text-xs">{box.cells.length} stored cells</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Box actions">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={startTitleEdit}>
                <PencilIcon />
                Edit title
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!canMoveUp} onClick={() => onMove(boxIndex, 'first')}>
                <ChevronsUpIcon />
                Move to top
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveUp} onClick={() => onMove(boxIndex, -1)}>
                <ArrowUpIcon />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveDown} onClick={() => onMove(boxIndex, 1)}>
                <ArrowDownIcon />
                Move down
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveDown} onClick={() => onMove(boxIndex, 'last')}>
                <ChevronsDownIcon />
                Move to bottom
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canInsertAfter} onClick={() => onInsertAfter(boxIndex)}>
                <PlusIcon />
                Add box after
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!canCompactSlots}
                onClick={() => onCompactSlots(boxIndex)}
              >
                <ListCollapseIcon />
                Compact slots
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!canDelete}
                onClick={() => onDelete(boxIndex)}
              >
                <Trash2Icon />
                Delete box
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {renderedCells.map((value, cellIndex) => (
          <BoxPresetCell
            key={`${boxIndex}-${cellIndex}`}
            boxIndex={boxIndex}
            cellIndex={cellIndex}
            value={value}
            isPadding={cellIndex >= box.cells.length}
            isDragSource={
              activeSource?.boxIndex === boxIndex && activeSource.cellIndex === cellIndex
            }
            isDropTarget={
              activeTarget?.boxIndex === boxIndex && activeTarget.cellIndex === cellIndex
            }
            isRepeatedPokemon={repeatedCellKeys.has(`${boxIndex}:${cellIndex}`)}
            pokemonById={pokemonById}
          />
        ))}
      </div>
    </section>
  )
}

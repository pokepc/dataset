import { PokemonOptionCombobox, type PokemonOption } from '@/components/pokemon-option-combobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  cycleTriStateBooleanValue,
  TRI_STATE_FALSE,
  TRI_STATE_TRUE,
  TRI_STATE_UNSET,
  type PokedexEntryDraft,
  type TriStateBooleanValue,
} from '@/lib/pokedex-logic'
import { cn } from '@/lib/utils'
import { DragDropManager, DragPreviewController, type DragDropCallbacks } from 'dnd-manager'
import { GripVerticalIcon, Layers3Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

type RowErrors = Partial<Record<'pid' | 'dexNum', string>>

type PokedexEntryEditorListProps = {
  entries: PokedexEntryDraft[]
  entryIndices?: number[]
  pokemonOptions: PokemonOption[]
  entryErrors: Record<string, RowErrors>
  editingEntryIds: Set<string>
  disabled?: boolean
  onReorder: (sourceIndex: number, targetIndex: number) => void
  onUpdateEntry: (clientId: string, patch: Partial<PokedexEntryDraft>) => void
  onToggleEdit: (clientId: string) => void
  onAddBelow: (clientId: string) => void
  onBatchAddBelow: (clientId: string) => void
  onRemove: (clientId: string) => void
  onAddBottom: () => void
}

type DragItem = {
  clientId: string
}

const triStateOptions: Array<{ value: TriStateBooleanValue; label: string }> = [
  { value: TRI_STATE_UNSET, label: 'Empty' },
  { value: TRI_STATE_TRUE, label: 'Yes' },
  { value: TRI_STATE_FALSE, label: 'No' },
]

export function PokedexEntryEditorList({
  entries,
  entryIndices,
  pokemonOptions,
  entryErrors,
  editingEntryIds,
  disabled = false,
  onReorder,
  onUpdateEntry,
  onToggleEdit,
  onAddBelow,
  onBatchAddBelow,
  onRemove,
  onAddBottom,
}: PokedexEntryEditorListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef(
    new DragPreviewController({
      zIndex: 60,
      opacity: 0.95,
      className: 'shadow-2xl',
    }),
  )
  const pokemonOptionById = useMemo(
    () => new Map(pokemonOptions.map((option) => [option.id, option])),
    [pokemonOptions],
  )
  const entryIndexByActualIndex = useMemo(
    () =>
      new Map(
        entries.map((entry, visibleIndex) => [entryIndices?.[visibleIndex] ?? visibleIndex, entry]),
      ),
    [entries, entryIndices],
  )

  useEffect(() => {
    const preview = previewRef.current
    const container = containerRef.current
    if (!container || disabled) return

    const callbacks: DragDropCallbacks<DragItem, number> = {
      canDrag: () => !disabled,
      getItemPosition: (element, kind) => {
        const row =
          kind === 'pokedex-entry-row'
            ? (element.closest<HTMLElement>('[data-entry-row="true"]') ?? element)
            : element.closest<HTMLElement>('[data-entry-row="true"]')
        const rawIndex = row?.dataset.index
        if (!rawIndex) return null
        const parsedIndex = Number.parseInt(rawIndex, 10)
        return Number.isFinite(parsedIndex) ? parsedIndex : null
      },
      getItemData: (_element, position) => {
        const entry = entryIndexByActualIndex.get(position)
        return entry ? { clientId: entry.clientId } : null
      },
      onDragStart: (element) => {
        const row = element.closest<HTMLElement>('[data-entry-row="true"]') ?? element
        preview.startFromElement(row)
      },
      onDragMove: (position) => {
        preview.moveToPointer(position)
      },
      onDrop: (sourceIndex, targetIndex) => {
        if (sourceIndex === targetIndex) return
        onReorder(sourceIndex, targetIndex)
      },
      onDragEnd: () => {
        preview.stop()
      },
      onClick: () => {},
    }

    const manager = new DragDropManager<DragItem, number>(
      container,
      {
        draggableKind: 'pokedex-entry-handle',
        droppableKind: 'pokedex-entry-row',
        dragThreshold: 8,
        clickThreshold: 8,
      },
      callbacks,
    )

    return () => {
      preview.stop()
      manager.destroy()
    }
  }, [disabled, entries, entryIndexByActualIndex, onReorder])

  useEffect(() => {
    return () => {
      previewRef.current.destroy()
    }
  }, [])

  function triStateBadge(entryValue: TriStateBooleanValue) {
    if (entryValue === TRI_STATE_TRUE) {
      return (
        <Badge
          className="border-sky-300/70 bg-sky-500/15 text-sky-700 dark:text-sky-300"
          variant="outline"
        >
          Yes
        </Badge>
      )
    }

    if (entryValue === TRI_STATE_FALSE) {
      return (
        <Badge
          className="border-yellow-300/70 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
          variant="outline"
        >
          No
        </Badge>
      )
    }

    return (
      <Badge
        className="border-slate-300/70 bg-slate-500/10 text-slate-600 dark:text-slate-300"
        variant="outline"
      >
        Unset
      </Badge>
    )
  }

  function triStateButtonClassName(entryValue: TriStateBooleanValue) {
    if (entryValue === TRI_STATE_TRUE) {
      return 'border-sky-300/70 bg-sky-500/15 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300'
    }

    if (entryValue === TRI_STATE_FALSE) {
      return 'border-yellow-300/70 bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/20 dark:text-yellow-300'
    }

    return 'border-slate-300/70 bg-slate-500/10 text-slate-600 hover:bg-slate-500/15 dark:text-slate-300'
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="space-y-3">
        {entries.map((entry, index) => {
          const actualIndex = entryIndices?.[index] ?? index
          const selectedPokemon = pokemonOptionById.get(entry.pid) ?? null
          const rowErrors = entryErrors[entry.clientId]
          const isEditing = editingEntryIds.has(entry.clientId)

          return (
            <div
              key={entry.clientId}
              data-kind="pokedex-entry-row"
              data-entry-row="true"
              data-index={actualIndex}
              className={cn(
                'border-border bg-card rounded-2xl border p-2.5 transition-colors sm:p-3',
                'data-[hovered=true]:border-emerald-500 data-[hovered=true]:ring-2 data-[hovered=true]:ring-emerald-500/40',
                rowErrors ? 'border-destructive/60' : 'hover:border-accent/60',
              )}
            >
              <div
                className={cn(
                  'grid gap-2.5',
                  isEditing
                    ? 'lg:grid-cols-[auto_minmax(0,1.5fr)_104px_92px_132px_132px_auto] lg:items-center'
                    : 'lg:grid-cols-[auto_minmax(180px,1.7fr)_90px_86px_118px_118px_auto] lg:items-center',
                )}
              >
                <div className="flex items-start justify-center pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    data-kind="pokedex-entry-handle"
                    data-index={actualIndex}
                    aria-label={`Reorder entry ${actualIndex + 1}`}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <GripVerticalIcon className="size-4" />
                  </Button>
                </div>

                {isEditing ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Pokemon</p>
                      <PokemonOptionCombobox
                        options={pokemonOptions}
                        value={entry.pid || null}
                        onSelect={(option) => onUpdateEntry(entry.clientId, { pid: option.id })}
                        placeholder="Select Pokemon"
                        searchPlaceholder="Search Pokemon to use..."
                        emptyText="No Pokemon found."
                        disabled={disabled}
                        triggerClassName="h-12 w-full justify-start rounded-xl"
                        contentClassName="max-h-80 min-w-72"
                      />
                      <p className="text-destructive min-h-4 text-xs">{rowErrors?.pid ?? ''}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Dex Num</p>
                      <input
                        type="number"
                        min={0}
                        max={99999}
                        value={entry.dexNum}
                        onChange={(event) =>
                          onUpdateEntry(entry.clientId, { dexNum: event.target.value })
                        }
                        disabled={disabled}
                        className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-12 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-[3px] aria-invalid:ring-[3px]"
                        aria-invalid={rowErrors?.dexNum ? true : undefined}
                      />
                      <p className="text-destructive min-h-4 text-xs">{rowErrors?.dexNum ?? ''}</p>
                    </div>

                    <label className="flex items-center gap-2 pt-6 text-sm">
                      <input
                        type="checkbox"
                        checked={entry.isForm}
                        onChange={(event) =>
                          onUpdateEntry(entry.clientId, { isForm: event.target.checked })
                        }
                        disabled={disabled}
                        className="border-input bg-background size-4 rounded border"
                      />
                      <span>Form</span>
                    </label>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Transfer Only</p>
                      <Select
                        value={entry.transferOnly}
                        onValueChange={(value) =>
                          onUpdateEntry(entry.clientId, {
                            transferOnly: (value ?? TRI_STATE_UNSET) as TriStateBooleanValue,
                          })
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-12 w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {triStateOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Non Canonical</p>
                      <Select
                        value={entry.isNonCanonical}
                        onValueChange={(value) =>
                          onUpdateEntry(entry.clientId, {
                            isNonCanonical: (value ?? TRI_STATE_UNSET) as TriStateBooleanValue,
                          })
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-12 w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {triStateOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-2.5">
                      {selectedPokemon ? (
                        <img
                          src={selectedPokemon.image}
                          alt=""
                          aria-hidden
                          className="size-9 shrink-0 object-contain sm:size-10"
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg text-xs sm:size-10">
                          ?
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {selectedPokemon?.label || 'No Pokemon selected'}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {entry.pid || 'Unset Pokemon'}
                        </p>
                        <p className="text-destructive min-h-4 text-xs">{rowErrors?.pid ?? ''}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Dex Num</p>
                      <p className="text-sm font-medium">{entry.dexNum || 'Unset'}</p>
                      <p className="text-destructive min-h-4 text-xs">{rowErrors?.dexNum ?? ''}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Form</p>
                      {entry.isForm ? (
                        <Badge
                          className="border-sky-300/70 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                          variant="outline"
                        >
                          Yes
                        </Badge>
                      ) : (
                        <Badge
                          className="border-yellow-300/70 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
                          variant="outline"
                        >
                          No
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Transfer Only</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={disabled}
                        className={cn(
                          'h-7 rounded-full px-3 text-xs',
                          triStateButtonClassName(entry.transferOnly),
                        )}
                        onClick={() =>
                          onUpdateEntry(entry.clientId, {
                            transferOnly: cycleTriStateBooleanValue(entry.transferOnly),
                          })
                        }
                        title="Cycle Transfer Only: Unset -> Yes -> No"
                        aria-label={`Cycle Transfer Only value for ${selectedPokemon?.label || entry.pid || 'this row'}`}
                      >
                        {entry.transferOnly === TRI_STATE_TRUE
                          ? 'Yes'
                          : entry.transferOnly === TRI_STATE_FALSE
                            ? 'No'
                            : 'Unset'}
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Non Canonical</p>
                      {triStateBadge(entry.isNonCanonical)}
                    </div>
                  </>
                )}

                <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 lg:justify-start">
                  <Button
                    type="button"
                    variant={isEditing ? 'secondary' : 'outline'}
                    size="icon-sm"
                    onClick={() => onToggleEdit(entry.clientId)}
                    disabled={disabled}
                    aria-label={isEditing ? 'Done editing row' : 'Edit row'}
                    title={isEditing ? 'Done' : 'Edit'}
                  >
                    <PencilIcon data-icon="inline-start" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onBatchAddBelow(entry.clientId)}
                    disabled={disabled}
                    aria-label="Batch add below this row"
                    title="Batch Below"
                  >
                    <Layers3Icon data-icon="inline-start" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onAddBelow(entry.clientId)}
                    disabled={disabled}
                    aria-label="Add one row below this row"
                    title="Add Below"
                  >
                    <PlusIcon data-icon="inline-start" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onRemove(entry.clientId)}
                    disabled={disabled}
                    aria-label="Remove this row"
                    title="Remove"
                  >
                    <Trash2Icon data-icon="inline-start" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Button type="button" variant="outline" onClick={onAddBottom} disabled={disabled}>
        <PlusIcon data-icon="inline-start" />
        Add Entry
      </Button>
    </div>
  )
}

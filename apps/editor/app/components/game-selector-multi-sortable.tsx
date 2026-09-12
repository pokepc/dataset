import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import { GameOptionCombobox } from './game-option-combobox'
import type { GameOption, GameSelectorMode } from './types'
import { SortableGamePills } from './sortable-game-pills'

type GameSelectorMultiSortableProps = {
  value: string[]
  onChange: (nextValue: string[]) => void
  options: GameOption[]
  mode?: GameSelectorMode
  allowedIds?: string[]
  prefillLabel?: string
  onPrefill?: () => void
  prefillDisabled?: boolean
  emptyText?: string
  disabled?: boolean
  allowAddAll?: boolean
}

export function GameSelectorMultiSortable({
  value,
  onChange,
  options,
  mode = 'games',
  allowedIds,
  prefillLabel,
  onPrefill,
  prefillDisabled = false,
  emptyText = 'No games selected.',
  disabled = false,
  allowAddAll = false,
}: GameSelectorMultiSortableProps) {
  const modeOptions = options.filter((option) => option.modes.includes(mode))
  const allowedIdSet = allowedIds ? new Set(allowedIds) : null
  const selectedIds = value
  const unselectedOptions = modeOptions.filter(
    (option) =>
      !selectedIds.includes(option.id) && (allowedIdSet ? allowedIdSet.has(option.id) : true),
  )

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 ? (
        <SortableGamePills
          ids={selectedIds}
          options={modeOptions}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <GameOptionCombobox
          options={unselectedOptions}
          onSelect={(selectedOption) => {
            onChange([...selectedIds, selectedOption.id])
          }}
          placeholder="Add game"
          searchPlaceholder="Search games to add..."
          emptyText={
            unselectedOptions.length === 0 ? 'All games already selected' : 'No games found.'
          }
          disabled={disabled || unselectedOptions.length === 0}
          triggerClassName="h-8 w-auto px-3 py-1.5 font-medium"
          placeholderClassName="text-foreground"
          contentClassName="max-h-80 min-w-64"
          triggerPrefix={<PlusIcon data-icon="inline-start" className="shrink-0" />}
        />

        {allowAddAll ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || unselectedOptions.length === 0}
            onClick={() => {
              onChange(
                modeOptions
                  .filter((option) => (allowedIdSet ? allowedIdSet.has(option.id) : true))
                  .map((option) => option.id),
              )
            }}
          >
            Add all games
          </Button>
        ) : null}

        {prefillLabel && onPrefill ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || prefillDisabled}
            onClick={onPrefill}
          >
            {prefillLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

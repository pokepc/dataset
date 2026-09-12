import { PokemonOptionCombobox, type PokemonOption } from '@/components/pokemon-option-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { matchesSearchQuery } from '@pokepc/dataset/lib/search'
import { XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

type PokemonSelectorMultiProps = {
  value: string[]
  onChange: (nextValue: string[]) => void
  options: PokemonOption[]
  allowedIds?: string[]
  excludedIds?: string[]
  emptyText?: string
  disabled?: boolean
  readOnly?: boolean
  prefillLabel?: string
  onPrefill?: () => void
  prefillDisabled?: boolean
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  secondaryActionDisabled?: boolean
  tertiaryActionLabel?: string
  onTertiaryAction?: () => void
  tertiaryActionDisabled?: boolean
}

export function PokemonSelectorMulti({
  value,
  onChange,
  options,
  allowedIds,
  excludedIds,
  emptyText = 'No Pokemon selected.',
  disabled = false,
  readOnly = false,
  prefillLabel,
  onPrefill,
  prefillDisabled = false,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled = false,
  tertiaryActionLabel,
  onTertiaryAction,
  tertiaryActionDisabled = false,
}: PokemonSelectorMultiProps) {
  const [visibleQuery, setVisibleQuery] = useState('')
  const selectedIds = value
  const allowedIdSet = allowedIds ? new Set(allowedIds) : null
  const excludedIdSet = excludedIds ? new Set(excludedIds) : null
  const selectableOptions = allowedIdSet
    ? options.filter((option) => allowedIdSet.has(option.id))
    : options
  const selectedOptions = selectedIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is PokemonOption => option !== undefined)
  const filteredSelectedOptions = useMemo(() => {
    if (visibleQuery.trim().length === 0) return selectedOptions

    return selectedOptions.filter((option) =>
      matchesSearchQuery(option.searchableText, visibleQuery),
    )
  }, [selectedOptions, visibleQuery])
  const unselectedOptions = selectableOptions.filter(
    (option) => !selectedIds.includes(option.id) && !excludedIdSet?.has(option.id),
  )
  const shouldUseScrollableSelectedList = filteredSelectedOptions.length > 18

  return (
    <div className="space-y-2">
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <PokemonOptionCombobox
            options={unselectedOptions}
            onSelect={(selectedOption) => {
              onChange([...selectedIds, selectedOption.id])
            }}
            placeholder="Add Pokemon"
            searchPlaceholder="Search Pokemon to add..."
            emptyText={
              unselectedOptions.length === 0 ? 'All Pokemon already selected' : 'No Pokemon found.'
            }
            disabled={disabled || unselectedOptions.length === 0}
            triggerClassName="h-8 w-auto px-3 py-1.5 font-medium"
            placeholderClassName="text-foreground"
            contentClassName="max-h-80 min-w-72"
          />
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
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || secondaryActionDisabled}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
          {tertiaryActionLabel && onTertiaryAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || tertiaryActionDisabled}
              onClick={onTertiaryAction}
            >
              {tertiaryActionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Input
        type="search"
        value={visibleQuery}
        onChange={(event) => setVisibleQuery(event.target.value)}
        placeholder="Filter shown Pokemon..."
        aria-label="Filter shown Pokemon"
        disabled={selectedOptions.length === 0}
      />

      {selectedOptions.length > 0 ? (
        <div className="border-border/60 bg-muted/20 rounded-xl border p-2">
          <ScrollArea className={shouldUseScrollableSelectedList ? 'h-72' : 'h-auto'}>
            {filteredSelectedOptions.length > 0 ? (
              <ul
                className="grid gap-2 pr-2"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))' }}
              >
                {filteredSelectedOptions.map((option) => (
                  <li key={option.id} className="h-full">
                    <div className="group/pill border-border bg-card hover:border-accent hover:bg-accent/50 relative flex h-full flex-col rounded-xl border p-2 text-center transition-colors">
                      {!readOnly ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          title="Remove"
                          aria-label={`Remove ${option.label}`}
                          className="bg-background/80 hover:bg-destructive! hover:text-destructive-foreground! cannot-hover:opacity-100 can-hover:opacity-0 can-hover:pointer-events-none can-hover:group-hover/pill:opacity-100 can-hover:group-hover/pill:pointer-events-auto absolute top-1 right-1 size-7 rounded-full"
                          onClick={(event) => {
                            event.stopPropagation()
                            onChange(selectedIds.filter((selectedId) => selectedId !== option.id))
                          }}
                          disabled={disabled}
                        >
                          <XIcon className="size-3" />
                        </Button>
                      ) : null}
                      <div className="mx-auto mt-2 flex h-12 items-center justify-center">
                        <img
                          src={option.image}
                          alt=""
                          aria-hidden
                          className="size-10 object-contain"
                        />
                      </div>
                      {option.dexNum !== undefined ? (
                        <p className="text-muted-foreground mt-1 text-[10px] leading-none">
                          #{option.dexNum}
                        </p>
                      ) : null}
                      <p className="mt-1 line-clamp-2 text-xs leading-tight font-medium">
                        {option.label}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground pr-2 text-xs">No Pokemon match this filter.</p>
            )}
          </ScrollArea>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      )}
    </div>
  )
}

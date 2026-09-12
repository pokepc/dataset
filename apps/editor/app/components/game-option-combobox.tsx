import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import type { GameOption } from './types'

type GameOptionComboboxProps = {
  options: GameOption[]
  value?: string | null
  onSelect: (option: GameOption) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  itemClassName?: string
  triggerPrefix?: ReactNode
  placeholderClassName?: string
}

export function GameOptionCombobox({
  options,
  value = null,
  onSelect,
  placeholder = 'Select game',
  searchPlaceholder = 'Search games...',
  emptyText = 'No games found.',
  disabled = false,
  triggerClassName,
  contentClassName,
  itemClassName,
  triggerPrefix,
  placeholderClassName = 'text-muted-foreground',
}: GameOptionComboboxProps) {
  const [query, setQuery] = useState('')
  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  )

  return (
    <Combobox
      items={options}
      value={selectedOption}
      itemToStringLabel={(item) => `${item.label} ${item.id}`}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(open) => {
        if (!open) {
          setQuery('')
        }
      }}
      onValueChange={(nextOption) => {
        if (!nextOption) return
        onSelect(nextOption)
        setQuery('')
      }}
      disabled={disabled}
    >
      <ComboboxTrigger
        className={cn(
          'border-input data-placeholder:text-muted-foreground bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex h-9 w-full items-center justify-between gap-1.5 rounded-4xl border px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px]',
          triggerClassName,
        )}
      >
        {triggerPrefix}
        {selectedOption ? (
          <span className="flex min-w-0 items-center gap-2 truncate">
            <img
              src={selectedOption.image}
              alt=""
              aria-hidden
              className="size-5 shrink-0 rounded-sm object-cover"
            />
            <span className="truncate">{selectedOption.label}</span>
          </span>
        ) : (
          <span className={cn('truncate', placeholderClassName)}>{placeholder}</span>
        )}
      </ComboboxTrigger>
      <ComboboxContent align="start" className={cn('min-w-64', contentClassName)}>
        <div className="w-full p-1.5 pb-0">
          <ComboboxInput
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full"
            showTrigger={false}
            showClear={false}
            onKeyDown={(event) => {
              event.stopPropagation()
            }}
          />
        </div>
        <ComboboxEmpty className="px-3 py-2 text-sm">{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: GameOption) => (
            <ComboboxItem key={option.id} value={option} className={itemClassName}>
              <img
                src={option.image}
                alt=""
                aria-hidden
                className="size-5 shrink-0 rounded-sm object-cover"
              />
              <span className="truncate">{option.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

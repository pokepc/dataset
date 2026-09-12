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
import { matchesSearchQuery } from '@pokepc/dataset/lib/search'
import { useMemo, useState } from 'react'

export type PokemonOption = {
  id: string
  label: string
  image: string
  dexNum?: string | number
  searchableText: string
}

type PokemonOptionComboboxProps = {
  options: PokemonOption[]
  value?: string | null
  onSelect: (option: PokemonOption) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  itemClassName?: string
  placeholderClassName?: string
}

export function PokemonOptionCombobox({
  options,
  value = null,
  onSelect,
  placeholder = 'Select Pokemon',
  searchPlaceholder = 'Search Pokemon...',
  emptyText = 'No Pokemon found.',
  disabled = false,
  triggerClassName,
  contentClassName,
  itemClassName,
  placeholderClassName = 'text-muted-foreground',
}: PokemonOptionComboboxProps) {
  const [query, setQuery] = useState('')
  const filteredOptions = useMemo(() => {
    if (query.trim().length === 0) return options

    return options.filter((option) => matchesSearchQuery(option.searchableText, query))
  }, [options, query])
  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  )

  return (
    <Combobox
      items={filteredOptions}
      value={selectedOption}
      itemToStringLabel={(item) => `${query} ${item.id} ${item.searchableText}`}
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
          {(option: PokemonOption) => (
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

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { matchesSearchQuery } from '@pokepc/dataset/lib/search'
import { PlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { PokemonOption } from '@/components/pokemon-option-combobox'

type PokemonOptionPickerListProps = {
  options: PokemonOption[]
  onSelect: (option: PokemonOption) => void
  disabled?: boolean
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  listClassName?: string
}

export function PokemonOptionPickerList({
  options,
  onSelect,
  disabled = false,
  searchPlaceholder = 'Search Pokemon...',
  emptyText = 'No Pokemon found.',
  className,
  listClassName,
}: PokemonOptionPickerListProps) {
  const [query, setQuery] = useState('')

  const filteredOptions = useMemo(() => {
    if (query.trim().length === 0) return options

    return options.filter((option) => matchesSearchQuery(option.searchableText, query))
  }, [options, query])

  return (
    <div className={cn('space-y-2', className)}>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        disabled={disabled}
        className="h-11 rounded-xl"
      />

      <div
        className={cn(
          'border-border/70 bg-muted/10 max-h-80 overflow-y-auto rounded-2xl border p-2',
          listClassName,
        )}
      >
        {filteredOptions.length > 0 ? (
          <div className="space-y-1">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option)}
                disabled={disabled}
                className="hover:bg-accent/70 focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
              >
                <img
                  src={option.image}
                  alt=""
                  aria-hidden
                  className="size-9 shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{option.label}</p>
                  <p className="text-muted-foreground truncate text-xs">{option.id}</p>
                </div>
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                  <PlusIcon className="size-3.5" />
                  Add
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">{emptyText}</div>
        )}
      </div>
    </div>
  )
}

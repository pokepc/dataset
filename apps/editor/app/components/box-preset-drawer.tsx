import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BOX_PRESET_DND_KIND, hasUnsupportedBoxPokemonId } from '@/lib/box-presets'
import { cn } from '@/lib/utils'
import { sanitizeSearchQuery } from '@pokepc/dataset/lib/search'
import { matchesSearchQuery } from '@pokepc/dataset/lib/search'
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  SearchIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

export type BoxPresetDrawerPokemon = {
  id: string
  label: string
  image: string
  dexNum: number | string
  searchableText: string
  placedCount: number
  isFemale?: boolean
  isFemaleForm?: boolean
}

type BoxPresetDrawerProps = {
  pokemon: BoxPresetDrawerPokemon[]
  disabled?: boolean
  activePokemonId?: string | null
}

type DrawerGroupId = 'not-placed' | 'placed' | 'placed-duplicates'

export function BoxPresetDrawer({
  pokemon,
  disabled = false,
  activePokemonId = null,
}: BoxPresetDrawerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<DrawerGroupId, boolean>>({
    'not-placed': true,
    placed: true,
    'placed-duplicates': true,
  })
  const allPokemonPlaced = pokemon.length > 0 && pokemon.every((option) => option.placedCount > 0)
  const filteredPokemon = useMemo(() => {
    if (query.trim().length === 0) return pokemon
    return pokemon.filter((option) =>
      matchesSearchQuery(
        `${option.searchableText} ${sanitizeSearchQuery(option.id)} ${sanitizeSearchQuery(option.label)}`,
        query,
      ),
    )
  }, [pokemon, query])
  const pokemonGroups = useMemo<
    Array<{ id: DrawerGroupId; title: string; pokemon: BoxPresetDrawerPokemon[] }>
  >(
    () => [
      {
        id: 'not-placed',
        title: 'Not Placed',
        pokemon: filteredPokemon.filter((option) => option.placedCount === 0),
      },
      {
        id: 'placed',
        title: 'Placed',
        pokemon: filteredPokemon.filter((option) => option.placedCount === 1),
      },
      {
        id: 'placed-duplicates',
        title: 'Placed Duplicates',
        pokemon: filteredPokemon.filter((option) => option.placedCount > 1),
      },
    ],
    [filteredPokemon],
  )

  function toggleGroup(groupId: DrawerGroupId) {
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }))
  }

  return (
    <div
      data-testid="box-preset-drawer"
      className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky bottom-0 z-50 -mx-4 border-t px-4 py-3 shadow-2xl backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? (
              <ChevronDownIcon data-icon="inline-start" />
            ) : (
              <ChevronUpIcon data-icon="inline-start" />
            )}
            Available Pokemon
          </Button>
          <p className="text-muted-foreground text-xs">
            {pokemon.length} storable Pokemon for this game set
          </p>
        </div>

        {open ? (
          <div className="space-y-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium">Available Pokemon</h2>
                <p className="text-muted-foreground text-xs">
                  Drag an item into an empty stored cell.
                </p>
              </div>

              {allPokemonPlaced ? (
                <div
                  className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
                  data-testid="drawer-all-placed-alert"
                  role="status"
                >
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                  <span>All storable Pokemon are placed in this preset.</span>
                </div>
              ) : null}

              <div className="relative w-full sm:max-w-xs">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Pokemon..."
                  className="pl-9"
                />
              </div>
            </div>

            {filteredPokemon.length > 0 ? (
              <div className="max-h-56 space-y-4 overflow-y-auto pr-1">
                {pokemonGroups.map((group) => {
                  const isGroupOpen = openGroups[group.id]

                  return (
                    <section
                      key={group.id}
                      className="space-y-2"
                      data-testid={`drawer-${group.id}`}
                    >
                      <button
                        type="button"
                        className="hover:bg-input/50 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left transition-colors"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isGroupOpen}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {isGroupOpen ? (
                            <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
                          ) : (
                            <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0" />
                          )}
                          <span className="text-foreground truncate text-xs font-semibold">
                            {group.title}
                          </span>
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {group.pokemon.length}
                        </span>
                      </button>

                      {isGroupOpen ? (
                        group.pokemon.length > 0 ? (
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-2 gap-y-3">
                            {group.pokemon.map((option) => {
                              const hasUnsupportedFormId = hasUnsupportedBoxPokemonId(option.id)

                              return (
                                <div
                                  key={option.id}
                                  className="min-w-0 text-center [contain-intrinsic-size:64px_88px] [content-visibility:auto]"
                                  data-duplicate-placement={
                                    option.placedCount > 1 ? 'true' : 'false'
                                  }
                                  data-unsupported-id={hasUnsupportedFormId ? 'true' : 'false'}
                                >
                                  <button
                                    type="button"
                                    data-kind={BOX_PRESET_DND_KIND}
                                    data-source="drawer"
                                    data-pokemon-id={option.id}
                                    data-drag-source={
                                      activePokemonId === option.id ? 'true' : 'false'
                                    }
                                    data-duplicate-placement={
                                      option.placedCount > 1 ? 'true' : 'false'
                                    }
                                    data-unsupported-id={hasUnsupportedFormId ? 'true' : 'false'}
                                    disabled={disabled}
                                    title={option.label}
                                    aria-label={`Drag ${option.label}`}
                                    className={cn(
                                      'border-border/80 bg-input/45 mx-auto flex aspect-square h-14 w-14 cursor-grab items-center justify-center rounded-lg border p-1 transition-all active:cursor-grabbing',
                                      'hover:border-primary/70 hover:bg-primary/10',
                                      'focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                                      'data-[dragging=true]:scale-95 data-[dragging=true]:opacity-30',
                                      'data-[drag-source=true]:border-primary data-[drag-source=true]:bg-primary/15 data-[drag-source=true]:ring-primary/60 data-[drag-source=true]:ring-2',
                                      'data-[duplicate-placement=true]:border-amber-400/80 data-[duplicate-placement=true]:bg-amber-500/15 data-[duplicate-placement=true]:ring-1 data-[duplicate-placement=true]:ring-amber-400/40',
                                      'data-[unsupported-id=true]:border-red-400/80 data-[unsupported-id=true]:bg-red-500/15 data-[unsupported-id=true]:ring-1 data-[unsupported-id=true]:ring-red-400/40',
                                      'disabled:cursor-not-allowed disabled:opacity-50',
                                    )}
                                  >
                                    <img
                                      src={option.image}
                                      alt=""
                                      aria-hidden
                                      loading="lazy"
                                      decoding="async"
                                      draggable={false}
                                      className="size-full object-contain"
                                    />
                                  </button>
                                  <div className="mt-1 min-w-0 space-y-0.5">
                                    <p
                                      className={cn(
                                        'truncate text-xs font-medium',
                                        option.placedCount > 1 && 'text-amber-200',
                                        hasUnsupportedFormId && 'text-red-200',
                                      )}
                                      title={option.label}
                                    >
                                      {option.label}
                                    </p>
                                    <p
                                      className={cn(
                                        'text-muted-foreground text-[10px]',
                                        option.placedCount > 1 && 'font-medium text-amber-300',
                                        hasUnsupportedFormId && 'font-medium text-red-300',
                                      )}
                                    >
                                      {option.placedCount > 0
                                        ? `${option.placedCount} placed`
                                        : 'Not placed'}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="border-border bg-background/40 text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
                            No Pokemon in this category.
                          </p>
                        )
                      ) : null}
                    </section>
                  )
                })}
              </div>
            ) : (
              <p className="border-border bg-background/40 text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                No Pokemon match this search.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

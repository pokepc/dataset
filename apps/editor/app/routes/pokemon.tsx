import { GameSelectorMultiSortable } from '@/components/game-selector-multi-sortable'
import { AvailabilitySourceComparison } from '@/components/availability-source-comparison'
import { GameSelectorSingle } from '@/components/game-selector-single'
import { PokemonOptionCombobox, type PokemonOption } from '@/components/pokemon-option-combobox'
import { type GameOption } from '@/components/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  type AvailabilityState,
  sanitizeAvailabilityState,
  toAvailabilityState,
} from '@/lib/pokemon-logic'
import { loadPokemonEditorData, savePokemonAvailabilityFromForm } from '@/lib/pokemon-logic.server'
import { pokemonSpriteUrl } from '@/lib/utils'
import { searchPokemon } from '@pokepc/dataset/lib/search'
import { formatDexNum } from '@pokepc/dataset/lib/utils'
import { sortStringsInGivenOrder } from '@pokepc/dataset/lib/utils'
import { ChevronLeftIcon, ChevronRightIcon, ClipboardPasteIcon } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import type { Route } from './+types/pokemon'

const SEARCH_DEBOUNCE_MS = 200

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Pokemon | PokePC Dataset Editor' },
    { name: 'description', content: 'Browse Pokemon sprites and names from the dataset.' },
  ]
}

export async function loader() {
  return loadPokemonEditorData()
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  return savePokemonAvailabilityFromForm(formData)
}

export default function PokemonPage({ loaderData }: Route.ComponentProps) {
  const { pokemon, gameOptions: loaderGameOptions } = loaderData
  const fetcher = useFetcher<typeof action>()

  const [pokemonList, setPokemonList] = useState(pokemon)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [draft, setDraft] = useState<AvailabilityState | null>(null)
  const [baseline, setBaseline] = useState<AvailabilityState | null>(null)
  const [copySourcePokemonId, setCopySourcePokemonId] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const scrollBehaviorRef = useRef<ScrollBehavior | null>(null)
  const pendingNavigateToPokemonIdRef = useRef<string | null>(null)
  const [selectedPokemonId, setSelectedPokemonId] = useQueryState('selected')

  const gameOptions = loaderGameOptions as GameOption[]
  const gameIdOrder = useMemo(
    () => gameOptions.filter((game) => game.modes.includes('games')).map((game) => game.id),
    [gameOptions],
  )
  const validGameIds = useMemo(() => new Set(gameIdOrder), [gameIdOrder])
  const debutIdOrder = useMemo(
    () => gameOptions.filter((game) => game.modes.includes('gamesets')).map((game) => game.id),
    [gameOptions],
  )
  const validDebutIds = useMemo(() => new Set(debutIdOrder), [debutIdOrder])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [query])

  const filteredPokemon = useMemo(
    () => searchPokemon(pokemonList, { q: debouncedQuery, forms: true }, false).pokemon,
    [pokemonList, debouncedQuery],
  )

  const selectedPokemon = useMemo(
    () => pokemonList.find((item) => item.id === selectedPokemonId) ?? null,
    [pokemonList, selectedPokemonId],
  )
  const copySourceOptions = useMemo<PokemonOption[]>(
    () =>
      pokemonList
        .filter((item) => item.id !== selectedPokemonId)
        .map((item) => ({
          id: item.id,
          label: item.name || item.id,
          image: pokemonSpriteUrl(item.nid),
          searchableText: item.searchableText,
        })),
    [pokemonList, selectedPokemonId],
  )

  const selectedIndexInFiltered = useMemo(
    () => filteredPokemon.findIndex((item) => item.id === selectedPokemonId),
    [filteredPokemon, selectedPokemonId],
  )

  const previousPokemon =
    selectedIndexInFiltered > 0 ? filteredPokemon[selectedIndexInFiltered - 1] : null
  const nextPokemon =
    selectedIndexInFiltered >= 0 && selectedIndexInFiltered < filteredPokemon.length - 1
      ? filteredPokemon[selectedIndexInFiltered + 1]
      : null
  const copySourcePokemon = useMemo(
    () => pokemonList.find((item) => item.id === copySourcePokemonId) ?? null,
    [pokemonList, copySourcePokemonId],
  )

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  )

  useEffect(() => {
    if (!selectedPokemon) {
      setDraft(null)
      setBaseline(null)
      return
    }

    const nextState = sanitizeAvailabilityState(
      toAvailabilityState(selectedPokemon),
      gameIdOrder,
      validGameIds,
      debutIdOrder,
      validDebutIds,
    )
    setDraft(nextState)
    setBaseline(nextState)
  }, [selectedPokemon, gameIdOrder, validGameIds, debutIdOrder, validDebutIds])

  useEffect(() => {
    setCopySourcePokemonId(previousPokemon?.id ?? '')
  }, [selectedPokemonId, previousPokemon])

  useEffect(() => {
    if (copySourceOptions.length === 0) {
      if (copySourcePokemonId) {
        setCopySourcePokemonId('')
      }
      return
    }

    const hasCurrentSource = copySourceOptions.some((option) => option.id === copySourcePokemonId)
    if (hasCurrentSource) return

    const fallbackId =
      previousPokemon && previousPokemon.id !== selectedPokemonId
        ? previousPokemon.id
        : (copySourceOptions[0]?.id ?? '')
    if (fallbackId !== copySourcePokemonId) {
      setCopySourcePokemonId(fallbackId)
    }
  }, [copySourceOptions, copySourcePokemonId, previousPokemon, selectedPokemonId])

  useEffect(() => {
    if (!fetcher.data) return
    if (fetcher.data.success !== true) {
      pendingNavigateToPokemonIdRef.current = null
      setStatusMessage(fetcher.data.error)
      return
    }
    if (!fetcher.data.availability) return

    const data = fetcher.data
    const savedAvailability: AvailabilityState = data.availability
    const pendingNavigateToPokemonId = pendingNavigateToPokemonIdRef.current
    pendingNavigateToPokemonIdRef.current = null

    setPokemonList((previous) =>
      previous.map((item) =>
        item.id === data.pokemonId
          ? {
              ...item,
              ...savedAvailability,
              shinyLockedIn: savedAvailability.shinyLockedIn,
            }
          : item,
      ),
    )
    setDraft(savedAvailability)
    setBaseline(savedAvailability)

    if (pendingNavigateToPokemonId) {
      scrollBehaviorRef.current = 'auto'
      void setSelectedPokemonId(pendingNavigateToPokemonId, { history: 'replace' })
      setStatusMessage('Pokemon availability saved. Moved to next Pokemon.')
      return
    }

    setStatusMessage('Pokemon availability saved.')
  }, [fetcher.data, setSelectedPokemonId])

  function canDiscardCurrentDraft() {
    if (!isDirty) return true
    return window.confirm('You have unsaved changes. Continue and discard them?')
  }

  function selectPokemon(pokemonId: string) {
    if (pokemonId === selectedPokemonId) return
    if (!canDiscardCurrentDraft()) return
    scrollBehaviorRef.current = 'smooth'
    void setSelectedPokemonId(pokemonId, { history: 'replace' })
    setStatusMessage(null)
  }

  function navigatePokemon(direction: 'prev' | 'next') {
    const target = direction === 'prev' ? previousPokemon : nextPokemon
    if (!target) return
    if (!canDiscardCurrentDraft()) return
    scrollBehaviorRef.current = 'auto'
    void setSelectedPokemonId(target.id, { history: 'replace' })
    setStatusMessage(null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey) return

      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName.toLowerCase()
        const isTypingTarget =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable
        if (isTypingTarget) return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        navigatePokemon('prev')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        navigatePokemon('next')
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (fetcher.state !== 'idle') return
        if (!isDirty) {
          navigatePokemon('next')
          return
        }
        saveAvailability({ navigateToPokemonId: nextPokemon?.id })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previousPokemon, nextPokemon, isDirty, fetcher.state, selectedPokemon, draft])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function updateAvailabilityField<K extends keyof AvailabilityState>(
    field: K,
    value: AvailabilityState[K],
  ) {
    setDraft((current) => {
      if (!current) return current
      return sanitizeAvailabilityState(
        { ...current, [field]: value },
        gameIdOrder,
        validGameIds,
        debutIdOrder,
        validDebutIds,
      )
    })
  }

  function copyFromPokemonById(sourcePokemonId: string) {
    if (!sourcePokemonId || !draft) return
    const sourcePokemon = pokemonList.find((item) => item.id === sourcePokemonId)
    if (!sourcePokemon) return
    setDraft(
      sanitizeAvailabilityState(
        toAvailabilityState(sourcePokemon),
        gameIdOrder,
        validGameIds,
        debutIdOrder,
        validDebutIds,
      ),
    )
    setStatusMessage(`Copied availability from ${sourcePokemon.name || sourcePokemon.id}.`)
  }

  function saveAvailability({ navigateToPokemonId }: { navigateToPokemonId?: string } = {}) {
    if (!selectedPokemon || !draft) return
    pendingNavigateToPokemonIdRef.current = navigateToPokemonId ?? null
    fetcher.submit(
      {
        intent: 'save-availability',
        pokemonId: selectedPokemon.id,
        availability: JSON.stringify(draft),
      },
      { method: 'post' },
    )
  }

  useEffect(() => {
    if (!selectedPokemonId) return
    if (!scrollBehaviorRef.current) return
    editorRef.current?.scrollIntoView({ behavior: scrollBehaviorRef.current, block: 'start' })
    scrollBehaviorRef.current = null
  }, [selectedPokemonId])

  const obtainableIdSet = useMemo(() => new Set(draft?.obtainableIn ?? []), [draft?.obtainableIn])
  const nonObtainableGameIds = useMemo(
    () => gameIdOrder.filter((id) => !obtainableIdSet.has(id)),
    [gameIdOrder, obtainableIdSet],
  )
  const storableAllowedGameIds = useMemo(() => {
    if (!draft) return []
    return sortStringsInGivenOrder(
      Array.from(new Set([...draft.obtainableIn, ...draft.transferOnlyIn, ...draft.eventOnlyIn])),
      gameIdOrder,
    )
  }, [draft, gameIdOrder])
  const nonObtainableInObtainableCount = useMemo(() => {
    if (!draft) return 0
    const blockedIds = new Set([...draft.transferOnlyIn, ...draft.eventOnlyIn])
    return draft.obtainableIn.filter((id) => blockedIds.has(id)).length
  }, [draft])

  function removeNonObtainableFromObtainable() {
    setDraft((current) => {
      if (!current) return current
      const blockedIds = new Set([...current.transferOnlyIn, ...current.eventOnlyIn])
      const nextObtainable = current.obtainableIn.filter((id) => !blockedIds.has(id))
      const removedCount = current.obtainableIn.length - nextObtainable.length
      setStatusMessage(
        removedCount > 0
          ? `Removed ${removedCount} non-obtainable games from Obtainable In.`
          : 'No non-obtainable games found in Obtainable In.',
      )
      return sanitizeAvailabilityState(
        {
          ...current,
          obtainableIn: nextObtainable,
        },
        gameIdOrder,
        validGameIds,
        debutIdOrder,
        validDebutIds,
      )
    })
  }

  function prefillTransferOnlyFromDiff() {
    setDraft((current) => {
      if (!current) return current
      const obtainableIdSet = new Set(current.obtainableIn)
      const eventOnlyIdSet = new Set(current.eventOnlyIn)
      const diff = sortStringsInGivenOrder(
        current.storableIn.filter((id) => !obtainableIdSet.has(id) && !eventOnlyIdSet.has(id)),
        gameIdOrder,
      )
      setStatusMessage(`Prefilled Transfer-only In with ${diff.length} games.`)
      return sanitizeAvailabilityState(
        {
          ...current,
          transferOnlyIn: diff,
        },
        gameIdOrder,
        validGameIds,
        debutIdOrder,
        validDebutIds,
      )
    })
  }

  function prefillStorableFromUnion() {
    if (selectedPokemon?.isBattleOnlyForm) {
      setStatusMessage('Prefill is disabled for battle-only forms.')
      return
    }

    setDraft((current) => {
      if (!current) return current
      const union = sortStringsInGivenOrder(
        Array.from(
          new Set([...current.obtainableIn, ...current.transferOnlyIn, ...current.eventOnlyIn]),
        ),
        gameIdOrder,
      )
      setStatusMessage(`Prefilled Storable In with ${union.length} games.`)
      return sanitizeAvailabilityState(
        {
          ...current,
          storableIn: union,
        },
        gameIdOrder,
        validGameIds,
        debutIdOrder,
        validDebutIds,
      )
    })
  }

  function availabilityTitle(label: string, count: number) {
    return count > 0 ? `${label} (${count})` : label
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Pokemon</h1>
        <p className="text-muted-foreground text-sm">
          Browse and search Pokemon sprites from the dataset.
        </p>
      </div>

      <div className="space-y-2">
        <Input
          type="search"
          placeholder="Search Pokemon..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search Pokemon"
        />
        <p className="text-muted-foreground text-xs">{filteredPokemon.length} results</p>
      </div>

      {selectedPokemon && draft ? (
        <Card ref={editorRef} className="border-border bg-card">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="border-border bg-background flex size-16 items-center justify-center rounded-xl border">
                  <img
                    src={pokemonSpriteUrl(selectedPokemon.nid)}
                    alt={selectedPokemon.name}
                    className="size-14 object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl">
                    {selectedPokemon.name || selectedPokemon.id}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    No. #{formatDexNum(selectedPokemon.dexNum)}
                  </p>
                </div>
              </div>

              <div className="w-full md:max-w-sm">
                <p className="mb-1.5 text-sm font-semibold">Debut In</p>
                <GameSelectorSingle
                  value={draft.debutIn}
                  onChange={(value) => updateAvailabilityField('debutIn', value)}
                  options={gameOptions}
                  mode="gamesets"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <AvailabilitySourceComparison
              key={selectedPokemon.id}
              pokemonId={selectedPokemon.id}
              pokemonName={selectedPokemon.name || selectedPokemon.id}
              games={gameOptions}
              draft={draft}
            />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-5">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {availabilityTitle('Obtainable In', draft.obtainableIn.length)}
                  </h3>
                  <GameSelectorMultiSortable
                    value={draft.obtainableIn}
                    onChange={(value) => updateAvailabilityField('obtainableIn', value)}
                    options={gameOptions}
                    mode="games"
                    allowAddAll
                    prefillLabel="Remove non-obtainable"
                    onPrefill={removeNonObtainableFromObtainable}
                    prefillDisabled={nonObtainableInObtainableCount === 0}
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {availabilityTitle('Transfer-only In', draft.transferOnlyIn.length)}
                  </h3>
                  <GameSelectorMultiSortable
                    value={draft.transferOnlyIn}
                    onChange={(value) => updateAvailabilityField('transferOnlyIn', value)}
                    options={gameOptions}
                    mode="games"
                    allowedIds={nonObtainableGameIds}
                    prefillLabel="Prefill"
                    onPrefill={prefillTransferOnlyFromDiff}
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {availabilityTitle('Event-only In', draft.eventOnlyIn.length)}
                  </h3>
                  <GameSelectorMultiSortable
                    value={draft.eventOnlyIn}
                    onChange={(value) => updateAvailabilityField('eventOnlyIn', value)}
                    options={gameOptions}
                    mode="games"
                    allowedIds={nonObtainableGameIds}
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {availabilityTitle('Storable In', draft.storableIn.length)}
                  </h3>
                  <GameSelectorMultiSortable
                    value={draft.storableIn}
                    onChange={(value) => updateAvailabilityField('storableIn', value)}
                    options={gameOptions}
                    mode="games"
                    allowedIds={storableAllowedGameIds}
                    allowAddAll
                    prefillLabel="Prefill"
                    prefillDisabled={selectedPokemon?.isBattleOnlyForm ?? true}
                    onPrefill={prefillStorableFromUnion}
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {availabilityTitle('Shiny-locked In', draft.shinyLockedIn.length)}
                  </h3>
                  <GameSelectorMultiSortable
                    value={draft.shinyLockedIn}
                    onChange={(value) => updateAvailabilityField('shinyLockedIn', value)}
                    options={gameOptions}
                    mode="games"
                  />
                </div>
              </div>
            </div>

            <div className="border-border grid gap-3 border-t pt-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <div className="flex w-full max-w-sm items-center sm:w-auto sm:min-w-80 sm:justify-self-start">
                <PokemonOptionCombobox
                  options={copySourceOptions}
                  value={copySourcePokemonId || null}
                  onSelect={(option) => setCopySourcePokemonId(option.id)}
                  placeholder="Select Pokemon"
                  searchPlaceholder="Search Pokemon to copy..."
                  emptyText="No Pokemon available."
                  disabled={copySourceOptions.length === 0}
                  triggerClassName="h-8 rounded-r-none border-r-0 truncate max-w-32"
                  contentClassName="max-h-80 min-w-72"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-l-none"
                  onClick={() => copyFromPokemonById(copySourcePokemonId)}
                  disabled={!copySourcePokemon}
                >
                  <ClipboardPasteIcon data-icon="inline-start" />
                  Import
                </Button>
              </div>

              <div className="flex items-center gap-2 sm:justify-self-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigatePokemon('prev')}
                  disabled={!previousPokemon}
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigatePokemon('next')}
                  disabled={!nextPokemon}
                >
                  Next
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </div>

              <div className="sm:justify-self-end">
                <Button
                  type="button"
                  onClick={() => saveAvailability()}
                  disabled={fetcher.state !== 'idle' || !isDirty || !draft.debutIn}
                >
                  Save
                </Button>
              </div>
            </div>

            {statusMessage ? (
              <p className="text-muted-foreground text-xs">{statusMessage}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {filteredPokemon.length > 0 ? (
        <ul
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}
        >
          {filteredPokemon.map((item) => (
            <li key={item.id} className="h-full">
              <button
                type="button"
                className="border-border bg-card hover:border-accent hover:bg-accent/50 flex h-full w-full flex-col rounded-2xl border p-3 text-center transition-colors"
                onClick={() => selectPokemon(item.id)}
              >
                <div className="flex h-24 items-center justify-center">
                  <img
                    src={pokemonSpriteUrl(item.nid)}
                    alt={item.name}
                    loading="lazy"
                    className="size-20 object-contain"
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-tight font-medium">
                  {item.name || item.id}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No Pokemon found for this search.</p>
      )}
    </section>
  )
}

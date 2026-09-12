import { CollapsibleSection } from '@/components/collapsible-section'
import { GameOptionCombobox } from '@/components/game-option-combobox'
import { PokemonSelectorMulti } from '@/components/pokemon-selector-multi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type AvailabilityKey,
  type GameAvailabilityState,
  cloneAvailabilityState,
  getAddableFemaleTransferOnlyPokemonIds,
  getMissingObtainablePokemonIds,
  getMissingTransferOnlyPokemonIds,
  getPrefilledTransferOnlyPokemonIds,
  getUnobtainablePokemonIds,
  normalizeGameAvailabilityState,
} from '@/lib/games-logic'
import {
  loadGameAvailabilityEditorData,
  saveGameAvailabilityFromForm,
} from '@/lib/games-logic.server'
import { sortStringsInGivenOrder } from '@pokepc/dataset/lib/utils'
import { ClipboardPasteIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useFetcher } from 'react-router'

export function meta() {
  return [
    { title: 'Game Availability | PokePC Dataset Editor' },
    { name: 'description', content: 'Edit Pokemon availability for a single game.' },
  ]
}

export async function loader({ params }: { params: { id?: string } }) {
  return loadGameAvailabilityEditorData(params.id)
}

export async function action({ request, params }: { request: Request; params: { id?: string } }) {
  return saveGameAvailabilityFromForm(request, params)
}

export default function GameAvailabilityEditorPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>
}) {
  const {
    game,
    pokemonOptions,
    allowedPokemonIdsForGame,
    battleOnlyPokemonIdsForGame,
    femaleFormByPokemonId,
    pokemonOrder,
    initialAvailability,
    gameOptions,
    availabilityByGameId,
  } = loaderData
  const fetcher = useFetcher<typeof action>()

  const [draft, setDraft] = useState<GameAvailabilityState>(initialAvailability)
  const [baseline, setBaseline] = useState<GameAvailabilityState>(initialAvailability)
  const [copySourceGameId, setCopySourceGameId] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [showBattleOnlyStorablePokemon, setShowBattleOnlyStorablePokemon] = useState(false)
  const initialUnobtainablePokemonIds = useMemo(
    () => getUnobtainablePokemonIds(initialAvailability, pokemonOrder, allowedPokemonIdsForGame),
    [initialAvailability, pokemonOrder, allowedPokemonIdsForGame],
  )
  const [unobtainablePokemonIds, setUnobtainablePokemonIds] = useState<string[]>(
    initialUnobtainablePokemonIds,
  )
  const [isUnobtainableLocked, setIsUnobtainableLocked] = useState(false)

  const validPokemonIds = useMemo(() => new Set(pokemonOrder), [pokemonOrder])
  const allowedPokemonIdsForGameSet = useMemo(
    () => new Set(allowedPokemonIdsForGame),
    [allowedPokemonIdsForGame],
  )
  const battleOnlyPokemonIdsForGameSet = useMemo(
    () => new Set(battleOnlyPokemonIdsForGame),
    [battleOnlyPokemonIdsForGame],
  )
  const copySourceOptions = useMemo(
    () => gameOptions.filter((option) => option.id !== game.id),
    [gameOptions, game.id],
  )
  const copySourceGame = useMemo(
    () => copySourceOptions.find((option) => option.id === copySourceGameId) ?? null,
    [copySourceOptions, copySourceGameId],
  )
  const nonObtainableInObtainableCount = useMemo(() => {
    const blockedIds = new Set([...draft.transferOnlyPokemon, ...draft.eventOnlyPokemon])
    return draft.obtainablePokemon.filter((id) => blockedIds.has(id)).length
  }, [draft])
  const activeUnobtainableExclusionIds = useMemo(
    () => (isUnobtainableLocked ? unobtainablePokemonIds : []),
    [isUnobtainableLocked, unobtainablePokemonIds],
  )
  const obtainableExcludedIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...draft.transferOnlyPokemon,
          ...draft.eventOnlyPokemon,
          ...activeUnobtainableExclusionIds,
        ]),
      ),
    [draft.transferOnlyPokemon, draft.eventOnlyPokemon, activeUnobtainableExclusionIds],
  )
  const transferOnlyExcludedIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...draft.obtainablePokemon,
          ...draft.eventOnlyPokemon,
          ...activeUnobtainableExclusionIds,
        ]),
      ),
    [draft.obtainablePokemon, draft.eventOnlyPokemon, activeUnobtainableExclusionIds],
  )
  const eventOnlyExcludedIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...draft.obtainablePokemon,
          ...draft.transferOnlyPokemon,
          ...(isUnobtainableLocked ? unobtainablePokemonIds : []),
        ]),
      ),
    [
      draft.obtainablePokemon,
      draft.transferOnlyPokemon,
      isUnobtainableLocked,
      unobtainablePokemonIds,
    ],
  )
  const missingObtainablePokemonIds = useMemo(
    () =>
      getMissingObtainablePokemonIds(
        draft,
        pokemonOrder,
        allowedPokemonIdsForGame,
        activeUnobtainableExclusionIds,
      ),
    [draft, pokemonOrder, allowedPokemonIdsForGame, activeUnobtainableExclusionIds],
  )
  const addableFemaleTransferOnlyPokemonIds = useMemo(
    () =>
      getAddableFemaleTransferOnlyPokemonIds(
        draft,
        pokemonOrder,
        femaleFormByPokemonId,
        allowedPokemonIdsForGame,
        battleOnlyPokemonIdsForGame,
        activeUnobtainableExclusionIds,
      ),
    [
      draft,
      pokemonOrder,
      femaleFormByPokemonId,
      allowedPokemonIdsForGame,
      battleOnlyPokemonIdsForGame,
      activeUnobtainableExclusionIds,
    ],
  )
  const missingTransferOnlyPokemonIds = useMemo(
    () =>
      getMissingTransferOnlyPokemonIds(
        draft,
        pokemonOrder,
        allowedPokemonIdsForGame,
        battleOnlyPokemonIdsForGame,
        activeUnobtainableExclusionIds,
      ),
    [
      draft,
      pokemonOrder,
      allowedPokemonIdsForGame,
      battleOnlyPokemonIdsForGame,
      activeUnobtainableExclusionIds,
    ],
  )
  const storablePokemonOptions = useMemo(
    () =>
      showBattleOnlyStorablePokemon
        ? pokemonOptions.filter((option) => battleOnlyPokemonIdsForGameSet.has(option.id))
        : pokemonOptions,
    [showBattleOnlyStorablePokemon, pokemonOptions, battleOnlyPokemonIdsForGameSet],
  )
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  )

  useEffect(() => {
    setDraft(initialAvailability)
    setBaseline(initialAvailability)
    setCopySourceGameId('')
    setShowBattleOnlyStorablePokemon(false)
    setUnobtainablePokemonIds(initialUnobtainablePokemonIds)
    setIsUnobtainableLocked(false)
    setStatusMessage(null)
  }, [game.id, initialAvailability, initialUnobtainablePokemonIds])

  useEffect(() => {
    if (copySourceOptions.length === 0) {
      if (copySourceGameId) {
        setCopySourceGameId('')
      }
      return
    }
    if (copySourceOptions.some((option) => option.id === copySourceGameId)) {
      return
    }
    setCopySourceGameId(copySourceOptions[0]?.id ?? '')
  }, [copySourceGameId, copySourceOptions])

  useEffect(() => {
    if (!fetcher.data) return
    if (fetcher.data.success !== true) {
      setStatusMessage(fetcher.data.error)
      return
    }

    if (fetcher.data.availability) {
      setDraft(fetcher.data.availability)
      setBaseline(fetcher.data.availability)
      setStatusMessage('Game availability saved.')
    }
  }, [fetcher.data])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function updateSection(key: AvailabilityKey, nextIds: string[]) {
    setDraft((current) =>
      normalizeGameAvailabilityState(
        {
          ...current,
          [key]: nextIds,
        },
        pokemonOrder,
        validPokemonIds,
      ),
    )
    setStatusMessage(null)
  }

  function updateUnobtainablePokemon(nextIds: string[]) {
    setUnobtainablePokemonIds(
      sortStringsInGivenOrder(
        [...new Set(nextIds)].filter(
          (id): id is string => validPokemonIds.has(id) && allowedPokemonIdsForGameSet.has(id),
        ),
        pokemonOrder,
      ),
    )
    setStatusMessage(null)
  }

  function prefillTransferOnlyFromDiff() {
    setDraft((current) => {
      const diff = getPrefilledTransferOnlyPokemonIds(
        current,
        pokemonOrder,
        battleOnlyPokemonIdsForGame,
        activeUnobtainableExclusionIds,
      )
      setStatusMessage(`Prefilled Transfer-only Pokemon with ${diff.length} Pokemon.`)
      return normalizeGameAvailabilityState(
        {
          ...current,
          transferOnlyPokemon: diff,
        },
        pokemonOrder,
        validPokemonIds,
      )
    })
  }

  function prefillUnobtainablePokemon() {
    const nextUnobtainablePokemonIds = getUnobtainablePokemonIds(
      draft,
      pokemonOrder,
      allowedPokemonIdsForGame,
    )
    setUnobtainablePokemonIds(nextUnobtainablePokemonIds)
    setStatusMessage(
      `Prefilled Unobtainable Pokemon with ${nextUnobtainablePokemonIds.length} Pokemon.`,
    )
  }

  function toggleUnobtainableLock() {
    setIsUnobtainableLocked((current) => {
      const next = !current
      setStatusMessage(
        next
          ? `Locked ${unobtainablePokemonIds.length} unobtainable Pokemon in memory. They are now excluded from other selectors and bulk add/prefill actions.`
          : 'Unlocked unobtainable exclusions. The list remains visible but no longer filters other sections.',
      )
      return next
    })
  }

  function prefillStorableFromUnion() {
    setDraft((current) => {
      const union = sortStringsInGivenOrder(
        Array.from(
          new Set([
            ...current.obtainablePokemon,
            ...current.transferOnlyPokemon,
            ...current.eventOnlyPokemon,
          ]),
        ).filter((id) => !battleOnlyPokemonIdsForGameSet.has(id)),
        pokemonOrder,
      )
      setStatusMessage(`Prefilled Storable Pokemon with ${union.length} Pokemon.`)
      return normalizeGameAvailabilityState(
        {
          ...current,
          storablePokemon: union,
        },
        pokemonOrder,
        validPokemonIds,
      )
    })
  }

  function removeNonObtainableFromObtainable() {
    setDraft((current) => {
      const blockedIds = new Set([...current.transferOnlyPokemon, ...current.eventOnlyPokemon])
      const nextObtainable = current.obtainablePokemon.filter((id) => !blockedIds.has(id))
      const removedCount = current.obtainablePokemon.length - nextObtainable.length
      setStatusMessage(
        removedCount > 0
          ? `Removed ${removedCount} non-obtainable Pokemon from Obtainable Pokemon.`
          : 'No non-obtainable Pokemon found in Obtainable Pokemon.',
      )
      return normalizeGameAvailabilityState(
        {
          ...current,
          obtainablePokemon: nextObtainable,
        },
        pokemonOrder,
        validPokemonIds,
      )
    })
  }

  function addMissingObtainablePokemon() {
    setDraft((current) => {
      const missingPokemonIds = getMissingObtainablePokemonIds(
        current,
        pokemonOrder,
        allowedPokemonIdsForGame,
        activeUnobtainableExclusionIds,
      )
      const nextObtainable = sortStringsInGivenOrder(
        [...current.obtainablePokemon, ...missingPokemonIds],
        pokemonOrder,
      )
      setStatusMessage(
        missingPokemonIds.length > 0
          ? `Added ${missingPokemonIds.length} missing Pokemon to Obtainable Pokemon: ${missingPokemonIds.join(', ')}.`
          : 'No missing Pokemon to add to Obtainable Pokemon.',
      )
      return normalizeGameAvailabilityState(
        {
          ...current,
          obtainablePokemon: nextObtainable,
        },
        pokemonOrder,
        validPokemonIds,
      )
    })
  }

  function addFemaleTransferOnlyPokemon() {
    setDraft((current) => {
      const femalePokemonIdsToAdd = getAddableFemaleTransferOnlyPokemonIds(
        current,
        pokemonOrder,
        femaleFormByPokemonId,
        allowedPokemonIdsForGame,
        battleOnlyPokemonIdsForGame,
        activeUnobtainableExclusionIds,
      )
      const nextTransferOnly = sortStringsInGivenOrder(
        [...current.transferOnlyPokemon, ...femalePokemonIdsToAdd],
        pokemonOrder,
      )
      setStatusMessage(
        femalePokemonIdsToAdd.length > 0
          ? `Added ${femalePokemonIdsToAdd.length} female forms to Transfer-only Pokemon: ${femalePokemonIdsToAdd.join(', ')}.`
          : 'No female forms to add to Transfer-only Pokemon.',
      )
      return normalizeGameAvailabilityState(
        {
          ...current,
          transferOnlyPokemon: nextTransferOnly,
        },
        pokemonOrder,
        validPokemonIds,
      )
    })
  }

  function addMissingTransferOnlyPokemon() {
    setDraft((current) => {
      const missingPokemonIds = getMissingTransferOnlyPokemonIds(
        current,
        pokemonOrder,
        allowedPokemonIdsForGame,
        battleOnlyPokemonIdsForGame,
        activeUnobtainableExclusionIds,
      )
      const nextTransferOnly = sortStringsInGivenOrder(
        [...current.transferOnlyPokemon, ...missingPokemonIds],
        pokemonOrder,
      )
      setStatusMessage(
        missingPokemonIds.length > 0
          ? `Added ${missingPokemonIds.length} missing Pokemon to Transfer-only Pokemon: ${missingPokemonIds.join(', ')}.`
          : 'No missing Pokemon to add to Transfer-only Pokemon.',
      )
      return normalizeGameAvailabilityState(
        {
          ...current,
          transferOnlyPokemon: nextTransferOnly,
        },
        pokemonOrder,
        validPokemonIds,
      )
    })
  }

  function copyFromGameById(sourceGameId: string) {
    if (!sourceGameId) return
    const sourceAvailability = availabilityByGameId[sourceGameId]
    if (!sourceAvailability) return
    setDraft(cloneAvailabilityState(sourceAvailability))
    const sourceLabel =
      copySourceOptions.find((option) => option.id === sourceGameId)?.label ?? sourceGameId
    setStatusMessage(`Copied availability from ${sourceLabel}.`)
  }

  function saveAvailability() {
    fetcher.submit(
      {
        intent: 'save-game-availability',
        gameId: game.id,
        draft: JSON.stringify(draft),
        baseline: JSON.stringify(baseline),
      },
      { method: 'post' },
    )
  }

  function sectionTitle(label: string, count: number) {
    return count > 0 ? `${label} (${count})` : label
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Games</h1>
          <Button variant="outline" size="sm" render={<Link to="/games" />} nativeButton={false}>
            Back to Games
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Edit Pokemon availability lists for{' '}
          <span className="text-foreground font-medium">{game.label}</span>.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-16 items-center justify-center">
              <img
                src={game.image}
                alt={game.label}
                className="border-border size-14 rounded-sm border object-contain"
              />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">{game.label}</CardTitle>
              <p className="text-muted-foreground text-xs">
                Edit Pokemon availability from this game&apos;s view.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-5">
            <CollapsibleSection
              title={sectionTitle('🐣 Debuted in this game', draft.debutedPokemon.length)}
            >
              <PokemonSelectorMulti
                value={draft.debutedPokemon}
                onChange={(value) => updateSection('debutedPokemon', value)}
                options={pokemonOptions}
                allowedIds={allowedPokemonIdsForGame}
                excludedIds={activeUnobtainableExclusionIds}
                emptyText="No Pokemon debut in this game."
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={sectionTitle('🧢 Obtainable Pokemon', draft.obtainablePokemon.length)}
              buttonClassName="text-blue-400 hover:text-blue-500"
            >
              <PokemonSelectorMulti
                value={draft.obtainablePokemon}
                onChange={(value) => updateSection('obtainablePokemon', value)}
                options={pokemonOptions}
                allowedIds={allowedPokemonIdsForGame}
                excludedIds={obtainableExcludedIds}
                emptyText="No obtainable Pokemon in this game."
                prefillLabel="Remove non-obtainable"
                onPrefill={removeNonObtainableFromObtainable}
                prefillDisabled={nonObtainableInObtainableCount === 0}
                secondaryActionLabel="Add missing"
                onSecondaryAction={addMissingObtainablePokemon}
                secondaryActionDisabled={missingObtainablePokemonIds.length === 0}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={sectionTitle('📦 Storable Pokemon', draft.storablePokemon.length)}
              buttonClassName="text-orange-400 hover:text-orange-500"
            >
              <div className="space-y-2">
                <label className="text-muted-foreground flex w-fit items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showBattleOnlyStorablePokemon}
                    onChange={(event) => setShowBattleOnlyStorablePokemon(event.target.checked)}
                    className="border-input bg-background size-4 rounded border"
                  />
                  <span>Show Battle-Only Forms</span>
                </label>
                <PokemonSelectorMulti
                  value={draft.storablePokemon}
                  onChange={(value) => updateSection('storablePokemon', value)}
                  options={storablePokemonOptions}
                  allowedIds={allowedPokemonIdsForGame}
                  excludedIds={activeUnobtainableExclusionIds}
                  emptyText={
                    showBattleOnlyStorablePokemon
                      ? 'No battle-only storable Pokemon shown for this game.'
                      : 'No storable Pokemon in this game.'
                  }
                  prefillLabel="Prefill"
                  onPrefill={prefillStorableFromUnion}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={sectionTitle('🚛 Transfer-only Pokemon', draft.transferOnlyPokemon.length)}
              buttonClassName="text-emerald-400 hover:text-emerald-500"
            >
              <PokemonSelectorMulti
                value={draft.transferOnlyPokemon}
                onChange={(value) => updateSection('transferOnlyPokemon', value)}
                options={pokemonOptions}
                allowedIds={allowedPokemonIdsForGame}
                excludedIds={transferOnlyExcludedIds}
                emptyText="No transfer-only Pokemon in this game."
                prefillLabel="Prefill"
                onPrefill={prefillTransferOnlyFromDiff}
                secondaryActionLabel="Add females"
                onSecondaryAction={addFemaleTransferOnlyPokemon}
                secondaryActionDisabled={addableFemaleTransferOnlyPokemonIds.length === 0}
                tertiaryActionLabel="Add missing"
                onTertiaryAction={addMissingTransferOnlyPokemon}
                tertiaryActionDisabled={missingTransferOnlyPokemonIds.length === 0}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={sectionTitle('📅 Event-only Pokemon', draft.eventOnlyPokemon.length)}
              buttonClassName="text-red-400 hover:text-red-500"
            >
              <PokemonSelectorMulti
                value={draft.eventOnlyPokemon}
                onChange={(value) => updateSection('eventOnlyPokemon', value)}
                options={pokemonOptions}
                allowedIds={allowedPokemonIdsForGame}
                excludedIds={eventOnlyExcludedIds}
                emptyText="No event-only Pokemon in this game."
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={`${sectionTitle('🚫 Unobtainable Pokemon', unobtainablePokemonIds.length)} ${isUnobtainableLocked ? '[Locked]' : '[Unlocked]'}`}
              buttonClassName="text-slate-400 hover:text-slate-500"
            >
              <div className="space-y-2">
                <PokemonSelectorMulti
                  value={unobtainablePokemonIds}
                  onChange={updateUnobtainablePokemon}
                  options={pokemonOptions}
                  allowedIds={allowedPokemonIdsForGame}
                  emptyText="No unobtainable Pokemon in this game."
                  prefillLabel="Prefill"
                  onPrefill={prefillUnobtainablePokemon}
                  secondaryActionLabel={isUnobtainableLocked ? 'Unlock' : 'Lock'}
                  onSecondaryAction={toggleUnobtainableLock}
                  secondaryActionDisabled={
                    !isUnobtainableLocked && unobtainablePokemonIds.length === 0
                  }
                />
                <p className="text-muted-foreground text-xs">
                  {isUnobtainableLocked
                    ? 'Locked in memory. This list is excluded from other selectors and bulk add/prefill actions.'
                    : 'Unlocked. This list stays visible and editable, but it is not filtering the other sections.'}
                </p>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={sectionTitle('✨ Shiny-locked Pokemon', draft.shinyLockedPokemon.length)}
              buttonClassName="text-yellow-400 hover:text-yellow-500"
            >
              <PokemonSelectorMulti
                value={draft.shinyLockedPokemon}
                onChange={(value) => updateSection('shinyLockedPokemon', value)}
                options={pokemonOptions}
                allowedIds={allowedPokemonIdsForGame}
                excludedIds={activeUnobtainableExclusionIds}
                emptyText="No shiny-locked Pokemon in this game."
              />
            </CollapsibleSection>
          </div>

          <div className="border-border grid gap-3 border-t pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex w-full max-w-sm items-center sm:w-auto sm:min-w-80 sm:justify-self-start">
              <GameOptionCombobox
                options={copySourceOptions}
                value={copySourceGameId || null}
                onSelect={(option) => setCopySourceGameId(option.id)}
                placeholder="Select game"
                searchPlaceholder="Search game to copy..."
                emptyText="No games available."
                disabled={copySourceOptions.length === 0}
                triggerClassName="h-8 rounded-r-none border-r-0 truncate max-w-40"
                contentClassName="max-h-80 min-w-72"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-l-none"
                onClick={() => copyFromGameById(copySourceGameId)}
                disabled={!copySourceGame}
              >
                <ClipboardPasteIcon data-icon="inline-start" />
                Import
              </Button>
            </div>

            <div className="sm:justify-self-end">
              <Button
                type="button"
                onClick={saveAvailability}
                disabled={fetcher.state !== 'idle' || !isDirty}
              >
                Save
              </Button>
            </div>
          </div>

          {statusMessage ? <p className="text-muted-foreground text-xs">{statusMessage}</p> : null}
        </CardContent>
      </Card>
    </section>
  )
}

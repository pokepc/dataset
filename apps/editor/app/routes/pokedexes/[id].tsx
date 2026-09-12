import { PokedexBatchAddPanel } from '@/components/pokedex-batch-add-panel'
import { PokedexEntryEditorList } from '@/components/pokedex-entry-editor-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  addMissingFormsToEntries,
  applyPokemonIsFormFlagsToEntries,
  applyNationalDexNumsToEntries,
  addPokemonToBatchAddQueue,
  appendPokedexEntries,
  appendPokedexEntry,
  BATCH_ADD_MODE_BELOW,
  BATCH_ADD_MODE_BOTTOM,
  createPokedexEntryDraft,
  createBatchAddDraft,
  createBatchAddEntryDrafts,
  getBatchAddPreviewEntries,
  hasPokedexDraftValidationErrors,
  insertPokedexEntryBelow,
  insertPokedexEntriesBelow,
  normalizePokedexDraft,
  removePokedexEntry,
  removePokemonFromBatchAddQueue,
  reorderPokedexEntries,
  syncBatchAddDraftDefaults,
  toPokedexDraft,
  validateBatchAddDraft,
  validatePokedexDraft,
  type BatchAddDraft,
  type PokedexDraft,
  type PokedexEntryDraft,
} from '@/lib/pokedex-logic'
import { loadPokedexEditorData, savePokedexFromForm } from '@/lib/pokedex-logic.server'
import { sanitizeSearchQuery } from '@pokepc/dataset/lib/search'
import { matchesSearchQuery } from '@pokepc/dataset/lib/search'
import { Link, useFetcher } from 'react-router'
import { HashIcon, Layers3Icon, SaveIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const NONE_OPTION_VALUE = '__none__'

export function meta() {
  return [
    { title: 'Pokedex Editor | PokePC Dataset Editor' },
    { name: 'description', content: 'Edit an existing Pokédex and its entries.' },
  ]
}

export async function loader({ params }: { params: { id?: string } }) {
  return loadPokedexEditorData(params.id)
}

export async function action({ request, params }: { request: Request; params: { id?: string } }) {
  return savePokedexFromForm(request, params)
}

export default function PokedexEditorPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>
}) {
  const {
    pokedex,
    initialDraft,
    pokemonOptions,
    nationalDexNumByPokemonId,
    isFormByPokemonId,
    formsByPokemonId,
    regionOptions,
    baseDexOptions,
  } = loaderData
  const fetcher = useFetcher<typeof action>()
  const [draft, setDraft] = useState<PokedexDraft>(initialDraft)
  const [baseline, setBaseline] = useState<PokedexDraft>(initialDraft)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [editingEntryIds, setEditingEntryIds] = useState<Set<string>>(new Set())
  const [batchAddDraft, setBatchAddDraft] = useState<BatchAddDraft>(() => createBatchAddDraft())
  const [entryFilterQuery, setEntryFilterQuery] = useState('')
  const nextEntryIdRef = useRef(initialDraft.entries.length)

  const pokemonOptionById = useMemo(
    () => new Map(pokemonOptions.map((option) => [option.id, option])),
    [pokemonOptions],
  )
  const validPokemonIds = useMemo(
    () => new Set(pokemonOptions.map((option) => option.id)),
    [pokemonOptions],
  )
  const validRegionIds = useMemo(
    () => new Set(regionOptions.map((option) => option.id)),
    [regionOptions],
  )
  const validBaseDexIds = useMemo(
    () => new Set(baseDexOptions.map((option) => option.id)),
    [baseDexOptions],
  )
  const validation = useMemo(
    () => validatePokedexDraft(draft, validPokemonIds, validRegionIds, validBaseDexIds),
    [draft, validPokemonIds, validRegionIds, validBaseDexIds],
  )
  const hasValidationErrors = useMemo(
    () => hasPokedexDraftValidationErrors(validation),
    [validation],
  )
  const batchAddValidation = useMemo(
    () => validateBatchAddDraft(batchAddDraft, draft.entries),
    [batchAddDraft, draft.entries],
  )
  const batchPreviewEntries = useMemo(
    () => getBatchAddPreviewEntries(batchAddDraft),
    [batchAddDraft],
  )
  const anchorOptions = useMemo(
    () =>
      draft.entries.map((entry, index) => {
        const pokemon = pokemonOptionById.get(entry.pid)
        const dexNumLabel = entry.dexNum || 'Unset'
        const pokemonLabel = pokemon?.label ?? entry.pid ?? 'Unset Pokemon'

        return {
          clientId: entry.clientId,
          label: `#${index + 1} · Dex ${dexNumLabel} · ${pokemonLabel}`,
        }
      }),
    [draft.entries, pokemonOptionById],
  )
  const filteredEntryItems = useMemo(() => {
    if (entryFilterQuery.trim().length === 0) {
      return draft.entries.map((entry, index) => ({ entry, actualIndex: index }))
    }

    return draft.entries
      .map((entry, index) => ({ entry, actualIndex: index }))
      .filter(({ entry }) => {
        const pokemon = pokemonOptionById.get(entry.pid)
        const searchableText = pokemon?.searchableText ?? sanitizeSearchQuery(entry.pid)
        const extraText = sanitizeSearchQuery(
          [entry.pid, entry.dexNum, entry.isForm ? 'form' : 'not form'].filter(Boolean).join(' '),
        )
        const haystack = `${searchableText} ${extraText}`.trim()

        return matchesSearchQuery(haystack, entryFilterQuery)
      })
  }, [draft.entries, entryFilterQuery, pokemonOptionById])
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  )

  useEffect(() => {
    setDraft(initialDraft)
    setBaseline(initialDraft)
    setEditingEntryIds(new Set())
    setBatchAddDraft(createBatchAddDraft())
    setEntryFilterQuery('')
    nextEntryIdRef.current = initialDraft.entries.length
    setStatusMessage(null)
  }, [initialDraft])

  useEffect(() => {
    if (!fetcher.data) return
    if (fetcher.data.success !== true) {
      setStatusMessage(fetcher.data.error)
      return
    }

    const nextDraft = toPokedexDraft(fetcher.data.pokedex)
    setDraft(nextDraft)
    setBaseline(nextDraft)
    setEditingEntryIds(new Set())
    setBatchAddDraft(createBatchAddDraft())
    setEntryFilterQuery('')
    nextEntryIdRef.current = nextDraft.entries.length
    setStatusMessage('Pokedex saved.')
  }, [fetcher.data])

  useEffect(() => {
    setBatchAddDraft((current) => syncBatchAddDraftDefaults(current, draft.entries))
  }, [draft.entries])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function nextEntryClientId() {
    nextEntryIdRef.current += 1
    return `${draft.id}-new-entry-${nextEntryIdRef.current}`
  }

  function createBlankEntry(): PokedexEntryDraft {
    return createPokedexEntryDraft(nextEntryClientId())
  }

  function updateBatchAddDraft(updater: (current: BatchAddDraft) => BatchAddDraft) {
    setBatchAddDraft((current) => syncBatchAddDraftDefaults(updater(current), draft.entries))
    setStatusMessage(null)
  }

  function updateDraft<K extends keyof PokedexDraft>(key: K, value: PokedexDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setStatusMessage(null)
  }

  function updateEntry(clientId: string, patch: Partial<PokedexEntryDraft>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.clientId === clientId ? { ...entry, ...patch } : entry,
      ),
    }))
    setStatusMessage(null)
  }

  function addEntryBelow(clientId: string) {
    const nextEntry = createBlankEntry()
    setDraft((current) => ({
      ...current,
      entries: insertPokedexEntryBelow(current.entries, clientId, nextEntry),
    }))
    setEditingEntryIds((current) => new Set(current).add(nextEntry.clientId))
    setStatusMessage(null)
  }

  function addEntryBottom() {
    const nextEntry = createBlankEntry()
    setDraft((current) => ({
      ...current,
      entries: appendPokedexEntry(current.entries, nextEntry),
    }))
    setEditingEntryIds((current) => new Set(current).add(nextEntry.clientId))
    setStatusMessage(null)
  }

  function removeEntry(clientId: string) {
    setDraft((current) => ({
      ...current,
      entries: removePokedexEntry(current.entries, clientId),
    }))
    setEditingEntryIds((current) => {
      const next = new Set(current)
      next.delete(clientId)
      return next
    })
    setStatusMessage(null)
  }

  function toggleEntryEdit(clientId: string) {
    setEditingEntryIds((current) => {
      const next = new Set(current)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  function reorderEntries(sourceIndex: number, targetIndex: number) {
    setDraft((current) => ({
      ...current,
      entries: reorderPokedexEntries(current.entries, sourceIndex, targetIndex),
    }))
    setStatusMessage(null)
  }

  function useNationalDexNums() {
    setDraft((current) => {
      const nextEntries = applyNationalDexNumsToEntries(current.entries, nationalDexNumByPokemonId)
      const updatedCount = nextEntries.reduce(
        (count, entry, index) => count + (entry.dexNum !== current.entries[index]?.dexNum ? 1 : 0),
        0,
      )

      setStatusMessage(
        updatedCount > 0
          ? `Updated ${updatedCount} entr${updatedCount === 1 ? 'y' : 'ies'} to their National Dex numbers.`
          : 'All rows already match their National Dex numbers.',
      )

      return {
        ...current,
        entries: nextEntries,
      }
    })
  }

  function usePokemonFormFlags() {
    setDraft((current) => {
      const nextEntries = applyPokemonIsFormFlagsToEntries(current.entries, isFormByPokemonId)
      const updatedCount = nextEntries.reduce(
        (count, entry, index) => count + (entry.isForm !== current.entries[index]?.isForm ? 1 : 0),
        0,
      )

      setStatusMessage(
        updatedCount > 0
          ? `Updated ${updatedCount} entr${updatedCount === 1 ? 'y' : 'ies'} to their Pokemon form flags.`
          : 'All rows already match their Pokemon form flags.',
      )

      return {
        ...current,
        entries: nextEntries,
      }
    })
  }

  function addForms() {
    setDraft((current) => {
      const nextEntries = addMissingFormsToEntries(
        current.entries,
        formsByPokemonId,
        nextEntryClientId,
      )
      const addedCount = nextEntries.length - current.entries.length

      setStatusMessage(
        addedCount > 0
          ? `Added ${addedCount} missing form entr${addedCount === 1 ? 'y' : 'ies'}.`
          : 'No missing forms to add.',
      )

      return {
        ...current,
        entries: nextEntries,
      }
    })
  }

  function openBatchAddAtBottom() {
    setBatchAddDraft(() =>
      syncBatchAddDraftDefaults(
        createBatchAddDraft({
          open: true,
          insertMode: BATCH_ADD_MODE_BOTTOM,
        }),
        draft.entries,
      ),
    )
    setStatusMessage(null)
  }

  function openBatchAddBelow(clientId: string) {
    setBatchAddDraft(() =>
      syncBatchAddDraftDefaults(
        createBatchAddDraft({
          open: true,
          insertMode: BATCH_ADD_MODE_BELOW,
          anchorClientId: clientId,
        }),
        draft.entries,
      ),
    )
    setStatusMessage(null)
  }

  function closeBatchAdd() {
    setBatchAddDraft(createBatchAddDraft())
    setStatusMessage(null)
  }

  function insertBatchEntries() {
    const nextValidation = validateBatchAddDraft(batchAddDraft, draft.entries)
    if (Object.keys(nextValidation).length > 0) {
      setStatusMessage('Please fix the batch add fields before inserting.')
      return
    }

    const nextEntries = createBatchAddEntryDrafts(batchAddDraft, nextEntryClientId)
    setDraft((current) => ({
      ...current,
      entries:
        batchAddDraft.insertMode === BATCH_ADD_MODE_BELOW
          ? insertPokedexEntriesBelow(current.entries, batchAddDraft.anchorClientId, nextEntries)
          : appendPokedexEntries(current.entries, nextEntries),
    }))
    setBatchAddDraft(createBatchAddDraft())
    setStatusMessage(
      `Inserted ${nextEntries.length} batch entr${nextEntries.length === 1 ? 'y' : 'ies'} into the draft.`,
    )
  }

  function saveDraft() {
    if (hasValidationErrors) {
      setStatusMessage('Please fix the highlighted fields before saving.')
      return
    }

    const normalizedDraft = normalizePokedexDraft(draft)
    fetcher.submit(
      {
        intent: 'save-pokedex',
        pokedexId: pokedex.id,
        draft: JSON.stringify({
          ...draft,
          id: normalizedDraft.id,
        }),
      },
      { method: 'post' },
    )
  }

  return (
    <section className="space-y-6 pb-28">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Pokedexes</h1>
          <Button
            variant="outline"
            size="sm"
            render={<Link to="/pokedexes" />}
            nativeButton={false}
          >
            Back to Pokedexes
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Edit Pokédex data for <span className="text-foreground font-medium">{pokedex.name}</span>.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">{pokedex.name}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="dex-id">ID</Label>
              <Input id="dex-id" value={draft.id} readOnly disabled />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dex-name">Name</Label>
              <Input
                id="dex-name"
                value={draft.name}
                onChange={(event) => updateDraft('name', event.target.value)}
                aria-invalid={validation.generalErrors.name ? true : undefined}
              />
              <p className="text-destructive min-h-4 text-xs">
                {validation.generalErrors.name ?? ''}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dex-short-desc">Short Description</Label>
              <Input
                id="dex-short-desc"
                value={draft.shortDesc}
                onChange={(event) => updateDraft('shortDesc', event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dex-gen">Generation</Label>
              <Input
                id="dex-gen"
                type="number"
                min={0}
                value={draft.gen}
                onChange={(event) => updateDraft('gen', event.target.value)}
                aria-invalid={validation.generalErrors.gen ? true : undefined}
              />
              <p className="text-destructive min-h-4 text-xs">
                {validation.generalErrors.gen ?? ''}
              </p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="dex-desc">Description</Label>
              <Textarea
                id="dex-desc"
                value={draft.desc}
                onChange={(event) => updateDraft('desc', event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Region</Label>
              <Select
                value={draft.region || NONE_OPTION_VALUE}
                onValueChange={(value) =>
                  updateDraft('region', !value || value === NONE_OPTION_VALUE ? '' : value)
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION_VALUE}>None</SelectItem>
                  {regionOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-destructive min-h-4 text-xs">
                {validation.generalErrors.region ?? ''}
              </p>
            </div>

            <div className="space-y-1">
              <Label>Base Dex</Label>
              <Select
                value={draft.baseDex || NONE_OPTION_VALUE}
                onValueChange={(value) =>
                  updateDraft('baseDex', !value || value === NONE_OPTION_VALUE ? '' : value)
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION_VALUE}>None</SelectItem>
                  {baseDexOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-destructive min-h-4 text-xs">
                {validation.generalErrors.baseDex ?? ''}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dex-pkapiid">pkApiId</Label>
              <Input
                id="dex-pkapiid"
                value={draft.pkApiId}
                onChange={(event) => updateDraft('pkApiId', event.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 pt-7 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.isNational}
                onChange={(event) => updateDraft('isNational', event.target.checked)}
                className="border-input bg-background size-4 rounded border"
              />
              <span>National Dex</span>
            </label>
          </div>

          <div className="border-border space-y-3 border-t pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  Entries ({draft.entries.length})
                </h2>
                <p className="text-muted-foreground text-sm">
                  Drag rows by the handle to reorder them. All edits stay in memory until you save.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={useNationalDexNums}
                  disabled={fetcher.state !== 'idle' || draft.entries.length === 0}
                >
                  <HashIcon data-icon="inline-start" />
                  Use National Dex Nums
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={usePokemonFormFlags}
                  disabled={fetcher.state !== 'idle' || draft.entries.length === 0}
                >
                  Use Pokemon Form Flags
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addForms}
                  disabled={fetcher.state !== 'idle' || draft.entries.length === 0}
                >
                  Add Forms
                </Button>

                <Button
                  type="button"
                  variant={batchAddDraft.open ? 'secondary' : 'outline'}
                  onClick={batchAddDraft.open ? closeBatchAdd : openBatchAddAtBottom}
                  disabled={fetcher.state !== 'idle'}
                >
                  <Layers3Icon data-icon="inline-start" />
                  {batchAddDraft.open ? 'Close Batch Add' : 'Batch Add'}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="entry-filter-query">Filter Visible Entries</Label>
              <Input
                id="entry-filter-query"
                value={entryFilterQuery}
                onChange={(event) => setEntryFilterQuery(event.target.value)}
                placeholder="Search by Pokemon name, id, Dex Num, or form..."
                disabled={fetcher.state !== 'idle'}
              />
              <p className="text-muted-foreground min-h-4 text-xs">
                {entryFilterQuery.trim().length > 0
                  ? `Showing ${filteredEntryItems.length} of ${draft.entries.length} entries.`
                  : 'This only filters the visible rows and does not change the saved entry list.'}
              </p>
            </div>

            {batchAddDraft.open ? (
              <PokedexBatchAddPanel
                draft={batchAddDraft}
                pokemonOptions={pokemonOptions}
                previewEntries={batchPreviewEntries}
                anchorOptions={anchorOptions}
                validationErrors={batchAddValidation}
                disabled={fetcher.state !== 'idle'}
                onClose={closeBatchAdd}
                onInsertModeChange={(value) =>
                  updateBatchAddDraft((current) => ({
                    ...current,
                    insertMode: value,
                  }))
                }
                onAnchorChange={(value) =>
                  updateBatchAddDraft((current) => ({
                    ...current,
                    anchorClientId: value,
                  }))
                }
                onAddPokemon={(pid) =>
                  updateBatchAddDraft((current) => addPokemonToBatchAddQueue(current, pid))
                }
                onRemovePokemon={(pid) =>
                  updateBatchAddDraft((current) => removePokemonFromBatchAddQueue(current, pid))
                }
                onStartingDexNumChange={(value) =>
                  updateBatchAddDraft((current) => ({
                    ...current,
                    startingDexNum: value,
                    startingDexNumWasEdited: true,
                  }))
                }
                onIsFormChange={(value) =>
                  updateBatchAddDraft((current) => ({
                    ...current,
                    isForm: value,
                  }))
                }
                onTransferOnlyChange={(value) =>
                  updateBatchAddDraft((current) => ({
                    ...current,
                    transferOnly: value,
                  }))
                }
                onIsNonCanonicalChange={(value) =>
                  updateBatchAddDraft((current) => ({
                    ...current,
                    isNonCanonical: value,
                  }))
                }
                onInsert={insertBatchEntries}
              />
            ) : null}

            <div className="max-h-[90vh] overflow-y-auto pr-1">
              {filteredEntryItems.length > 0 ? (
                <PokedexEntryEditorList
                  entries={filteredEntryItems.map((item) => item.entry)}
                  entryIndices={filteredEntryItems.map((item) => item.actualIndex)}
                  pokemonOptions={pokemonOptions}
                  entryErrors={validation.entryErrors}
                  editingEntryIds={editingEntryIds}
                  disabled={fetcher.state !== 'idle'}
                  onReorder={reorderEntries}
                  onUpdateEntry={updateEntry}
                  onToggleEdit={toggleEntryEdit}
                  onAddBelow={addEntryBelow}
                  onBatchAddBelow={openBatchAddBelow}
                  onRemove={removeEntry}
                  onAddBottom={addEntryBottom}
                />
              ) : (
                <div className="border-border/70 bg-muted/10 text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-sm">
                  No entries match this filter.
                </div>
              )}
            </div>
          </div>

          {statusMessage ? <p className="text-muted-foreground text-sm">{statusMessage}</p> : null}
        </CardContent>
      </Card>

      <div className="fixed right-6 bottom-6 z-40">
        <Button
          type="button"
          size="lg"
          className="shadow-2xl"
          onClick={saveDraft}
          disabled={fetcher.state !== 'idle' || !isDirty || hasValidationErrors}
        >
          <SaveIcon data-icon="inline-start" />
          Save
        </Button>
      </div>
    </section>
  )
}

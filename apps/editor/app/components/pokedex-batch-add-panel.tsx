import { type PokemonOption } from '@/components/pokemon-option-combobox'
import { PokemonOptionPickerList } from '@/components/pokemon-option-picker-list'
import { Badge } from '@/components/ui/badge'
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
import {
  BATCH_ADD_MODE_BELOW,
  BATCH_ADD_MODE_BOTTOM,
  TRI_STATE_FALSE,
  TRI_STATE_TRUE,
  TRI_STATE_UNSET,
  type BatchAddDraft,
  type BatchAddPreviewEntry,
  type BatchAddValidationErrors,
  type TriStateBooleanValue,
} from '@/lib/pokedex-logic'
import { XIcon } from 'lucide-react'
import { useMemo } from 'react'

type AnchorOption = {
  clientId: string
  label: string
}

type PokedexBatchAddPanelProps = {
  draft: BatchAddDraft
  pokemonOptions: PokemonOption[]
  previewEntries: BatchAddPreviewEntry[]
  anchorOptions: AnchorOption[]
  validationErrors: BatchAddValidationErrors
  disabled?: boolean
  onClose: () => void
  onInsertModeChange: (value: BatchAddDraft['insertMode']) => void
  onAnchorChange: (value: string) => void
  onAddPokemon: (pid: string) => void
  onRemovePokemon: (pid: string) => void
  onStartingDexNumChange: (value: string) => void
  onIsFormChange: (value: boolean) => void
  onTransferOnlyChange: (value: TriStateBooleanValue) => void
  onIsNonCanonicalChange: (value: TriStateBooleanValue) => void
  onInsert: () => void
}

const triStateOptions: Array<{ value: TriStateBooleanValue; label: string }> = [
  { value: TRI_STATE_UNSET, label: 'Empty' },
  { value: TRI_STATE_TRUE, label: 'Yes' },
  { value: TRI_STATE_FALSE, label: 'No' },
]

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

export function PokedexBatchAddPanel({
  draft,
  pokemonOptions,
  previewEntries,
  anchorOptions,
  validationErrors,
  disabled = false,
  onClose,
  onInsertModeChange,
  onAnchorChange,
  onAddPokemon,
  onRemovePokemon,
  onStartingDexNumChange,
  onIsFormChange,
  onTransferOnlyChange,
  onIsNonCanonicalChange,
  onInsert,
}: PokedexBatchAddPanelProps) {
  const pokemonOptionById = useMemo(
    () => new Map(pokemonOptions.map((option) => [option.id, option])),
    [pokemonOptions],
  )
  const availablePokemonOptions = useMemo(
    () => pokemonOptions.filter((option) => !draft.queuedPokemonIds.includes(option.id)),
    [draft.queuedPokemonIds, pokemonOptions],
  )
  const hasValidationErrors = Object.keys(validationErrors).length > 0

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">Batch Add Entries</CardTitle>
          <p className="text-muted-foreground text-sm">
            Queue multiple Pokemon, preview their Dex numbers, then insert them into the in-memory
            draft in one step.
          </p>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={disabled}>
          <XIcon data-icon="inline-start" />
          Close
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <Label>Insert Position</Label>
            <Select
              value={draft.insertMode}
              onValueChange={(value) => {
                if (!value) return
                onInsertModeChange(value)
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BATCH_ADD_MODE_BOTTOM}>At bottom</SelectItem>
                <SelectItem value={BATCH_ADD_MODE_BELOW}>Below selected row</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draft.insertMode === BATCH_ADD_MODE_BELOW ? (
            <div className="space-y-1">
              <Label>Anchor Row</Label>
              <Select
                value={draft.anchorClientId || null}
                onValueChange={(value) => onAnchorChange(value ?? '')}
                disabled={disabled}
              >
                <SelectTrigger
                  className="h-10 w-full"
                  aria-invalid={validationErrors.anchorClientId ? true : undefined}
                >
                  <SelectValue placeholder="Choose a row" />
                </SelectTrigger>
                <SelectContent>
                  {anchorOptions.map((option) => (
                    <SelectItem key={option.clientId} value={option.clientId}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-destructive min-h-4 text-xs">
                {validationErrors.anchorClientId ?? ''}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Add Pokemon To Queue</Label>
          <PokemonOptionPickerList
            options={availablePokemonOptions}
            onSelect={(option) => onAddPokemon(option.id)}
            searchPlaceholder="Search Pokemon to queue..."
            emptyText="No Pokemon available to add."
            disabled={disabled || availablePokemonOptions.length === 0}
            listClassName="max-h-72"
          />
          <p className="text-destructive min-h-4 text-xs">
            {validationErrors.queuedPokemonIds ?? ''}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[140px_auto_160px_160px] lg:items-end">
          <div className="space-y-1">
            <Label htmlFor="batch-starting-dex-num">Starting Dex Num</Label>
            <Input
              id="batch-starting-dex-num"
              type="number"
              min={0}
              max={99999}
              value={draft.startingDexNum}
              onChange={(event) => onStartingDexNumChange(event.target.value)}
              aria-invalid={validationErrors.startingDexNum ? true : undefined}
              disabled={disabled}
            />
            <p className="text-destructive min-h-4 text-xs">
              {validationErrors.startingDexNum ?? ''}
            </p>
          </div>

          <label className="flex items-center gap-2 pb-5 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.isForm}
              onChange={(event) => onIsFormChange(event.target.checked)}
              disabled={disabled}
              className="border-input bg-background size-4 rounded border"
            />
            <span>Mark all as forms</span>
          </label>

          <div className="space-y-1">
            <Label>Transfer Only</Label>
            <Select
              value={draft.transferOnly}
              onValueChange={(value) =>
                onTransferOnlyChange((value ?? TRI_STATE_UNSET) as TriStateBooleanValue)
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-10 w-full">
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
            <Label>Non Canonical</Label>
            <Select
              value={draft.isNonCanonical}
              onValueChange={(value) =>
                onIsNonCanonicalChange((value ?? TRI_STATE_UNSET) as TriStateBooleanValue)
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-10 w-full">
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
        </div>

        <p className="text-muted-foreground text-xs">
          Non-form batches increase Dex numbers by 1 automatically. Form batches keep the same Dex
          number for every queued row.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Preview ({previewEntries.length})
              </h3>
              <p className="text-muted-foreground text-xs">
                Closing this panel discards the queued batch without touching the Pokédex draft.
              </p>
            </div>
          </div>

          {previewEntries.length > 0 ? (
            <div className="border-border/70 bg-muted/15 max-h-80 space-y-2 overflow-y-auto rounded-2xl border p-2">
              {previewEntries.map((previewEntry) => {
                const pokemon = pokemonOptionById.get(previewEntry.pid) ?? null

                return (
                  <div
                    key={previewEntry.pid}
                    className="border-border/70 bg-background/70 grid gap-3 rounded-xl border p-3 lg:grid-cols-[minmax(0,1.4fr)_110px_90px_120px_120px_auto] lg:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {pokemon ? (
                        <img
                          src={pokemon.image}
                          alt=""
                          aria-hidden
                          className="size-10 shrink-0 object-contain"
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg text-xs">
                          ?
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {pokemon?.label ?? previewEntry.pid}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{previewEntry.pid}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Dex Num</p>
                      <p className="text-sm font-medium">
                        {previewEntry.dexNum === null ? 'Unset' : previewEntry.dexNum}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Form</p>
                      {previewEntry.isForm ? (
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
                      {triStateBadge(previewEntry.transferOnly)}
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Non Canonical</p>
                      {triStateBadge(previewEntry.isNonCanonical)}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemovePokemon(previewEntry.pid)}
                        disabled={disabled}
                      >
                        <XIcon data-icon="inline-start" />
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="border-border/70 bg-muted/10 text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
              Queue Pokemon to preview the block before inserting it.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
            Cancel
          </Button>
          <Button type="button" onClick={onInsert} disabled={disabled || hasValidationErrors}>
            Insert Batch
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

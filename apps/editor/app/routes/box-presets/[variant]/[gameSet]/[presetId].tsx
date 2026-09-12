import { BoxPresetGrid } from '@/components/box-preset-grid'
import { BoxPresetSummary } from '@/components/box-preset-summary'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  countChangedCells,
  hasBoxPresetDraftChanges,
  normalizeBoxPresetDraft,
  updateBoxPresetMetadata,
  type BoxPresetDraft,
  type BoxPresetDropResult,
} from '@/lib/box-presets'
import {
  deleteBoxPresetFromForm,
  loadBoxPresetEditorData,
  saveBoxPresetFromForm,
} from '@/lib/box-presets.server'
import { ArrowLeftIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, redirect, useFetcher, useNavigate } from 'react-router'

export function meta() {
  return [
    { title: 'Box Preset Editor | PokePC Dataset Editor' },
    { name: 'description', content: 'Edit a dataset box preset.' },
  ]
}

export function loader({
  params,
}: {
  params: { variant?: string; gameSet?: string; presetId?: string }
}) {
  return loadBoxPresetEditorData(params)
}

export async function action({
  request,
  params,
}: {
  request: Request
  params: { variant?: string; gameSet?: string; presetId?: string }
}) {
  const formData = await request.clone().formData()
  if (formData.get('intent') === 'delete-box-preset') {
    const result = await deleteBoxPresetFromForm(request, params)
    if (result.success) throw redirect(result.location)
    return result
  }
  return saveBoxPresetFromForm(request, params)
}

export default function BoxPresetEditorPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>
}) {
  const navigate = useNavigate()
  const fetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const [draft, setDraft] = useState<BoxPresetDraft>(loaderData.initialDraft)
  const [baseline, setBaseline] = useState<BoxPresetDraft>(loaderData.initialDraft)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [dropMessage, setDropMessage] = useState<string | null>(null)
  const isSubmitting = fetcher.state !== 'idle' || deleteFetcher.state !== 'idle'
  const isDirty = useMemo(() => hasBoxPresetDraftChanges(baseline, draft), [baseline, draft])
  const changedCellCount = useMemo(() => countChangedCells(baseline, draft), [baseline, draft])

  useEffect(() => {
    setDraft(loaderData.initialDraft)
    setBaseline(loaderData.initialDraft)
    setStatusMessage(null)
    setDropMessage(null)
  }, [loaderData.initialDraft])

  useEffect(() => {
    if (!fetcher.data) return
    if (fetcher.data.success !== true) {
      setStatusMessage(fetcher.data.error)
      return
    }

    const nextDraft = normalizeBoxPresetDraft(fetcher.data.draft)
    setDraft(nextDraft)
    setBaseline(nextDraft)
    setStatusMessage(
      `Box preset saved with ${fetcher.data.summary.placedPokemonCount} placed Pokemon.`,
    )
    setDropMessage(null)
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

  function saveDraft() {
    const formData = new FormData()
    formData.set('intent', 'save-box-preset')
    formData.set('draft', JSON.stringify(draft))
    fetcher.submit(formData, { method: 'post' })
  }

  function handleDraftChange(nextDraft: BoxPresetDraft, result: BoxPresetDropResult) {
    setDraft(nextDraft)
    setStatusMessage(
      result.changedBoxIndices.length > 0
        ? `Updated ${result.changedBoxIndices.length} box${result.changedBoxIndices.length === 1 ? '' : 'es'}.`
        : null,
    )
  }

  function handleDraftEdit(nextDraft: BoxPresetDraft, message?: string) {
    setDraft(nextDraft)
    setStatusMessage(message ?? null)
  }

  const selectedSiblingLabel =
    loaderData.siblingPresets.find((preset) => preset.id === draft.id)?.label ?? draft.name
  const DeletePresetForm = deleteFetcher.Form

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            to="/box-presets"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeftIcon className="size-4" />
            Box Presets
          </Link>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{draft.name}</h1>
            <p className="text-muted-foreground text-sm">{draft.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{loaderData.variantLabel}</Badge>
          <Badge variant="outline">{loaderData.gameSet.label}</Badge>
          <Badge variant={isDirty ? 'default' : 'secondary'}>{isDirty ? 'Unsaved' : 'Saved'}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Preset Controls</span>
            <BoxPresetSummary draft={draft} changedCellCount={changedCellCount} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-medium">Preset Title</label>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    handleDraftEdit(
                      updateBoxPresetMetadata(draft, { name: event.target.value }),
                      undefined,
                    )
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-medium">Sibling Presets</label>
                <Select
                  value={draft.id}
                  onValueChange={(presetId) =>
                    navigate(
                      `/box-presets/${loaderData.variant}/${loaderData.gameSet.id}/${presetId}`,
                    )
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{selectedSiblingLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    {loaderData.siblingPresets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(baseline)
                  setStatusMessage('Draft reset.')
                  setDropMessage(null)
                }}
                disabled={!isDirty || isSubmitting}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Reset
              </Button>
              <Button type="button" onClick={saveDraft} disabled={!isDirty || isSubmitting}>
                <SaveIcon data-icon="inline-start" />
                {fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button type="button" variant="destructive">
                      <Trash2Icon data-icon="inline-start" />
                      Delete
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete preset?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the selected preset from the dataset. This action cannot be
                      undone from the editor.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <DeletePresetForm method="post">
                      <input type="hidden" name="intent" value="delete-box-preset" />
                      <AlertDialogAction type="submit" variant="destructive">
                        Delete preset
                      </AlertDialogAction>
                    </DeletePresetForm>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-medium">Description</label>
            <Textarea
              value={draft.description}
              onChange={(event) =>
                handleDraftEdit(
                  updateBoxPresetMetadata(draft, { description: event.target.value }),
                  undefined,
                )
              }
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="min-h-5 text-xs">
            {dropMessage ? <p className="text-muted-foreground">{dropMessage}</p> : null}
            {statusMessage ? (
              <p
                className={
                  fetcher.data?.success === false || deleteFetcher.data?.success === false
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }
              >
                {statusMessage}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <BoxPresetGrid
        draft={draft}
        pokemon={loaderData.availablePokemon}
        boxCellCount={loaderData.boxCellCount}
        maxBoxCount={loaderData.maxBoxCount}
        disabled={isSubmitting}
        changedCellCount={changedCellCount}
        isDirty={isDirty}
        isSaving={fetcher.state !== 'idle'}
        presetName={draft.name}
        onChange={handleDraftChange}
        onDraftChange={handleDraftEdit}
        onDropMessage={setDropMessage}
        onSave={saveDraft}
      />
    </section>
  )
}

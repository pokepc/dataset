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
import { createBoxPresetFromForm, loadBoxPresetIndexData } from '@/lib/box-presets.server'
import { BoxIcon, ExternalLinkIcon, PlusIcon } from 'lucide-react'
import { Form, Link, redirect, useActionData, useSearchParams } from 'react-router'

export function meta() {
  return [
    { title: 'Box Presets | PokePC Dataset Editor' },
    { name: 'description', content: 'Browse and edit classic and modern box presets.' },
  ]
}

export function loader() {
  return loadBoxPresetIndexData()
}

export async function action({ request }: { request: Request }) {
  const result = await createBoxPresetFromForm(request)
  if (result.success) throw redirect(result.location)
  return result
}

export default function BoxPresetsIndexPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>
}) {
  const actionData = useActionData<typeof action>()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedVariantId = searchParams.get('variant') ?? 'classic'
  const selectedVariant =
    loaderData.variants.find((variant) => variant.id === selectedVariantId) ??
    loaderData.variants[0]!
  const selectedGameSetId =
    searchParams.get('gameSet') ??
    selectedVariant.gameSets.find((gameSet) => gameSet.presetCount > 0)?.id ??
    selectedVariant.gameSets[0]?.id ??
    ''
  const selectedGameSet =
    selectedVariant.gameSets.find((gameSet) => gameSet.id === selectedGameSetId) ??
    selectedVariant.gameSets[0]
  const selectedPresetId = searchParams.get('preset') ?? selectedGameSet?.presets[0]?.id ?? ''
  const selectedPreset = selectedGameSet?.presets.find((preset) => preset.id === selectedPresetId)

  function updateSearchParams(next: { variant?: string; gameSet?: string; preset?: string }) {
    const params = new URLSearchParams(searchParams)
    if (next.variant !== undefined) {
      params.set('variant', next.variant)
      params.delete('gameSet')
      params.delete('preset')
    }
    if (next.gameSet !== undefined) {
      params.set('gameSet', next.gameSet)
      params.delete('preset')
    }
    if (next.preset !== undefined) {
      params.set('preset', next.preset)
    }
    setSearchParams(params)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Box Presets</h1>
          <p className="text-muted-foreground text-sm">
            Browse and edit dataset box presets by variant and game set.
          </p>
        </div>
        <Badge variant="outline">
          {loaderData.variants.reduce((count, variant) => count + variant.presetCount, 0)} presets
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BoxIcon className="text-muted-foreground size-4" />
            Select Preset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-medium">Variant</label>
              <Select
                value={selectedVariant.id}
                onValueChange={(value) => updateSearchParams({ variant: value ?? undefined })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedVariant.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {loaderData.variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.label} ({variant.presetCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-medium">Game Set</label>
              <Select
                value={selectedGameSet?.id ?? ''}
                onValueChange={(value) => updateSearchParams({ gameSet: value ?? undefined })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedGameSet?.label ?? 'No game set'}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {selectedVariant.gameSets.map((gameSet) => (
                    <SelectItem key={gameSet.id} value={gameSet.id}>
                      {gameSet.label} ({gameSet.presetCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-medium">Preset</label>
              <Select
                value={selectedPreset?.id ?? ''}
                onValueChange={(value) => updateSearchParams({ preset: value ?? undefined })}
                disabled={!selectedGameSet || selectedGameSet.presetCount === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No presets">
                    {selectedPreset?.label ?? 'No presets'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {selectedGameSet?.presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedGameSet && selectedPreset ? (
            <div className="border-border bg-input/20 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">{selectedPreset.label}</p>
                <p className="text-muted-foreground text-xs">
                  {selectedVariant.label} / {selectedGameSet.label}
                </p>
              </div>
              <Link
                to={`/box-presets/${selectedVariant.id}/${selectedGameSet.id}/${selectedPreset.id}`}
              >
                <Button>
                  <ExternalLinkIcon data-icon="inline-start" />
                  Open Editor
                </Button>
              </Link>
            </div>
          ) : (
            <p className="border-border bg-background/40 text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
              No presets were found for this variant and game set. Add one below to start editing.
            </p>
          )}

          {selectedGameSet ? (
            <Form method="post" className="border-border bg-card grid gap-3 rounded-2xl border p-4">
              <input type="hidden" name="intent" value="create-box-preset" />
              <input type="hidden" name="variant" value={selectedVariant.id} />
              <input type="hidden" name="gameSet" value={selectedGameSet.id} />
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-medium">New Preset ID</label>
                  <Input name="presetId" placeholder="my-new-preset" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-medium">
                    New Preset Title
                  </label>
                  <Input name="name" placeholder="My New Preset" required />
                </div>
                <Button type="submit">
                  <PlusIcon data-icon="inline-start" />
                  Add Preset
                </Button>
              </div>
              {actionData?.success === false ? (
                <p className="text-destructive text-xs">{actionData.error}</p>
              ) : null}
            </Form>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {loaderData.variants.map((variant) => (
          <Card key={variant.id} size="sm">
            <CardHeader>
              <CardTitle>{variant.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {variant.presetCount} presets across{' '}
                {variant.gameSets.filter((gameSet) => gameSet.presetCount > 0).length} game sets.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AGGREGATE_JSON,
  MOVE_POSITION_VALUES,
  OPERATION_VALUES,
  TARGET_VALUES,
  applyFieldOperation,
  isJsonObject,
  parseFieldPath,
  type FieldOperation,
  type MovePosition,
  type TargetType,
} from '@/lib/data-migrations'
import {
  loadAllGames,
  loadAllPokemon,
  readDatasetFile,
  writeDatasetFile,
} from '@pokepc/dataset/lib/fs'
import { ChevronDownIcon, PlayIcon, WrenchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import type { Route } from './+types/maintenance'

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Maintenance | PokePC Dataset Editor' },
    {
      name: 'description',
      content: 'Run bulk maintenance actions for Pokemon dataset schema and JSON files.',
    },
  ]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent')
  if (intent !== 'run-bulk-field-migration') {
    return { success: false, error: 'Unsupported maintenance intent.' as const }
  }

  const targetValue = formData.get('target')
  const operationValue = formData.get('operation')
  const fieldNameValue = formData.get('fieldName')
  const defaultValueRaw = formData.get('defaultValue')
  const renameToValue = formData.get('renameTo')
  const addAfterSiblingField = formData.get('addAfterSibling')
  const addAfterSiblingRaw =
    typeof addAfterSiblingField === 'string' ? addAfterSiblingField.trim() : ''
  const movePivotField = formData.get('movePivot')
  const movePivotRaw = typeof movePivotField === 'string' ? movePivotField.trim() : ''
  const movePositionValue = formData.get('movePosition')
  const dryRun = formData.get('dryRun') === 'on'

  if (!TARGET_VALUES.includes(targetValue as TargetType)) {
    return { success: false, error: 'Invalid target.' as const }
  }
  if (!OPERATION_VALUES.includes(operationValue as FieldOperation)) {
    return { success: false, error: 'Invalid operation.' as const }
  }
  if (typeof fieldNameValue !== 'string' || !fieldNameValue.trim()) {
    return { success: false, error: 'Field name is required.' as const }
  }

  const fieldName = fieldNameValue.trim()
  const fieldPath = parseFieldPath(fieldName)
  if (!fieldPath) {
    return {
      success: false,
      error:
        'Field name path is invalid. Use dot notation with letters, numbers, "_" or "-".' as const,
    }
  }

  const target = targetValue as TargetType
  const operation = operationValue as FieldOperation
  const defaultPayload = typeof defaultValueRaw === 'string' ? defaultValueRaw.trim() : ''
  const renameTo = typeof renameToValue === 'string' ? renameToValue.trim() : ''

  let parsedDefaultValue: unknown = null
  if (operation === 'add') {
    if (!defaultPayload) {
      return {
        success: false,
        error: 'Default value JSON is required for add operations.' as const,
      }
    }
    try {
      parsedDefaultValue = JSON.parse(defaultPayload)
    } catch {
      return {
        success: false,
        error:
          'Default value must be valid JSON (example: "text", 123, true, null, [], {}).' as const,
      }
    }
  }

  const leafKey = fieldPath[fieldPath.length - 1]
  let addAfterSibling: string | null = null
  if (operation === 'add' && addAfterSiblingRaw) {
    if (!/^[\w-]+$/.test(addAfterSiblingRaw)) {
      return {
        success: false,
        error:
          'Insert-after key must be a single identifier (letters, numbers, "_", "-").' as const,
      }
    }
    if (addAfterSiblingRaw === leafKey) {
      return {
        success: false,
        error: "Insert-after key must differ from the new field's leaf name." as const,
      }
    }
    addAfterSibling = addAfterSiblingRaw
  }

  let renameToPath: string[] | null = null
  if (operation === 'rename') {
    renameToPath = parseFieldPath(renameTo)
    if (!renameToPath) {
      return {
        success: false,
        error: 'Rename destination is required and must be a valid dot path.' as const,
      }
    }
    if (renameToPath.join('.') === fieldPath.join('.')) {
      return {
        success: false,
        error: 'Rename destination must be different from source path.' as const,
      }
    }
  }

  let movePivotKey = ''
  let movePosition: MovePosition = 'before'
  if (operation === 'move') {
    if (!movePivotRaw) {
      return { success: false, error: 'Pivot field (sibling key) is required for move.' as const }
    }
    if (!/^[\w-]+$/.test(movePivotRaw)) {
      return {
        success: false,
        error: 'Pivot key must be a single identifier (letters, numbers, "_", "-").' as const,
      }
    }
    if (movePivotRaw === leafKey) {
      return {
        success: false,
        error: "Pivot key must differ from the source field's leaf name." as const,
      }
    }
    if (!MOVE_POSITION_VALUES.includes(movePositionValue as MovePosition)) {
      return { success: false, error: 'Move position must be before or after.' as const }
    }
    movePivotKey = movePivotRaw
    movePosition = movePositionValue as MovePosition
  }

  const modeText = dryRun ? 'Simulation complete' : 'Run complete'
  const actionText =
    operation === 'add'
      ? `added "${fieldName}"`
      : operation === 'remove'
        ? `removed "${fieldName}"`
        : operation === 'move'
          ? `moved "${fieldName}" ${movePosition} "${movePivotKey}"`
          : `renamed "${fieldName}" to "${renameTo}"`

  if (target === 'abilities' || target === 'items' || target === 'moves') {
    const filePath = AGGREGATE_JSON[target]
    let root: unknown
    try {
      root = readDatasetFile<unknown>(filePath)
    } catch {
      return { success: false, error: `Failed to read ${filePath}.` as const }
    }
    if (!Array.isArray(root)) {
      return { success: false, error: `${filePath} must be a JSON array.` as const }
    }

    let changedCount = 0
    for (const item of root) {
      if (!isJsonObject(item)) continue
      const changed = applyFieldOperation(item, operation, fieldPath, {
        parsedDefaultValue,
        renameToPath,
        addAfterSibling,
        movePivotKey,
        movePosition,
      })
      if (!changed) continue
      changedCount += 1
    }

    if (!dryRun && changedCount > 0) {
      try {
        writeDatasetFile(root, filePath, false)
      } catch {
        return { success: false, error: `Failed to write ${filePath}.` as const }
      }
    }

    const label = target === 'abilities' ? 'ability' : target === 'items' ? 'item' : 'move'
    return {
      success: true as const,
      message: `${modeText}: ${actionText} in ${changedCount}/${root.length} ${label} records (${filePath}).`,
    }
  }

  const ids =
    target === 'pokemon'
      ? loadAllPokemon().map((record) => record.id)
      : loadAllGames().map((record) => record.id)
  let changedCount = 0

  for (const id of ids) {
    const filePath = `${target}/${id}.json`
    let record: unknown
    try {
      record = readDatasetFile<unknown>(filePath)
    } catch {
      return { success: false, error: `Failed to read ${filePath}.` as const }
    }

    if (!isJsonObject(record)) {
      return { success: false, error: `File ${filePath} is not a JSON object.` as const }
    }

    const changed = applyFieldOperation(record, operation, fieldPath, {
      parsedDefaultValue,
      renameToPath,
      addAfterSibling,
      movePivotKey,
      movePosition,
    })

    if (!changed) continue
    changedCount += 1

    if (!dryRun) {
      try {
        writeDatasetFile(record, filePath, false)
      } catch {
        return { success: false, error: `Failed to write ${filePath}.` as const }
      }
    }
  }

  return {
    success: true as const,
    message: `${modeText}: ${actionText} in ${changedCount}/${ids.length} ${target} files.`,
  }
}

export default function MaintenancePage() {
  const fetcher = useFetcher<typeof action>()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [selectedOperation, setSelectedOperation] = useState<FieldOperation>('add')

  useEffect(() => {
    if (!fetcher.data) return
    if (fetcher.data.success !== true) {
      setStatusMessage(fetcher.data.error)
      return
    }
    setStatusMessage(fetcher.data.message ?? null)
  }, [fetcher.data])

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <WrenchIcon className="text-muted-foreground size-5" />
          Maintenance
        </h1>
        <p className="text-muted-foreground text-sm">
          Bulk tools for maintaining Pokemon data schema and JSON files.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Field Migration</CardTitle>
          <CardDescription>
            Add, remove, rename, or reorder (move) fields across all Pokemon or game JSON files, or
            every record in abilities.json, items.json, or moves.json.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fetcher.Form method="post" className="space-y-5">
            <input type="hidden" name="intent" value="run-bulk-field-migration" />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target">Target</Label>
                <div className="relative">
                  <select
                    id="target"
                    name="target"
                    defaultValue="pokemon"
                    className="border-input bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full appearance-none rounded-4xl border px-3 pr-10 text-sm outline-none focus-visible:ring-[3px]"
                  >
                    <option value="pokemon">Pokemon</option>
                    <option value="games">Games</option>
                    <option value="abilities">Abilities (abilities.json)</option>
                    <option value="items">Items (items.json)</option>
                    <option value="moves">Moves (moves.json)</option>
                  </select>
                  <ChevronDownIcon className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="operation">Operation</Label>
                <div className="relative">
                  <select
                    id="operation"
                    name="operation"
                    value={selectedOperation}
                    onChange={(event) =>
                      setSelectedOperation(event.currentTarget.value as FieldOperation)
                    }
                    className="border-input bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full appearance-none rounded-4xl border px-3 pr-10 text-sm outline-none focus-visible:ring-[3px]"
                  >
                    <option value="add">Add field</option>
                    <option value="remove">Remove field</option>
                    <option value="rename">Rename field</option>
                    <option value="move">Move field</option>
                  </select>
                  <ChevronDownIcon className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fieldName">Field name</Label>
              <Input id="fieldName" name="fieldName" placeholder="e.g. forms.legacyTag" required />
            </div>

            {selectedOperation === 'add' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultValue">Default value JSON (for add)</Label>
                  <Input
                    id="defaultValue"
                    name="defaultValue"
                    placeholder='e.g. "unknown", 123, true, null, [], {}'
                    defaultValue='"unknown"'
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addAfterSibling">Insert after (add only)</Label>
                  <Input
                    id="addAfterSibling"
                    name="addAfterSibling"
                    placeholder="Sibling key at same level as the new field; empty = end of object"
                  />
                  <p className="text-muted-foreground text-xs">
                    For <code className="text-foreground">forms.tag</code>, a sibling is any key
                    next to <code className="text-foreground">tag</code> inside{' '}
                    <code className="text-foreground">forms</code>
                    (e.g. <code className="text-foreground">spriteId</code>). If that key is missing
                    on a record, the new field is appended at the end for that record.
                  </p>
                </div>
              </div>
            ) : null}

            {selectedOperation === 'rename' ? (
              <div className="space-y-2">
                <Label htmlFor="renameTo">Rename destination (for rename)</Label>
                <Input id="renameTo" name="renameTo" placeholder="e.g. forms.newFieldName" />
              </div>
            ) : null}

            {selectedOperation === 'move' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="movePivot">Pivot field (sibling key, same object)</Label>
                  <Input
                    id="movePivot"
                    name="movePivot"
                    placeholder="e.g. name (sibling of the source leaf)"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movePosition">Place source</Label>
                  <div className="relative">
                    <select
                      id="movePosition"
                      name="movePosition"
                      defaultValue="before"
                      className="border-input bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full appearance-none rounded-4xl border px-3 pr-10 text-sm outline-none focus-visible:ring-[3px]"
                    >
                      <option value="before">Before pivot</option>
                      <option value="after">After pivot</option>
                    </select>
                    <ChevronDownIcon className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs md:col-span-2">
                  Source and pivot must be direct children of the same object (e.g. move{' '}
                  <code className="text-foreground">forms.spriteId</code> after pivot{' '}
                  <code className="text-foreground">tag</code>). Records without either key are
                  skipped.
                </p>
              </div>
            ) : null}

            <Label htmlFor="dryRun" className="w-fit">
              <input
                id="dryRun"
                name="dryRun"
                type="checkbox"
                defaultChecked
                className="border-input bg-background size-4 rounded border"
              />
              Dry run (preview only, no file writes)
            </Label>

            <div className="border-border flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-xs">
                Runs raw JSON migrations without schema validation.
              </p>
              <Button type="submit" disabled={fetcher.state !== 'idle'}>
                <PlayIcon data-icon="inline-start" />
                {fetcher.state === 'idle' ? 'Run' : 'Running...'}
              </Button>
            </div>
          </fetcher.Form>

          {statusMessage ? (
            <p className="text-muted-foreground mt-4 text-xs">{statusMessage}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}

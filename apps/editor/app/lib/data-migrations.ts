export const TARGET_VALUES = ['pokemon', 'games', 'abilities', 'items', 'moves'] as const
export const OPERATION_VALUES = ['add', 'remove', 'rename', 'move'] as const
export const MOVE_POSITION_VALUES = ['before', 'after'] as const

export const AGGREGATE_JSON: Record<'abilities' | 'items' | 'moves', string> = {
  abilities: 'abilities.json',
  items: 'items.json',
  moves: 'moves.json',
}

export type TargetType = (typeof TARGET_VALUES)[number]
export type FieldOperation = (typeof OPERATION_VALUES)[number]
export type MovePosition = (typeof MOVE_POSITION_VALUES)[number]
export type JsonObject = Record<string, unknown>

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseFieldPath(path: string): string[] | null {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length === 0) return null
  if (segments.some((segment) => !/^[\w-]+$/.test(segment))) return null
  return segments
}

function getObjectAtPath(obj: JsonObject, path: string[]): JsonObject | null {
  let current: unknown = obj
  for (const segment of path) {
    if (!isJsonObject(current) || !(segment in current)) return null
    current = current[segment]
  }
  return isJsonObject(current) ? current : null
}

function getParentForLeafPath(obj: JsonObject, leafPath: string[]): JsonObject | null {
  if (leafPath.length === 0) return null
  if (leafPath.length === 1) return obj
  return getObjectAtPath(obj, leafPath.slice(0, -1))
}

function getValueAtPath(obj: JsonObject, path: string[]) {
  let current: unknown = obj
  for (const segment of path) {
    if (!isJsonObject(current) || !(segment in current)) {
      return { found: false as const, value: undefined }
    }
    current = current[segment]
  }
  return { found: true as const, value: current }
}

function insertKeyOnParent(
  parent: JsonObject,
  newKey: string,
  value: unknown,
  afterSibling: string | null,
): void {
  if (!afterSibling) {
    parent[newKey] = value
    return
  }

  const entries = Object.entries(parent)
  const afterIdx = entries.findIndex(([k]) => k === afterSibling)
  if (afterIdx === -1) {
    parent[newKey] = value
    return
  }

  for (const k of Object.keys(parent)) {
    delete parent[k]
  }
  for (const [k, v] of entries) {
    parent[k] = v
    if (k === afterSibling) {
      parent[newKey] = value
    }
  }
}

function setValueAtPathIfMissingOrUndefined(
  obj: JsonObject,
  path: string[],
  value: unknown,
): boolean {
  if (path.length === 0) return false
  let current: JsonObject = obj
  for (const segment of path.slice(0, -1)) {
    const next = current[segment]
    if (isJsonObject(next)) {
      current = next
      continue
    }
    if (typeof next === 'undefined') {
      current[segment] = {}
      current = current[segment] as JsonObject
      continue
    }
    return false
  }

  const key = path[path.length - 1]
  if (typeof current[key] !== 'undefined') return false
  current[key] = value
  return true
}

function setValueAtPathIfMissingWithOrder(
  obj: JsonObject,
  path: string[],
  value: unknown,
  afterSibling: string | null,
): boolean {
  if (path.length === 0) return false
  let current: JsonObject = obj
  for (const segment of path.slice(0, -1)) {
    const next = current[segment]
    if (isJsonObject(next)) {
      current = next
      continue
    }
    if (typeof next === 'undefined') {
      current[segment] = {}
      current = current[segment] as JsonObject
      continue
    }
    return false
  }

  const key = path[path.length - 1]
  if (typeof current[key] !== 'undefined') return false
  insertKeyOnParent(current, key, value, afterSibling)
  return true
}

function deleteValueAtPath(obj: JsonObject, path: string[]): boolean {
  if (path.length === 0) return false
  let current: JsonObject = obj
  for (const segment of path.slice(0, -1)) {
    const next = current[segment]
    if (!isJsonObject(next)) return false
    current = next
  }

  const key = path[path.length - 1]
  if (!(key in current)) return false
  delete current[key]
  return true
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function moveKeyRelativeTo(
  parent: JsonObject,
  sourceKey: string,
  pivotKey: string,
  position: MovePosition,
): boolean {
  if (!(sourceKey in parent) || !(pivotKey in parent) || sourceKey === pivotKey) return false

  const entries = Object.entries(parent)
  const withoutSource = entries.filter(([k]) => k !== sourceKey)
  const newPivotIdx = withoutSource.findIndex(([k]) => k === pivotKey)
  const insertAt = position === 'before' ? newPivotIdx : newPivotIdx + 1
  const pair: [string, unknown] = [sourceKey, parent[sourceKey]]
  const newEntries = [...withoutSource.slice(0, insertAt), pair, ...withoutSource.slice(insertAt)]

  const oldKeys = entries.map(([k]) => k)
  const newKeys = newEntries.map(([k]) => k)
  if (oldKeys.length === newKeys.length && oldKeys.every((k, i) => k === newKeys[i])) {
    return false
  }

  for (const k of Object.keys(parent)) {
    delete parent[k]
  }
  for (const [k, v] of newEntries) {
    parent[k] = v
  }
  return true
}

export type ApplyFieldOperationParams = {
  parsedDefaultValue: unknown
  renameToPath: string[] | null
  addAfterSibling: string | null
  movePivotKey: string
  movePosition: MovePosition
}

export function applyFieldOperation(
  record: JsonObject,
  operation: FieldOperation,
  fieldPath: string[],
  params: ApplyFieldOperationParams,
): boolean {
  const { parsedDefaultValue, renameToPath, addAfterSibling, movePivotKey, movePosition } = params
  if (operation === 'add') {
    return setValueAtPathIfMissingWithOrder(
      record,
      fieldPath,
      cloneJsonValue(parsedDefaultValue),
      addAfterSibling,
    )
  }
  if (operation === 'remove') {
    return deleteValueAtPath(record, fieldPath)
  }
  if (operation === 'move') {
    const parent = getParentForLeafPath(record, fieldPath)
    if (!parent) return false
    const sourceKey = fieldPath[fieldPath.length - 1]
    return moveKeyRelativeTo(parent, sourceKey, movePivotKey, movePosition)
  }
  if (operation === 'rename') {
    const source = getValueAtPath(record, fieldPath)
    if (!source.found || !renameToPath) return false
    const movedToDestination = setValueAtPathIfMissingOrUndefined(
      record,
      renameToPath,
      source.value,
    )
    const removedSource = deleteValueAtPath(record, fieldPath)
    return movedToDestination || removedSource
  }
  return false
}

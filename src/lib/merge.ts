/**
 * Merges base records, a game set's mods and locale text into that set's full data (doc-2,
 * "Merged data"). Pure and filesystem-free, so browsers and the static API build share it; the
 * Node loader is `loadGameSetSource` in `fs.ts`.
 */
import { localeCodes, type LocaleCode } from './languages'
import { moddableKinds, moddableRecordSchemas } from './schemas'
import type {
  ModdableKind,
  ModdableRecord,
  RecordOverride,
  Roster,
  Text,
  TextFile,
  TextOverride,
} from './types'

export type ModdableRecords = { [K in ModdableKind]: ModdableRecord<K>[] }
export type ModdableTextFiles = { [K in ModdableKind]: TextFile<K> }
export type ModdableTextOverrides = { [K in ModdableKind]: Record<string, TextOverride<K>> }
export type RecordOverrides = { [K in ModdableKind]: RecordOverride<K>[] }

export type GameSetMods = {
  roster?: Roster
  overrides?: Partial<RecordOverrides>
  text?: Partial<Record<LocaleCode, Partial<ModdableTextOverrides>>>
}

export type GameSetSource = {
  /** Base records per kind; kinds left out are left out of the result. */
  base: Partial<ModdableRecords>
  /** Base text per locale and kind. */
  text?: Partial<Record<LocaleCode, Partial<ModdableTextFiles>>>
  /** The set's mods; without them the result is the base data. */
  mods?: GameSetMods
}

export type MergedGameSet = {
  records: Partial<ModdableRecords>
  /** Only locales and kinds with at least one entry; missing text stays missing. */
  text: Partial<Record<LocaleCode, Partial<ModdableTextFiles>>>
}

export type MergeOptions = {
  /** Validate merged records against the v8 schemas (default true). */
  validate?: boolean
}

export class GameSetMergeError extends Error {
  override name = 'GameSetMergeError'
}

type AnyRecord = { id: string } & Record<string, unknown>
type Overridable = { $unset?: readonly string[] } & Record<string, unknown>

/**
 * Applies a sparse override: present properties replace the base value entirely (arrays and
 * objects included) and `$unset` removes properties. The base object is not mutated.
 */
export function applyOverride<T extends AnyRecord>(base: T, override: Overridable): T {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (key === '$unset' || key === 'id') continue
    result[key] = value
  }
  for (const key of override.$unset ?? []) {
    delete result[key]
  }
  return result as T
}

/** Applies a mod text entry field by field; an entry left with no fields is `undefined`. */
export function applyTextOverride<T extends Record<string, unknown>>(
  base: T | undefined,
  override: Overridable,
): T | undefined {
  const result = applyOverride({ id: '', ...base }, override) as Record<string, unknown>
  delete result.id
  return Object.keys(result).length > 0 ? (result as T) : undefined
}

/**
 * Produces a game set's full data: the roster's base records with the set's overrides applied
 * and, per locale, the roster's base text with the set's text applied. Never fills missing text
 * from another locale or set. Throws `GameSetMergeError` when mods reference unknown or
 * excluded ids, or a merged record fails validation.
 */
export function mergeGameSet(source: GameSetSource, options: MergeOptions = {}): MergedGameSet {
  const { base, mods = {} } = source
  const validate = options.validate ?? true
  const records: Partial<Record<ModdableKind, AnyRecord[]>> = {}
  const includedIds: Partial<Record<ModdableKind, Set<string>>> = {}

  for (const kind of moddableKinds) {
    const baseRecords = base[kind] as AnyRecord[] | undefined
    if (!baseRecords) {
      assertNoModsFor(kind, mods)
      continue
    }
    const included = selectRoster(kind, baseRecords, mods.roster?.[kind])
    const overrides = indexOverrides(kind, mods.overrides?.[kind] as Overridable[] | undefined)
    const merged = included.map((record) => {
      const override = overrides.get(record.id)
      overrides.delete(record.id)
      return override ? applyOverride(record, override) : record
    })
    if (overrides.size > 0) {
      throw new GameSetMergeError(
        `${kind} overrides target ids outside the set: ${[...overrides.keys()].join(', ')}`,
      )
    }
    if (validate) validateRecords(kind, merged)
    records[kind] = merged
    includedIds[kind] = new Set(merged.map((record) => record.id))
  }

  return {
    records: records as Partial<ModdableRecords>,
    text: mergeText(source, includedIds, records),
  }
}

function selectRoster(
  kind: ModdableKind,
  baseRecords: AnyRecord[],
  rosterIds: readonly string[] | undefined,
): AnyRecord[] {
  if (!rosterIds) return baseRecords
  const baseIds = new Set(baseRecords.map((record) => record.id))
  const unknown = rosterIds.filter((id) => !baseIds.has(id))
  if (unknown.length > 0) {
    throw new GameSetMergeError(`Roster lists unknown ${kind}: ${unknown.join(', ')}`)
  }
  const wanted = new Set(rosterIds)
  return baseRecords.filter((record) => wanted.has(record.id))
}

function indexOverrides(kind: ModdableKind, overrides: Overridable[] = []) {
  const byId = new Map<string, Overridable>()
  for (const override of overrides) {
    const id = override.id as string
    if (byId.has(id)) throw new GameSetMergeError(`Duplicate ${kind} override: ${id}`)
    byId.set(id, override)
  }
  return byId
}

function assertNoModsFor(kind: ModdableKind, mods: GameSetMods) {
  const hasText = Object.values(mods.text ?? {}).some((files) => files?.[kind])
  if (mods.overrides?.[kind]?.length || hasText) {
    throw new GameSetMergeError(`Mods override ${kind}, but no base ${kind} were given`)
  }
}

function validateRecords(kind: ModdableKind, records: AnyRecord[]) {
  const schema = moddableRecordSchemas[kind]
  for (const record of records) {
    const result = schema.safeParse(record)
    if (!result.success) {
      throw new GameSetMergeError(
        `Merged ${kind} "${record.id}" is invalid: ${result.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ')}`,
      )
    }
  }
}

function mergeText(
  source: GameSetSource,
  includedIds: Partial<Record<ModdableKind, Set<string>>>,
  records: Partial<Record<ModdableKind, AnyRecord[]>>,
): MergedGameSet['text'] {
  const given = new Set([
    ...Object.keys(source.text ?? {}),
    ...Object.keys(source.mods?.text ?? {}),
  ])
  const unknown = [...given].filter(
    (locale) => !(localeCodes as readonly string[]).includes(locale),
  )
  if (unknown.length > 0) {
    throw new GameSetMergeError(`Unknown locale codes: ${unknown.join(', ')}`)
  }
  const locales = localeCodes.filter((locale) => given.has(locale))
  const merged: MergedGameSet['text'] = {}

  for (const locale of locales) {
    const files: Partial<Record<ModdableKind, Record<string, unknown>>> = {}
    for (const kind of moddableKinds) {
      const ids = includedIds[kind]
      const baseFile = source.text?.[locale]?.[kind] as Record<string, Text> | undefined
      const modFile = source.mods?.text?.[locale]?.[kind] as Record<string, Overridable> | undefined
      if (!ids) continue
      const outside = Object.keys(modFile ?? {}).filter((id) => !ids.has(id))
      if (outside.length > 0) {
        throw new GameSetMergeError(
          `${locale} ${kind} text overrides target ids outside the set: ${outside.join(', ')}`,
        )
      }
      const file: Record<string, unknown> = {}
      // Follow record order, so merged text files are ordered like merged records.
      for (const { id } of records[kind] ?? []) {
        const baseText = baseFile?.[id]
        const override = modFile?.[id]
        const text = override ? applyTextOverride(baseText, override) : baseText
        if (text) file[id] = text
      }
      if (Object.keys(file).length > 0) files[kind] = file
    }
    if (Object.keys(files).length > 0) {
      merged[locale] = files as Partial<ModdableTextFiles>
    }
  }
  return merged
}

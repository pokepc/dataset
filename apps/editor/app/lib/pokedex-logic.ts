import { POKEPC_LATEST_GENERATION } from '@pokepc/dataset/lib/constants'

export const TRI_STATE_UNSET = 'unset'
export const TRI_STATE_TRUE = 'true'
export const TRI_STATE_FALSE = 'false'
export const BATCH_ADD_MODE_BOTTOM = 'bottom'
export const BATCH_ADD_MODE_BELOW = 'below'

export type TriStateBooleanValue =
  | typeof TRI_STATE_UNSET
  | typeof TRI_STATE_TRUE
  | typeof TRI_STATE_FALSE

export type BatchAddInsertMode = typeof BATCH_ADD_MODE_BOTTOM | typeof BATCH_ADD_MODE_BELOW

export type PokedexEntryDraft = {
  clientId: string
  pid: string
  dexNum: string
  isForm: boolean
  transferOnly: TriStateBooleanValue
  isNonCanonical: TriStateBooleanValue
  originDex?: string
  meta?: Pkds.PokedexEntry['meta']
}

export type PokedexDraft = {
  id: string
  name: string
  shortDesc: string
  desc: string
  gen: string
  region: string
  isNational: boolean
  baseDex: string
  pkApiId: string
  entries: PokedexEntryDraft[]
}

export type PokedexDraftValidation = {
  generalErrors: Partial<Record<'name' | 'gen' | 'region' | 'baseDex', string>>
  entryErrors: Record<string, Partial<Record<'pid' | 'dexNum', string>>>
}

export type BatchAddDraft = {
  open: boolean
  insertMode: BatchAddInsertMode
  anchorClientId: string
  queuedPokemonIds: string[]
  startingDexNum: string
  isForm: boolean
  transferOnly: TriStateBooleanValue
  isNonCanonical: TriStateBooleanValue
  startingDexNumWasEdited: boolean
}

export type BatchAddValidationErrors = Partial<
  Record<'anchorClientId' | 'queuedPokemonIds' | 'startingDexNum', string>
>

export type BatchAddPreviewEntry = {
  pid: string
  dexNum: number | null
  isForm: boolean
  transferOnly: TriStateBooleanValue
  isNonCanonical: TriStateBooleanValue
}

export function booleanToTriStateBooleanValue(value: boolean | undefined): TriStateBooleanValue {
  if (value === true) return TRI_STATE_TRUE
  if (value === false) return TRI_STATE_FALSE
  return TRI_STATE_UNSET
}

export function createBatchAddDraft(overrides?: Partial<BatchAddDraft>): BatchAddDraft {
  return {
    open: false,
    insertMode: BATCH_ADD_MODE_BOTTOM,
    anchorClientId: '',
    queuedPokemonIds: [],
    startingDexNum: '',
    isForm: false,
    transferOnly: TRI_STATE_UNSET,
    isNonCanonical: TRI_STATE_UNSET,
    startingDexNumWasEdited: false,
    ...overrides,
  }
}

export function triStateBooleanValueToBoolean(value: TriStateBooleanValue): boolean | undefined {
  if (value === TRI_STATE_TRUE) return true
  if (value === TRI_STATE_FALSE) return false
  return undefined
}

export function cycleTriStateBooleanValue(value: TriStateBooleanValue): TriStateBooleanValue {
  if (value === TRI_STATE_UNSET) return TRI_STATE_TRUE
  if (value === TRI_STATE_TRUE) return TRI_STATE_FALSE
  return TRI_STATE_UNSET
}

export function createPokedexEntryDraft(
  clientId: string,
  entry?: Partial<Pkds.PokedexEntry>,
): PokedexEntryDraft {
  return {
    clientId,
    pid: entry?.pid ?? '',
    dexNum: entry?.dexNum === undefined ? '' : String(entry.dexNum),
    isForm: entry?.isForm ?? false,
    transferOnly: booleanToTriStateBooleanValue(entry?.transferOnly),
    isNonCanonical: booleanToTriStateBooleanValue(entry?.isNonCanonical),
    originDex: entry?.originDex,
    meta: entry?.meta,
  }
}

export function toPokedexDraft(pokedex: Pkds.Pokedex): PokedexDraft {
  return {
    id: pokedex.id,
    name: pokedex.name,
    shortDesc: pokedex.shortDesc ?? '',
    desc: pokedex.desc ?? '',
    gen: String(pokedex.gen),
    region: pokedex.region ?? '',
    isNational: pokedex.isNational,
    baseDex: pokedex.baseDex ?? '',
    pkApiId: pokedex.pkApiId ?? '',
    entries: pokedex.entries.map((entry, index) =>
      createPokedexEntryDraft(`${pokedex.id}-entry-${index}`, entry),
    ),
  }
}

export function insertPokedexEntryBelow(
  entries: PokedexEntryDraft[],
  currentClientId: string,
  nextEntry: PokedexEntryDraft,
): PokedexEntryDraft[] {
  const index = entries.findIndex((entry) => entry.clientId === currentClientId)
  if (index === -1) return [...entries, nextEntry]
  const nextEntries = [...entries]
  nextEntries.splice(index + 1, 0, nextEntry)
  return nextEntries
}

export function appendPokedexEntry(
  entries: PokedexEntryDraft[],
  nextEntry: PokedexEntryDraft,
): PokedexEntryDraft[] {
  return [...entries, nextEntry]
}

export function insertPokedexEntriesBelow(
  entries: PokedexEntryDraft[],
  currentClientId: string,
  nextEntries: PokedexEntryDraft[],
): PokedexEntryDraft[] {
  if (nextEntries.length === 0) return entries
  const index = entries.findIndex((entry) => entry.clientId === currentClientId)
  if (index === -1) return [...entries, ...nextEntries]
  const result = [...entries]
  result.splice(index + 1, 0, ...nextEntries)
  return result
}

export function appendPokedexEntries(
  entries: PokedexEntryDraft[],
  nextEntries: PokedexEntryDraft[],
): PokedexEntryDraft[] {
  if (nextEntries.length === 0) return entries
  return [...entries, ...nextEntries]
}

export function removePokedexEntry(
  entries: PokedexEntryDraft[],
  clientId: string,
): PokedexEntryDraft[] {
  return entries.filter((entry) => entry.clientId !== clientId)
}

export function applyNationalDexNumsToEntries(
  entries: PokedexEntryDraft[],
  nationalDexNumByPokemonId: Record<string, number | string>,
): PokedexEntryDraft[] {
  return entries.map((entry) => {
    const nationalDexNum = nationalDexNumByPokemonId[entry.pid]
    if (nationalDexNum === undefined || nationalDexNum === null) {
      return entry
    }

    const nextDexNum = String(nationalDexNum)
    if (entry.dexNum === nextDexNum) {
      return entry
    }

    return {
      ...entry,
      dexNum: nextDexNum,
    }
  })
}

export function applyPokemonIsFormFlagsToEntries(
  entries: PokedexEntryDraft[],
  isFormByPokemonId: Record<string, boolean>,
): PokedexEntryDraft[] {
  return entries.map((entry) => {
    const nextIsForm = isFormByPokemonId[entry.pid]
    if (nextIsForm === undefined || entry.isForm === nextIsForm) {
      return entry
    }

    return {
      ...entry,
      isForm: nextIsForm,
    }
  })
}

export function addMissingFormsToEntries(
  entries: PokedexEntryDraft[],
  formsByPokemonId: Record<string, string[]>,
  createClientId: () => string,
): PokedexEntryDraft[] {
  const existingIds = new Set(entries.map((entry) => entry.pid))
  const nextEntries: PokedexEntryDraft[] = []

  for (const entry of entries) {
    nextEntries.push(entry)

    const formIds = formsByPokemonId[entry.pid] ?? []
    for (const formId of formIds) {
      if (existingIds.has(formId)) continue

      nextEntries.push(
        createPokedexEntryDraft(createClientId(), {
          pid: formId,
          dexNum: entry.dexNum,
          isForm: true,
        }),
      )
      existingIds.add(formId)
    }
  }

  return nextEntries
}

export function reorderPokedexEntries(
  entries: PokedexEntryDraft[],
  sourceIndex: number,
  targetIndex: number,
): PokedexEntryDraft[] {
  if (sourceIndex === targetIndex) return entries
  const nextEntries = [...entries]
  const sourceEntry = nextEntries[sourceIndex]
  const targetEntry = nextEntries[targetIndex]
  if (!sourceEntry || !targetEntry) return entries
  nextEntries[sourceIndex] = targetEntry
  nextEntries[targetIndex] = sourceEntry
  return nextEntries
}

function parseBatchInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) ? parsed : null
}

export function deriveBatchAddStartingDexNum(
  entries: PokedexEntryDraft[],
  insertMode: BatchAddInsertMode,
  anchorClientId: string,
): string {
  const referenceEntry =
    insertMode === BATCH_ADD_MODE_BELOW
      ? (entries.find((entry) => entry.clientId === anchorClientId) ?? null)
      : (entries.at(-1) ?? null)

  if (!referenceEntry) return ''

  const parsedDexNum = parseBatchInteger(referenceEntry.dexNum)
  if (parsedDexNum === null || parsedDexNum < 0 || parsedDexNum > 99999) {
    return ''
  }

  return String(parsedDexNum + 1)
}

export function syncBatchAddDraftDefaults(
  draft: BatchAddDraft,
  entries: PokedexEntryDraft[],
): BatchAddDraft {
  let nextDraft = draft

  if (draft.insertMode === BATCH_ADD_MODE_BELOW) {
    const anchorExists = entries.some((entry) => entry.clientId === draft.anchorClientId)
    const fallbackAnchorClientId = anchorExists
      ? draft.anchorClientId
      : (entries[0]?.clientId ?? '')

    if (fallbackAnchorClientId !== draft.anchorClientId) {
      nextDraft = {
        ...nextDraft,
        anchorClientId: fallbackAnchorClientId,
      }
    }
  }

  if (!draft.startingDexNumWasEdited) {
    const nextStartingDexNum = deriveBatchAddStartingDexNum(
      entries,
      nextDraft.insertMode,
      nextDraft.anchorClientId,
    )
    if (nextStartingDexNum !== nextDraft.startingDexNum) {
      nextDraft = {
        ...nextDraft,
        startingDexNum: nextStartingDexNum,
      }
    }
  }

  return nextDraft
}

export function addPokemonToBatchAddQueue(draft: BatchAddDraft, pid: string): BatchAddDraft {
  if (draft.queuedPokemonIds.includes(pid)) return draft

  return {
    ...draft,
    queuedPokemonIds: [...draft.queuedPokemonIds, pid],
  }
}

export function removePokemonFromBatchAddQueue(draft: BatchAddDraft, pid: string): BatchAddDraft {
  if (!draft.queuedPokemonIds.includes(pid)) return draft

  return {
    ...draft,
    queuedPokemonIds: draft.queuedPokemonIds.filter((queuedPid) => queuedPid !== pid),
  }
}

export function validateBatchAddDraft(
  draft: BatchAddDraft,
  entries: PokedexEntryDraft[],
): BatchAddValidationErrors {
  const errors: BatchAddValidationErrors = {}

  if (draft.insertMode === BATCH_ADD_MODE_BELOW) {
    const anchorExists = entries.some((entry) => entry.clientId === draft.anchorClientId)
    if (!anchorExists) {
      errors.anchorClientId = 'Choose a row to insert below.'
    }
  }

  if (draft.queuedPokemonIds.length === 0) {
    errors.queuedPokemonIds = 'Add at least one Pokemon to the batch.'
  }

  const startingDexNum = parseBatchInteger(draft.startingDexNum)
  if (startingDexNum === null || startingDexNum < 0 || startingDexNum > 99999) {
    errors.startingDexNum = 'Starting Dex Num must be an integer between 0 and 99999.'
  }

  return errors
}

export function getBatchAddPreviewEntries(draft: BatchAddDraft): BatchAddPreviewEntry[] {
  const startingDexNum = parseBatchInteger(draft.startingDexNum)

  return draft.queuedPokemonIds.map((pid, index) => ({
    pid,
    dexNum: startingDexNum === null ? null : draft.isForm ? startingDexNum : startingDexNum + index,
    isForm: draft.isForm,
    transferOnly: draft.transferOnly,
    isNonCanonical: draft.isNonCanonical,
  }))
}

export function createBatchAddEntryDrafts(
  draft: BatchAddDraft,
  createClientId: () => string,
): PokedexEntryDraft[] {
  return getBatchAddPreviewEntries(draft).map((entry) =>
    createPokedexEntryDraft(createClientId(), {
      pid: entry.pid,
      dexNum: entry.dexNum ?? undefined,
      isForm: entry.isForm,
      transferOnly: triStateBooleanValueToBoolean(entry.transferOnly),
      isNonCanonical: triStateBooleanValueToBoolean(entry.isNonCanonical),
    }),
  )
}

function normalizeTextToOptional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTextToNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizePokedexDraft(draft: PokedexDraft): Pkds.Pokedex {
  return {
    id: draft.id,
    name: draft.name.trim(),
    shortDesc: normalizeTextToOptional(draft.shortDesc),
    desc: normalizeTextToNullable(draft.desc),
    gen: Number.parseInt(draft.gen, 10),
    region: normalizeTextToNullable(draft.region),
    isNational: draft.isNational,
    baseDex: normalizeTextToNullable(draft.baseDex),
    pkApiId: normalizeTextToNullable(draft.pkApiId),
    entries: draft.entries.map((entry) => ({
      pid: entry.pid.trim(),
      dexNum: Number.parseInt(entry.dexNum, 10),
      isForm: entry.isForm,
      transferOnly: triStateBooleanValueToBoolean(entry.transferOnly),
      isNonCanonical: triStateBooleanValueToBoolean(entry.isNonCanonical),
      originDex: entry.originDex,
      meta: entry.meta,
    })),
  }
}

export function validatePokedexDraft(
  draft: PokedexDraft,
  validPokemonIds: Set<string>,
  validRegionIds: Set<string>,
  validBaseDexIds: Set<string>,
): PokedexDraftValidation {
  const generalErrors: PokedexDraftValidation['generalErrors'] = {}
  const entryErrors: PokedexDraftValidation['entryErrors'] = {}

  if (draft.name.trim().length === 0) {
    generalErrors.name = 'Name is required.'
  } else if (draft.name.trim().length > 50) {
    generalErrors.name = 'Name must be 50 characters or fewer.'
  }

  const parsedGen = Number.parseInt(draft.gen, 10)
  if (!Number.isInteger(parsedGen) || parsedGen < 0 || parsedGen > POKEPC_LATEST_GENERATION) {
    generalErrors.gen = `Generation must be an integer between 0 and ${POKEPC_LATEST_GENERATION}.`
  }

  if (draft.region.trim().length > 0 && !validRegionIds.has(draft.region.trim())) {
    generalErrors.region = 'Region must be a valid region id or left empty.'
  }

  if (draft.baseDex.trim().length > 0 && !validBaseDexIds.has(draft.baseDex.trim())) {
    generalErrors.baseDex = 'Base Dex must be a valid Pokedex id or left empty.'
  }

  for (const entry of draft.entries) {
    const currentErrors: Partial<Record<'pid' | 'dexNum', string>> = {}
    const normalizedPid = entry.pid.trim()

    if (normalizedPid.length === 0) {
      currentErrors.pid = 'Pokemon is required.'
    } else if (!validPokemonIds.has(normalizedPid)) {
      currentErrors.pid = 'Pokemon id is invalid.'
    }

    const parsedDexNum = Number.parseInt(entry.dexNum, 10)
    if (!Number.isInteger(parsedDexNum) || parsedDexNum < 0 || parsedDexNum > 99999) {
      currentErrors.dexNum = 'Dex number must be an integer between 0 and 99999.'
    }

    if (Object.keys(currentErrors).length > 0) {
      entryErrors[entry.clientId] = currentErrors
    }
  }

  return {
    generalErrors,
    entryErrors,
  }
}

export function hasPokedexDraftValidationErrors(validation: PokedexDraftValidation): boolean {
  return (
    Object.keys(validation.generalErrors).length > 0 ||
    Object.keys(validation.entryErrors).length > 0
  )
}

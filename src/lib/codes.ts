/**
 * Append-only code maps (data/codes). Consumers store these small integers instead of ids, so a
 * released code must never change meaning: codes are dense, never renumbered and never reused, and
 * an id that leaves the dataset keeps its code as a retired entry. See Backlog doc-3 (Code maps).
 */

export const codeMapKinds = ['pokemon', 'ribbons', 'marks', 'moves'] as const

export type CodeMapKind = (typeof codeMapKinds)[number]

/**
 * Problems that make a code map unsafe to publish, compared with the ids the dataset currently
 * contains. Empty when the map is valid.
 */
export function findCodeMapProblems(
  entries: readonly Pkds.CodeMapEntry[],
  liveIds: readonly string[],
): string[] {
  const problems: string[] = []
  const live = new Set(liveIds)
  const seenIds = new Set<string>()

  entries.forEach((entry, index) => {
    if (entry.code !== index) {
      problems.push(
        `${entry.id}: code ${entry.code} at position ${index}; codes must be 0..n-1 in order`,
      )
    }
    if (seenIds.has(entry.id)) {
      problems.push(`${entry.id}: listed more than once`)
    }
    seenIds.add(entry.id)

    if (entry.retired) {
      if (live.has(entry.id)) {
        problems.push(`${entry.id}: retired but still in the dataset`)
      }
      if (entry.replacedBy !== undefined && !live.has(entry.replacedBy)) {
        problems.push(`${entry.id}: replaced by ${entry.replacedBy}, which is not in the dataset`)
      }
    } else {
      if (!live.has(entry.id)) {
        problems.push(`${entry.id}: not in the dataset; mark it retired instead of removing it`)
      }
      if (entry.replacedBy !== undefined) {
        problems.push(`${entry.id}: replacedBy is only allowed on retired entries`)
      }
    }
  })

  for (const id of liveIds) {
    if (!seenIds.has(id)) {
      problems.push(`${id}: in the dataset without a code; run pnpm codes:sync`)
    }
  }

  return problems
}

/**
 * Changes from a released code map that would alter the meaning of stored codes: a released code
 * pointing at another id, a released entry disappearing, or a retired entry becoming live again.
 * Appending new entries is the only allowed change besides retiring an id.
 */
export function findReleasedCodeChanges(
  released: readonly Pkds.CodeMapEntry[],
  current: readonly Pkds.CodeMapEntry[],
): string[] {
  const changes: string[] = []
  const currentByCode = new Map(current.map((entry) => [entry.code, entry]))

  for (const before of released) {
    const after = currentByCode.get(before.code)
    if (!after) {
      changes.push(`code ${before.code} (${before.id}) was removed`)
      continue
    }
    if (after.id !== before.id) {
      changes.push(`code ${before.code} changed from ${before.id} to ${after.id}`)
    }
    if (before.retired && !after.retired) {
      changes.push(`code ${before.code} (${before.id}) was retired and cannot become live again`)
    }
  }

  return changes
}

/**
 * Brings a code map up to date with the dataset: appends a code for every live id that has none and
 * marks entries whose id left the dataset as retired. Existing codes are never renumbered.
 */
export function syncCodeMap(
  entries: readonly Pkds.CodeMapEntry[],
  liveIds: readonly string[],
): Pkds.CodeMapEntry[] {
  const live = new Set(liveIds)
  const synced: Pkds.CodeMapEntry[] = entries.map((entry) =>
    !entry.retired && !live.has(entry.id) ? { ...entry, retired: true } : entry,
  )
  const coded = new Set(synced.map((entry) => entry.id))

  for (const id of liveIds) {
    if (!coded.has(id)) {
      synced.push({ id, code: synced.length })
      coded.add(id)
    }
  }

  return synced
}

import type { AvailabilitySourceRow } from '@pokepc/dataset/lib/availability-sources'

type SourceOpinion = {
  name: string
  row?: AvailabilitySourceRow
  pending?: boolean
  error?: string
}

const verdictLabels = {
  obtainable: { symbol: '✅', label: 'Obtainable' },
  'transfer-only': { symbol: '🔀', label: 'Transfer only' },
  'event-only': { symbol: '🎁', label: 'Event only' },
  unavailable: { symbol: '❌', label: 'Not obtainable' },
  unknown: { symbol: '—', label: 'Needs review' },
  conflict: { symbol: '⚠️', label: 'Sources disagree' },
  loading: { symbol: '…', label: 'Loading' },
  outdated: { symbol: '↻', label: 'Restart editor' },
} as const

/** Summarize upstream evidence only; the editor's draft is deliberately not an input. */
export function summarizeAvailabilitySources(sources: SourceOpinion[]) {
  const evidence = sources
    .map(
      ({ name, row, pending, error }) =>
        `${name}: ${pending ? 'Loading…' : (row?.verdict?.reason ?? row?.message ?? error ?? 'No source evidence.')}`,
    )
    .join('\n')
  const verdict = (status: keyof typeof verdictLabels, reason: string) => ({
    status,
    ...verdictLabels[status],
    reason: `${reason}\n\n${evidence}`,
  })
  if (sources.some((source) => source.pending))
    return verdict('loading', 'Waiting for the requested upstream sources.')
  if (sources.some(({ row }) => row?.state === 'found' && !row.verdict))
    return verdict(
      'outdated',
      'The editor server is still using an older source reader. Restart the editor, then load the sources again.',
    )

  const opinions = sources
    .filter(({ row }) => row?.state === 'found')
    .map(({ row }) => row?.verdict?.status ?? 'unknown')
  const known = new Set(opinions.filter((status) => status !== 'unknown'))
  if (!known.size)
    return verdict('unknown', 'The loaded sources do not establish availability for this form.')
  if ((known.has('unavailable') && known.size > 1) || (known.has('obtainable') && known.size > 1))
    return verdict(
      'conflict',
      'The sources give different classifications. Review their methods and conditions.',
    )

  // An uncertain route could change whether acquisition is exclusively transfer/event based.
  if (opinions.includes('unknown') && !known.has('obtainable'))
    return verdict(
      'unknown',
      'Some source methods need review before an exclusive verdict is possible.',
    )

  if (known.has('transfer-only'))
    return verdict(
      'transfer-only',
      known.has('event-only')
        ? 'A transfer route is documented, so acquisition is not exclusive to events.'
        : 'The classified source methods require a transfer or player trade.',
    )
  if (known.has('event-only'))
    return verdict('event-only', 'The classified source methods require an event or distribution.')
  if (known.has('obtainable'))
    return verdict('obtainable', 'The sources document an ordinary in-game acquisition route.')
  return verdict(
    'unavailable',
    'A source explicitly states unavailability; this is not inferred from missing entries.',
  )
}

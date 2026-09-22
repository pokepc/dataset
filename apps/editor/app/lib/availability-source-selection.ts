import type {
  AvailabilitySourceId,
  AvailabilitySourceResult,
} from '@pokepc/dataset/lib/availability-sources'

export type AvailabilitySourceState = {
  id: AvailabilitySourceId
  rows: Map<string, AvailabilitySourceResult['rows'][number]>
  pending: boolean
}

/** Use a loaded GO entry from either page, preferring the dedicated GO list. */
export function selectAvailabilitySource<T extends AvailabilitySourceState>(
  gameId: string,
  sources: T[],
): T | undefined {
  const main = sources.find((source) => source.id === 'bulbapedia')
  if (gameId !== 'go') return main
  const go = sources.find((source) => source.id === 'bulbapedia-go')
  const candidates = [go, main].filter((source): source is T => source !== undefined)
  return (
    candidates.find((source) => !source.pending && source.rows.get(gameId)?.state === 'found') ??
    candidates.find((source) => source.pending) ??
    go ??
    main
  )
}

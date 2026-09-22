import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  availabilityUrls,
  createAvailabilityReport,
  parseAvailabilityTables,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityStatus,
} from '../upstream-adapters/bulbapedia/availability.ts'
import { fetchAvailabilityPage } from '../upstream-adapters/bulbapedia/fetch.ts'

export type { AvailabilityGame, AvailabilityPokemon }
export type AvailabilitySourceId = 'bulbapedia' | 'bulbapedia-go'
export type AvailabilitySourceEntry = { text: string; url: string; notes?: string[] }
export type AvailabilitySourceVerdict = {
  status: 'obtainable' | 'transfer-only' | 'event-only' | 'unavailable' | 'unknown'
  reason: string
}
export type AvailabilitySourceRow = {
  gameId: string
  state: 'found' | 'missing' | 'unsupported' | 'error'
  entries: AvailabilitySourceEntry[]
  message?: string
  verdict?: AvailabilitySourceVerdict
}
export type AvailabilitySourceResult = {
  sourceId: AvailabilitySourceId
  pokemonId: string
  loadedAt: string
  rows: AvailabilitySourceRow[]
  notes: string[]
  error?: string
}
export type AvailabilitySourceOptions = {
  signal?: AbortSignal
  refresh?: boolean
  cacheDir?: string
  siblings?: AvailabilityPokemon[]
}

const statuses: Record<AvailabilityStatus, AvailabilitySourceVerdict['status']> = {
  obtainableIn: 'obtainable',
  transferOnlyIn: 'transfer-only',
  eventOnlyIn: 'event-only',
  unavailable: 'unavailable',
  unknown: 'unknown',
}

/** Source tables and explicit form rules establish classifications; saved data is never evidence. */
export async function loadAvailabilitySource(
  sourceId: AvailabilitySourceId,
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  options: AvailabilitySourceOptions = {},
): Promise<AvailabilitySourceResult> {
  options.signal?.throwIfAborted()
  if (sourceId !== 'bulbapedia' && sourceId !== 'bulbapedia-go')
    throw new Error(`Unknown availability source: ${sourceId}`)
  const source = sourceId === 'bulbapedia-go' ? 'go' : 'main'
  const concreteGames = games.filter((game) => game.type === 'game')
  const inScope = (gameId: string) => (gameId === 'go') === (source === 'go')
  const result: AvailabilitySourceResult = {
    sourceId,
    pokemonId: pokemon.id,
    loadedAt: new Date().toISOString(),
    rows: concreteGames.map((game) => ({
      gameId: game.id,
      state: inScope(game.id) ? 'missing' : 'unsupported',
      entries: [],
      message: inScope(game.id)
        ? 'No matching availability table entry.'
        : 'Not covered by this source.',
    })),
    notes: [],
  }
  const cacheRoot = options.cacheDir ?? fileURLToPath(new URL('../../.local/', import.meta.url))
  try {
    const html = await fetchAvailabilityPage(source, options.signal, {
      cacheDir: join(cacheRoot, 'bulbapedia'),
      forceRefresh: options.refresh,
    })
    const tables = parseAvailabilityTables({ [source]: html })
    const report = createAvailabilityReport(tables, pokemon, games, options.siblings)
    result.notes = report.warnings
    result.rows = report.rows.map((row): AvailabilitySourceRow => {
      const evidence = row.basis === 'source' || row.basis === 'rule'
      if (!inScope(row.game.id) || (!tables.gameIds.has(row.game.id) && !evidence))
        return {
          gameId: row.game.id,
          state: 'unsupported',
          entries: [],
          message: 'Not covered by this source.',
        }
      const reason = row.methods
        .map((method) => [method.text, method.note].filter(Boolean).join(' — '))
        .join('\n')
      return {
        gameId: row.game.id,
        state: evidence ? 'found' : 'missing',
        entries: evidence
          ? row.methods.map((method) => ({
              text: method.text,
              url:
                method.sourceUrl === undefined
                  ? availabilityUrls[source]
                  : (method.sourceUrl ?? ''),
              ...(method.note ? { notes: [method.note] } : {}),
            }))
          : [],
        ...(!evidence ? { message: reason || 'No matching availability table entry.' } : {}),
        ...(evidence ? { verdict: { status: statuses[row.status], reason } } : {}),
      }
    })
  } catch (error) {
    options.signal?.throwIfAborted()
    result.error = error instanceof Error ? error.message : String(error)
    result.rows = result.rows.map((row) =>
      row.state === 'unsupported'
        ? row
        : { ...row, state: 'error', entries: [], message: result.error, verdict: undefined },
    )
  }
  options.signal?.throwIfAborted()
  return result
}

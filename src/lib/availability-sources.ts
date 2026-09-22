import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  bulbapediaUrl,
  type AvailabilityGame,
  type AvailabilityPokemon,
} from '../upstream-adapters/bulbapedia/availability.ts'
import { fetchSpeciesPage } from '../upstream-adapters/bulbapedia/fetch.ts'
import { parsePokeApiEncounters } from '../upstream-adapters/bulbapedia/cross-check.ts'
import { fetchPokeApiJson } from '../upstream-adapters/pokeapi/client.ts'
import {
  fetchSerebiiEvidence,
  serebiiTargets,
} from '../upstream-adapters/serebii/availability-evidence.ts'
import {
  parseBulbapediaSource,
  parseSerebiiSource,
} from '../upstream-adapters/availability-comparison.ts'
import { pokeApiSourceMethods, sourceVerdict } from '../upstream-adapters/source-verdict.ts'
import type { LocationMethod } from '../upstream-adapters/bulbapedia/availability.ts'

export type { AvailabilityGame, AvailabilityPokemon }
export type AvailabilitySourceId = 'bulbapedia' | 'serebii' | 'pokeapi'
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

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Read-only source evidence and conservative summaries; no AI or dataset fallback. */
export async function loadAvailabilitySource(
  sourceId: AvailabilitySourceId,
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  options: AvailabilitySourceOptions = {},
): Promise<AvailabilitySourceResult> {
  options.signal?.throwIfAborted()
  const concreteGames = games.filter((game) => game.type === 'game')
  const result: AvailabilitySourceResult = {
    sourceId,
    pokemonId: pokemon.id,
    loadedAt: new Date().toISOString(),
    rows: concreteGames.map((game) => ({
      gameId: game.id,
      state: 'unsupported',
      entries: [],
      message: 'This source adapter has no coverage for this game.',
    })),
    notes: [],
  }
  const cacheRoot = options.cacheDir ?? fileURLToPath(new URL('../../.local/', import.meta.url))
  try {
    if (sourceId === 'bulbapedia') {
      result.rows.forEach((row) => {
        row.state = 'missing'
      })
      const html = await fetchSpeciesPage(bulbapediaUrl(pokemon), options.signal, {
        cacheDir: join(cacheRoot, 'bulbapedia'),
        forceRefresh: options.refresh,
      })
      Object.assign(result, parseBulbapediaSource(html, pokemon, games, options.siblings))
    } else if (sourceId === 'serebii') {
      // The existing CLI targets predate Z-A. Request its shared Gen IX page
      // through the validated Scarlet route without changing CLI coverage.
      const needsModernPage = concreteGames.some((game) =>
        ['lza', 'pokopia', 'champions'].includes(game.id),
      )
      const lookupGames =
        needsModernPage && !concreteGames.some((game) => game.id === 'sv-s' || game.id === 'sv-v')
          ? [
              ...games,
              {
                id: 'sv-s',
                name: 'Scarlet',
                type: 'game' as const,
                gen: 9,
                gameSet: 'sv',
                gameSuperSet: null,
              },
            ]
          : games
      const targets = serebiiTargets(
        pokemon,
        lookupGames,
        lookupGames.filter((game) => game.type === 'game').map((game) => game.id),
      )
      const rows = new Map(result.rows.map((row) => [row.gameId, row]))
      // The existing fetcher paces requests; collecting all generation pages is
      // bounded (at most nine) and each failed page affects only its own games.
      await Promise.all(
        targets.map(async (target) => {
          try {
            const evidence = await fetchSerebiiEvidence(target, pokemon, {
              signal: options.signal,
              cacheDir: join(cacheRoot, 'serebii'),
              forceRefresh: options.refresh,
            })
            const parsed = parseSerebiiSource(evidence, pokemon, games, options.siblings)
            for (const row of parsed.rows) rows.set(row.gameId, row)
            result.notes.push(...parsed.notes)
          } catch (error) {
            options.signal?.throwIfAborted()
            const failedIds = [...target.gameIds]
            if (
              new URL(target.url).pathname.startsWith('/pokedex-sv/') &&
              concreteGames.some((game) => game.id === 'lza')
            )
              failedIds.push('lza')
            for (const gameId of failedIds)
              rows.set(gameId, { gameId, state: 'error', entries: [], message: messageOf(error) })
          }
        }),
      )
      result.rows = concreteGames.map((game) => rows.get(game.id)!)
      result.notes = [...new Set(result.notes)]
      const failed = result.rows.filter((row) => row.state === 'error')
      if (failed.length)
        result.error = `Some Serebii pages could not be loaded (${failed.length} game rows). Other pages are shown.`
    } else if (sourceId === 'pokeapi') {
      if (!/^[1-9]\d*$/.test(pokemon.refs.pkApiId)) {
        result.rows.forEach((row) => {
          row.message = 'No mapped PokéAPI Pokémon endpoint for this form.'
        })
        return result
      }
      for (const row of result.rows) {
        const game = concreteGames.find((game) => game.id === row.gameId)!
        if (game.pokeApiGameVersionId) {
          row.state = 'missing'
          row.message =
            'No encounter records returned. This does not establish unavailability; breeding, evolution, gifts and events may be absent.'
        }
      }
      const path = `pokemon/${pokemon.refs.pkApiId}/encounters`
      const url = `https://pokeapi.co/api/v2/${path}/`
      const data = await fetchPokeApiJson(path, {
        signal: options.signal,
        forceRefresh: options.refresh,
        cacheDir: join(cacheRoot, 'pokeapi'),
        retries: 1,
        timeoutMs: 30_000,
        minIntervalMs: 500,
      })
      const parsed = parsePokeApiEncounters(data, games)
      result.notes.push(
        'PokéAPI lists encounter records, not complete availability. Empty results do not rule out evolution, breeding, gifts, events or transfers.',
      )
      result.notes.push(
        `Endpoint: Pokémon #${pokemon.refs.pkApiId}. Encounters may omit gender/form qualifiers; they do not independently establish the selected form (${pokemon.id}).`,
      )
      const shared = options.siblings
        ?.filter((entry) => entry.id !== pokemon.id && entry.refs.pkApiId === pokemon.refs.pkApiId)
        .map((entry) => entry.id)
      if (shared?.length)
        result.notes.push(`This endpoint is shared with other dataset forms: ${shared.join(', ')}.`)
      if (parsed.unmapped.length)
        result.notes.push(`Unmapped source versions: ${parsed.unmapped.join(', ')}.`)
      const methods = new Map<string, LocationMethod[]>()
      for (const encounter of parsed.encounters) {
        const row = result.rows.find((row) => row.gameId === encounter.gameId)!
        row.state = 'found'
        delete row.message
        row.entries.push({
          text: `${encounter.location}: ${encounter.methods.map((method) => `${method.name}${method.conditions.length ? ` (${method.conditions.join(', ')})` : ''}`).join('; ')}`,
          url,
          notes: [`Source version: ${encounter.version}`],
        })
        methods.set(encounter.gameId, [
          ...(methods.get(encounter.gameId) ?? []),
          ...pokeApiSourceMethods(
            encounter,
            pokemon,
            options.siblings ?? [pokemon],
            concreteGames.find((game) => game.id === encounter.gameId)!,
          ),
        ])
      }
      for (const row of result.rows)
        if (row.state === 'found') row.verdict = sourceVerdict(methods.get(row.gameId) ?? [])
    } else {
      throw new Error(`Unknown availability source: ${sourceId}`)
    }
  } catch (error) {
    options.signal?.throwIfAborted()
    result.error = messageOf(error)
    result.rows = result.rows.map((row) =>
      row.state === 'unsupported'
        ? row
        : { ...row, state: 'error', entries: [], message: result.error, verdict: undefined },
    )
  }
  options.signal?.throwIfAborted()
  return result
}

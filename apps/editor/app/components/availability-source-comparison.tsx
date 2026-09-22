import type { GameOption } from '@/components/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AvailabilitySourceResponse } from '@/lib/availability-sources.server'
import { summarizeAvailabilitySources } from '@/lib/availability-verdict'
import type { AvailabilityState } from '@/lib/pokemon-logic'
import { gameSpriteUrl } from '@/lib/utils'
import type {
  AvailabilitySourceId,
  AvailabilitySourceResult,
} from '@pokepc/dataset/lib/availability-sources'
import { ExternalLinkIcon, LoaderCircleIcon, TablePropertiesIcon } from 'lucide-react'
import { parseAsBoolean, useQueryState } from 'nuqs'
import { useEffect, useId, useState } from 'react'
import { useFetcher } from 'react-router'

const sourceLabels: Record<AvailabilitySourceId, string> = {
  bulbapedia: 'Bulbapedia',
  serebii: 'Serebii',
  pokeapi: 'PokéAPI',
}
const sourceIds = Object.keys(sourceLabels) as AvailabilitySourceId[]

function sourceUrl(pokemonId: string, source: AvailabilitySourceId, refresh = false) {
  const params = new URLSearchParams({ pokemonId, source })
  if (refresh) params.set('refresh', '1')
  return `/availability-sources?${params}`
}

const draftFields = [
  ['obtainableIn', 'Obtainable'],
  ['transferOnlyIn', 'Transfer only'],
  ['eventOnlyIn', 'Event only'],
] as const
type SourceRow = AvailabilitySourceResult['rows'][number]
type Entry = SourceRow['entries'][number]

function EvidenceEntry({ entry }: { entry: Entry }) {
  return (
    <li className="space-y-1">
      <p className="whitespace-pre-line">{entry.text}</p>
      {entry.notes?.map((note) => (
        <p key={note} className="text-muted-foreground text-xs">
          {note}
        </p>
      ))}
      {entry.url.startsWith('https://') ? (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2"
        >
          Source <ExternalLinkIcon className="size-3" aria-hidden="true" />
        </a>
      ) : null}
    </li>
  )
}

function EvidenceCell({
  row,
  pending,
  error,
}: {
  row?: SourceRow
  pending: boolean
  error?: string
}) {
  if (pending) return <span className="text-muted-foreground">Loading…</span>
  if (row?.state === 'error' || (!row && error))
    return <p className="text-destructive">{row?.message ?? error ?? 'Could not load source.'}</p>
  if (!row || row.state !== 'found')
    return (
      <span className="text-muted-foreground">
        {row?.message ??
          (row?.state === 'unsupported' ? 'Not covered by this source.' : 'No source entry.')}
      </span>
    )

  return (
    <div className="space-y-2">
      <ul className="space-y-3">
        {row.entries.slice(0, 3).map((entry, index) => (
          <EvidenceEntry key={index} entry={entry} />
        ))}
      </ul>
      {row.entries.length > 3 ? (
        <details>
          <summary className="text-foreground cursor-pointer text-xs">
            Show {row.entries.length - 3} more entries
          </summary>
          <ul className="mt-2 space-y-3">
            {row.entries.slice(3).map((entry, index) => (
              <EvidenceEntry key={index} entry={entry} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export function AvailabilitySourceComparison({
  pokemonId,
  pokemonName,
  games,
  draft,
}: {
  pokemonId: string
  pokemonName: string
  games: GameOption[]
  draft: AvailabilityState
}) {
  const bulbapedia = useFetcher<AvailabilitySourceResponse>()
  const serebii = useFetcher<AvailabilitySourceResponse>()
  const pokeapi = useFetcher<AvailabilitySourceResponse>()
  const fetchers = { bulbapedia, serebii, pokeapi }
  const [opened, setOpened] = useQueryState(
    'sources',
    parseAsBoolean.withDefault(false).withOptions({ history: 'replace', shallow: true }),
  )
  const [gameQuery, setGameQuery] = useState('')
  const panelId = useId()
  const pending = sourceIds.some((id) => fetchers[id].state !== 'idle')
  const requested = pending || sourceIds.some((id) => fetchers[id].data !== undefined)
  const { load: loadBulbapedia } = bulbapedia
  const { load: loadSerebii } = serebii
  const { load: loadPokeapi } = pokeapi

  useEffect(() => {
    if (!opened || requested) return
    // Let cleanup cancel unstarted loads during rapid navigation or Strict Mode remounts.
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      void loadBulbapedia(sourceUrl(pokemonId, 'bulbapedia'))
      void loadSerebii(sourceUrl(pokemonId, 'serebii'))
      void loadPokeapi(sourceUrl(pokemonId, 'pokeapi'))
    })
    return () => {
      cancelled = true
    }
  }, [opened, requested, pokemonId, loadBulbapedia, loadSerebii, loadPokeapi])

  const columns = sourceIds.map((id) => {
    const fetcher = fetchers[id]
    const response = fetcher.data
    const result =
      response?.ok && response.result.pokemonId === pokemonId ? response.result : undefined
    return {
      id,
      result,
      rows: new Map(result?.rows.map((row) => [row.gameId, row])),
      pending: fetcher.state !== 'idle',
      error: response && !response.ok ? response.error : result?.error,
    }
  })
  const visibleGames = games.filter(
    (game) =>
      game.modes.includes('games') &&
      `${game.label} ${game.id}`.toLowerCase().includes(gameQuery.trim().toLowerCase()),
  )

  function loadSource(id: AvailabilitySourceId, refresh: boolean) {
    void fetchers[id].load(sourceUrl(pokemonId, id, refresh))
  }

  function loadAll() {
    void setOpened(true)
    if (requested) for (const id of sourceIds) loadSource(id, true)
  }

  return (
    <section
      className="border-border space-y-3 rounded-xl border p-3"
      aria-label="Availability source comparison"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Compare availability sources</h3>
          <p className="text-muted-foreground text-xs">Game-by-game evidence for {pokemonName}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {requested ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={opened}
              aria-controls={panelId}
              onClick={() => void setOpened(!opened)}
            >
              {opened ? 'Hide comparison' : 'Show comparison'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={loadAll}
            aria-controls={panelId}
          >
            {pending ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <TablePropertiesIcon aria-hidden="true" />
            )}
            {pending
              ? 'Loading sources…'
              : requested
                ? 'Refresh sources'
                : 'Load availability sources'}
          </Button>
        </div>
      </div>
      {opened ? (
        <div id={panelId} className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Source text is shown as published. Check form labels and event requirements; missing
            evidence does not mean unavailable. Your draft stays editable below.
          </p>
          <p className="text-muted-foreground text-xs">
            Verdict summarizes upstream evidence: ✅ obtainable · 🔀 transfer only · 🎁 event only ·
            ❌ not obtainable · ⚠️ sources disagree · — needs review. Select a verdict for its
            reasoning.
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            {columns.map((column) => (
              <div
                key={column.id}
                className="bg-muted/40 min-w-0 space-y-1 rounded-lg p-2 text-xs"
                data-testid={`source-status-${column.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{sourceLabels[column.id]}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={column.pending}
                    onClick={() => loadSource(column.id, true)}
                    aria-label={`Reload ${sourceLabels[column.id]}`}
                  >
                    Reload
                  </Button>
                </div>
                <p
                  role="status"
                  className={column.error ? 'text-destructive' : 'text-muted-foreground'}
                >
                  {column.pending
                    ? 'Loading…'
                    : (column.error ??
                      (column.result
                        ? `Loaded ${new Date(column.result.loadedAt).toLocaleTimeString()}`
                        : 'Waiting…'))}
                </p>
                {column.result?.notes.length ? (
                  <details>
                    <summary className="cursor-pointer">
                      Source notes ({column.result.notes.length})
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {column.result.notes.map((note, index) => (
                        <li key={index} className="whitespace-pre-line">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
          <Input
            type="search"
            value={gameQuery}
            onChange={(event) => setGameQuery(event.target.value)}
            placeholder="Filter games…"
            aria-label="Filter comparison games"
            className="max-w-sm"
          />
          <div
            className="border-border max-h-[65vh] overflow-auto rounded-lg border"
            tabIndex={0}
            role="region"
            aria-label="Availability comparison table"
          >
            <table className="w-full min-w-[1000px] table-fixed text-left text-xs leading-relaxed">
              <caption className="sr-only">
                Availability evidence for {pokemonName}; rows follow dataset game order.
              </caption>
              <thead className="bg-muted sticky top-0 z-20">
                <tr>
                  <th scope="col" className="bg-muted sticky left-0 w-36 p-3">
                    Game
                  </th>
                  <th scope="col" className="w-28 p-3 text-center">
                    Verdict
                  </th>
                  <th scope="col" className="w-32 p-3">
                    Current draft
                  </th>
                  {sourceIds.map((id) => (
                    <th scope="col" key={id} className="p-3">
                      {sourceLabels[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleGames.map((game) => {
                  const acquisition = draftFields
                    .filter(([field]) => draft[field].includes(game.id))
                    .map(([, label]) => label)
                  const verdict = summarizeAvailabilitySources(
                    columns.map((column) => ({
                      name: sourceLabels[column.id],
                      row: column.rows.get(game.id),
                      pending: column.pending,
                      error: column.error,
                    })),
                  )
                  return (
                    <tr
                      key={game.id}
                      className="border-border border-t align-top"
                      data-game-id={game.id}
                    >
                      <th scope="row" className="bg-card sticky left-0 z-10 p-3 font-medium">
                        <img
                          src={gameSpriteUrl(game.id, 'gametiles')}
                          alt=""
                          width={48}
                          height={48}
                          loading="lazy"
                          className="mb-2 block size-12 max-h-12 max-w-12 rounded-sm object-contain"
                        />
                        {game.label}
                        <span className="text-muted-foreground block font-normal">{game.id}</span>
                      </th>
                      <td className="p-3" data-verdict={verdict.status}>
                        <details>
                          <summary
                            className="cursor-pointer list-none text-center [&::-webkit-details-marker]:hidden"
                            title={verdict.reason}
                            aria-label={`${verdict.label}. Show verdict explanation`}
                          >
                            <span aria-hidden="true" className="text-xl">
                              {verdict.symbol}
                            </span>
                            <span className="text-muted-foreground block">{verdict.label}</span>
                          </summary>
                          <p className="text-muted-foreground mt-2 wrap-break-word whitespace-pre-line">
                            {verdict.reason}
                          </p>
                        </details>
                      </td>
                      <td className="space-y-1 p-3">
                        <p>{acquisition.join(' / ') || 'Not classified'}</p>
                        {draft.storableIn.includes(game.id) ? (
                          <p className="text-muted-foreground">Storable</p>
                        ) : null}
                      </td>
                      {columns.map((column) => (
                        <td key={column.id} className="p-3 wrap-break-word" data-source={column.id}>
                          <EvidenceCell
                            row={column.rows.get(game.id)}
                            pending={column.pending}
                            error={column.error}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!visibleGames.length ? (
              <p className="text-muted-foreground p-4 text-sm">No games match your filter.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

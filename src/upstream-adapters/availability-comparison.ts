import { load, type CheerioAPI } from 'cheerio'
import type { AvailabilitySourceEntry, AvailabilitySourceRow } from '../lib/availability-sources.ts'
import {
  bulbapediaUrl,
  createGameResolver,
  normalizeName,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type LocationMethod,
} from './bulbapedia/availability.ts'
import type { SerebiiEvidence } from './serebii/availability-evidence.ts'
import { sourceCellMethods, sourceVerdict } from './source-verdict.ts'

type Selection = ReturnType<CheerioAPI>
type HtmlNode = Exclude<Parameters<typeof load>[0], string | Buffer | unknown[]>
export type ParsedSourceEvidence = { rows: AvailabilitySourceRow[]; notes: string[] }
const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const unique = <T>(values: T[]) => [...new Set(values)]

/** Preserve the source's prose and annotations without deciding availability. */
function readCell(cell: Selection, $: CheerioAPI): { text: string; notes: string[] } {
  const copy = cell.clone()
  copy.find('script,style,noscript,.mw-editsection').remove()
  const notes: string[] = []
  copy.find('[title]').each((_, node) => {
    const title = compact($(node).attr('title') ?? '')
    const label = compact($(node).text())
    if (title && title !== label) notes.push(label ? `${label}: ${title}` : title)
  })
  copy.find('a[href^="#cite_note"]').each((_, node) => {
    const id = $(node).attr('href')!.slice(1)
    const footnote = $('[id]').filter((_, element) => $(element).attr('id') === id)
    const text = compact(footnote.text()).replace(/^\^\s*/, '')
    if (text) notes.push(`Footnote ${compact($(node).text())}: ${text}`)
  })
  copy.find('img').each((_, node) => {
    // Some evolution charts contain only images. Retain the filename when no
    // accessible label exists rather than silently losing a form/condition.
    const label =
      $(node).attr('alt') || $(node).attr('title') || $(node).attr('src')?.split('/').at(-1)
    $(node).replaceWith($('<span></span>').text(label ? ` [${label}] ` : ''))
  })
  copy.find('br').replaceWith('\n')
  copy.find('p,div,li,tr').before('\n').after('\n')
  copy.find('td,th').before(' ').after(' ')
  copy.find('small,sup').before(' ').after(' ')
  const text = copy.text().split('\n').map(compact).filter(Boolean).join('\n')
  return { text, notes: unique(notes) }
}

function addEntries(
  byGame: Map<string, AvailabilitySourceEntry[]>,
  gameIds: string[],
  entries: AvailabilitySourceEntry[],
) {
  for (const id of gameIds) byGame.set(id, [...(byGame.get(id) ?? []), ...entries])
}

function rowsFromEntries(
  gameIds: string[],
  byGame: Map<string, AvailabilitySourceEntry[]>,
  methodsByGame: Map<string, LocationMethod[]>,
): AvailabilitySourceRow[] {
  return gameIds.map((gameId) => {
    const entries = [
      ...new Map(
        (byGame.get(gameId) ?? []).map((entry) => [JSON.stringify(entry), entry]),
      ).values(),
    ]
    return {
      gameId,
      state: entries.length ? 'found' : 'missing',
      entries,
      ...(entries.length ? { verdict: sourceVerdict(methodsByGame.get(gameId) ?? []) } : {}),
      ...(entries.length
        ? {}
        : { message: 'No matching source row. This does not establish unavailability.' }),
    }
  })
}

function speciesNote(pokemon: AvailabilityPokemon): string {
  return `Species page for ${pokemon.refs.bulbapedia}; all source form qualifiers are retained. These rows do not independently establish availability of the selected form (${pokemon.id}).`
}

function sectionContent($: CheerioAPI, id: string): Selection {
  const heading = $(`[id="${id}"]`).closest('h2,h3,h4,h5,h6')
  const anchor = heading.parent().hasClass('mw-heading') ? heading.parent() : heading
  return anchor.nextUntil('h1,h2,h3,h4,h5,h6,.mw-heading')
}

export function parseBulbapediaSource(
  html: string,
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  siblings: AvailabilityPokemon[] = [pokemon],
): ParsedSourceEvidence {
  const $ = load(html)
  const locations = sectionContent($, 'Game_locations')
  if (!locations.length)
    throw new Error('Bulbapedia Game locations section was not found or is empty.')
  const title = compact($('#firstHeading,h1').first().text())
  if (
    title &&
    normalizeName(title.replace(/\(Pokémon\)/, '')) !== normalizeName(pokemon.refs.bulbapedia)
  )
    throw new Error(`Bulbapedia page title does not match ${pokemon.refs.bulbapedia}.`)
  const resolve = createGameResolver(games)
  const byGame = new Map<string, AvailabilitySourceEntry[]>()
  const methodsByGame = new Map<string, LocationMethod[]>()
  const notes = [speciesNote(pokemon)]
  const url = `${bulbapediaUrl(pokemon)}#Game_locations`
  for (const content of [locations, sectionContent($, 'In_side_games')]) {
    content.find('tr').each((_, node) => {
      const headers = $(node).children('th')
      const cells = $(node).children('td')
      if (!headers.length || !cells.length) return
      const labels = headers.toArray().map((header) => compact($(header).text()))
      // Prefer explicit version labels over a generic paired Expansion Pass link.
      let ids = unique(labels.flatMap(resolve))
      if (!ids.length && labels.some((label) => normalizeName(label) === 'expansionpass')) {
        ids = unique(
          headers
            .find('a[href^="/wiki/"]')
            .toArray()
            .flatMap((anchor) => {
              try {
                return resolve(
                  decodeURIComponent($(anchor).attr('href')!.slice(6).split('#')[0]).replaceAll(
                    '_',
                    ' ',
                  ),
                )
              } catch {
                return []
              }
            }),
        )
      }
      if (!ids.length) return
      const context = labels.join(' / ')
      const entries = cells.toArray().flatMap((cell) => {
        const evidence = readCell($(cell), $)
        return evidence.text
          ? [{ ...evidence, url, notes: [`Source row: ${context}`, ...evidence.notes] }]
          : []
      })
      addEntries(byGame, ids, entries)
      for (const id of ids) {
        const game = games.find((game) => game.id === id)!
        const methods = cells
          .toArray()
          .flatMap((cell) =>
            sourceCellMethods($(cell), $, pokemon, siblings, games, game, 'bulbapedia'),
          )
        methodsByGame.set(id, [...(methodsByGame.get(id) ?? []), ...methods])
      }
    })
    content.find('th').each((_, node) => {
      const text = compact($(node).text())
      if (/^This Pokémon was unavailable prior to Generation\b/i.test(text)) notes.push(text)
    })
  }
  for (const id of ['Evolution', 'Form_data', 'Form_change', 'Forms']) {
    const content = sectionContent($, id)
    if (!content.length) continue
    const context = readCell(content, $)
    if (context.text) notes.push(`${id.replaceAll('_', ' ')} context: ${context.text}`)
    notes.push(...context.notes)
  }
  if (!byGame.size) throw new Error('No recognized Bulbapedia game-location rows were found.')
  return {
    rows: rowsFromEntries(
      games.filter((game) => game.type === 'game').map((game) => game.id),
      byGame,
      methodsByGame,
    ),
    notes: unique(notes),
  }
}

/** Expand rowspans so DLC labels stay attached to both explicit version rows. */
function expandedRows(table: HtmlNode, $: CheerioAPI): HtmlNode[][] {
  const spans = new Map<number, { node: HtmlNode; remaining: number }>()
  return $(table)
    .find('tr')
    .filter((_, row) => $(row).closest('table')[0] === table)
    .toArray()
    .map((row) => {
      const result: HtmlNode[] = []
      for (const [column, span] of spans) {
        result[column] = span.node
        if (--span.remaining === 0) spans.delete(column)
      }
      let column = 0
      for (const node of $(row).children('td,th').toArray()) {
        while (result[column]) column++
        const width = Math.min(20, Math.max(1, Number($(node).attr('colspan')) || 1))
        const height = Math.min(100, Math.max(1, Number($(node).attr('rowspan')) || 1))
        for (let offset = 0; offset < width; offset++) {
          result[column + offset] = node
          if (height > 1) spans.set(column + offset, { node, remaining: height - 1 })
        }
        column += width
      }
      return unique(result.filter(Boolean))
    })
}

export function parseSerebiiSource(
  evidence: SerebiiEvidence,
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  siblings: AvailabilityPokemon[] = [pokemon],
): ParsedSourceEvidence {
  const $ = load(evidence.html)
  const resolve = createGameResolver(games)
  const targets = new Set(evidence.gameIds)
  const modernPage = new URL(evidence.url).pathname.startsWith('/pokedex-sv/')
  // Serebii's Gen IX directory also carries explicit Z-A location rows. Newer
  // side-game rows may appear there too; accept only their actual game headers.
  const modernExtras = modernPage
    ? games
        .filter((game) => game.type === 'game' && ['lza', 'pokopia', 'champions'].includes(game.id))
        .map((game) => game.id)
    : []
  for (const id of modernExtras) targets.add(id)
  const byGame = new Map<string, AvailabilitySourceEntry[]>()
  const methodsByGame = new Map<string, LocationMethod[]>()
  const notes = [speciesNote(pokemon)]
  let foundLocationTable = false
  const tables = $('table').filter((_, table) => !$(table).parents('table').length)
  tables.each((_, table) => {
    const heading = compact($(table).find('td,th').first().text())
    if (!/^Locations?\b/i.test(heading)) {
      if (/^(?:Evolutionary Chain|Alternate Forms?|Form(?:e)? Changes?)\b/i.test(heading)) {
        const context = readCell($(table), $)
        notes.push(`${new URL(evidence.url).pathname} context: ${context.text}`, ...context.notes)
      }
      return
    }
    foundLocationTable = true
    for (const cells of expandedRows(table, $)) {
      if (cells.length < 2) continue
      // The method can itself name a game ("Trade from ..."); destination
      // identity must come from the left-hand label cells only.
      const labels = cells.slice(0, Math.min(2, cells.length - 1))
      let index = -1
      let gameIds: string[] = []
      for (let current = labels.length - 1; current >= 0; current--) {
        const matched = resolve(compact($(labels[current]).text())).filter((id) => targets.has(id))
        if (matched.length) {
          index = current
          gameIds = matched
          break
        }
      }
      if (index < 0) continue
      const context = cells
        .slice(0, index + 1)
        .map((cell) => compact($(cell).text()))
        .join(' / ')
      const methodCells = cells
        .slice(index + 1)
        .filter((cell) => !/^Details$/i.test(compact($(cell).text())))
      const entries = methodCells.flatMap((cell) => {
        const text = readCell($(cell), $)
        return text.text
          ? [{ ...text, url: evidence.url, notes: [`Source row: ${context}`, ...text.notes] }]
          : []
      })
      addEntries(byGame, gameIds, entries)
      for (const id of gameIds) {
        const game = games.find((game) => game.id === id)!
        const methods = methodCells.flatMap((cell) =>
          sourceCellMethods($(cell), $, pokemon, siblings, games, game, 'serebii'),
        )
        methodsByGame.set(id, [...(methodsByGame.get(id) ?? []), ...methods])
      }
    }
  })
  if (!foundLocationTable) throw new Error('Serebii location table was not found.')
  const covered = unique([
    ...evidence.gameIds,
    ...modernExtras.filter((id) => id === 'lza' || byGame.has(id)),
  ])
  return { rows: rowsFromEntries(covered, byGame, methodsByGame), notes: unique(notes) }
}

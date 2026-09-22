import { load, type CheerioAPI } from 'cheerio'
import { stripVTControlCharacters, styleText } from 'node:util'
import { sortStringsInGivenOrder } from '../../utils/utils-internal.ts'
import type { AvailabilityCrossChecks } from './cross-check.ts'

export const availabilityFields = ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn'] as const
type AvailabilityField = (typeof availabilityFields)[number]
export type AvailabilityStatus = AvailabilityField | 'unavailable' | 'unknown'
export type AvailabilityJson = Pick<
  AvailabilityPokemon,
  'id' | 'nid' | AvailabilityField | 'storableIn'
>
type Selection = ReturnType<CheerioAPI>

export type AvailabilityPokemon = Pick<
  Pkds.Pokemon,
  | 'id'
  | 'nid'
  | 'dexNum'
  | 'gen'
  | 'isDefault'
  | 'isFemaleForm'
  | 'isBattleOnlyForm'
  | 'isRegional'
  | 'region'
  | 'refs'
  | AvailabilityField
  | 'storableIn'
> & {
  formId?: Pkds.Pokemon['formId']
  names: Partial<Pkds.Pokemon['names']>
  formNames: Partial<Pkds.Pokemon['formNames']>
}
export type AvailabilityGame = Pick<
  Pkds.Game,
  'id' | 'name' | 'gen' | 'type' | 'gameSet' | 'gameSuperSet'
> &
  Partial<Pick<Pkds.Game, 'pokeApiGameVersionId' | 'pokeApiGameVersionGroupId'>>

export type LocationMethod = {
  text: string
  status: AvailabilityStatus
  note?: string
}
export type AvailabilityRow = {
  game: AvailabilityGame
  status: AvailabilityStatus
  basis: 'source' | 'rule' | 'dataset' | 'unknown' | 'ai'
  methods: LocationMethod[]
  storable: boolean
}
export type AvailabilityReport = {
  pokemon: AvailabilityPokemon
  gameOrder: string[]
  rows: AvailabilityRow[]
  warnings: string[]
  candidateJson?: AvailabilityJson
  crossChecks?: AvailabilityCrossChecks
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\bpokemon\b/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

const ignoredUpstreamGames = new Set(['greenjapan', 'bluejapan', 'palpark'])

export function isIgnoredUpstreamGame(label: string): boolean {
  return ignoredUpstreamGames.has(normalizeName(label))
}

export function resolvePokemon(input: string, pokemon: AvailabilityPokemon[]): AvailabilityPokemon {
  const id = input.trim().toLowerCase()
  const nid = id.replace(/^\d{1,4}(?=-|$)/, (digits) => digits.padStart(4, '0'))
  const result = pokemon.find((entry) => entry.id === id || entry.nid === nid)
  if (!result) throw new Error(`Unknown Pokémon id or nid: ${input}`)
  return result
}

export function bulbapediaUrl(pokemon: AvailabilityPokemon): string {
  const slug = pokemon.refs.bulbapedia.trim()
  if (!slug) throw new Error(`No Bulbapedia reference for ${pokemon.id}`)
  return `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(`${slug.replace(/ /g, '_')}_(Pokémon)`)}`
}

/** Header labels, never arbitrary links in the method cell, identify destination games. */
export function createGameResolver(games: AvailabilityGame[]): (label: string) => string[] {
  const aliases = new Map<string, string[]>()
  for (const game of games) {
    let ids: string[]
    if (game.type === 'game') ids = [game.id]
    else if (game.type === 'dlc') {
      ids = games
        .filter(
          (entry) =>
            entry.type === 'game' && (entry.gameSet === game.gameSet || entry.id === game.gameSet),
        )
        .map((entry) => entry.id)
    } else {
      ids = games
        .filter(
          (entry) =>
            entry.type === 'game' && (entry.gameSet === game.id || entry.gameSuperSet === game.id),
        )
        .map((entry) => entry.id)
    }
    for (const label of [game.id, game.name]) aliases.set(normalizeName(label), ids)
  }
  const special: Record<string, string[]> = {
    XD: ['xd'],
    'Sword and Shield Expansion Pass': ['swsh-sw', 'swsh-sh'],
    'Sword Expansion Pass': ['swsh-sw'],
    'Shield Expansion Pass': ['swsh-sh'],
    'The Hidden Treasure of Area Zero': ['sv-s', 'sv-v'],
    'The Hidden Treasure of Area Zero (Scarlet)': ['sv-s'],
    'The Hidden Treasure of Area Zero (Violet)': ['sv-v'],
    'Mega Dimension': ['lza'],
  }
  for (const [label, ids] of Object.entries(special)) {
    aliases.set(
      normalizeName(label),
      ids.filter((id) => games.some((game) => game.id === id)),
    )
  }
  return (label) => (isIgnoredUpstreamGame(label) ? [] : (aliases.get(normalizeName(label)) ?? []))
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function formAliases(pokemon: AvailabilityPokemon): Set<string> {
  const labels = [pokemon.names.eng, pokemon.formNames.eng, pokemon.formId]
  if (
    [422, 423].includes(Number(pokemon.dexNum)) &&
    ['west', 'east'].includes(pokemon.formId ?? '')
  )
    labels.push(`${pokemon.formId} Sea`)
  if (pokemon.isDefault || pokemon.isFemaleForm) {
    labels.push('regular form', 'normal form', 'standard form', pokemon.refs.bulbapedia)
    const regional: Record<string, string> = {
      kanto: 'Kantonian',
      johto: 'Johtonian',
      hoenn: 'Hoennian',
      sinnoh: 'Sinnohian',
      unova: 'Unovan',
      kalos: 'Kalosian',
      alola: 'Alolan',
      galar: 'Galarian',
      hisui: 'Hisuian',
      paldea: 'Paldean',
    }
    if (regional[pokemon.region]) labels.push(`${regional[pokemon.region]} Form`)
  }
  return new Set(labels.filter((label): label is string => !!label).map(normalizeForm))
}

function normalizeForm(value: string): string {
  return normalizeName(value.replace(/\bforme?s?\b/gi, ''))
}

function matchesFormLabel(label: string, aliases: Set<string>, knownForms: Set<string>): boolean {
  if (aliases.has(normalizeForm(label))) return true
  // Shared suffixes such as "Kantonian/Hisuian Forms" name several specific forms.
  const parts = label.split(/\s*(?:\/|,|&|\band\b)\s*/i)
  const suffix = parts
    .at(-1)
    ?.replace(/\bforme?s?\b/gi, '')
    .trim()
    .match(/^[^-\s]+([-\s].+)$/)?.[1]
  const forms = parts.map((part) => {
    const normalized = normalizeForm(part)
    // Abbreviated shared suffixes: "Red/Blue-Striped Forms", "West/East Sea".
    if (!knownForms.has(normalized) && suffix && knownForms.has(normalizeForm(part + suffix)))
      return normalizeForm(part + suffix)
    return normalized
  })
  return (
    forms.length > 1 &&
    forms.every((form) => knownForms.has(form)) &&
    forms.some((form) => aliases.has(form))
  )
}

function classifyMethod(
  fragment: Selection,
  dexNum?: number,
  resolveGame: (label: string) => string[] = () => [],
): AvailabilityStatus {
  const text = cleanText(fragment.text())
  const links = fragment
    .find('a')
    .toArray()
    .map((node) => `${node.attribs.href ?? ''} ${node.attribs.title ?? ''}`)
    .join(' ')
  if (/\{\{|\b(?:unknown|to be confirmed|TBA|TBD)\b/i.test(text)) return 'unknown'
  if (/^(?:unobtainable|unavailable|not available|not in (?:this|the) game)\b/i.test(text))
    return 'unavailable'
  const inGameTrade = /In.game.trade/i.test(links)
  if (inGameTrade) return 'obtainableIn'
  // Some NPC-trade rows link to generic Trade (e.g. "Trade Abra on Route 2").
  // Require a requested species or named trading partner and a linked route/city/town.
  const locationTrade = fragment
    .find('a')
    .toArray()
    .some((node) => {
      const href = node.attribs.href ?? ''
      const requestedSpecies = /\/wiki\/[^/]+_\(Pok(?:%C3%A9|é)mon\)/i.test(href)
      if (
        !requestedSpecies &&
        (!href.startsWith('/wiki/') || /\/Player(?:$|#)|\/Trade(?:$|#)/i.test(href))
      )
        return false
      const species = cleanText(
        fragment
          .find('a')
          .filter((_, anchor) => anchor === node)
          .text(),
      )
      if (!requestedSpecies && !text.startsWith(`Trade with ${species} `)) return false
      return fragment
        .find('a')
        .toArray()
        .some((place) => {
          if (
            !/^\/wiki\/(?:[A-Za-z]+_)?Route_\d+(?:$|#)|^\/wiki\/[^/]+_(?:City|Town|Village)(?:$|#)/.test(
              place.attribs.href ?? '',
            )
          )
            return false
          const name = cleanText(
            fragment
              .find('a')
              .filter((_, anchor) => anchor === place)
              .text(),
          )
          const prefixes = [requestedSpecies ? `Trade ${species}` : `Trade with ${species}`]
          // Named NPCs can appear between the requested species and the town.
          fragment.find('a').each((_, npc) => {
            const href = npc.attribs.href ?? ''
            if (
              npc === node ||
              npc === place ||
              !href.startsWith('/wiki/') ||
              /Pok(?:%C3%A9|é)mon|\/Trade(?:$|#)|\/Player(?:$|#)/i.test(href)
            )
              return
            const npcName = cleanText(
              fragment
                .find('a')
                .filter((_, anchor) => anchor === npc)
                .text(),
            )
            prefixes.push(`Trade ${species} to ${npcName}`, `Trade ${species} with ${npcName}`)
          })
          return prefixes.some((prefix) =>
            ['on', 'in', 'at'].some((preposition) =>
              text.startsWith(`${prefix} ${preposition} ${name}`),
            ),
          )
        })
    })
  if (locationTrade) return 'obtainableIn'
  // The transfer unlocks the box; the selected Meltan is subsequently caught in GO.
  if (dexNum === 808 && /^Mystery Box\b/i.test(text) && /Mystery_Box/.test(links))
    return 'obtainableIn'
  const externalTransfer =
    /Pok[eé] (?:Transfer|Transporter)|Pok[eé]mon (?:HOME|Bank)|Pal Park|Time Capsule|GO Park|transfe[rn]|migrate/i.test(
      text,
    )
  // A trailing event is an additional route, not a restriction on the preceding route.
  // Keep parenthesized event requirements intact (e.g. an event-only island encounter).
  if (/[,;]\s*(?:Event|Pok[eé] Portal News|Wild Area News)\b/i.test(text)) {
    const ordinary = fragment.clone()
    const anchors = ordinary.find('a')
    anchors.each((index) => {
      const anchor = anchors.eq(index)
      if (/^(?:Event|Pok[eé] Portal News|Wild Area News)$/i.test(cleanText(anchor.text())))
        anchor.remove()
    })
    if (cleanText(ordinary.text()) !== text) return classifyMethod(ordinary, dexNum, resolveGame)
  }
  if (externalTransfer || /^Trade\b/i.test(text)) return 'transferOnlyIn'
  if ((dexNum === 251 || dexNum === 385) && /Bonus Disc/i.test(text)) return 'transferOnlyIn'
  if (dexNum === 385 && /Pok[eé]mon Channel/i.test(text)) return 'transferOnlyIn'
  // Navel Rock rows name the required item without spelling out its event restriction.
  // FRLG also documents an ordinary route in its Switch release in a tooltip.
  if (/requires\s+MysticTicket/i.test(text) && /\/MysticTicket\b/.test(links)) {
    const ordinaryRelease = fragment
      .find('.explain[title]')
      .toArray()
      .some((node) => /available without an event/i.test(node.attribs.title ?? ''))
    return ordinaryRelease ? 'obtainableIn' : 'eventOnlyIn'
  }
  if (
    /\bevent\b|Pok[eé] Portal News|Wild Area News|Mystery Gift|distribution/i.test(text) ||
    /requires\s+Mythical Pecha Berry/i.test(text) ||
    /#In_events\b/.test(links)
  )
    return 'eventOnlyIn'
  // Ordinary multiplayer catches count even when the host owns the other version.
  if (/\bUnion Circle\b|\bTera Raid (?:Battles?|Battle Search)\b/i.test(text)) return 'obtainableIn'
  // These recognizable game/service routes import the Pokémon into the destination.
  // Do not infer an external game from arbitrary unmatched location or DLC links.
  const externalGame = text.match(
    /(?:Pok[eé]mon\s+)?(?:Colosseum Bonus Disc|Bonus Disc|Dream World|Dream Radar)|Pok[eé]walker|My Pok[eé]mon Ranch|Pok[eé]mon Channel/i,
  )?.[0]
  if (externalGame) return resolveGame(externalGame).length ? 'unknown' : 'transferOnlyIn'
  if (
    /\b(?:evolve|breed|hatch|gift|received|receive|reward|starter|first pok[eé]mon|revive|revival|catch|capture|defeat|befriend)\b/i.test(
      text,
    )
  )
    return 'obtainableIn'
  // Location cells normally link to an area or an encounter mechanic. Bare, unfamiliar
  // prose is left for review instead of treating every nonempty cell as a wild encounter.
  if (fragment.find('a[href^="/wiki/"]').length > 0) return 'obtainableIn'
  return 'unknown'
}

export function readMethods(
  cell: Selection,
  pokemon: AvailabilityPokemon,
  siblings: AvailabilityPokemon[],
  resolveGame: (label: string) => string[],
): LocationMethod[] {
  const clone = cell.clone()
  clone.find('script, style, .reference, .mw-editsection').remove()
  // HTML blocks separate acquisition methods too. Otherwise an adjacent form's
  // "Unobtainable" can swallow the next paragraph's encounter and form annotation.
  clone.find('p, div, li, td, th').before('<!--method-break-->').after('<!--method-break-->')
  clone.find('br').replaceWith('<!--method-break-->')
  const aliases = formAliases(pokemon)
  const knownForms = new Set(siblings.flatMap((sibling) => [...formAliases(sibling)]))
  return (clone.html() ?? '').split('<!--method-break-->').flatMap((html) => {
    const $ = load(html, null, false)
    const fragment = $.root()
    fragment.find('sup').before(' ').after(' ')
    const text = cleanText(fragment.text())
    if (!text) return []
    const labels = fragment
      .find('small')
      .toArray()
      .map((node) => cleanText($(node).text()).replace(/^\(|\)$/g, ''))
      .filter(
        (label) =>
          // The Gigantamax Factor is a gift attribute, not the recipient's current form.
          !/^gigantamax factor$/i.test(label) &&
          (knownForms.has(normalizeForm(label)) ||
            /\b(?:forms?|formes?|cap|cosplay|gigantamax|original color)\b/i.test(label)),
      )
    const allForms = labels.some((label) => /^(?:all|both) forms?$/i.test(label))
    const matches = labels.some((label) => matchesFormLabel(label, aliases, knownForms))
    if (labels.length && !allForms && !matches) return []
    // A species table is not evidence for every alternate/battle-only form.
    if (
      pokemon.isBattleOnlyForm ||
      (!labels.length && !pokemon.isDefault && !pokemon.isFemaleForm)
    ) {
      return [
        { text, status: 'unknown', note: 'Species-level method; this form needs verification' },
      ]
    }
    const versionQualifier = fragment
      .find('sup a')
      .toArray()
      .some((node) => /Pok[eé]mon.*(?:and|Version)/i.test($(node).attr('title') ?? ''))
    if (versionQualifier)
      return [{ text, status: 'unknown', note: 'Version-qualified method needs verification' }]
    return [{ text, status: classifyMethod(fragment, Number(pokemon.dexNum), resolveGame) }]
  })
}

export function sourceStatus(methods: LocationMethod[]): AvailabilityStatus {
  for (const field of availabilityFields) {
    if (methods.some((method) => method.status === field)) {
      // An unknown method might add an ordinary route or change event exclusivity.
      if (field !== 'obtainableIn' && methods.some((method) => method.status === 'unknown'))
        return 'unknown'
      return field
    }
  }
  return methods.length && methods.every((method) => method.status === 'unavailable')
    ? 'unavailable'
    : 'unknown'
}

function datasetStatus(pokemon: AvailabilityPokemon, gameId: string): AvailabilityStatus {
  return availabilityFields.find((field) => pokemon[field].includes(gameId)) ?? 'unknown'
}

export function parseAvailability(
  html: string,
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  siblings: AvailabilityPokemon[] = [pokemon],
): AvailabilityReport {
  const $ = load(html)
  const heading = $('#Game_locations').closest('h2,h3,h4')
  if (!heading.length)
    throw new Error(
      'Bulbapedia Game locations section was not found (blocked response or changed markup).',
    )
  const pageTitle = cleanText($('#firstHeading, h1').first().text())
  if (
    pageTitle &&
    normalizeName(pageTitle.replace(/\(Pokémon\)/, '')) !== normalizeName(pokemon.refs.bulbapedia)
  ) {
    throw new Error(
      `Page title ${JSON.stringify(pageTitle)} does not match ${pokemon.refs.bulbapedia}.`,
    )
  }
  const resolveGame = createGameResolver(games)
  const methodsByGame = new Map<string, LocationMethod[]>()
  const unmapped = new Set<string>()
  let matchedRows = 0
  for (const section of [heading, $('#In_side_games').closest('h2,h3,h4')]) {
    const anchor = section.parent().hasClass('mw-heading') ? section.parent() : section
    const content = anchor.nextUntil('h1,h2,h3,h4,h5,h6,.mw-heading')
    content.find('tr').each((_, element) => {
      const row = $(element)
      const headers = row.children('th')
      const cells = row.children('td')
      if (!headers.length || !cells.length) return
      const labels = headers.toArray().map((node) => cleanText($(node).text()))
      const ids = [
        ...new Set(
          headers.toArray().flatMap((node) => {
            const header = $(node)
            const label = cleanText(header.text())
            if (normalizeName(label) !== 'expansionpass') return resolveGame(label)
            // The generic label alone has no game identity. Resolve its article link;
            // version-specific visible labels above remain authoritative over a paired link.
            return header
              .find('a')
              .toArray()
              .flatMap((anchor) => {
                if (normalizeName($(anchor).text()) !== 'expansionpass') return []
                const href = $(anchor).attr('href') ?? ''
                if (!href.startsWith('/wiki/')) return []
                try {
                  return resolveGame(
                    decodeURIComponent(href.slice(6).split('#')[0]).replaceAll('_', ' '),
                  )
                } catch {
                  return []
                }
              })
          }),
        ),
      ]
      if (!ids.length) {
        if (section === heading && headers.find('a').length)
          labels
            .filter((label) => !isIgnoredUpstreamGame(label))
            .forEach((label) => unmapped.add(label))
        return
      }
      matchedRows++
      const methods = cells
        .toArray()
        .flatMap((cell) => readMethods($(cell), pokemon, siblings, resolveGame))
      const isExpansion = labels.some((label) =>
        /expansion|treasure|dimension|teal mask|indigo disk|isle of armor|crown tundra/i.test(
          label,
        ),
      )
      for (const id of ids) {
        const existing = methodsByGame.get(id) ?? []
        existing.push(
          ...methods.map((method) => ({
            ...method,
            text: isExpansion ? `[${labels.join(' / ')}] ${method.text}` : method.text,
          })),
        )
        methodsByGame.set(id, existing)
      }
    })
  }
  if (!matchedRows)
    throw new Error(
      'No recognized game-location rows found; refusing to produce an empty availability result.',
    )
  const rows = games
    .filter((game) => game.type === 'game')
    .map((game): AvailabilityRow => {
      // Species-level encounters cannot establish a female form before genders existed.
      if (pokemon.isFemaleForm && game.gen === 1) {
        return {
          game,
          status: 'unavailable',
          basis: 'rule',
          methods: [
            { text: 'Female forms do not exist before Generation II.', status: 'unavailable' },
          ],
          storable: pokemon.storableIn.includes(game.id),
        }
      }
      const methods = [
        ...new Map(
          (methodsByGame.get(game.id) ?? []).map((method) => [method.text, method]),
        ).values(),
      ]
      const parsed = sourceStatus(methods)
      const confirmedLzaEvent =
        game.id === 'lza' &&
        ['diancie', 'diancie-mega', 'mewtwo', 'mewtwo-mega-x', 'mewtwo-mega-y'].includes(pokemon.id)
      // Confirmed dataset policy: this Mystery Gift unlock is event-only. The base
      // game's generic Trade placeholder must not override the DLC acquisition.
      if (
        confirmedLzaEvent ||
        (((pokemon.id === 'zeraora' && game.id === 'lza') ||
          (pokemon.id === 'pecharunt' && ['sv-s', 'sv-v'].includes(game.id))) &&
          methods.some(
            (method) =>
              method.status === 'eventOnlyIn' &&
              /Mystery Gift|Mythical Pecha Berry/i.test(method.text),
          ))
      )
        return {
          game,
          status: 'eventOnlyIn',
          basis: 'rule',
          methods: confirmedLzaEvent
            ? [
                ...methods,
                {
                  text: 'Confirmed dataset rule: this Pokémon and its Mega forms require event acquisition in Legends: Z-A.',
                  status: 'eventOnlyIn',
                },
              ]
            : methods,
          storable: pokemon.storableIn.includes(game.id),
        }
      const current = datasetStatus(pokemon, game.id)
      // Event history is not proof of exclusivity when a transfer route is already known.
      const preserveTransfer = parsed === 'eventOnlyIn' && current === 'transferOnlyIn'
      const retain = parsed === 'unknown' || preserveTransfer
      return {
        game,
        status: retain ? current : parsed,
        basis: retain ? (current === 'unknown' ? 'unknown' : 'dataset') : 'source',
        methods,
        storable: pokemon.storableIn.includes(game.id),
      }
    })
  const warnings = [
    'storableIn is preserved from the dataset; location tables do not establish box compatibility or form reversion.',
  ]
  const retained = rows
    .filter((row) => row.basis === 'dataset' || row.basis === 'unknown')
    .map((row) => row.game.id)
  if (retained.length)
    warnings.push(
      `Acquisition not established by this page; existing values retained for: ${retained.join(', ')}.`,
    )
  const review = rows
    .filter((row) => row.methods.some((method) => method.status === 'unknown'))
    .map((row) => row.game.id)
  if (review.length)
    warnings.push(
      `Methods need verification for: ${review.join(', ')}. See the table for source text.`,
    )
  if (unmapped.size)
    warnings.push(
      `Source-only game/service labels not in the dataset: ${[...unmapped].join(', ')}.`,
    )
  return { pokemon, gameOrder: games.map((game) => game.id), rows, warnings }
}

/** Candidate fields only; unresolved games and storage retain their existing values. */
export function availabilityJson(report: AvailabilityReport): AvailabilityJson {
  const { pokemon, rows } = report
  const candidate = report.candidateJson ?? pokemon
  const result = {
    id: candidate.id,
    nid: candidate.nid,
    obtainableIn: [...candidate.obtainableIn],
    transferOnlyIn: [...candidate.transferOnlyIn],
    eventOnlyIn: [...candidate.eventOnlyIn],
    storableIn: [...candidate.storableIn],
  }
  if (!report.candidateJson) {
    for (const row of rows) {
      if (row.basis !== 'source' && row.basis !== 'rule') continue
      for (const field of availabilityFields) {
        result[field] = result[field].filter((id) => id !== row.game.id)
        if (row.status === field) result[field].push(row.game.id)
      }
    }
  }
  for (const field of [...availabilityFields, 'storableIn'] as const) {
    const ids = field === 'storableIn' ? result[field] : [...new Set(result[field])]
    // Include sets/DLC from the full index, and retain unrecognized IDs at the end.
    result[field] = sortStringsInGivenOrder(ids, [...report.gameOrder, ...ids])
  }
  return result
}

export function availabilityChanges(report: AvailabilityReport) {
  const candidate = availabilityJson(report)
  return [...availabilityFields, 'storableIn' as const].map((field) => {
    const before = new Set(report.pokemon[field])
    const after = new Set(candidate[field])
    return {
      field,
      added: [...after].filter((id) => !before.has(id)),
      removed: [...before].filter((id) => !after.has(id)),
    }
  })
}

export function formatAvailabilityChanges(report: AvailabilityReport): string {
  const colors = {
    obtainableIn: 'green',
    transferOnlyIn: 'cyan',
    eventOnlyIn: 'magenta',
    storableIn: 'yellow',
  } as const
  const games = new Map(report.rows.map((row) => [row.game.id, row.game.name]))
  const describe = (ids: string[]) =>
    ids.map((id) => (games.has(id) ? `${games.get(id)} (${id})` : id)).join(', ')
  return availabilityChanges(report)
    .map(({ field, added, removed }) => {
      const label = styleText(['bold', colors[field]], `${field}:`)
      if (!added.length && !removed.length) return `${label} unchanged`
      return `${label}\n  Added: ${describe(added) || 'none'}\n  Removed: ${describe(removed) || 'none'}`
    })
    .join('\n')
}

export function formatAvailabilityProposal(report: AvailabilityReport): string {
  const changes = availabilityChanges(report)
  const added = changes.reduce((count, change) => count + change.added.length, 0)
  const removed = changes.reduce((count, change) => count + change.removed.length, 0)
  return `Proposed changes: ${added || removed ? `${added} additions, ${removed} removals` : 'none'}\n${formatAvailabilityChanges(report)}`
}

function wrapCell(text: string, width: number): string[] {
  const clean = stripVTControlCharacters(text).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
  return clean.split('\n').flatMap((paragraph) => {
    const lines: string[] = []
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && Array.from(`${line} ${word}`).length <= width) {
        line += ` ${word}`
        continue
      }
      if (line) lines.push(line)
      const characters = Array.from(word)
      while (characters.length > width) lines.push(characters.splice(0, width).join(''))
      line = characters.join('')
    }
    lines.push(line)
    return lines
  })
}

export function formatAvailabilityTable(
  report: AvailabilityReport,
  columns = process.stdout.columns || 120,
): string {
  const width = Math.max(60, Math.min(160, columns))
  const gameWidth = Math.min(26, Math.floor(width / 4))
  const widths = [gameWidth, 13, 7, width - gameWidth - 13 - 7 - 13]
  const border = (left: string, middle: string, right: string) =>
    left + widths.map((size) => '─'.repeat(size + 2)).join(middle) + right
  const renderRow = (cells: string[]) => {
    const wrapped = cells.map((cell, index) => wrapCell(cell, widths[index]))
    return Array.from(
      { length: Math.max(...wrapped.map((cell) => cell.length)) },
      (_, line) =>
        '│ ' +
        wrapped
          .map((cell, index) => {
            const value = cell[line] ?? ''
            return value + ' '.repeat(widths[index] - Array.from(value).length)
          })
          .join(' │ ') +
        ' │',
    )
  }
  const statuses: Record<AvailabilityStatus, string> = {
    obtainableIn: 'Obtainable',
    transferOnlyIn: 'Transfer only',
    eventOnlyIn: 'Event only',
    unavailable: 'Unavailable',
    unknown: 'Unknown',
  }
  const lines = [
    border('┌', '┬', '┐'),
    ...renderRow(['Game (ID)', 'Acquisition', 'Basis', 'How to obtain']),
  ]
  for (const row of report.rows) {
    const methods = row.methods
      .map((method) => `${method.text}${method.note ? ` (${method.note})` : ''}`)
      .join('\n')
    lines.push(
      border('├', '┼', '┤'),
      ...renderRow([
        `${row.game.name} (${row.game.id})`,
        report.crossChecks?.conflicts.some(
          (conflict) =>
            conflict.gameId === row.game.id &&
            report.crossChecks!.unresolvedConflictIds.includes(conflict.id),
        )
          ? 'Uncertain'
          : statuses[row.status],
        row.basis,
        methods || 'No matching source row; needs verification',
      ]),
    )
  }
  lines.push(border('└', '┴', '┘'))
  return lines.join('\n')
}

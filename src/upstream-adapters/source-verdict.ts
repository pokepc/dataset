import { load, type CheerioAPI } from 'cheerio'
import type { AvailabilitySourceVerdict } from '../lib/availability-sources.ts'
import {
  createGameResolver,
  readMethods,
  sourceStatus,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type LocationMethod,
} from './bulbapedia/availability.ts'
import { parsePokeApiEncounters } from './bulbapedia/cross-check.ts'
import { findEncounterException } from './bulbapedia/encounter-exceptions.ts'

type Selection = ReturnType<CheerioAPI>
type Encounter = ReturnType<typeof parsePokeApiEncounters>['encounters'][number]
const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const unknown = (text: string, note: string): LocationMethod => ({ text, status: 'unknown', note })

/** Summarize acquisition routes from this source, never current dataset fields. */
export function sourceVerdict(methods: LocationMethod[]): AvailabilitySourceVerdict {
  const status = sourceStatus(methods)
  const statuses = {
    obtainableIn: 'obtainable',
    transferOnlyIn: 'transfer-only',
    eventOnlyIn: 'event-only',
    unavailable: 'unavailable',
    unknown: 'unknown',
  } as const
  const relevant = methods.filter((method) => method.status === status)
  return {
    status: statuses[status],
    reason:
      relevant.map((method) => method.note ?? method.text).join('; ') ||
      'The source does not establish acquisition for this selected form.',
  }
}

/** Add stricter evidence guards around the CLI's pure source-method reader. */
export function sourceCellMethods(
  cell: Selection,
  sourceDocument: CheerioAPI,
  pokemon: AvailabilityPokemon,
  siblings: AvailabilityPokemon[],
  games: AvailabilityGame[],
  game: AvailabilityGame,
  source: 'bulbapedia' | 'serebii',
): LocationMethod[] {
  const clone = cell.clone()
  clone.find('script,style,.mw-editsection').remove()
  clone.find('p,div,li').before('<!--source-method-->').after('<!--source-method-->')
  clone.find('br').replaceWith('<!--source-method-->')
  const fragments = (clone.html() ?? '')
    .split('<!--source-method-->')
    .filter((html) => compact(load(html).text()))
  // A form label on a separate line may qualify the preceding location. Do not
  // discard it and accidentally treat that location as an unqualified route.
  const detachedForm = fragments.some((html) => {
    const text = compact(load(html).text())
    return /^\(?[\w %/-]+ (?:Forms?|Formes?)\)?$/i.test(text)
  })
  if (detachedForm)
    return [unknown(compact(cell.text()), 'A separate form label needs manual interpretation.')]

  return fragments.flatMap((html) => {
    const $ = load(html, null, false)
    const fragment = $.root()
    const text = compact(fragment.text())
    if (!text) return []
    const annotations = fragment
      .find('[title]')
      .toArray()
      // These article titles refer to permanent gifts/story encounters, not distributions.
      .filter(
        (node) => !($(node).is('a') && /\bin-game events?\b/i.test($(node).attr('title') ?? '')),
      )
      .map((node) => $(node).attr('title') ?? '')
    fragment.find('a[href^="#cite_note"]').each((_, node) => {
      const id = $(node).attr('href')!.slice(1)
      annotations.push(
        sourceDocument('[id]')
          .filter((_, element) => sourceDocument(element).attr('id') === id)
          .text(),
      )
    })
    const evidence = [text, ...annotations].join(' ')
    const selected = pokemon.isFemaleForm ? { ...pokemon, isFemaleForm: false } : pokemon
    const methods = readMethods(fragment, selected, siblings, createGameResolver(games))
    if (!methods.length) {
      // A recognized different form can be omitted. An unparsed combined label
      // (e.g. "50% Forme, Power Construct") may still describe this form, so it
      // must block a false exclusive verdict from the remaining Trade row.
      const otherForm = siblings.some(
        (sibling) =>
          sibling.id !== pokemon.id &&
          readMethods(fragment, sibling, siblings, createGameResolver(games)).length > 0,
      )
      return otherForm
        ? []
        : [unknown(text, 'The source form qualifier could not be matched to the selected form.')]
    }
    const outsideLabels = fragment.clone()
    outsideLabels.find('small').remove()
    if (/\([^)]*\bforme?s?\b[^)]*\)/i.test(outsideLabels.text()))
      return [unknown(text, 'The source has an inline form qualifier that needs manual review.')]
    if (
      /\brental\b|Battle Bingo|\b(?:never|not)\s+(?:(?:officially|actually)\s+)?(?:released|distributed)|unreleased|unused encounter/i.test(
        evidence,
      )
    )
      return [
        unknown(text, 'The source describes a rental or an unreleased acquisition condition.'),
      ]
    if (
      /\b(?:requires?|requiring|only if|provided that)\b/i.test(evidence) &&
      !/\bevent\b|Mystery Gift|distribution/i.test(evidence)
    )
      return [unknown(text, 'The source has an acquisition prerequisite that needs manual review.')]
    if (pokemon.isFemaleForm && !/\bfemale\b|♀/i.test(text))
      return [
        unknown(text, 'The species row does not explicitly identify the selected female form.'),
      ]
    if (
      (pokemon.isDefault || pokemon.isFemaleForm) &&
      siblings.some(
        (sibling) => sibling.isRegional && sibling.gen <= game.gen && sibling.id !== pokemon.id,
      ) &&
      !fragment.find('small').length
    )
      return [
        unknown(
          text,
          'The source does not distinguish the regional forms present in this generation.',
        ),
      ]
    if (
      fragment.find('sup').length &&
      /(?:Sun|Moon|Scarlet|Violet|Sword|Shield|Diamond|Pearl|Ruby|Sapphire)\b/i.test(
        fragment.find('sup').text(),
      )
    )
      return [unknown(text, 'The source has a version-qualified method that needs manual review.')]
    return methods.map((method) => {
      if (method.status === 'unknown' && method.note) return method
      // Prerequisite tooltips/footnotes can identify an event even when the
      // location itself is an ordinary encounter. Preserve that restriction.
      const annotation = annotations.join(' ')
      const eventMentioned = /\bevent\b|Mystery Gift|distribution/i.test(annotation)
      const eventNotRequired =
        /without (?:an? )?event|no event (?:is )?required|event (?:is )?not required/i.test(
          annotation,
        )
      if (eventMentioned && !eventNotRequired) {
        if (method.status === 'eventOnlyIn') return method
        if (
          /requires?\b.*(?:event|Mystery Gift|distribution)|(?:event|Mystery Gift|distribution)[\s-]only|event\b.*(?:required|prerequisite)/i.test(
            annotation,
          )
        )
          return { ...method, status: 'eventOnlyIn' as const }
        return unknown(
          text,
          'The source annotation mentions an event without establishing whether it is required.',
        )
      }
      if (source === 'serebii' && method.status === 'unknown') {
        const location =
          /\b(?:Route\s+\d+|Wild Zone\s+\d+|Dynamax Adventures?|Max Lair|Friend Safari|Safari Zone|Island Scan|Tera Raid Battles?)\b/i.test(
            text,
          )
        const locationLink = fragment
          .find('a[href]')
          .toArray()
          .some((node) =>
            /\/(?:pokearth|pokearth-\w+|pokemongo\/locations)\//i.test($(node).attr('href') ?? ''),
          )
        if (location || locationLink) return { ...method, status: 'obtainableIn' as const }
      }
      return method
    })
  })
}

/** Encounter records can establish a positive route, but cannot prove absence. */
export function pokeApiSourceMethods(
  encounter: Encounter,
  pokemon: AvailabilityPokemon,
  siblings: AvailabilityPokemon[],
  game: AvailabilityGame,
): LocationMethod[] {
  const sharedForms = siblings.some(
    (other) => other.id !== pokemon.id && other.refs.pkApiId === pokemon.refs.pkApiId,
  )
  const regionalAmbiguity =
    (pokemon.isDefault || pokemon.isFemaleForm) &&
    siblings.some((other) => other.isRegional && other.gen <= game.gen)
  if (
    pokemon.isBattleOnlyForm ||
    pokemon.isFemaleForm ||
    sharedForms ||
    regionalAmbiguity ||
    ['422', '423'].includes(pokemon.refs.pkApiId)
  )
    return [
      unknown(
        encounter.location,
        'The encounter endpoint does not independently identify the selected form or gender.',
      ),
    ]
  return encounter.methods.map((method) => {
    const text = `${encounter.location}: ${method.name}${method.conditions.length ? ` (${method.conditions.join(', ')})` : ''}`
    const exception = findEncounterException(pokemon.refs.pkApiId, encounter, method)
    if (exception) return unknown(text, `Known upstream encounter exception: ${exception.reason}`)
    // The existing encounter cross-check records this omission: an unqualified
    // static record does not describe Navel Rock's event-item prerequisite.
    if (
      ['249', '250'].includes(pokemon.refs.pkApiId) &&
      encounter.gameId === 'e' &&
      encounter.location === 'navel-rock-area' &&
      method.name === 'static'
    )
      return unknown(
        text,
        'This encounter record omits the known event-item prerequisite; check the page evidence.',
      )
    if (/rental|unreleased|unused/i.test([method.name, ...method.conditions].join(' ')))
      return unknown(text, 'The encounter describes a rental or an unreleased route.')
    if (
      /^(?:pokemon-ranger|colosseum-bonus-disc-jpn|colosseum-bonus-disc-us|pokemon-channel-pal|trade|gift-egg-from-pokemon-ranger)$/i.test(
        method.name,
      )
    )
      return { text, status: 'transferOnlyIn' }
    if (/event|distribution|mystery-gift/i.test([method.name, ...method.conditions].join(' ')))
      return { text, status: 'eventOnlyIn' }
    const unexplained = method.conditions.filter(
      (condition) =>
        !/^(?:time-(?:morning|day|night)|season-|swarm-|radar-|slot2-|radio-|story-progress-|weekday-|weekend-|weather-|rock-smash-|tv-option-)/.test(
          condition,
        ),
    )
    if (unexplained.length)
      return unknown(text, `Encounter conditions need manual review: ${unexplained.join(', ')}.`)
    if (
      !/^(?:walk|surf|old-rod|good-rod|super-rod|rock-smash|headbutt|headbutt-low|headbutt-normal|headbutt-high|dark-grass|grass-spots|cave-spots|bridge-spots|super-rod-spots|surf-spots|yellow-flowers|purple-flowers|red-flowers|rough-terrain|gift|gift-egg|static|squirt-bottle|wailmer-pail|seaweed|pokeflute|roaming-grass|roaming-water|devon-scope|feebas-tile-fishing|island-scan|sos-encounter|berry-piles|npc-trade)$/i.test(
        method.name,
      )
    )
      return unknown(text, 'This encounter method needs manual interpretation.')
    return { text, status: 'obtainableIn' }
  })
}

import { describe, expect, it } from 'vitest'
import pikachu from '../../../data/pokemon/pikachu.json'
import femalePikachu from '../../../data/pokemon/pikachu-f.json'
import nidoranFemale from '../../../data/pokemon/nidoranf.json'
import raichu from '../../../data/pokemon/raichu.json'
import alolanRaichu from '../../../data/pokemon/raichu-alola.json'
import megaCharizard from '../../../data/pokemon/charizard-mega-x.json'
import magearna from '../../../data/pokemon/magearna.json'
import originalMagearna from '../../../data/pokemon/magearna-original.json'
import { pokemonSchema } from '../../lib/schemas'
import {
  availabilityJson,
  bulbapediaUrl,
  createGameResolver,
  formatAvailabilityTable,
  parseAvailability,
  resolvePokemon,
  type AvailabilityGame,
  type AvailabilityPokemon,
} from './availability'

const game = (
  id: string,
  name: string,
  gameSet: string | null = null,
  type: AvailabilityGame['type'] = 'game',
  gen = 9,
): AvailabilityGame => ({ id, name, gameSet, gameSuperSet: null, type, gen })
const games = [
  game('rb-r', 'Red', 'rb', 'game', 1),
  game('rb-b', 'Blue', 'rb', 'game', 1),
  game('y', 'Yellow', null, 'game', 1),
  game('gs-g', 'Gold', 'gs', 'game', 2),
  game('sm', 'Sun & Moon', null, 'set'),
  game('sm-s', 'Sun', 'sm'),
  game('sm-m', 'Moon', 'sm'),
  game('swsh-sw', 'Sword', 'swsh'),
  game('swsh-sh', 'Shield', 'swsh'),
  game('swsh-islearmor', 'The Isle of Armor', 'swsh', 'dlc'),
  game('sv-s', 'Scarlet', 'sv'),
  game('sv-v', 'Violet', 'sv'),
  game('lza', 'Legends: Z-A'),
  game('lza-megadimension', 'Legends: Z-A - Mega Dimension', 'lza', 'dlc'),
  game('home', 'HOME'),
  game('go', 'GO'),
]

// Synthetic, reduced fixtures retain the nested tables and annotations used by
// Bulbapedia's Game locations templates, without depending on network or snapshots.
function row(labels: string[], method: string): string {
  return `<tr>${labels.map((label) => `<th><a href="/wiki/Game">${label}</a></th>`).join('')}
    <td><table><tr><td>${method}</td></tr></table></td></tr>`
}
function page(rows: string, species = 'Pikachu'): string {
  return `<h1 id="firstHeading">${species} (Pokémon)</h1>
    <h3><span id="Game_locations">Game locations</span></h3>
    <table><tr><td><table>${rows}</table></td></tr></table>
    <h4 id="In_events">In events</h4>
    <table>${row(['HOME'], '<a href="#In_events">Event</a>')}</table>`
}
const location = '<a href="/wiki/Viridian_Forest">Viridian Forest</a>'
const reportFor = (rows: string, pokemon: AvailabilityPokemon = pikachu) =>
  parseAvailability(page(rows, pokemon.refs.bulbapedia), pokemon, games, [pokemon])

describe('identity and game normalization', () => {
  it.each(['pikachu', ' PIKACHU ', '0025', '25', '025'])('resolves %s', (input) => {
    expect(resolvePokemon(input, [pikachu, alolanRaichu]).id).toBe('pikachu')
  })
  it('resolves exact form nids and rejects unknown forms', () => {
    expect(resolvePokemon('26-alola', [raichu, alolanRaichu]).id).toBe('raichu-alola')
    expect(() => resolvePokemon('26-imaginary', [raichu, alolanRaichu])).toThrow('Unknown Pokémon')
  })
  it('uses the stored reference, including punctuation', () => {
    expect(
      bulbapediaUrl({ ...pikachu, refs: { ...pikachu.refs, bulbapedia: 'Mr. Mime' } }),
    ).toContain('/Mr._Mime_(Pok%C3%A9mon)')
  })
  it('maps paired games and DLC to concrete IDs without confusing Japanese Blue', () => {
    const resolve = createGameResolver(games)
    expect(resolve('Pokémon Sun and Moon')).toEqual(['sm-s', 'sm-m'])
    expect(resolve('Expansion Pass')).toEqual(['swsh-sw', 'swsh-sh'])
    expect(resolve('The Isle of Armor')).toEqual(['swsh-sw', 'swsh-sh'])
    expect(resolve('Mega Dimension')).toEqual(['lza'])
    expect(resolve('Blue (Japan)')).toEqual([])
  })
})

describe('location parsing and classification', () => {
  it('splits paired headers, folds DLC, deduplicates and ignores event history tables', () => {
    const report = reportFor(
      row(['Sword', 'Shield'], 'Trade') +
        row(['Expansion Pass'], location) +
        row(['Expansion Pass'], location),
    )
    expect(new Set(report.rows.map((entry) => entry.game.id)).size).toBe(report.rows.length)
    expect(report.rows.some((entry) => entry.game.type !== 'game')).toBe(false)
    for (const id of ['swsh-sw', 'swsh-sh']) {
      const entry = report.rows.find((entry) => entry.game.id === id)!
      expect(entry.status).toBe('obtainableIn')
      expect(entry.methods).toHaveLength(2)
      expect(entry.methods[1].text).toContain('[Expansion Pass]')
    }
    expect(report.rows.find((entry) => entry.game.id === 'home')?.basis).toBe('dataset')
  })
  it.each([
    [location, 'obtainableIn'],
    ['Evolve Pikachu', 'obtainableIn'],
    ['Breed Raichu', 'obtainableIn'],
    ['<a href="/wiki/In-game_trade#Sun">Trade</a> in a city', 'obtainableIn'],
    ['<a href="/wiki/Trade">Trade</a>', 'transferOnlyIn'],
    ['<a href="/wiki/Pal_Park">Pal Park</a>', 'transferOnlyIn'],
    ['<a href="/wiki/Ramanas_Park">Ramanas Park</a>', 'obtainableIn'],
    ['Poké Transfer, <a href="#In_events">Event</a>', 'transferOnlyIn'],
    ['Pokémon HOME, <a href="/wiki/Poké_Portal_News">Poké Portal News</a>', 'transferOnlyIn'],
    [`${location}, <a href="#In_events">Event</a>`, 'obtainableIn'],
    [`${location} (<a href="#In_events">Event</a>)`, 'eventOnlyIn'],
    ['<a href="#In_events">Event</a>', 'eventOnlyIn'],
    ['Unobtainable', 'unavailable'],
  ])('classifies %s as %s', (method, expected) => {
    expect(reportFor(row(['Red'], method)).rows[0].status).toBe(expected)
  })
  it('keeps a known transfer route over an event-only summary', () => {
    const pokemon = { ...pikachu, obtainableIn: [], transferOnlyIn: ['rb-r'] }
    const report = reportFor(row(['Red'], '<a href="#In_events">Event</a>'), pokemon)
    expect(report.rows[0]).toMatchObject({ status: 'transferOnlyIn', basis: 'dataset' })
    expect(availabilityJson(report).eventOnlyIn).not.toContain('rb-r')
  })
  it('does not treat unfamiliar prose as an encounter or erase unresolved games', () => {
    const pokemon = { ...pikachu, obtainableIn: [], transferOnlyIn: ['rb-r', 'home'] }
    const report = reportFor(row(['Red'], 'Some new mechanic requiring research'), pokemon)
    expect(report.rows[0]).toMatchObject({ status: 'transferOnlyIn', basis: 'dataset' })
    expect(availabilityJson(report).transferOnlyIn).toEqual(['rb-r', 'home'])
    expect(report.warnings.join(' ')).toContain('Methods need verification')
  })
  it('preserves unreviewed storage even when acquisition changes', () => {
    const report = reportFor(row(['Red'], 'Unobtainable'))
    const json = availabilityJson(report)
    expect(json.obtainableIn).not.toContain('rb-r')
    expect(json.storableIn).toEqual(pikachu.storableIn)
    expect(
      pokemonSchema
        .pick({
          id: true,
          nid: true,
          obtainableIn: true,
          transferOnlyIn: true,
          eventOnlyIn: true,
          storableIn: true,
        })
        .parse(json),
    ).toEqual(json)
    expect(pikachu.obtainableIn).toContain('rb-r')
  })
  it('handles MediaWiki heading wrappers and includes dataset side games', () => {
    const html = `<h1>Pikachu (Pokémon)</h1><div class="mw-heading"><h3 id="Game_locations">Game locations</h3></div>
      <table>${row(['Red'], location)}</table>
      <div class="mw-heading"><h4 id="In_side_games">In side games</h4></div>
      <table>${row(['GO'], 'Catch in the wild')}</table>`
    expect(
      parseAvailability(html, pikachu, games).rows.find((entry) => entry.game.id === 'go')?.basis,
    ).toBe('source')
  })
  it('rejects challenge pages, changed markup, and wrong species', () => {
    expect(() => parseAvailability('<h1>Just a moment</h1>', pikachu, games)).toThrow(
      'Game locations',
    )
    expect(() => parseAvailability(page(''), pikachu, games)).toThrow('No recognized')
    expect(() => parseAvailability(page(row(['Red'], location), 'Raichu'), pikachu, games)).toThrow(
      'does not match',
    )
  })
  it('renders a bordered terminal table and keeps literal pipes in source text', () => {
    expect(formatAvailabilityTable(reportFor(row(['Red'], `${location} | grass`)))).toContain(
      'Forest | grass',
    )
    expect(formatAvailabilityTable(reportFor(row(['Red'], location)))).toContain('┌')
    expect(formatAvailabilityTable(reportFor(row(['Red'], location)))).not.toContain('| --- |')
  })
  it.each([60, 80, 120])(
    'wraps long methods to a %i-column terminal without truncating',
    (columns) => {
      const report = reportFor(row(['Red'], `${location} ${'x'.repeat(150)}<br>Breed Pikachu`))
      const table = formatAvailabilityTable(report, columns)
      expect(table.split('\n').every((line) => Array.from(line).length === columns)).toBe(true)
      expect(table.match(/x/g)).toHaveLength(150)
      expect(table).toContain('rb-r')
      expect(table).toContain('Breed')
    },
  )
})

describe('form boundaries', () => {
  it.each([location, 'Trade', '<a href="#In_events">Event</a>'])(
    'excludes Gen 1 acquisition for female forms regardless of species method: %s',
    (method) => {
      const report = reportFor(
        row(['Red', 'Blue', 'Yellow'], method) + row(['Gold'], location),
        femalePikachu,
      )
      const json = availabilityJson(report)
      for (const id of ['rb-r', 'rb-b', 'y']) {
        expect(report.rows.find((entry) => entry.game.id === id)).toMatchObject({
          status: 'unavailable',
          basis: 'rule',
        })
        for (const field of ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn'] as const)
          expect(json[field]).not.toContain(id)
      }
      expect(json.obtainableIn).toContain('gs-g')
      expect(json.storableIn).toEqual(femalePikachu.storableIn)
      expect(formatAvailabilityTable(report)).toContain('Female forms do not exist')
    },
  )
  it('applies the female Gen 1 rule even with absent source rows or stale acquisition data', () => {
    const pokemon = {
      ...femalePikachu,
      obtainableIn: ['rb-r'],
      transferOnlyIn: ['rb-b'],
      eventOnlyIn: ['y'],
    }
    const json = availabilityJson(reportFor(row(['Gold'], location), pokemon))
    expect(json.obtainableIn).toEqual(['gs-g'])
    expect(json.transferOnlyIn).toEqual([])
    expect(json.eventOnlyIn).toEqual([])
  })
  it('allows female-only species such as Nidoran♀ in Gen 1', () => {
    const report = reportFor(row(['Red'], location), nidoranFemale)
    expect(report.rows[0]).toMatchObject({ status: 'obtainableIn', basis: 'source' })
    expect(availabilityJson(report).obtainableIn).toContain('rb-r')
  })
  const formRows = row(
    ['Sun', 'Moon'],
    'Trade <small>(<b>Kantonian Form</b>)</small><br>Evolve Pikachu <small>(<b>Alolan Form</b>)</small>',
  )
  it('keeps regional form methods separate from the default form', () => {
    const html = page(formRows, 'Raichu')
    const base = parseAvailability(html, raichu, games, [raichu, alolanRaichu])
    const alola = parseAvailability(html, alolanRaichu, games, [raichu, alolanRaichu])
    expect(base.rows.find((entry) => entry.game.id === 'sm-s')?.status).toBe('transferOnlyIn')
    expect(alola.rows.find((entry) => entry.game.id === 'sm-s')).toMatchObject({
      status: 'obtainableIn',
      methods: [{ text: 'Evolve Pikachu (Alolan Form)', status: 'obtainableIn' }],
    })
  })
  it('accepts explicit All Forms rows for a regional form', () => {
    const report = reportFor(
      row(
        ['Expansion Pass'],
        '<a href="/wiki/Max_Lair">Max Lair</a> <small>(<b>All Forms</b>)</small>',
      ),
      alolanRaichu,
    )
    expect(report.rows.find((entry) => entry.game.id === 'swsh-sw')).toMatchObject({
      status: 'obtainableIn',
      basis: 'source',
    })
  })
  it('never copies unqualified species acquisition into an alternate or battle form', () => {
    for (const pokemon of [alolanRaichu, megaCharizard]) {
      const report = reportFor(row(['Red'], location), pokemon)
      expect(report.rows[0].basis).toBe('unknown')
      expect(availabilityJson(report).obtainableIn).not.toContain('rb-r')
    }
  })
  it('preserves Original Color Magearna when the page only describes the regular form', () => {
    const report = parseAvailability(
      page(row(['Sun'], '<a href="/wiki/Hauoli_City">Hauoli City</a> (QR Scanner)'), 'Magearna'),
      originalMagearna,
      games,
      [magearna, originalMagearna],
    )
    const json = availabilityJson(report)
    expect(json.eventOnlyIn).toEqual(originalMagearna.eventOnlyIn)
    expect(json.obtainableIn).toEqual(originalMagearna.obtainableIn)
    expect(json.obtainableIn).not.toContain('sm-s')
  })
  it('retains values rather than guessing at version-specific superscripts', () => {
    const report = reportFor(
      row(['Sun', 'Moon'], `${location}<sup><a title="Pokémon Sun and Moon">S</a></sup>`),
    )
    expect(report.rows.find((entry) => entry.game.id === 'sm-m')?.basis).toBe('dataset')
  })
})

import { describe, expect, it } from 'vitest'
import pikachu from '../../../data/pokemon/pikachu.json'
import femalePikachu from '../../../data/pokemon/pikachu-f.json'
import nidoranFemale from '../../../data/pokemon/nidoranf.json'
import raichu from '../../../data/pokemon/raichu.json'
import femaleRaichu from '../../../data/pokemon/raichu-f.json'
import alolanRaichu from '../../../data/pokemon/raichu-alola.json'
import sandshrew from '../../../data/pokemon/sandshrew.json'
import alolanSandshrew from '../../../data/pokemon/sandshrew-alola.json'
import megaCharizard from '../../../data/pokemon/charizard-mega-x.json'
import magearna from '../../../data/pokemon/magearna.json'
import originalMagearna from '../../../data/pokemon/magearna-original.json'
import bulbasaur from '../../../data/pokemon/bulbasaur.json'
import squirtle from '../../../data/pokemon/squirtle.json'
import arcanine from '../../../data/pokemon/arcanine.json'
import hisuianArcanine from '../../../data/pokemon/arcanine-hisui.json'
import hisuianGrowlithe from '../../../data/pokemon/growlithe-hisui.json'
import meowth from '../../../data/pokemon/meowth.json'
import alolanMeowth from '../../../data/pokemon/meowth-alola.json'
import galarianMeowth from '../../../data/pokemon/meowth-galar.json'
import mrMime from '../../../data/pokemon/mrmime.json'
import galarianMrMime from '../../../data/pokemon/mrmime-galar.json'
import mimeJr from '../../../data/pokemon/mimejr.json'
import mrRime from '../../../data/pokemon/mrrime.json'
import graveler from '../../../data/pokemon/graveler.json'
import alolanGraveler from '../../../data/pokemon/graveler-alola.json'
import tauros from '../../../data/pokemon/tauros.json'
import combatTauros from '../../../data/pokemon/tauros-paldea.json'
import blazeTauros from '../../../data/pokemon/tauros-paldea-fire.json'
import aquaTauros from '../../../data/pokemon/tauros-paldea-water.json'
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
  game('usum-us', 'Ultra Sun', 'usum'),
  game('usum-um', 'Ultra Moon', 'usum'),
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

describe('form annotations across HTML method boundaries', () => {
  it('keeps Graveler Legends: Arceus paragraphs separate from Alolan unavailability', () => {
    const legends = game('la', 'Legends: Arceus', null, 'game', 8)
    // Reduced from the cached species page: the divider and paragraph follow the
    // Alolan annotation without a BR, and the Kantonian annotation belongs to the paragraph.
    const html = page(
      row(
        ['Legends: Arceus'],
        `
      Unobtainable <small>(<b>Alolan Form</b>)</small>
      <div style="border-bottom: 1px solid black;"></div>
      <p><b>Obsidian Fieldlands:</b> <a href="/wiki/Oreburrow_Tunnel">Oreburrow Tunnel</a>,
      <a href="/wiki/Ramanas_Island">Ramanas Island</a> <sup>Shaking ore deposits</sup>
      <small>(<b>Kantonian Form</b>)</small></p>
    `,
      ),
      'Graveler',
    )
    const siblings = [graveler, alolanGraveler]
    const standard = parseAvailability(html, graveler, [legends], siblings)
    expect(standard.rows[0].status).toBe('obtainableIn')
    expect(standard.rows[0].methods).toEqual([
      {
        text: 'Obsidian Fieldlands: Oreburrow Tunnel, Ramanas Island Shaking ore deposits (Kantonian Form)',
        status: 'obtainableIn',
      },
    ])
    const regional = parseAvailability(html, alolanGraveler, [legends], siblings)
    expect(regional.rows[0].status).toBe('unavailable')
    expect(regional.rows[0].methods).toEqual([
      { text: 'Unobtainable (Alolan Form)', status: 'unavailable' },
    ])
  })

  it.each([
    '<p>ALOLA</p><p>KANTO</p>',
    '<div>ALOLA</div><div>KANTO</div>',
    '<ul><li>ALOLA</li><li>KANTO</li></ul>',
    '<table><tr><td>ALOLA</td><td>KANTO</td></tr></table>',
  ])('preserves independent methods and inline form labels in %s', (layout) => {
    const methods = layout
      .replace('ALOLA', '<a href="/wiki/Route_17">Route 17</a> <small>(Alolan Form)</small>')
      .replace(
        'KANTO',
        '<a href="/wiki/Pokemon_Bank">Pokémon Bank</a> <small>(Kantonian Form)</small>',
      )
    for (const selected of [graveler, alolanGraveler]) {
      const report = parseAvailability(page(row(['Sun'], methods), 'Graveler'), selected, games, [
        graveler,
        alolanGraveler,
      ])
      const sun = report.rows.find((row) => row.game.id === 'sm-s')!
      expect(sun.status).toBe(selected.isDefault ? 'transferOnlyIn' : 'obtainableIn')
      expect(sun.methods).toHaveLength(1)
      expect(sun.methods[0].text).not.toContain(selected.isDefault ? 'Alolan' : 'Kantonian')
    }
  })
})

describe('identity and game normalization', () => {
  it.each(['obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'] as const)(
    'sorts %s by the complete game index while retaining unresolved IDs',
    (field) => {
      const orderedGames = [
        game('swsh-sw', 'Sword', 'swsh'),
        game('swsh-islearmor', 'The Isle of Armor', 'swsh', 'dlc'),
        game('home', 'HOME'),
        game('rb-r', 'Red', 'rb', 'game', 1),
      ]
      const ids = ['unresolved-game', 'rb-r', 'home', 'swsh-islearmor', 'swsh-sw']
      const pokemon = {
        ...pikachu,
        obtainableIn: [],
        transferOnlyIn: [],
        eventOnlyIn: [],
        storableIn: [],
        [field]: ids,
      }
      const report = parseAvailability(page(row(['Red'], 'Unknown method')), pokemon, orderedGames)
      expect(availabilityJson(report)[field]).toEqual([
        'swsh-sw',
        'swsh-islearmor',
        'home',
        'rb-r',
        'unresolved-game',
      ])
      expect(pokemon[field]).toEqual(ids)
    },
  )

  it.each(['pikachu', ' PIKACHU ', '0025', '25', '025'])('resolves %s', (input) => {
    expect(resolvePokemon(input, [pikachu, alolanRaichu]).id).toBe('pikachu')
  })
  it('resolves exact form nids and rejects unknown forms', () => {
    expect(resolvePokemon('26-alola', [raichu, alolanRaichu]).id).toBe('raichu-alola')
    expect(() => resolvePokemon('26-imaginary', [raichu, alolanRaichu])).toThrow('Unknown Pokémon')
  })
  it.each([
    { pokemon: mrMime, slug: 'Mr._Mime' },
    { pokemon: galarianMrMime, slug: 'Mr._Mime' },
    { pokemon: mimeJr, slug: 'Mime_Jr.' },
    { pokemon: mrRime, slug: 'Mr._Rime' },
    { pokemon: tauros, slug: 'Tauros' },
    { pokemon: combatTauros, slug: 'Tauros' },
    { pokemon: blazeTauros, slug: 'Tauros' },
    { pokemon: aquaTauros, slug: 'Tauros' },
  ])('uses the actual species page reference for $pokemon.id', ({ pokemon, slug }) => {
    expect(bulbapediaUrl(pokemon)).toBe(
      `https://bulbapedia.bulbagarden.net/wiki/${slug}_(Pok%C3%A9mon)`,
    )
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
  it.each([bulbasaur, squirtle])(
    'includes the Isle of Armor gift for $id despite its Gigantamax Factor note',
    (pokemon) => {
      // Match the nested table and small-print attribute used in the species pages.
      const gift = `<table><tbody><tr><td>
        <a href="/wiki/Master_Dojo">Master Dojo</a>
        (<a href="/wiki/List_of_in-game_event_Pokémon_in_Pokémon_Sword_and_Shield#${pokemon.names.eng}">Only one</a>;
        <small><b><a href="/wiki/Gigantamax#Gigantamax_Factor">Gigantamax Factor</a></b></small>)
        </td></tr></tbody></table>`
      const report = reportFor(row(['Sword', 'Shield'], 'Trade') + row(['Expansion Pass'], gift), {
        ...pokemon,
        obtainableIn: [],
        transferOnlyIn: ['swsh-sw', 'swsh-sh'],
        eventOnlyIn: [],
      })
      const json = availabilityJson(report)
      for (const id of ['swsh-sw', 'swsh-sh']) {
        const entry = report.rows.find((entry) => entry.game.id === id)!
        expect(entry).toMatchObject({ status: 'obtainableIn', basis: 'source' })
        expect(entry.methods).toContainEqual({
          text: '[Expansion Pass] Master Dojo (Only one; Gigantamax Factor)',
          status: 'obtainableIn',
        })
        expect(json.obtainableIn).toContain(id)
        expect(json.transferOnlyIn).not.toContain(id)
        expect(json.eventOnlyIn).not.toContain(id)
      }
    },
  )

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
    expect([...json.storableIn].sort()).toEqual([...pikachu.storableIn].sort())
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
  const nested = (methods: string) => `<table><tbody><tr><td>${methods}</td></tr></tbody></table>`
  it.each([
    'Kantonian/Hisuian Forms',
    'Kantonian and Hisuian Forms',
    'Kantonian, Hisuian Forms',
    'Kantonian &amp; Hisuian Forms',
  ])('recognizes the SV DLC evolution for both Arcanine forms labeled %s', (label) => {
    const html = page(
      row(['Scarlet', 'Violet'], nested('Pokémon HOME <small>(<b>Hisuian Form</b>)</small>')) +
        row(
          ['The Hidden Treasure of Area Zero'],
          nested(
            `<a href="/wiki/Evolution">Evolve</a> <a href="/wiki/Growlithe_(Pokémon)">Growlithe</a> <small>(<b>${label}</b>)</small>`,
          ),
        ),
      'Arcanine',
    )
    for (const pokemon of [arcanine, hisuianArcanine]) {
      const report = parseAvailability(
        html,
        { ...pokemon, obtainableIn: [], transferOnlyIn: ['sv-s', 'sv-v'], eventOnlyIn: [] },
        games,
        [arcanine, hisuianArcanine],
      )
      const json = availabilityJson(report)
      expect(json.obtainableIn).toEqual(['sv-s', 'sv-v'])
      expect(json.transferOnlyIn).toEqual([])
      expect(json.eventOnlyIn).toEqual([])
      expect([...json.storableIn].sort()).toEqual([...pokemon.storableIn].sort())
      for (const id of ['sv-s', 'sv-v']) {
        const entry = report.rows.find((entry) => entry.game.id === id)!
        expect(entry).toMatchObject({ status: 'obtainableIn', basis: 'source' })
        expect(entry.methods).toContainEqual({
          text: `[The Hidden Treasure of Area Zero] Evolve Growlithe (${label.replace('&amp;', '&')})`,
          status: 'obtainableIn',
        })
      }
    }
  })

  it('recognizes Perrin’s Hisuian Growlithe gift as ordinary SV DLC acquisition', () => {
    const report = reportFor(
      row(['Scarlet', 'Violet'], 'Pokémon HOME <small>(<b>Hisuian Form</b>)</small>') +
        row(
          ['The Hidden Treasure of Area Zero'],
          'Gift from <a href="/wiki/Perrin">Perrin</a> <small>(<b>Hisuian Form</b>)</small>',
        ),
      { ...hisuianGrowlithe, obtainableIn: [], transferOnlyIn: ['sv-s', 'sv-v'], eventOnlyIn: [] },
    )
    const json = availabilityJson(report)
    expect(json.obtainableIn).toEqual(['sv-s', 'sv-v'])
    expect(json.transferOnlyIn).toEqual([])
    expect(json.eventOnlyIn).toEqual([])
  })

  it('applies grouped labels only to the named forms, not every regional form', () => {
    const html = page(
      row(['Scarlet', 'Violet'], 'Gift <small>(<b>Kantonian/Alolan Forms</b>)</small>'),
      'Meowth',
    )
    for (const pokemon of [meowth, alolanMeowth, galarianMeowth]) {
      const report = parseAvailability(
        html,
        { ...pokemon, obtainableIn: [], transferOnlyIn: ['sv-s', 'sv-v'], eventOnlyIn: [] },
        games,
        [meowth, alolanMeowth, galarianMeowth],
      )
      const included = pokemon !== galarianMeowth
      expect(availabilityJson(report).obtainableIn).toEqual(included ? ['sv-s', 'sv-v'] : [])
      for (const id of ['sv-s', 'sv-v']) {
        expect(report.rows.find((entry) => entry.game.id === id)).toMatchObject({
          status: included ? 'obtainableIn' : 'transferOnlyIn',
          basis: included ? 'source' : 'dataset',
        })
      }
    }
  })

  it.each([raichu, femaleRaichu])(
    'keeps Kantonian $id transfer-only in SM while allowing its USUM Ultra Space evolution',
    (pokemon) => {
      const report = parseAvailability(
        page(
          row(
            ['Sun', 'Moon'],
            nested(
              '<a href="/wiki/Trade">Trade</a> <small>(<b>Kantonian Form</b>)</small><br>' +
                '<a href="/wiki/Evolution">Evolve</a> <a href="/wiki/Pikachu_(Pokémon)">Pikachu</a> <small>(<b>Alolan Form</b>)</small>',
            ),
          ) +
            row(
              ['Ultra Sun', 'Ultra Moon'],
              nested(
                'Evolve Pikachu in <a href="/wiki/Ultra_Space">Ultra Space</a> <small>(<b>Kantonian Form</b>)</small><br>' +
                  'Evolve Pikachu <small>(<b>Alolan Form</b>)</small>',
              ),
            ),
          'Raichu',
        ),
        { ...pokemon, obtainableIn: ['sm-s', 'sm-m'], transferOnlyIn: [], eventOnlyIn: [] },
        games,
        [raichu, femaleRaichu, alolanRaichu],
      )
      const json = availabilityJson(report)
      expect(json.obtainableIn).toEqual(['usum-us', 'usum-um'])
      expect(json.transferOnlyIn).toEqual(['sm-s', 'sm-m'])
      for (const id of ['sm-s', 'sm-m']) {
        expect(report.rows.find((row) => row.game.id === id)).toMatchObject({
          status: 'transferOnlyIn',
          basis: 'source',
          methods: [{ text: 'Trade (Kantonian Form)', status: 'transferOnlyIn' }],
        })
      }
    },
  )

  it('does not give Kantonian Sandshrew the Alolan encounter in Moon', () => {
    const html = page(
      row(['Sun'], nested('Trade, <a href="/wiki/Pokémon_Bank">Pokémon Bank</a>')) +
        row(
          ['Moon'],
          nested(
            '<a href="/wiki/Mount_Lanakila">Mount Lanakila</a>, <a href="/wiki/Tapu_Village">Tapu Village</a> <small>(<b>Alolan Form</b>)</small><br>' +
              '<a href="/wiki/Pokémon_Bank">Pokémon Bank</a> <small>(<b>Kantonian Form</b>)</small>',
          ),
        ),
      'Sandshrew',
    )
    const siblings = [sandshrew, alolanSandshrew]
    const report = parseAvailability(
      html,
      { ...sandshrew, obtainableIn: ['sm-s', 'sm-m'], transferOnlyIn: [], eventOnlyIn: [] },
      games,
      siblings,
    )
    expect(availabilityJson(report).obtainableIn).toEqual([])
    expect(availabilityJson(report).transferOnlyIn).toEqual(['sm-s', 'sm-m'])
    const alola = parseAvailability(html, alolanSandshrew, games, siblings)
    expect(alola.rows.find((row) => row.game.id === 'sm-m')).toMatchObject({
      status: 'obtainableIn',
      basis: 'source',
      methods: [{ text: 'Mount Lanakila, Tapu Village (Alolan Form)', status: 'obtainableIn' }],
    })
  })

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
      expect([...json.storableIn].sort()).toEqual([...femalePikachu.storableIn].sort())
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

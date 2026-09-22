import { describe, expect, it } from 'vitest'
import pikachu from '../../../data/pokemon/pikachu.json'
import femalePikachu from '../../../data/pokemon/pikachu-f.json'
import nidoranFemale from '../../../data/pokemon/nidoranf.json'
import nidoranMale from '../../../data/pokemon/nidoranm.json'
import farfetchd from '../../../data/pokemon/farfetchd.json'
import galarianFarfetchd from '../../../data/pokemon/farfetchd-galar.json'
import sirfetchd from '../../../data/pokemon/sirfetchd.json'
import flabebe from '../../../data/pokemon/flabebe.json'
import typeNull from '../../../data/pokemon/typenull.json'
import greatTusk from '../../../data/pokemon/greattusk.json'
import woChien from '../../../data/pokemon/wochien.json'
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
import xatu from '../../../data/pokemon/xatu.json'
import paldeanWooper from '../../../data/pokemon/wooper-paldea.json'
import shellos from '../../../data/pokemon/shellos.json'
import shellosEast from '../../../data/pokemon/shellos-east.json'
import gastrodon from '../../../data/pokemon/gastrodon.json'
import gastrodonEast from '../../../data/pokemon/gastrodon-east.json'
import basculin from '../../../data/pokemon/basculin.json'
import basculinBlue from '../../../data/pokemon/basculin-blue-striped.json'
import basculinWhite from '../../../data/pokemon/basculin-white-striped.json'
import meltan from '../../../data/pokemon/meltan.json'
import melmetal from '../../../data/pokemon/melmetal.json'
import zeraora from '../../../data/pokemon/zeraora.json'
import pecharunt from '../../../data/pokemon/pecharunt.json'
import diancie from '../../../data/pokemon/diancie.json'
import megaDiancie from '../../../data/pokemon/diancie-mega.json'
import mewtwo from '../../../data/pokemon/mewtwo.json'
import megaMewtwoX from '../../../data/pokemon/mewtwo-mega-x.json'
import megaMewtwoY from '../../../data/pokemon/mewtwo-mega-y.json'
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
  return `<tr>${labels.map((label) => `<th><a href="${label === 'Expansion Pass' ? '/wiki/Pok%C3%A9mon_Sword_and_Shield_Expansion_Pass' : '/wiki/Game'}">${label}</a></th>`).join('')}
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
    { pokemon: paldeanWooper, slug: 'Wooper' },
    { pokemon: nidoranFemale, slug: 'Nidoran%E2%99%80' },
    { pokemon: nidoranMale, slug: 'Nidoran%E2%99%82' },
    { pokemon: farfetchd, slug: "Farfetch'd" },
    { pokemon: galarianFarfetchd, slug: "Farfetch'd" },
    { pokemon: sirfetchd, slug: "Sirfetch'd" },
    { pokemon: flabebe, slug: 'Flab%C3%A9b%C3%A9' },
    { pokemon: typeNull, slug: 'Type%3A_Null' },
    { pokemon: greatTusk, slug: 'Great_Tusk' },
    { pokemon: woChien, slug: 'Wo-Chien' },
  ])('uses the actual species page reference for $pokemon.id', ({ pokemon, slug }) => {
    expect(bulbapediaUrl(pokemon)).toBe(
      `https://bulbapedia.bulbagarden.net/wiki/${slug}_(Pok%C3%A9mon)`,
    )
  })
  it('maps paired games and DLC to concrete IDs without confusing Japanese Blue', () => {
    const resolve = createGameResolver(games)
    expect(resolve('Pokémon Sun and Moon')).toEqual(['sm-s', 'sm-m'])
    expect(resolve('Expansion Pass')).toEqual([])
    expect(resolve('Sword Expansion Pass')).toEqual(['swsh-sw'])
    expect(resolve('Shield Expansion Pass')).toEqual(['swsh-sh'])
    expect(resolve('The Isle of Armor')).toEqual(['swsh-sw', 'swsh-sh'])
    expect(resolve('Mega Dimension')).toEqual(['lza'])
    expect(resolve('Blue (Japan)')).toEqual([])
  })
})

describe('location parsing and classification', () => {
  it.each(['to', 'with'])('recognizes a linked NPC %s Duking in Pyrite Town', (preposition) => {
    const report = reportFor(
      row(
        ['Red'],
        `<a href="/wiki/Trade">Trade</a> <a href="/wiki/Surskit_(Pok%C3%A9mon)">Surskit</a> ${preposition} <a href="/wiki/Duking">Duking</a> in <a href="/wiki/Pyrite_Town">Pyrite Town</a>`,
      ),
    )
    expect(report.rows.find((row) => row.game.id === 'rb-r')?.status).toBe('obtainableIn')
  })
  it('does not treat a linked player as an NPC trade', () => {
    const report = reportFor(
      row(
        ['Red'],
        '<a href="/wiki/Trade">Trade</a> <a href="/wiki/Surskit_(Pok%C3%A9mon)">Surskit</a> to <a href="/wiki/Player">another player</a> in <a href="/wiki/Pyrite_Town">Pyrite Town</a>',
      ),
    )
    expect(report.rows.find((row) => row.game.id === 'rb-r')?.status).toBe('transferOnlyIn')
  })
  it.each(['Yancy', 'Curtis'])('recognizes a trade with %s without a requested species', (npc) => {
    const result = reportFor(
      row(
        ['Red'],
        `<a href="/wiki/Trade">Trade</a> with <a href="/wiki/${npc}">${npc}</a> in <a href="/wiki/Nimbasa_City">Nimbasa City</a>`,
      ),
    )
    expect(result.rows[0].status).toBe('obtainableIn')
  })
  it.each([
    [shellos, shellosEast],
    [gastrodon, gastrodonEast],
  ])('excludes West Sea methods when parsing %s East Sea', (west, east) => {
    const html = row(
      ['Red'],
      '<a href="/wiki/Pokéwalker">Pokéwalker</a> <small>(West Sea)</small><br><a href="/wiki/Trade">Trade</a> <small>(East Sea)</small>',
    )
    const result = parseAvailability(
      page(html, east.refs.bulbapedia),
      { ...east, obtainableIn: ['rb-r'], transferOnlyIn: [] },
      games,
      [west, east],
    )
    expect(result.rows[0].status).toBe('transferOnlyIn')
    expect(result.rows[0].basis).toBe('source')
    expect(result.rows[0].methods).toHaveLength(1)
    expect(result.rows[0].methods[0].text).toContain('East Sea')
  })
  it.each([
    ['Scarlet', 'sv-s', 'sv-v'],
    ['Violet', 'sv-v', 'sv-s'],
  ])('keeps Hidden Treasure DLC rows scoped to %s', (version, included, excluded) => {
    const report = reportFor(
      row(['Scarlet', 'Violet'], 'Trade') +
        row([`The Hidden Treasure of Area Zero (${version})`], location),
    )
    expect(report.rows.find((row) => row.game.id === included)?.status).toBe('obtainableIn')
    expect(report.rows.find((row) => row.game.id === excluded)?.status).toBe('transferOnlyIn')
  })
  it('ignores excluded upstream headers while keeping Pal Park transfer methods', () => {
    const report = reportFor(
      row(['Red'], '<a href="/wiki/Pal_Park">Pal Park</a>') +
        row(['Green (Japan)'], location) +
        row(['Blue (Japan)'], location) +
        row(['Pal Park'], location) +
        row(['Unknown Game'], location),
    )
    expect(report.rows.find((row) => row.game.id === 'rb-r')?.status).toBe('transferOnlyIn')
    expect(report.warnings.find((warning) => warning.startsWith('Source-only'))).toBe(
      'Source-only game/service labels not in the dataset: Unknown Game.',
    )
  })
  it.each([
    '/wiki/Unknown_Expansion_Pass',
    '/wiki/Game',
    '/wiki/%invalid',
    'https://example.com/Expansion_Pass',
  ])('does not guess the games for a generic Expansion Pass linked to %s', (href) => {
    const expansion = row(['Expansion Pass'], location).replace(
      '/wiki/Pok%C3%A9mon_Sword_and_Shield_Expansion_Pass',
      href,
    )
    const report = reportFor(row(['Sword', 'Shield'], 'Trade') + expansion)
    for (const id of ['swsh-sw', 'swsh-sh'])
      expect(report.rows.find((row) => row.game.id === id)?.status).toBe('transferOnlyIn')
    expect(report.warnings.join(' ')).toContain('Expansion Pass')
  })

  it('keeps a version-specific DLC label scoped even when it links to the paired article', () => {
    const expansion = row(['Sword Expansion Pass'], location).replace(
      '/wiki/Game',
      '/wiki/Pok%C3%A9mon_Sword_and_Shield_Expansion_Pass',
    )
    const report = reportFor(row(['Sword', 'Shield'], 'Trade') + expansion)
    expect(report.rows.find((row) => row.game.id === 'swsh-sw')?.status).toBe('obtainableIn')
    expect(report.rows.find((row) => row.game.id === 'swsh-sh')?.status).toBe('transferOnlyIn')
  })
  it.each([
    ['Sword', 'swsh-sw', 'swsh-sh'],
    ['Shield', 'swsh-sh', 'swsh-sw'],
  ])('folds the %s Expansion Pass into only its own version', (version, included, excluded) => {
    const report = reportFor(
      row(['Sword', 'Shield'], '<a href="/wiki/Trade">Trade</a><sup>Version 1.2.0+</sup>') +
        row(
          [`${version} Expansion Pass`],
          '<a href="/wiki/Training_Lowlands">Training Lowlands</a>',
        ),
    )
    expect(report.rows.find((row) => row.game.id === included)?.status).toBe('obtainableIn')
    const other = report.rows.find((row) => row.game.id === excluded)!
    expect(other.status).toBe('transferOnlyIn')
    expect(other.methods.some((method) => method.text.includes('Training Lowlands'))).toBe(false)
    expect(report.warnings.join(' ')).not.toContain(`${version} Expansion Pass`)
  })
  it.each(['Abra', 'Clefairy'])(
    'recognizes an NPC route trade for %s even with a generic Trade link',
    (species) => {
      const methods = `<a href="/wiki/Trade">Trade</a> <a href="/wiki/${species}_(Pok%C3%A9mon)">${species}</a> on <a href="/wiki/Kanto_Route_2">Route 2</a>`
      const report = reportFor(row(['Red'], methods), mrMime)
      expect(report.rows.find((row) => row.game.id === 'rb-r')?.status).toBe('obtainableIn')
    },
  )
  it.each([
    '<a href="/wiki/Trade">Trade</a>',
    '<a href="/wiki/Trade">Trade</a> <a href="/wiki/Haunter_(Pok%C3%A9mon)">Haunter</a> in <a href="/wiki/Pok%C3%A9mon_Crystal">Pokémon Crystal</a>',
    '<a href="/wiki/Trade">Trade</a> from <a href="/wiki/Pokemon_Red">Red</a>',
    '<a href="/wiki/Trade">Trade</a> <a href="/wiki/Abra_(Pok%C3%A9mon)">Abra</a> from <a href="/wiki/Kanto_Route_2">Route 2</a>',
  ])('does not infer an NPC trade without its specific route-trade wording: %s', (methods) => {
    expect(
      reportFor(row(['Red'], methods), mrMime).rows.find((row) => row.game.id === 'rb-r')?.status,
    ).toBe('transferOnlyIn')
  })
  it('recognizes Xatu NPC trades in Crystal, HeartGold and SoulSilver', () => {
    const tradeGames = [
      game('c', 'Crystal'),
      game('hgss-hg', 'HeartGold'),
      game('hgss-ss', 'SoulSilver'),
    ]
    const methods =
      '<a href="/wiki/Trade">Trade</a> <a href="/wiki/Haunter_(Pok%C3%A9mon)">Haunter</a> in <a href="/wiki/Pewter_City">Pewter City</a>'
    const report = parseAvailability(
      page(row(['Crystal'], methods) + row(['HeartGold', 'SoulSilver'], methods), 'Xatu'),
      xatu,
      tradeGames,
    )
    expect(report.rows.map((row) => row.status)).toEqual([
      'obtainableIn',
      'obtainableIn',
      'obtainableIn',
    ])
    const candidate = availabilityJson(report)
    for (const game of tradeGames) {
      expect(candidate.obtainableIn).toContain(game.id)
      expect(candidate.transferOnlyIn).not.toContain(game.id)
    }
  })
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
    [
      '<a href="/wiki/Trade">Trade</a> <a href="/wiki/Granbull_(Pok%C3%A9mon)">Granbull</a> in <a href="/wiki/Seafolk_Village">Seafolk Village</a>',
      'obtainableIn',
    ],
    ['<a href="/wiki/Trade">Trade</a>', 'transferOnlyIn'],
    ['<a href="/wiki/Pal_Park">Pal Park</a>', 'transferOnlyIn'],
    ['<a href="/wiki/Ramanas_Park">Ramanas Park</a>', 'obtainableIn'],
    ['<a href="/wiki/Pokémon_Dream_Radar">Pokémon Dream Radar</a>', 'transferOnlyIn'],
    ['<a href="/wiki/My_Pokémon_Ranch">My Pokémon Ranch</a>', 'transferOnlyIn'],
    ['<a href="/wiki/Floccesy_Ranch">Floccesy Ranch</a>', 'obtainableIn'],
    ['<a href="/wiki/Pokéwalker">Pokéwalker</a>', 'transferOnlyIn'],
    ['Poké Transfer, <a href="#In_events">Event</a>', 'transferOnlyIn'],
    [
      '<a href="/wiki/Poké_Transporter">Poké Transporter</a>, <a href="#In_events">Event</a>',
      'transferOnlyIn',
    ],
    ['Pokémon HOME, <a href="/wiki/Poké_Portal_News">Poké Portal News</a>', 'transferOnlyIn'],
    [`${location}, <a href="#In_events">Event</a>`, 'obtainableIn'],
    [`${location} (<a href="#In_events">Event</a>)`, 'eventOnlyIn'],
    [`${location} (requires <a href="/wiki/MysticTicket">MysticTicket</a>)`, 'eventOnlyIn'],
    [
      `${location} (requires <a href="/wiki/MysticTicket">MysticTicket</a>)<span class="explain" title="distributed through an event in the original release; available without an event in the Nintendo Switch release">*</span>`,
      'obtainableIn',
    ],
    ['<a href="#In_events">Event</a>', 'eventOnlyIn'],
    ['Unobtainable', 'unavailable'],
    ['Union Circle', 'obtainableIn'],
    ['Tera Raid Battle Search (4★)', 'obtainableIn'],
    ['Tera Raid Battles (4★)', 'obtainableIn'],
    ['Tera Raid Battle Search (event only)', 'eventOnlyIn'],
  ])('classifies %s as %s', (method, expected) => {
    expect(reportFor(row(['Red'], method)).rows[0].status).toBe(expected)
  })
  it('keeps a known transfer route over an event-only summary', () => {
    const pokemon = { ...pikachu, obtainableIn: [], transferOnlyIn: ['rb-r'] }
    const report = reportFor(row(['Red'], '<a href="#In_events">Event</a>'), pokemon)
    expect(report.rows[0]).toMatchObject({ status: 'transferOnlyIn', basis: 'dataset' })
    expect(availabilityJson(report).eventOnlyIn).not.toContain('rb-r')
  })
  it.each([diancie, megaDiancie, mewtwo, megaMewtwoX, megaMewtwoY])(
    'preserves the confirmed LZA event-only rule for %s',
    (selected) => {
      const result = reportFor(row(['Legends: Z-A'], 'Trade'), {
        ...selected,
        obtainableIn: ['lza'],
        eventOnlyIn: [],
        transferOnlyIn: [],
      })
      const json = availabilityJson(result)
      expect(json.eventOnlyIn).toContain('lza')
      expect(json.obtainableIn).not.toContain('lza')
      expect(json.transferOnlyIn).not.toContain('lza')
      expect(new Set(json.storableIn)).toEqual(new Set(selected.storableIn))
    },
  )
  it('keeps Pecharunt’s Mystery Gift item encounter event-only over the base Trade row', () => {
    const html =
      row(['Scarlet', 'Violet'], 'Trade Version 3.0.0+') +
      row(
        ['The Hidden Treasure of Area Zero'],
        `${location} (requires Mythical Pecha Berry) (Only one)`,
      )
    const result = reportFor(html, pecharunt)
    for (const id of ['sv-s', 'sv-v'])
      expect(result.rows.find((r) => r.game.id === id)).toMatchObject({
        status: 'eventOnlyIn',
        basis: 'rule',
      })
  })
  it('distinguishes unlocking the Mystery Box from importing Meltan', () => {
    const method =
      '<a href="/wiki/Mystery_Box">Mystery Box</a> (Unlocked after transferring a Pokémon to GO Park or via GO Transporter)'
    const result = reportFor(row(['GO'], method), {
      ...meltan,
      obtainableIn: [],
      transferOnlyIn: ['go'],
    })
    expect(result.rows.find((r) => r.game.id === 'go')?.status).toBe('obtainableIn')
    const evolved = reportFor(row(['GO'], 'Evolve Meltan'), melmetal)
    expect(evolved.rows.find((r) => r.game.id === 'go')?.status).toBe('obtainableIn')
    const imported = reportFor(row(['GO'], 'Transfer via Pokémon HOME'), meltan)
    expect(imported.rows.find((r) => r.game.id === 'go')?.status).toBe('transferOnlyIn')
  })
  it('keeps the confirmed Zeraora LZA Mystery Gift route event-only over a generic Trade placeholder', () => {
    const html =
      row(['Legends: Z-A'], 'Trade Version 2.0.0+') +
      row(['Mega Dimension'], `${location} (requires Mystery Gift activation) (Only one)`)
    const result = reportFor(html, {
      ...zeraora,
      obtainableIn: [],
      eventOnlyIn: [],
      transferOnlyIn: ['lza'],
    })
    expect(result.rows.find((r) => r.game.id === 'lza')).toMatchObject({
      status: 'eventOnlyIn',
      basis: 'rule',
    })
  })
  it('recognizes a form ID when the English form label is absent', () => {
    const selected = { ...pikachu, formId: 'altered', formNames: {} }
    const result = reportFor(row(['Red'], `${location} <small>(Altered Forme)</small>`), selected)
    expect(result.rows[0].status).toBe('obtainableIn')
    const other = reportFor(row(['Red'], `${location} <small>(Origin Forme)</small>`), selected)
    expect(other.rows[0].basis).not.toBe('source')
  })
  it.each([basculin, basculinBlue, basculinWhite])(
    'scopes Red/Blue-Striped Forms to the named Basculin forms: %s',
    (selected) => {
      const html = page(
        row(['Red'], `${location} <small>(Red/Blue-Striped Forms)</small>`),
        selected.refs.bulbapedia,
      )
      const result = parseAvailability(
        html,
        { ...selected, obtainableIn: [], transferOnlyIn: ['rb-r'] },
        games,
        [basculin, basculinBlue, basculinWhite],
      )
      expect(result.rows[0].status).toBe(
        selected === basculinWhite ? 'transferOnlyIn' : 'obtainableIn',
      )
    },
  )
  it.each([251, 385])('classifies Bonus Disc routes as transfer-only for #%s', (dexNum) => {
    const selected = { ...pikachu, dexNum, obtainableIn: [], transferOnlyIn: [] }
    const result = reportFor(
      row(['Red'], '<a href="/wiki/Pokémon_Colosseum_Bonus_Disc">Bonus Disc</a>'),
      selected,
    )
    expect(result.rows[0].status).toBe('transferOnlyIn')
  })
  it('classifies both Jirachi external gift routes as transfer-only', () => {
    const selected = { ...pikachu, dexNum: 385, obtainableIn: [], transferOnlyIn: [] }
    const result = reportFor(
      row(
        ['Red'],
        '<a href="/wiki/Pokémon_Colosseum_Bonus_Disc">Bonus Disc</a> (US)<br><a href="/wiki/Pokémon_Channel">Pokémon Channel</a> (EU)',
      ),
      selected,
    )
    expect(result.rows[0].status).toBe('transferOnlyIn')
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

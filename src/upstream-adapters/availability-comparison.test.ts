import { describe, expect, it } from 'vitest'
import arcanine from '../../data/pokemon/arcanine.json'
import arcanineHisui from '../../data/pokemon/arcanine-hisui.json'
import arceus from '../../data/pokemon/arceus.json'
import type { AvailabilityGame } from './bulbapedia/availability.ts'
import { parseBulbapediaSource, parseSerebiiSource } from './availability-comparison.ts'

const game = (id: string, name: string, gameSet: string | null = null): AvailabilityGame => ({
  id,
  name,
  gameSet,
  type: 'game',
  gameSuperSet: null,
  gen: 9,
})
const games: AvailabilityGame[] = [
  game('dp-d', 'Diamond'),
  game('dp-p', 'Pearl'),
  game('pt', 'Platinum'),
  game('swsh-sw', 'Sword', 'swsh'),
  game('swsh-sh', 'Shield', 'swsh'),
  game('sv-s', 'Scarlet', 'sv'),
  game('sv-v', 'Violet', 'sv'),
  { ...game('sv-tealmask', 'The Teal Mask', 'sv'), type: 'dlc' },
  game('home', 'HOME'),
  game('go', 'GO'),
  game('xd', 'XD'),
]

describe('raw Bulbapedia availability comparison', () => {
  it('retains event restrictions, tooltip prerequisites, footnotes and source form qualifiers without verdicts', () => {
    const html = `<h1>Arceus (Pokémon)</h1><h3 id="Game_locations">Game locations</h3>
      <table><tr><th>Diamond</th><th>Pearl</th><td>
        Hall of Origin <small>(requires Azure Flute<span title="Never officially distributed">*</span>)</small>
        <sup><a href="#cite_note-1">[1]</a></sup><br>Event <small>(Normal Form)</small>
      </td></tr><tr><th>Platinum</th><td>Unobtainable</td></tr></table>
      <h3 id="Evolution">Evolution</h3><p>Arceus does not evolve.</p>
      <h3 id="Form_data">Form data</h3><p>Its held Plate determines its type.</p>
      <h3>References</h3><ol><li id="cite_note-1">This item was not distributed.</li></ol>`
    const result = parseBulbapediaSource(html, arceus, games)
    const diamond = result.rows.find((row) => row.gameId === 'dp-d')!
    expect(diamond.state).toBe('found')
    expect(diamond.entries[0].text).toContain('requires Azure Flute')
    expect(diamond.entries[0].text).toContain('Normal Form')
    expect(diamond.entries[0].notes).toContain('*: Never officially distributed')
    expect(diamond.entries[0].notes).toContain('Footnote [1]: This item was not distributed.')
    expect(diamond.entries[0].url).toMatch(
      /^https:\/\/bulbapedia\.bulbagarden\.net\/wiki\/Arceus_.*#Game_locations$/,
    )
    expect(result.rows.find((row) => row.gameId === 'dp-p')?.entries).toEqual(diamond.entries)
    expect(result.rows.find((row) => row.gameId === 'pt')).toMatchObject({
      state: 'found',
      entries: [{ text: 'Unobtainable' }],
    })
    expect(result.rows.find((row) => row.gameId === 'home')).toMatchObject({
      state: 'missing',
      entries: [],
    })
    expect(result.notes).toContain('Evolution context: Arceus does not evolve.')
    expect(result.notes).toContain('Form data context: Its held Plate determines its type.')
    expect(JSON.stringify(result)).not.toMatch(/obtainableIn|storableIn|eventOnlyIn/)
  })

  it('shows all species forms rather than silently filtering or copying the selected form availability', () => {
    const html = `<h1>Arcanine (Pokémon)</h1><div class="mw-heading"><h3><span id="Game_locations">Game locations</span></h3></div>
      <table><tr><th>Scarlet</th><td><div>North Province <small>(Kantonian Form)</small></div><div>Transfer <small>(Hisuian Form)</small></div></td></tr></table>
      <h3 id="In_side_games">In side games</h3><table><tr><th>XD</th><td>Rental in Battle Bingo</td></tr></table>`
    const before = JSON.stringify(arcanineHisui)
    const result = parseBulbapediaSource(html, arcanineHisui, games)
    expect(result.rows.find((row) => row.gameId === 'sv-s')?.entries[0].text).toBe(
      'North Province (Kantonian Form)\nTransfer (Hisuian Form)',
    )
    expect(result.notes[0]).toContain(
      'do not independently establish availability of the selected form',
    )
    expect(result.rows.find((row) => row.gameId === 'xd')?.entries[0].text).toBe(
      'Rental in Battle Bingo',
    )
    expect(JSON.stringify(arcanineHisui)).toBe(before)
  })

  it('folds named DLC into parents while retaining explicit version restrictions', () => {
    const html = `<h1>Arcanine (Pokémon)</h1><h3 id="Game_locations">Game locations</h3><table>
      <tr><th>The Teal Mask</th><td>Evolve Growlithe</td></tr>
      <tr><th>Sword</th><th><a href="/wiki/Pok%C3%A9mon_Sword_and_Shield_Expansion_Pass">Expansion Pass</a></th><td>Gift</td></tr>
      </table>`
    const result = parseBulbapediaSource(html, arcanine, games)
    expect(result.rows.find((row) => row.gameId === 'sv-s')?.entries[0].notes).toContain(
      'Source row: The Teal Mask',
    )
    expect(result.rows.find((row) => row.gameId === 'sv-v')?.state).toBe('found')
    expect(result.rows.find((row) => row.gameId === 'swsh-sw')?.state).toBe('found')
    expect(result.rows.find((row) => row.gameId === 'swsh-sh')?.state).toBe('missing')
    expect(result.rows.some((row) => row.gameId === 'sv-tealmask')).toBe(false)
  })

  it('rejects challenge pages, wrong species, and unmappable location tables', () => {
    expect(() => parseBulbapediaSource('<h1>Access denied</h1>', arcanine, games)).toThrow(
      'Game locations',
    )
    expect(() =>
      parseBulbapediaSource(
        '<h1>Pikachu (Pokémon)</h1><h3 id="Game_locations">Locations</h3><table></table>',
        arcanine,
        games,
      ),
    ).toThrow('does not match')
    expect(() =>
      parseBulbapediaSource(
        '<h3 id="Game_locations">Locations</h3><table><tr><th>Unknown</th><td>Somewhere</td></tr></table>',
        arcanine,
        games,
      ),
    ).toThrow('No recognized')
  })
})

describe('raw Serebii availability comparison', () => {
  it('retains explicitly named modern side-game rows without inventing missing coverage', () => {
    const modernGames = [
      ...games,
      game('lza', 'Legends: Z-A'),
      game('pokopia', 'Pokopia'),
      game('champions', 'Champions'),
    ]
    const html =
      '<table><tr><td>Locations</td></tr><tr><td>Legends: Z-A</td><td>Wild Zone 20</td></tr><tr><td>Pokopia</td><td>Special habitat</td></tr></table>'
    const result = parseSerebiiSource(
      { html, url: 'https://www.serebii.net/pokedex-sv/arcanine/', gameIds: ['sv-s', 'sv-v'] },
      arcanine,
      modernGames,
    )
    expect(result.rows.find((row) => row.gameId === 'lza')).toMatchObject({
      state: 'found',
      entries: [{ text: 'Wild Zone 20' }],
    })
    expect(result.rows.find((row) => row.gameId === 'pokopia')).toMatchObject({
      state: 'found',
      entries: [{ text: 'Special habitat' }],
    })
    expect(result.rows.some((row) => row.gameId === 'champions')).toBe(false)
  })

  it('keeps DLC rowspans per version, all form text, and useful evolution image labels', () => {
    const html = `<table><tr><td>Evolutionary Chain</td></tr><tr><td><img src="/pokemon/058-h.png"><img title="Use Fire Stone" src="/evo/firestone.png"><img alt="Hisuian Arcanine" src="/pokemon/059-h.png"></td></tr></table>
      <table><tr><td>Alternate Forms</td></tr><tr><td>Hisuian Form remains Hisuian when evolved.</td></tr></table>
      <table><tr><td colspan="3">Locations</td></tr>
      <tr><td colspan="2">Scarlet</td><td>North Province<br>Kantonian Form</td></tr>
      <tr><td colspan="2">Violet</td><td>Not available</td></tr>
      <tr><td rowspan="2">The Teal Mask</td><td>Scarlet</td><td>Evolve Growlithe <small>Hisuian Form</small></td></tr>
      <tr><td>Violet</td><td>Transfer from HOME <small>Hisuian Form</small></td></tr>
      <tr><td>Trainer Locations</td><td>Unrelated trainers</td></tr></table>`
    const result = parseSerebiiSource(
      { html, url: 'https://www.serebii.net/pokedex-sv/arcanine/', gameIds: ['sv-s', 'sv-v'] },
      arcanineHisui,
      games,
    )
    const scarlet = result.rows.find((row) => row.gameId === 'sv-s')!
    const violet = result.rows.find((row) => row.gameId === 'sv-v')!
    expect(scarlet.entries.map((entry) => entry.text)).toEqual([
      'North Province\nKantonian Form',
      'Evolve Growlithe Hisuian Form',
    ])
    expect(violet.entries.map((entry) => entry.text)).toEqual([
      'Not available',
      'Transfer from HOME Hisuian Form',
    ])
    expect(violet.entries[1].notes).toContain('Source row: The Teal Mask / Violet')
    expect(result.notes.join(' ')).toContain('Use Fire Stone')
    expect(result.notes.join(' ')).toContain('058-h.png')
    expect(result.notes.join(' ')).toContain('Hisuian Form remains Hisuian')
    expect(JSON.stringify(result)).not.toContain('Unrelated trainers')
  })

  it('distinguishes omitted rows from explicit source unavailability and never borrows another game page', () => {
    const html =
      '<table><tr><td>Locations</td></tr><tr><td>Scarlet</td><td>Not available</td></tr><tr><td>HOME</td><td>Gift</td></tr></table>'
    const result = parseSerebiiSource(
      { html, url: 'https://www.serebii.net/pokedex-sv/arcanine/', gameIds: ['sv-s', 'sv-v'] },
      arcanine,
      games,
    )
    expect(result.rows).toMatchObject([
      { gameId: 'sv-s', state: 'found', entries: [{ text: 'Not available' }] },
      { gameId: 'sv-v', state: 'missing', entries: [] },
    ])
    expect(result.rows).toHaveLength(2)
  })
})

import { describe, expect, it } from 'vitest'
import pikachu from '../../data/pokemon/pikachu.json'
import pikachuFemale from '../../data/pokemon/pikachu-f.json'
import zygarde from '../../data/pokemon/zygarde.json'
import zygardeTen from '../../data/pokemon/zygarde-10.json'
import zygardeComplete from '../../data/pokemon/zygarde-complete.json'
import arceus from '../../data/pokemon/arceus.json'
import meltan from '../../data/pokemon/meltan.json'
import sneaselHisuiFemale from '../../data/pokemon/sneasel-hisui-f.json'
import gimmighoul from '../../data/pokemon/gimmighoul.json'
import gimmighoulRoaming from '../../data/pokemon/gimmighoul-roaming.json'
import basculin from '../../data/pokemon/basculin.json'
import type { AvailabilityGame, AvailabilityPokemon } from './bulbapedia/availability.ts'
import { parseBulbapediaSource, parseSerebiiSource } from './availability-comparison.ts'
import { pokeApiSourceMethods, sourceVerdict } from './source-verdict.ts'

const games: AvailabilityGame[] = [
  { id: 'swsh-sw', name: 'Sword', type: 'game', gen: 8, gameSet: 'swsh', gameSuperSet: null },
  { id: 'swsh-sh', name: 'Shield', type: 'game', gen: 8, gameSet: 'swsh', gameSuperSet: null },
  { id: 'e', name: 'Emerald', type: 'game', gen: 3, gameSet: null, gameSuperSet: null },
]

function parseCell(
  source: 'bulbapedia' | 'serebii',
  cell: string,
  pokemon: AvailabilityPokemon = pikachu,
  siblings: AvailabilityPokemon[] = [pokemon],
) {
  if (source === 'bulbapedia')
    return parseBulbapediaSource(
      `<h3 id="Game_locations">Locations</h3><table><tr><th>Sword</th><td>${cell}</td></tr></table>`,
      pokemon,
      games,
      siblings,
    ).rows[0].verdict
  return parseSerebiiSource(
    {
      html: `<table><tr><td>Locations</td></tr><tr><td>Sword</td><td>${cell}</td></tr></table>`,
      gameIds: ['swsh-sw'],
      url: 'https://www.serebii.net/pokedex-swsh/pikachu/',
    },
    pokemon,
    games,
    siblings,
  ).rows[0].verdict
}

describe.each(['bulbapedia', 'serebii'] as const)('%s source-only verdicts', (source) => {
  it.each([
    ['Catch in the forest', 'obtainable'],
    ['Transfer from Pokémon Bank', 'transfer-only'],
    ['Event', 'event-only'],
    ['<a href="/wiki/Event_Pok%C3%A9mon" title="Event Pokémon">Event</a>', 'event-only'],
    ['Not available', 'unavailable'],
    ['To be confirmed', 'unknown'],
  ])('classifies explicit source route %s as %s', (cell, status) => {
    expect(parseCell(source, cell)?.status).toBe(status)
  })

  it('does not count rentals or an unexplained prerequisite as ordinary acquisition', () => {
    expect(
      parseCell(source, '<a href="/wiki/Battle_Bingo">Rental in Battle Bingo</a>')?.status,
    ).toBe('unknown')
    expect(
      parseCell(
        source,
        '<a href="/wiki/Flower_Paradise">Flower Paradise</a> (requires a special item)',
      )?.status,
    ).toBe('unknown')
  })

  it('keeps event prerequisites in annotations and blocks unreleased event items', () => {
    expect(
      parseCell(
        source,
        '<a href="/wiki/Flower_Paradise">Flower Paradise</a><span title="Requires an event item">*</span>',
      )?.status,
    ).toBe('event-only')
    expect(
      parseCell(
        source,
        '<a href="/wiki/Hall_of_Origin">Hall of Origin</a><span title="Azure Flute was never officially distributed">*</span><br>Event',
        arceus,
      )?.status,
    ).toBe('unknown')
  })

  it('does not turn negated or ambiguous event annotations into event exclusivity', () => {
    expect(
      parseCell(
        source,
        '<a href="/wiki/Navel_Rock">Catch at Navel Rock</a><span title="Available without an event">*</span>',
      )?.status,
    ).toBe('obtainable')
    expect(
      parseCell(
        source,
        '<a href="/wiki/Forest">Catch in the forest</a><span title="See event distribution history">*</span>',
      )?.status,
    ).toBe('unknown')
  })

  it('recognizes permanent gifts and encounters linked to in-game event articles', () => {
    expect(
      parseCell(
        source,
        '<a href="/wiki/List_of_in-game_event_Pokémon_in_Generation_I" title="List of in-game event Pokémon in Generation I">Received</a> from a girl in Cerulean City',
      )?.status,
    ).toBe('obtainable')
    expect(
      parseCell(
        source,
        '<a href="/wiki/Terminus_Cave">Catch in Terminus Cave</a> (<a href="/wiki/List_of_wild_Pokémon_from_in-game_events" title="List of wild Pokémon from in-game events">Only one</a>)',
      )?.status,
    ).toBe('obtainable')
  })

  it('does not assign unqualified species encounters to a female regional form', () => {
    expect(parseCell(source, 'Catch at Mount Silver', sneaselHisuiFemale)?.status).toBe('unknown')
  })

  it('selects the explicitly named Gimmighoul form without changing source evidence', () => {
    const cell =
      '<div>Catch in ruins <small>(Chest Form)</small></div><div>Transfer from GO <small>(Roaming Form)</small></div>'
    expect(
      parseCell(source, cell, gimmighoulRoaming, [gimmighoul, gimmighoulRoaming])?.status,
    ).toBe('transfer-only')
  })

  it('leaves detached form labels and version qualifiers for review', () => {
    expect(parseCell(source, 'Catch in the forest<br>Hisuian Form')?.status).toBe('unknown')
    expect(parseCell(source, 'Catch in the forest<sup>Shield</sup>')?.status).toBe('unknown')
    expect(parseCell(source, 'Catch in the forest (Alolan Form)')?.status).toBe('unknown')
  })

  it('uses an ordinary route despite an additional uncertain or event route', () => {
    expect(parseCell(source, 'Catch in the forest<br>Event<br>To be confirmed')?.status).toBe(
      'obtainable',
    )
    expect(parseCell(source, 'Transfer from HOME<br>Event')?.status).toBe('transfer-only')
  })
})

it('unions base-game transfer and DLC acquisition without copying the draft', () => {
  const pokemon = { ...zygarde, obtainableIn: [], eventOnlyIn: ['swsh-sw'], transferOnlyIn: [] }
  const result = parseBulbapediaSource(
    '<h3 id="Game_locations">Locations</h3><table><tr><th>Sword</th><td>Trade</td></tr><tr><th>Sword Expansion Pass</th><td><a href="/wiki/Max_Lair">Max Lair</a> (Dynamax Adventures)</td></tr></table>',
    pokemon,
    games,
  )
  expect(result.rows[0].verdict?.status).toBe('obtainable')
  expect(pokemon.eventOnlyIn).toEqual(['swsh-sw'])
  expect(result.rows[1].verdict).toBeUndefined()
})

it('recognizes Serebii DLC Dynamax Adventures and Meltan Mystery Box catches', () => {
  const result = parseSerebiiSource(
    {
      html: '<table><tr><td>Locations</td></tr><tr><td>Sword</td><td>Trade</td></tr><tr><td>Crown Tundra</td><td>Sword</td><td>Dynamax Adventures</td></tr></table>',
      gameIds: ['swsh-sw'],
      url: 'https://www.serebii.net/pokedex-swsh/zygarde/',
    },
    zygarde,
    games,
  )
  expect(result.rows[0].verdict?.status).toBe('obtainable')
  expect(
    parseCell('bulbapedia', '<a href="/wiki/Mystery_Box">Mystery Box</a>', meltan)?.status,
  ).toBe('obtainable')
})

it('does not silently omit the real Zygarde DLC cell with a combined form and ability qualifier', () => {
  const cell = `<table><tr><td><a href="/wiki/Max_Lair" title="Max Lair">Max Lair</a> (<a href="/wiki/Dynamax_Adventure" title="Dynamax Adventure">Dynamax Adventure</a>) (<a href="/wiki/List_of_in-game_event_Pok%C3%A9mon_in_Pok%C3%A9mon_Sword_and_Shield#Zygarde" title="List of in-game event Pokémon in Pokémon Sword and Shield">Only one</a>) <small>(<b>50% Forme, Power Construct</b>)</small></td></tr></table>`
  const html = `<h3 id="Game_locations">Locations</h3><table><tr><th>Sword</th><td><a href="/wiki/Trade" title="Trade">Trade</a><sup>Version 1.3.0+</sup></td></tr><tr><th><a href="/wiki/Pok%C3%A9mon_Sword_and_Shield_Expansion_Pass">Expansion Pass</a></th><td>${cell}</td></tr></table>`
  const result = parseBulbapediaSource(html, zygarde, games, [zygarde, zygardeTen, zygardeComplete])
  expect(result.rows[0].verdict?.status).toBe('unknown')
  expect(result.rows[0].verdict?.reason).toContain('form qualifier')
  expect(result.rows[0].entries.map((entry) => entry.text).join(' ')).toContain('Power Construct')
})

describe('PokéAPI source-only verdicts', () => {
  const encounter = (name: string, conditions: string[] = []) => ({
    gameId: 'swsh-sw',
    versionId: 33,
    version: 'sword',
    location: 'forest',
    methods: [{ name, conditions }],
  })
  const verdict = (name: string, conditions: string[] = []) =>
    sourceVerdict(pokeApiSourceMethods(encounter(name, conditions), pikachu, [pikachu], games[0]))

  it('uses ordinary, explicit transfer, and explicit event records', () => {
    expect(verdict('walk').status).toBe('obtainable')
    expect(verdict('pokemon-ranger').status).toBe('transfer-only')
    expect(verdict('gift', ['event-active']).status).toBe('event-only')
  })

  it('does not promote shared-form records or unexplained conditions to obtainable', () => {
    expect(
      sourceVerdict(
        pokeApiSourceMethods(encounter('walk'), pikachu, [pikachu, pikachuFemale], games[0]),
      ).status,
    ).toBe('unknown')
    expect(verdict('static', ['other-special-item']).status).toBe('unknown')
    expect(verdict('future-method').status).toBe('unknown')
  })

  it('keeps the exact known Basculin encounter exception uncertain', () => {
    const raw = {
      gameId: 'usum-um',
      versionId: 30,
      version: 'ultra-moon',
      location: 'brooklet-hill-north',
      methods: [{ name: 'super-rod', conditions: [] }],
    }
    const result = sourceVerdict(pokeApiSourceMethods(raw, basculin, [basculin], games[0]))
    expect(result.status).toBe('unknown')
    expect(result.reason).toContain('Blue-Striped')
  })
})

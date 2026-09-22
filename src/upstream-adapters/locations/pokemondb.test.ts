import { describe, expect, it } from 'vitest'
import { parsePokemonDbCatalog, parsePokemonDbPage } from './pokemondb.ts'

describe('PokémonDB location catalog', () => {
  it('includes linked and greyed-out names from regional panels while ignoring navigation', () => {
    const html = `<nav><a href="/location/not-a-place">Global navigation</a></nav>
      <div class="sv-tabs-panel" id="loc-kanto"><div class="grid-col">
        <a href="/location/kanto-route-1"> Route 1 </a>
        <span class="text-muted">Pallet Town</span>
      </div></div>
      <div class="sv-tabs-panel" id="loc-johto"><div class="grid-col">
        <a href="/location/johto-ilex-forest">Ilex Forest</a>
      </div></div>
      <div class="sv-tabs-panel" id="other-tab"><div class="grid-col">
        <a href="/location/not-a-region">Not a region</a>
      </div></div>`
    expect(parsePokemonDbCatalog(html)).toEqual([
      {
        source: 'pokemondb',
        sourceId: '/location/kanto-route-1',
        url: 'https://pokemondb.net/location/kanto-route-1',
        name: 'Route 1',
        region: 'kanto',
        games: [],
        pokeApiId: null,
        pages: ['https://pokemondb.net/location/kanto-route-1'],
      },
      {
        source: 'pokemondb',
        sourceId: 'kanto/Pallet Town',
        url: 'https://pokemondb.net/location',
        name: 'Pallet Town',
        region: 'kanto',
        games: [],
        pokeApiId: null,
        pages: [],
      },
      {
        source: 'pokemondb',
        sourceId: '/location/johto-ilex-forest',
        url: 'https://pokemondb.net/location/johto-ilex-forest',
        name: 'Ilex Forest',
        region: 'johto',
        games: [],
        pokeApiId: null,
        pages: ['https://pokemondb.net/location/johto-ilex-forest'],
      },
    ])
  })

  it('rejects pages without regional catalog entries', () => {
    expect(() => parsePokemonDbCatalog('<h1>Access denied</h1>')).toThrow('no regional entries')
  })
})

describe('PokémonDB individual game evidence', () => {
  const page = (
    cells: string,
  ) => `<h1>Route 1, Kanto <span class="text-muted">(location)</span></h1>
    <table><tbody><tr>${cells}</tr></tbody></table>`

  it('deduplicates positive badges and ignores blank cells even when they contain game names', () => {
    expect(
      parsePokemonDbPage(
        page(`
      <td class="cell-loc-game cell-loc-game-R1">R</td>
      <td class="cell-loc-game cell-loc-game-blank">B</td>
      <td class="cell-loc-game cell-loc-game-R1">R</td>
      <td class="cell-loc-game cell-loc-game-SS4">SS</td>
      <td class="cell-loc-game cell-loc-game-blank cell-loc-game-HG4">HG</td>`),
      ),
    ).toEqual(['rb-r', 'hgss-ss'])
  })

  it('leaves a valid location without positive encounter badges unresolved for other sources', () => {
    expect(
      parsePokemonDbPage(page('<td class="cell-loc-game cell-loc-game-blank">R</td>')),
    ).toEqual([])
  })

  it('fails on an unknown positive game badge', () => {
    expect(() =>
      parsePokemonDbPage(page('<td class="cell-loc-game cell-loc-game-FUTURE">Future</td>')),
    ).toThrow('Unmapped PokémonDB game badge: FUTURE')
  })

  it('requires a location title before accepting encounter evidence', () => {
    expect(() =>
      parsePokemonDbPage(
        '<h1>Pokémon encounters</h1><table><tr><td class="cell-loc-game cell-loc-game-R1">R</td></tr></table>',
      ),
    ).toThrow('Not a PokémonDB location page')
  })
})

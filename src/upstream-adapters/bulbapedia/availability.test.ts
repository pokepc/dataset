import { readFileSync } from 'node:fs'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import {
  availabilityJson,
  createAvailabilityReport,
  formatAvailabilityTable,
  parseAvailabilityTables,
  resolvePokemon,
  type AvailabilityGame,
  type AvailabilityPokemon,
} from './availability.ts'
import {
  classifyAvailabilitySymbol,
  parseMainAvailability,
  resolveMainAvailability,
} from './main-availability.ts'
import { mainPage, goPage } from './test-fixtures.ts'

const read = <T>(collection: string, id: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../data/${collection}/${id}.json`, import.meta.url), 'utf8'),
  )
const gameIds = JSON.parse(
  readFileSync(new URL('../../../data/indices/games.json', import.meta.url), 'utf8'),
) as string[]
const games = gameIds.map((id) => read<AvailabilityGame>('games', id))
const pokemon = (id: string) => read<AvailabilityPokemon>('pokemon', id)
const mainHtml = mainPage()
const tables = parseAvailabilityTables({ main: mainHtml, go: goPage() })
const report = (id: string, siblings: AvailabilityPokemon[] = [pokemon(id)]) =>
  createAvailabilityReport(tables, pokemon(id), games, siblings)
const row = (id: string, gameId: string) =>
  report(id).rows.find((entry) => entry.game.id === gameId)!

describe('case-sensitive legend mapping', () => {
  const $ = load(mainHtml)
  const legend = new Map(
    $('table')
      .first()
      .find('tr')
      .toArray()
      .flatMap((r) => {
        const cells = $(r).children('td')
        return cells.length === 2
          ? [[cells.eq(0).text().trim(), cells.eq(1).text().trim()] as const]
          : []
      }),
  )
  it.each(['EV', 'EVE', 'EVD', 'CCEV'])('%s is an event-only catch', (code) => {
    expect(classifyAvailabilitySymbol(code, legend).status).toBe('eventOnlyIn')
  })
  it.each([
    'Ev',
    'EvB',
    'EvE',
    'EvET',
    'PW',
    'PWE',
    'DR',
    'DRE',
    'DRET',
    'DW',
    'DWB',
    'DWE',
    'DWET',
    'TE',
    'TED',
    'T',
  ])('%s needs an external route', (code) => {
    expect(classifyAvailabilitySymbol(code, legend).status).toBe('transferOnlyIn')
  })
  it.each([
    'C',
    'S',
    'R',
    'E',
    'B',
    'CD',
    'D',
    'DA',
    'DD',
    'ET',
    'ETD',
    'CC',
    'CCB',
    'CCD',
    'CCDA',
    'CCDD',
    'CCE',
    'CCR',
    'CCS',
    'DS',
    'DSE',
    'DSET',
    'FS',
    'FSB',
    'FSE',
    'FSET',
  ])('%s is ordinary acquisition', (code) => {
    expect(classifyAvailabilitySymbol(code, legend).status).toBe('obtainableIn')
  })
  it('distinguishes explicit unavailability, blanks, and unsupported codes', () => {
    expect(classifyAvailabilitySymbol('—', legend).status).toBe('unavailable')
    expect(classifyAvailabilitySymbol('', legend).status).toBe('unknown')
    expect(() => classifyAvailabilitySymbol('NEW', legend)).toThrow('Unknown availability symbol')
  })
  it('distinguishes communication plus DLC from a Max Raid Den', () => {
    expect(classifyAvailabilitySymbol('CCD', legend).note).not.toContain('Pokémon Den')
    expect(classifyAvailabilitySymbol('CCD', legend).note).toContain('paid DLC')
    expect(classifyAvailabilitySymbol('CCDD', legend).note).toContain('Pokémon Den')
    expect(classifyAvailabilitySymbol('CCDD', legend).note).toContain('paid DLC')
  })
})

describe('main table parsing', () => {
  it('uses English Blue from Green, skipping Japanese Blue without shifting later games', () => {
    const $ = load(mainHtml)
    const cells = $('table').eq(1).find('tr').eq(2).children('th')
    cells.eq(1).text('T')
    cells.eq(2).text('EV')
    cells.eq(3).text('R')
    const parsed = parseMainAvailability($.html())
    const methods = parsed.rows.get(1)![0].methods
    expect(methods.get('rb-b')?.status).toBe('transferOnlyIn')
    expect(methods.get('y')?.status).toBe('obtainableIn')
    expect(parsed.gameIds.size).toBe(40)
  })
  it('maps reduced columns for Gen VII, Meltan, Gen VIII and Hisui', () => {
    expect(row('meltan', 'lgpe-lgp').status).toBe('transferOnlyIn')
    expect(row('meltan', 'sm-s').status).toBe('unavailable')
    expect(row('toxtricity', 'bdsp-bd').status).toBe('unavailable')
    expect(row('basculegion', 'la').status).toBe('obtainableIn')
    expect(row('basculegion', 'swsh-sw').status).toBe('unavailable')
    expect(row('pecharunt', 'sv-s').status).toBe('eventOnlyIn')
  })
  it.each([
    'raichu-alola',
    'tauros-paldea',
    'tauros-paldea-fire',
    'tauros-paldea-water',
    'sneasel-hisui',
    'shellos',
    'shellos-east',
    'basculin',
    'basculin-blue-striped',
    'basculin-white-striped',
    'deerling-summer',
    'meowstic-f',
    'indeedee-f',
    'floette-eternal',
    'magearna-original',
    'toxtricity-low-key',
    'gimmighoul-roaming',
  ])('matches the exact named or pictured form %s', (id) => {
    expect(resolveMainAvailability(tables.main!, pokemon(id))).toBeDefined()
  })
  it('does not give absent alternate forms their species availability', () => {
    for (const id of [
      'deoxys-attack',
      'pikachu-original',
      'poltchageist-artisan',
      'terapagos-terastal',
      'terapagos-stellar',
    ]) {
      expect(resolveMainAvailability(tables.main!, pokemon(id))).toBeUndefined()
    }
    const future = {
      ...pokemon('deoxys-attack'),
      id: 'deoxys-future',
      nid: '0386-future',
      formId: 'future',
      formNames: { eng: 'Future Forme' },
    }
    expect(
      createAvailabilityReport(tables, future, games)
        .rows.filter((entry) => entry.game.id !== 'go')
        .every((entry) => entry.basis === 'dataset' || entry.basis === 'unknown'),
    ).toBe(true)
  })
  it('retains blank cells and their existing values', () => {
    const selected = pokemon('bulbasaur')
    const main = parseMainAvailability(mainHtml)
    main.rows.get(1)![0].methods.set('lza', { status: 'unknown', text: 'Empty source cell' })
    const result = createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games)
    const lza = result.rows.find((entry) => entry.game.id === 'lza')!
    expect(lza.methods[0]).toMatchObject({ status: 'unknown', text: 'Empty source cell' })
    expect(['dataset', 'unknown']).toContain(lza.basis)
    expect(result.warnings.join(' ')).toContain('lza')
  })
  it('retains footnote qualifiers without changing source symbols', () => {
    expect(row('celebi', 'c').methods[0]).toMatchObject({ text: 'C', status: 'obtainableIn' })
    expect(row('celebi', 'c').methods[0].note).toContain('Virtual Console')
    expect(row('togepi', 'col').methods[0]).toMatchObject({ text: 'EV', status: 'eventOnlyIn' })
  })
  it('rejects changed legends, column order, cell widths and unrecognized labels', () => {
    expect(() => parseMainAvailability(mainHtml.replace('<td>PW', '<td>XX'))).toThrow(
      'legend changed',
    )
    const order = load(mainHtml)
    order('p a')
      .filter((_, link) => order(link).text().trim() === 'Gold')
      .text('New game')
    expect(() => parseMainAvailability(order.html())).toThrow('game order changed')
    const $ = load(mainHtml)
    $('table').eq(1).find('tr').eq(3).children().last().remove()
    expect(() => parseMainAvailability($.html())).toThrow('column count')
    const cells = load(mainHtml)
    cells('table').eq(1).find('tr').eq(3).children('th').first().text('NEW')
    expect(() => parseMainAvailability(cells.html())).toThrow('Unknown availability symbol')
  })
  it('rejects game cells moved to another column even at the same width', () => {
    const $ = load(mainHtml)
    const cells = $('table').eq(1).find('tr').eq(3).children('th')
    const first = cells.first().attr('style')!
    cells.first().attr('style', cells.last().attr('style')!)
    cells.last().attr('style', first)
    expect(() => parseMainAvailability($.html())).toThrow('Misaligned')
  })
})

describe('shared reports', () => {
  it('excludes Champions recruitment without inventing a visiting route or removing storage', () => {
    const selected = {
      ...pokemon('bulbasaur'),
      obtainableIn: ['champions', 'home'],
      transferOnlyIn: [],
      eventOnlyIn: [],
      storableIn: ['champions'],
    }
    // The policy applies to retained data, including when only the GO source is loaded.
    for (const parsed of [tables, parseAvailabilityTables({ go: goPage() })]) {
      const result = createAvailabilityReport(parsed, selected, games)
      expect(result.rows.find((entry) => entry.game.id === 'champions')).toMatchObject({
        status: 'unknown',
        basis: 'unknown',
        storable: true,
        methods: [expect.objectContaining({ text: expect.stringContaining('cannot be exported') })],
      })
      const candidate = availabilityJson(result)
      expect(candidate.obtainableIn).not.toContain('champions')
      expect(candidate.obtainableIn).toContain('home')
      expect(candidate.transferOnlyIn).not.toContain('champions')
      expect(candidate.storableIn).toEqual(['champions'])
      expect(result.warnings.join(' ')).toContain('champions')
    }
    const visiting = { ...selected, obtainableIn: [], transferOnlyIn: ['champions'] }
    const result = createAvailabilityReport(tables, visiting, games)
    expect(result.rows.find((entry) => entry.game.id === 'champions')?.status).toBe(
      'transferOnlyIn',
    )
    expect(availabilityJson(result).transferOnlyIn).toContain('champions')
  })

  it('rejects Champions as an acquisition source even in positive source cells and partial reports', () => {
    const selected = { ...pokemon('bulbasaur'), obtainableIn: ['champions'] }
    const main = parseMainAvailability(mainHtml)
    main.gameIds.add('champions')
    main.rows.get(1)![0].methods.set('champions', { status: 'obtainableIn', text: 'C' })
    const result = createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games)
    expect(result.rows.find((entry) => entry.game.id === 'champions')?.status).toBe('unknown')
    expect(availabilityJson(result).obtainableIn).not.toContain('champions')
    expect(availabilityJson({ ...result, rows: [] }).obtainableIn).not.toContain('champions')
  })

  it('inherits cosmetic female source rows except Gen I', () => {
    const result = report('pikachu-f', [pokemon('pikachu'), pokemon('pikachu-f')])
    expect(result.rows.find((entry) => entry.game.id === 'rb-r')).toMatchObject({
      status: 'unavailable',
      basis: 'rule',
    })
    expect(result.rows.find((entry) => entry.game.id === 'gs-g')).toMatchObject({
      status: 'obtainableIn',
      basis: 'rule',
    })
    expect(result.rows.find((entry) => entry.game.id === 'go')?.status).toBe('obtainableIn')
  })
  it('preserves storage and uncovered games but replaces verified EV/Ev/PW classifications', () => {
    const selected = pokemon('bulbasaur')
    selected.storableIn = ['home', 'rb-r']
    selected.obtainableIn = ['home', 'gs-g']
    selected.eventOnlyIn = ['gs-g']
    const result = availabilityJson(createAvailabilityReport(tables, selected, games))
    expect(result.storableIn).toEqual(['home', 'rb-r'])
    expect(result.obtainableIn).toContain('home')
    expect(result.obtainableIn).not.toContain('gs-g')
    expect(result.eventOnlyIn).not.toContain('gs-g')
    expect(result.transferOnlyIn).toContain('gs-g')
  })
  it('resolves ids/nids and prints a bounded terminal table', () => {
    expect(resolvePokemon('26-alola', [pokemon('raichu-alola')]).id).toBe('raichu-alola')
    expect(() => resolvePokemon('wrong', [pokemon('pikachu')])).toThrow('Unknown Pokémon')
    expect(
      formatAvailabilityTable(report('pikachu'), 60)
        .split('\n')
        .every((line) => [...line].length <= 60),
    ).toBe(true)
  })
})

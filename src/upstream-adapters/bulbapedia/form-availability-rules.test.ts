import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  availabilityFields,
  availabilityJson,
  createAvailabilityReport,
  parseAvailabilityTables,
  type AvailabilityGame,
  type AvailabilityPokemon,
} from './availability.ts'
import { megaEvolutionUrl } from './form-availability-rules.ts'
import { mainPage, goPage } from './test-fixtures.ts'

const read = <T>(collection: string, id: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../data/${collection}/${id}.json`, import.meta.url), 'utf8'),
  )
const pokemon = (id: string) => read<AvailabilityPokemon>('pokemon', id)
const games = [
  'rb-r',
  'xy-x',
  'xy-y',
  'oras-or',
  'oras-as',
  'sm-s',
  'sm-m',
  'usum-us',
  'usum-um',
  'lgpe-lgp',
  'lgpe-lge',
  'swsh-sw',
  'swsh-sh',
  'sv-s',
  'lza',
  'go',
  'home',
  'champions',
  'wiwa-wi',
].map((id) => read<AvailabilityGame>('games', id))
const tables = parseAvailabilityTables({ main: mainPage(), go: goPage() })
const report = (id: string) => createAvailabilityReport(tables, pokemon(id), games)

describe('explicit transformation rules', () => {
  it.each([
    [
      'venusaur-mega',
      [
        'xy-x',
        'xy-y',
        'oras-or',
        'oras-as',
        'sm-s',
        'sm-m',
        'usum-us',
        'usum-um',
        'lgpe-lgp',
        'lgpe-lge',
        'lza',
      ],
    ],
    [
      'beedrill-mega',
      ['oras-or', 'oras-as', 'sm-s', 'sm-m', 'usum-us', 'usum-um', 'lgpe-lgp', 'lgpe-lge', 'lza'],
    ],
    ['sceptile-mega', ['oras-or', 'oras-as', 'sm-s', 'sm-m', 'usum-us', 'usum-um', 'lza']],
    ['raichu-mega-x', ['lza']],
    ['garchomp-mega-z', ['lza']],
  ])('maps %s to its supported games', (id, supported) => {
    const rows = report(id).rows.filter((row) => tables.main!.gameIds.has(row.game.id))
    expect(rows.filter((row) => row.status === 'obtainableIn').map((row) => row.game.id)).toEqual(
      supported,
    )
    expect(rows.every((row) => row.basis === 'rule')).toBe(true)
    expect(
      rows
        .filter((row) => !supported.includes(row.game.id))
        .every((row) => row.status === 'unavailable'),
    ).toBe(true)
    expect(rows[0].methods[0].sourceUrl).toBe(megaEvolutionUrl)
    expect(report(id).warnings.join(' ')).not.toContain('No exact main-series')
  })

  it.each(['latias-mega', 'latios-mega'])(
    'preserves the documented X/Y stone-transfer exception for %s',
    (id) => {
      expect(report(id).rows.find((row) => row.game.id === 'xy-x')).toMatchObject({
        status: 'transferOnlyIn',
        basis: 'rule',
      })
    },
  )

  it('uses the exact base-form event gate and replaces overlapping saved categories', () => {
    const base = pokemon('magearna-original')
    const selected = pokemon('magearna-original-mega')
    selected.obtainableIn = ['lza']
    selected.transferOnlyIn = ['lza']
    selected.eventOnlyIn = ['lza']
    const main = {
      gameIds: new Set(['lza']),
      rows: new Map([
        [
          801,
          [
            {
              form: '',
              methods: new Map([['lza', { text: 'R', status: 'obtainableIn' as const }]]),
            },
            {
              form: 'Original',
              methods: new Map([['lza', { text: 'EV', status: 'eventOnlyIn' as const }]]),
            },
          ],
        ],
      ]),
    }
    const result = availabilityJson(
      createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games, [base, selected]),
    )
    expect(result.eventOnlyIn).toContain('lza')
    expect(result.obtainableIn).not.toContain('lza')
    expect(result.transferOnlyIn).not.toContain('lza')
    expect(result.storableIn).toEqual(selected.storableIn)
  })

  it('does not turn a blank base-form source cell into ordinary acquisition', () => {
    const main = {
      gameIds: new Set(['lza']),
      rows: new Map([
        [
          719,
          [
            {
              form: '',
              methods: new Map([
                ['lza', { text: 'Empty source cell', status: 'unknown' as const }],
              ]),
            },
          ],
        ],
      ]),
    }
    const result = createAvailabilityReport(
      { main, gameIds: main.gameIds },
      pokemon('diancie-mega'),
      games,
    )
    expect(result.rows.find((row) => row.game.id === 'lza')?.basis).toMatch(/dataset|unknown/)
  })

  it('keeps unrecognized introduction groups and games unresolved', () => {
    const selected = { ...pokemon('venusaur-mega'), debutIn: 'future', obtainableIn: ['champions'] }
    const result = createAvailabilityReport(tables, selected, games)
    for (const id of ['xy-x', 'champions', 'wiwa-wi', 'home'])
      expect(result.rows.find((row) => row.game.id === id)?.basis).toMatch(/dataset|unknown/)
    expect(availabilityJson(result).obtainableIn).toContain('champions')
  })

  it('applies Gigantamax rules to both Sword/Shield versions, with the Melmetal exception', () => {
    for (const id of [
      'flapple-gmax',
      'appletun-gmax',
      'toxtricity-low-key-gmax',
      'melmetal-gmax',
    ]) {
      const selected = report(id)
      expect(selected.rows.find((row) => row.game.id === 'swsh-sw')).toMatchObject({
        basis: 'rule',
        status: id === 'melmetal-gmax' ? 'transferOnlyIn' : 'obtainableIn',
      })
      expect(selected.rows.find((row) => row.game.id === 'swsh-sh')).toMatchObject({
        basis: 'rule',
        status: id === 'melmetal-gmax' ? 'transferOnlyIn' : 'obtainableIn',
      })
      expect(selected.rows.find((row) => row.game.id === 'lza')).toMatchObject({
        basis: 'rule',
        status: 'unavailable',
      })
    }
    const result = availabilityJson(report('melmetal-gmax'))
    expect(result.eventOnlyIn).toContain('home')
    expect(result.obtainableIn).not.toContain('home')
    expect(result.transferOnlyIn).not.toContain('home')
    expect(
      report('melmetal-gmax').rows.find((row) => row.game.id === 'home')?.methods[0].sourceUrl,
    ).toBeNull()
  })

  it('does not infer GO, Primal forms, or main-series rules from a GO-only request', () => {
    const selected = pokemon('venusaur-mega')
    expect(report(selected.id).rows.find((row) => row.game.id === 'go')?.basis).toMatch(
      /dataset|unknown/,
    )
    const goOnly = parseAvailabilityTables({ go: goPage() })
    expect(
      createAvailabilityReport(goOnly, selected, games).rows.find((row) => row.game.id === 'xy-x')
        ?.basis,
    ).toBe('dataset')
    expect(report('kyogre-primal').rows.find((row) => row.game.id === 'oras-or')?.basis).toMatch(
      /dataset|unknown/,
    )
    const result = availabilityJson(report(selected.id))
    expect(availabilityFields.filter((field) => result[field].includes('xy-x'))).toEqual([
      'obtainableIn',
    ])
  })
})

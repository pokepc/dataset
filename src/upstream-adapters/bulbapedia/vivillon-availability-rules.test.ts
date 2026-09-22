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
import { formAvailabilityInheritance } from './form-availability-inheritance.ts'
import { resolveVivillonAvailability } from './vivillon-availability-rules.ts'
import { mainPage } from './test-fixtures.ts'

const read = <T>(collection: string, id: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../data/${collection}/${id}.json`, import.meta.url), 'utf8'),
  )
const games = read<string[]>('indices', 'games').map((id) => read<AvailabilityGame>('games', id))
const forms = read<string[]>('indices', 'pokemon')
  .filter((id) => id === 'vivillon' || id.startsWith('vivillon-'))
  .map((id) => read<AvailabilityPokemon>('pokemon', id))
const { main } = parseAvailabilityTables({ main: mainPage() })
// Source cells describe a species, not the individual patterns. The curated matrix must override
// even a misleading positive species cell; explicit incompatibilities can still apply to all forms.
main!.rows.set(666, [
  {
    form: '',
    methods: new Map(
      [...main!.gameIds].map((game) => [game, { text: '—', status: 'unavailable' as const }]),
    ),
  },
])
const tables = { main: main!, gameIds: main!.gameIds }
const nativeZa = ['vivillon-meadow', 'vivillon-marine', 'vivillon-garden']

describe('curated Vivillon availability by game and pattern', () => {
  it.each(forms.map((p) => [p.id, p] as const))(
    '%s follows the complete acquisition matrix',
    (id, pokemon) => {
      const special = ['vivillon-fancy', 'vivillon-pokeball'].includes(id)
      const report = createAvailabilityReport(tables, pokemon, games, forms)
      const expected = new Map([
        ['xy-x', !special],
        ['xy-y', !special],
        ['oras-or', false],
        ['oras-as', false],
        ['sm-s', false],
        ['sm-m', false],
        ['usum-us', !special],
        ['usum-um', !special],
        ['sv-s', id === 'vivillon-fancy'],
        ['sv-v', id === 'vivillon-fancy'],
        ['lza', nativeZa.includes(id)],
        ['home', false],
        ['champions', false],
      ])
      const candidate = availabilityJson(report)
      for (const [game, obtainable] of expected) {
        const status = obtainable ? 'obtainableIn' : 'transferOnlyIn'
        expect(
          report.rows.find((row) => row.game.id === game),
          `${id}/${game}`,
        ).toMatchObject({ basis: 'rule', status })
        expect(availabilityFields.filter((field) => candidate[field].includes(game))).toEqual([
          status,
        ])
      }
      for (const game of ['rb-r', 'b2w2-b2', 'lgpe-lgp', 'swsh-sw', 'swsh-sh', 'bdsp-bd', 'la'])
        expect(report.rows.find((row) => row.game.id === game)).toMatchObject({
          basis: 'rule',
          status: 'unavailable',
        })
      expect(candidate.storableIn).toEqual(pokemon.storableIn)
      expect(candidate.storableIn).toContain('home')
      expect(formAvailabilityInheritance(pokemon)).toBeUndefined()
    },
  )

  it('has all 20 patterns, with Icy Snow represented by the unsuffixed ID', () => {
    expect(forms).toHaveLength(20)
    const report = createAvailabilityReport(
      tables,
      forms.find((p) => p.id === 'vivillon')!,
      games,
      forms,
    )
    expect(report.rows.find((row) => row.game.id === 'lza')?.status).toBe('transferOnlyIn')
    expect(report.rows.find((row) => row.game.id === 'sv-s')?.status).toBe('transferOnlyIn')
  })

  it('documents postcard simplification and the permanent Marine quest reward', () => {
    const icy = forms.find((p) => p.id === 'vivillon')!
    expect(resolveVivillonAvailability(main!, icy, 'sv-s')?.text).toContain('postcard-dependent')
    const marine = forms.find((p) => p.id === 'vivillon-marine')!
    expect(resolveVivillonAvailability(main!, marine, 'lza')).toMatchObject({
      status: 'obtainableIn',
      text: expect.stringContaining('ordinary permanent quest reward'),
    })
  })

  it('removes the old Fancy/Poké Ball distribution overlaps', () => {
    for (const id of ['vivillon-fancy', 'vivillon-pokeball']) {
      const pokemon = {
        ...forms.find((p) => p.id === id)!,
        obtainableIn: ['xy-x'],
        eventOnlyIn: ['xy-x'],
        transferOnlyIn: ['xy-x'],
      }
      const candidate = availabilityJson(createAvailabilityReport(tables, pokemon, games, forms))
      expect(candidate.transferOnlyIn).toContain('xy-x')
      expect(candidate.obtainableIn).not.toContain('xy-x')
      expect(candidate.eventOnlyIn).not.toContain('xy-x')
    }
  })

  it('lets exact GO entries decide availability even for special patterns', () => {
    const pokemon = forms.find((p) => p.id === 'vivillon-fancy')!
    for (const status of ['obtainableIn', 'unavailable'] as const) {
      const go = {
        warnings: [],
        entries: [
          {
            sprite: 'GO0666Fan.png',
            dexNum: 666,
            form: 'fancy',
            speciesWide: false,
            status,
            text: 'Exact GO entry',
          },
        ],
      }
      for (const parsed of [
        { ...tables, go, gameIds: new Set([...main!.gameIds, 'go']) },
        { go, gameIds: new Set(['go']) },
      ]) {
        const report = createAvailabilityReport(parsed, pokemon, games, forms)
        expect(report.rows.find((row) => row.game.id === 'go')).toMatchObject({
          basis: 'source',
          status,
        })
      }
    }
  })

  it('leaves future games and unknown patterns unresolved instead of copying species positives', () => {
    const pokemon = forms[0]
    const unknownGame = {
      gameIds: new Set(['wiwa-wi']),
      rows: new Map([
        [
          666,
          [
            {
              form: '',
              methods: new Map([['wiwa-wi', { text: 'C', status: 'obtainableIn' as const }]]),
            },
          ],
        ],
      ]),
    }
    const report = createAvailabilityReport(
      { main: unknownGame, gameIds: unknownGame.gameIds },
      pokemon,
      games,
      forms,
    )
    expect(report.rows.find((row) => row.game.id === 'wiwa-wi')?.basis).toBe('unknown')
    expect(
      resolveVivillonAvailability(main!, { ...pokemon, id: 'vivillon-unknown' }, 'lza'),
    ).toBeUndefined()
    expect(resolveVivillonAvailability(main!, pokemon, 'pokopia')).toBeUndefined()
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  availabilityFields,
  availabilityJson,
  createAvailabilityReport,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityStatus,
} from './availability.ts'
import { formAvailabilityInheritance } from './form-availability-inheritance.ts'
import type { MainAvailability } from './main-availability.ts'
import type { GoAvailability } from './go-availability.ts'

const read = <T>(collection: string, id: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../data/${collection}/${id}.json`, import.meta.url), 'utf8'),
  )
const pokemon = (id: string) => read<AvailabilityPokemon>('pokemon', id)
const games = read<string[]>('indices', 'games').map((id) => read<AvailabilityGame>('games', id))
const source = (
  base: AvailabilityPokemon,
  overrides: Record<string, AvailabilityStatus> = {},
): MainAvailability => ({
  gameIds: new Set([
    'rb-r',
    'rs-r',
    'dp-d',
    'dp-p',
    'pt',
    'hgss-hg',
    'xy-x',
    'oras-or',
    'sm-s',
    'usum-us',
    'swsh-sw',
    'la',
    'lza',
  ]),
  rows: new Map([
    [
      Number(base.dexNum),
      [
        {
          form: '',
          methods: new Map(
            Object.entries({
              'rb-r': 'unavailable',
              'rs-r': 'unavailable',
              'dp-d': 'obtainableIn',
              'dp-p': 'obtainableIn',
              pt: 'obtainableIn',
              'hgss-hg': 'transferOnlyIn',
              'xy-x': 'obtainableIn',
              'oras-or': 'transferOnlyIn',
              'sm-s': 'transferOnlyIn',
              'usum-us': 'transferOnlyIn',
              'swsh-sw': 'unavailable',
              la: 'obtainableIn',
              lza: 'eventOnlyIn',
              ...overrides,
            } as Record<string, AvailabilityStatus>).map(([game, status]) => [
              game,
              { text: status, status },
            ]),
          ),
        },
      ],
    ],
  ]),
})
const goSource = (base: AvailabilityPokemon, exact?: AvailabilityStatus): GoAvailability => ({
  warnings: [],
  entries: [
    {
      sprite: 'base.png',
      dexNum: Number(base.dexNum),
      form: '',
      speciesWide: false,
      text: 'Released base',
      status: 'obtainableIn',
    },
    ...(exact
      ? [
          {
            sprite: 'form.png',
            dexNum: Number(base.dexNum),
            form: 'wash',
            speciesWide: false,
            text: 'Exact form entry',
            status: exact,
          },
        ]
      : []),
  ],
})
const fields = [...availabilityFields, 'storableIn'] as const

describe('explicit base-form inheritance', () => {
  it.each([
    ['pumpkaboo-small', 'pumpkaboo'],
    ['gourgeist-super', 'gourgeist'],
    ['alcremie-rainbow-swirl-ribbon', 'alcremie'],
    ['unown-z', 'unown'],
    ['arceus-fire', 'arceus'],
    ['silvally-fairy', 'silvally'],
    ['flabebe-blue', 'flabebe'],
    ['floette-white', 'floette'],
    ['florges-yellow', 'florges'],
    ['genesect-chill', 'genesect'],
  ])('%s inherits acquisition and storage from %s', (id, baseId) => {
    const selected = {
      ...pokemon(id),
      obtainableIn: ['home', 'lza'],
      eventOnlyIn: ['xy-x'],
      transferOnlyIn: ['lza'],
      storableIn: [],
    }
    const base = {
      ...pokemon(baseId),
      obtainableIn: ['champions'],
      eventOnlyIn: [],
      transferOnlyIn: ['home'],
      storableIn: ['home', 'bank', 'xy-x', 'champions'],
    }
    const main = source(base)
    const report = createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games, [
      base,
      selected,
    ])
    const candidate = availabilityJson(report)
    expect(candidate.obtainableIn).toContain('xy-x')
    expect(candidate.transferOnlyIn).toContain('oras-or')
    expect(candidate.eventOnlyIn).toContain('lza')
    expect(candidate.obtainableIn).not.toContain('lza')
    expect(candidate.transferOnlyIn).not.toContain('lza')
    expect(candidate.eventOnlyIn).not.toContain('xy-x')
    expect(candidate.obtainableIn).not.toContain('champions')
    expect(candidate.transferOnlyIn).not.toContain('champions')
    expect(report.rows.find((row) => row.game.id === 'champions')).toMatchObject({
      basis: 'unknown',
      status: 'unknown',
    })
    const heldItem = ['arceus', 'silvally', 'genesect'].includes(baseId)
    expect(candidate.transferOnlyIn.includes('home')).toBe(!heldItem)
    expect(candidate.obtainableIn).not.toContain('home')
    const storage = heldItem ? ['xy-x', 'champions'] : base.storableIn
    expect(candidate.storableIn).toEqual(storage)
    expect(report.rows.find((row) => row.game.id === 'xy-x')).toMatchObject({
      basis: 'rule',
      storable: true,
    })
    expect(report.rows.find((row) => row.game.id === 'home')).toMatchObject(
      heldItem
        ? { basis: 'rule', status: 'unavailable', storable: false }
        : { basis: 'dataset', inheritedFrom: baseId },
    )
  })

  it('selects all 164 ordinary variants and keeps curated/special forms out of inheritance', () => {
    const all = read<string[]>('indices', 'pokemon').map(pokemon)
    expect(all.filter((entry) => formAvailabilityInheritance(entry))).toHaveLength(164)
    for (const id of [
      'unown',
      'unown-question',
      'unown-exclamation',
      'vivillon-fancy',
      'vivillon-pokeball',
      'vivillon-ocean',
      'pikachu-original',
      'pikachu-partner',
      'pikachu-world',
      'floette-eternal',
      'floette-eternal-mega',
      'alcremie-gmax',
      'arceus-legendary',
      'minior',
    ])
      expect(formAvailabilityInheritance(pokemon(id)), id).toBeUndefined()
  })

  it('uses Minior’s species source without copying Meteor’s empty storage onto cores', () => {
    const core = { ...pokemon('minior-red'), storableIn: ['home', 'sm-s'] }
    const meteor = { ...pokemon('minior'), storableIn: [] }
    const main = source(meteor)
    for (const id of ['minior-red', 'minior-blue']) {
      const selected = id === core.id ? core : pokemon(id)
      const report = createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games, [
        core,
        meteor,
        selected,
      ])
      expect(availabilityJson(report).storableIn).toEqual(core.storableIn)
      expect(report.rows.find((row) => row.game.id === 'sm-s')).toMatchObject({
        basis: 'rule',
        status: 'transferOnlyIn',
      })
    }
    expect(
      availabilityJson(
        createAvailabilityReport({ main, gameIds: main.gameIds }, meteor, games, [core, meteor]),
      ).storableIn,
    ).toEqual([])
  })

  it('retains Furfrou Gen VII storage, excluding Gen VI and Bank deposit reversion', () => {
    const base = {
      ...pokemon('furfrou'),
      storableIn: [
        'xy-x',
        'xy-y',
        'bank',
        'oras-or',
        'oras-as',
        'sm-s',
        'sm-m',
        'usum-us',
        'usum-um',
        'go',
        'home',
        'lza',
        'champions',
      ],
    }
    const selected = pokemon('furfrou-heart')
    const main = source(base)
    const report = createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games, [
      base,
      selected,
    ])
    expect(availabilityJson(report).storableIn).toEqual([
      'sm-s',
      'sm-m',
      'usum-us',
      'usum-um',
      'go',
      'home',
      'lza',
      'champions',
    ])
    expect(report.rows.find((row) => row.game.id === 'xy-x')).toMatchObject({
      status: 'obtainableIn',
      storable: false,
    })
  })

  it('restricts appliance Rotom acquisition and storage to Platinum onward', () => {
    const base = {
      ...pokemon('rotom'),
      storableIn: ['rs-r', 'dp-d', 'dp-p', 'pt', 'hgss-hg', 'home'],
    }
    const selected = { ...pokemon('rotom-wash'), obtainableIn: ['rs-r', 'dp-d', 'dp-p'] }
    const main = source(base)
    const candidate = availabilityJson(
      createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games, [base, selected]),
    )
    for (const field of fields)
      expect(candidate[field].filter((game) => ['rs-r', 'dp-d', 'dp-p'].includes(game))).toEqual([])
    expect(candidate.obtainableIn).toContain('pt')
    expect(candidate.transferOnlyIn).toContain('hgss-hg')
    expect(candidate.storableIn).toEqual(['pt', 'hgss-hg', 'home'])
  })

  it.each(['rotom-heat', 'rotom-wash', 'rotom-frost', 'rotom-fan', 'rotom-mow'])(
    '%s is transfer-only and storable in HOME without inheriting the base gift',
    (id) => {
      const base = { ...pokemon('rotom'), obtainableIn: ['home'], storableIn: ['home'] }
      const selected = {
        ...pokemon(id),
        obtainableIn: ['home'],
        eventOnlyIn: ['home'],
        transferOnlyIn: [],
        storableIn: ['home'],
      }
      const main = source(base)
      const tables = { main, gameIds: main.gameIds }
      for (const siblings of [[base, selected], [selected]]) {
        const report = createAvailabilityReport(tables, selected, games, siblings)
        const candidate = availabilityJson(report)
        expect(candidate.obtainableIn).not.toContain('home')
        expect(candidate.eventOnlyIn).not.toContain('home')
        expect(candidate.transferOnlyIn).toContain('home')
        expect(candidate.storableIn).toContain('home')
        expect(report.rows.find((row) => row.game.id === 'home')).toMatchObject({
          basis: 'rule',
          status: 'transferOnlyIn',
          storable: true,
        })
      }
      expect(
        availabilityJson(createAvailabilityReport(tables, base, games)).obtainableIn,
      ).toContain('home')
    },
  )

  it('keeps Legendary Plate Arceus exclusive to LA and Eternal Floette acquisition to LZA', () => {
    for (const [id, game] of [
      ['arceus-legendary', 'la'],
      ['floette-eternal', 'lza'],
    ]) {
      const selected = {
        ...pokemon(id),
        obtainableIn: ['xy-x'],
        transferOnlyIn: ['home', 'sv-s'],
        eventOnlyIn: ['go'],
      }
      const main = source(selected)
      const candidate = availabilityJson(
        createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games),
      )
      expect(candidate.obtainableIn).toEqual([game])
      expect(candidate.transferOnlyIn).toEqual([])
      expect(candidate.eventOnlyIn).toEqual([])
      expect(candidate.storableIn).toEqual(id === 'arceus-legendary' ? ['la'] : selected.storableIn)
    }
  })

  it('prioritizes exact GO entries, including unavailable and inconclusive entries', () => {
    const base = pokemon('rotom')
    const selected = {
      ...pokemon('rotom-wash'),
      obtainableIn: [],
      transferOnlyIn: [],
      eventOnlyIn: [],
    }
    for (const status of ['unavailable', 'unknown', undefined] as const) {
      const report = createAvailabilityReport(
        { go: goSource(base, status), gameIds: new Set(['go']) },
        selected,
        games,
        [base, selected],
      )
      expect(report.rows.find((row) => row.game.id === 'go')).toMatchObject({
        basis: status === 'unknown' ? 'unknown' : status === 'unavailable' ? 'source' : 'rule',
        status: status ?? 'obtainableIn',
      })
      expect(report.rows.find((row) => row.game.id === 'xy-x')?.basis).toBe('unknown')
      expect(availabilityJson(report).storableIn).toEqual(selected.storableIn)
    }
  })

  it.each([
    'arceus-fire',
    'silvally-fire',
    'genesect-burn',
    'dialga-origin',
    'palkia-origin',
    'giratina-origin',
    'zacian-crowned',
    'zamazenta-crowned',
    'ogerpon-wellspring',
    'ogerpon-hearthflame',
    'ogerpon-cornerstone',
    'venusaur-mega',
    'kyogre-primal',
    'groudon-primal',
  ])(
    'removes Bank and HOME from all availability fields for held-item form %s without its base record',
    (id) => {
      const selected = {
        ...pokemon(id),
        storableIn: ['bank', 'home', 'go', 'sv-s'],
        obtainableIn: ['bank', 'home'],
        eventOnlyIn: ['bank', 'home'],
        transferOnlyIn: ['bank', 'home'],
      }
      const main = source(selected)
      const report = createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games)
      const candidate = availabilityJson(report)
      const primal = ['kyogre-primal', 'groudon-primal'].includes(id)
      expect(candidate.storableIn).toEqual(primal ? ['go'] : ['go', 'sv-s'])
      for (const game of ['bank', 'home']) {
        for (const field of fields) expect(candidate[field]).not.toContain(game)
        expect(report.rows.find((row) => row.game.id === game)).toMatchObject({
          basis: 'rule',
          status: 'unavailable',
          storable: false,
        })
      }
      expect(report.warnings.join(' ')).toContain(
        primal
          ? 'Temporary battle forms do not inherit base storage'
          : id === 'giratina-origin'
            ? 'deposit/form-reversion exclusions'
            : 'HOME cannot retain a form that requires a held item',
      )
    },
  )

  it.each([
    'arceus',
    'silvally',
    'genesect',
    'mawile',
    'hoopa-unbound',
    'furfrou-heart',
    'alcremie-rainbow-swirl-ribbon',
  ])('does not remove HOME storage from %s based on a form item or form name alone', (id) => {
    const selected = { ...pokemon(id), storableIn: ['home'] }
    const main = source(selected)
    expect(
      availabilityJson(createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games))
        .storableIn,
    ).toEqual(['home'])
  })

  it('does not invent evidence from missing base records or blank source cells', () => {
    const base = pokemon('genesect')
    const selected = { ...pokemon('genesect-burn'), obtainableIn: ['lza'] }
    const main = source(base, { lza: 'unknown' })
    const tables = { main, gameIds: main.gameIds }
    const missing = createAvailabilityReport(tables, selected, games)
    expect(missing.warnings.join(' ')).toContain('needs sibling records genesect')
    expect(missing.rows.find((row) => row.game.id === 'xy-x')?.basis).not.toBe('rule')
    const blank = createAvailabilityReport(tables, selected, games, [base, selected])
    expect(blank.rows.find((row) => row.game.id === 'lza')?.basis).toBe('dataset')
    expect(availabilityJson(blank).obtainableIn).toContain('lza')
  })
})

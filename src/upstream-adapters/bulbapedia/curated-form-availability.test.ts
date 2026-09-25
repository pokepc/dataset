import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  availabilityJson,
  createAvailabilityReport,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityStatus,
} from './availability.ts'
import { curatedFormRules, resolveCuratedFormAvailability } from './curated-form-availability.ts'
import { parseMainAvailability, type MainAvailability } from './main-availability.ts'
import { mainPage } from './test-fixtures.ts'

const read = <T>(collection: string, id: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../data/${collection}/${id}.json`, import.meta.url), 'utf8'),
  )
const pokemon = (id: string) => read<AvailabilityPokemon>('pokemon', id)
const games = read<string[]>('indices', 'games').map((id) => read<AvailabilityGame>('games', id))
const species = [...new Set(curatedFormRules.map((rule) => rule.base))].map(pokemon)
const ids = curatedFormRules.flatMap((rule) => rule.forms)
const mainSource = (): MainAvailability => {
  const gameIds = parseMainAvailability(mainPage()).gameIds
  const rows: MainAvailability['rows'] = new Map()
  for (const base of [
    ...species,
    ...['reshiram', 'zekrom', 'solgaleo', 'lunala', 'glastrier', 'spectrier'].map(pokemon),
  ]) {
    const dex = Number(base.dexNum)
    rows.set(dex, [
      ...(rows.get(dex) ?? []),
      {
        form: base.isRegional ? 'Galarian' : '',
        methods: new Map(
          [...gameIds].map((game) => [game, { status: 'obtainableIn' as const, text: 'C' }]),
        ),
      },
    ])
  }
  return { gameIds, rows }
}
const method = (id: string, game: string, main = mainSource()) =>
  resolveCuratedFormAvailability(main, pokemon(id), game, species)

describe('researched main-game forms', () => {
  it('covers the 81 previously missing main-game forms exactly once', () => {
    expect(ids).toHaveLength(81)
    expect(new Set(ids).size).toBe(81)
  })

  it.each([
    'castform-sunny',
    'castform-rainy',
    'castform-snowy',
    'cherrim-sunshine',
    'aegislash-blade',
    'mimikyu-busted',
    'eiscue-noice',
    'morpeko-hangry',
    'palafin-hero',
    'cramorant-gulping',
    'cramorant-gorging',
    'wishiwashi-school',
    'meloetta-pirouette',
  ])('%s inherits acquisition, not storage or service gifts', (id) => {
    const selected = { ...pokemon(id), obtainableIn: ['home'], storableIn: ['home', 'sv-s', 'go'] }
    const main = mainSource()
    for (const status of [
      'obtainableIn',
      'transferOnlyIn',
      'eventOnlyIn',
      'unavailable',
    ] as const) {
      main.rows.get(Number(selected.dexNum))![0].methods.set('sv-s', { status, text: status })
      const result = createAvailabilityReport(
        { main, gameIds: main.gameIds },
        selected,
        games,
        species,
      )
      expect(result.rows.find((row) => row.game.id === 'sv-s')?.status).toBe(status)
      expect(result.rows.find((row) => row.game.id === 'home')?.status).toBe('unavailable')
      const json = availabilityJson(result)
      expect(json.storableIn).toEqual(['go'])
      expect(json.obtainableIn).not.toContain('home')
      expect(json.transferOnlyIn).not.toContain('home')
    }
  })

  it.each([
    ['unown-question', 'gs-g', 'unavailable'],
    ['unown-question', 'rs-r', 'obtainableIn'],
    ['deoxys-attack', 'frlg-fr', 'obtainableIn'],
    ['deoxys-attack', 'frlg-lg', 'unavailable'],
    ['deoxys-defense', 'frlg-lg', 'obtainableIn'],
    ['deoxys-speed', 'e', 'obtainableIn'],
    ['deoxys-speed', 'dp-d', 'obtainableIn'],
    ['kyogre-primal', 'xy-x', 'unavailable'],
    ['kyogre-primal', 'sm-s', 'obtainableIn'],
    ['groudon-primal', 'lza', 'obtainableIn'],
    ['groudon-primal', 'sv-s', 'unavailable'],
    ['dialga-origin', 'bdsp-bd', 'unavailable'],
    ['palkia-origin', 'la', 'obtainableIn'],
    ['giratina-origin', 'dp-d', 'unavailable'],
    ['giratina-origin', 'pt', 'obtainableIn'],
    ['shaymin-sky', 'dp-d', 'unavailable'],
    ['shaymin-sky', 'pt', 'obtainableIn'],
    ['tornadus-therian', 'bw-b', 'unavailable'],
    ['tornadus-therian', 'b2w2-b2', 'transferOnlyIn'],
    ['enamorus-therian', 'usum-us', 'unavailable'],
    ['enamorus-therian', 'la', 'obtainableIn'],
    ['keldeo-resolute', 'bw-b', 'unavailable'],
    ['keldeo-resolute', 'lza', 'obtainableIn'],
    ['zygarde-complete', 'xy-x', 'unavailable'],
    ['zygarde-complete', 'lza', 'obtainableIn'],
    ['hoopa-unbound', 'xy-x', 'unavailable'],
    ['hoopa-unbound', 'oras-or', 'obtainableIn'],
    ['necrozma-ultra', 'usum-us', 'obtainableIn'],
    ['necrozma-ultra', 'swsh-sw', 'unavailable'],
    ['greninja-ash', 'sm-s', 'transferOnlyIn'],
    ['greninja-ash', 'usum-us', 'transferOnlyIn'],
    ['greninja-ash', 'sv-s', 'unavailable'],
    ['eternatus-eternamax', 'swsh-sw', 'unavailable'],
    ['pikachu-partner', 'usum-us', 'eventOnlyIn'],
    ['pikachu-partner', 'sm-s', 'unavailable'],
    ['pikachu-original', 'sm-s', 'transferOnlyIn'],
    ['pikachu-world', 'sm-s', 'unavailable'],
    ['pikachu-world', 'swsh-sw', 'transferOnlyIn'],
    ['zarude-dada', 'lza', 'unavailable'],
    ['samurott-hisui', 'lza', 'unavailable'],
    ['sinistea-antique', 'lza', 'unavailable'],
    ['poltchageist-artisan', 'sv-s', 'obtainableIn'],
    ['tatsugiri-stretchy', 'lza', 'obtainableIn'],
    ['squawkabilly-white', 'lza', 'obtainableIn'],
  ])('%s in %s respects its form-specific gate', (id, game, expected) => {
    expect(method(id, game)?.status).toBe(expected)
  })

  it.each([
    ['kyurem-white', 643],
    ['kyurem-black', 644],
    ['necrozma-dusk-mane', 791],
    ['necrozma-dawn-wings', 792],
    ['calyrex-ice', 896],
    ['calyrex-shadow', 897],
  ] as const)('%s checks its fusion partner and excludes Bank/HOME', (id, dex) => {
    const main = mainSource()
    for (const status of [
      'transferOnlyIn',
      'eventOnlyIn',
      'unknown',
      'unavailable',
      'obtainableIn',
    ] as AvailabilityStatus[]) {
      main.rows.get(dex)![0].methods.set('sv-s', { status, text: status })
      expect(method(id, 'sv-s', main)?.status).toBe(status)
    }
    expect(method(id, 'home', main)?.status).toBe('unavailable')
    expect(method(id, 'bank', main)?.status).toBe('unavailable')
  })

  it('uses the Galarian base for Galarian Zen Mode', () => {
    const main = mainSource()
    main.rows.get(555)![0].methods.set('swsh-sw', { status: 'transferOnlyIn', text: 'T' })
    expect(method('darmanitan-zen', 'swsh-sw', main)?.status).toBe('transferOnlyIn')
    expect(method('darmanitan-galar-zen', 'swsh-sw', main)?.status).toBe('obtainableIn')
  })

  it('preserves source qualifiers and form-specific deposit behavior', () => {
    const main = mainSource()
    main.rows.get(386)![0].methods.set('frlg-fr', {
      status: 'obtainableIn',
      text: 'C',
      note: 'Nintendo Switch re-release; original game requires an event.',
    })
    expect(method('deoxys-attack', 'frlg-fr', main)?.note).toContain('Nintendo Switch re-release')
    const selected = {
      ...pokemon('hoopa-unbound'),
      storableIn: ['oras-or', 'oras-as', 'sm-s', 'bank', 'home', 'go'],
    }
    const result = createAvailabilityReport(
      { main, gameIds: main.gameIds },
      selected,
      games,
      species,
    )
    expect(availabilityJson(result).storableIn).toEqual(['bank', 'sm-s', 'home', 'go'])
    expect(result.rows.find((row) => row.game.id === 'bank')).toMatchObject({
      status: 'transferOnlyIn',
      basis: 'rule',
      storable: true,
    })
    expect(result.rows.find((row) => row.game.id === 'oras-or')).toMatchObject({
      status: 'obtainableIn',
      storable: false,
    })
  })

  it('stores punctuation Unown in earlier compatible Gen III games without adding Gen II', () => {
    const main = mainSource()
    const selected = { ...pokemon('unown-question'), storableIn: ['gs-g', 'home', 'go'] }
    const result = createAvailabilityReport(
      { main, gameIds: main.gameIds },
      selected,
      games,
      species,
    )
    expect(availabilityJson(result).storableIn).toEqual([
      'rs-r',
      'rs-s',
      'boxrs',
      'col',
      'frlg-fr',
      'frlg-lg',
      'e',
      'xd',
      'ranch',
      'bank',
      'home',
      'go',
    ])
  })

  it('keeps missing base/partner evidence and future games unresolved', () => {
    const main = mainSource()
    main.rows.delete(643)
    expect(method('kyurem-white', 'sv-s', main)?.status).toBe('unknown')
    expect(method('aegislash-blade', 'champions', main)).toBeUndefined()
    expect(method('aegislash-blade', 'wiwa-wi', main)).toBeUndefined()
    expect(
      resolveCuratedFormAvailability(main, pokemon('aegislash-blade'), 'xy-x', [])?.status,
    ).toBe('unknown')
  })

  it('removes every acquisition and storage route for Eternamax', () => {
    const allGames = games.filter((game) => game.type === 'game').map((game) => game.id)
    const selected = {
      ...pokemon('eternatus-eternamax'),
      obtainableIn: allGames,
      transferOnlyIn: allGames,
      eventOnlyIn: allGames,
      storableIn: allGames,
    }
    const main = mainSource()
    const result = availabilityJson(
      createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games, species),
    )
    for (const field of ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'] as const)
      expect(result[field]).toEqual([])
  })

  it('keeps Dada Zarude transfer-only and removes the incorrect GO release', () => {
    const main = mainSource()
    const selected = {
      ...pokemon('zarude-dada'),
      obtainableIn: ['go', 'swsh-sw'],
      eventOnlyIn: ['swsh-sh'],
      storableIn: ['go', 'home', 'swsh-sw'],
    }
    const result = availabilityJson(
      createAvailabilityReport({ main, gameIds: main.gameIds }, selected, games, species),
    )
    expect(result.obtainableIn).toEqual([])
    expect(result.eventOnlyIn).toEqual([])
    expect(result.transferOnlyIn).toEqual(
      expect.arrayContaining(['swsh-sw', 'swsh-sh', 'home', 'sv-s', 'sv-v']),
    )
    expect(result.transferOnlyIn).not.toContain('go')
    expect(result.storableIn).toEqual(['home', 'swsh-sw'])
  })

  it.each(['pikachu-original', 'pikachu-world'])(
    'marks released %s obtainable and storable in GO regardless of exportability',
    (id) => {
      const saved = pokemon(id)
      const selected = {
        ...saved,
        obtainableIn: ['go'],
        transferOnlyIn: [...saved.transferOnlyIn, 'go'],
        eventOnlyIn: ['go'],
        storableIn: saved.storableIn.filter((game) => game !== 'go'),
      }
      const main = mainSource()
      const report = createAvailabilityReport(
        { main, gameIds: main.gameIds },
        selected,
        games,
        species,
      )
      const result = availabilityJson({
        ...report,
        rows: report.rows.filter((row) => row.game.id === 'go'),
      })
      expect(result.obtainableIn).toContain('go')
      for (const field of ['transferOnlyIn', 'eventOnlyIn'] as const)
        expect(result[field]).not.toContain('go')
      expect(result.storableIn).toEqual([...selected.storableIn, 'go'])
      expect(result.transferOnlyIn).toEqual(saved.transferOnlyIn)
    },
  )

  it('never infers GO forms from these main-game inheritance rules', () => {
    const main = mainSource()
    for (const id of ids.filter(
      (id) =>
        !['eternatus-eternamax', 'zarude-dada', 'pikachu-original', 'pikachu-world'].includes(id),
    ))
      expect(method(id, 'go', main)).toBeUndefined()
    const selected = {
      ...pokemon('darmanitan-zen'),
      obtainableIn: [],
      transferOnlyIn: [],
      eventOnlyIn: [],
    }
    const go = {
      warnings: [],
      entries: [
        {
          dexNum: 555,
          sprite: 'GO0555.png',
          form: '',
          speciesWide: false,
          status: 'obtainableIn' as const,
          text: 'Base release',
        },
      ],
    }
    const result = createAvailabilityReport(
      { main, go, gameIds: new Set([...main.gameIds, 'go']) },
      selected,
      games,
      species,
    )
    expect(result.rows.find((row) => row.game.id === 'go')?.status).toBe('unknown')
    expect(availabilityJson(result).obtainableIn).not.toContain('go')
  })
})

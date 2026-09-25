import { describe, expect, it } from 'vitest'
import { loadAllGames, loadAllPokedexes, loadAllPokemon } from '../../lib/fs.ts'
import {
  availabilityJson,
  createAvailabilityReport,
  parseAvailabilityTables,
} from './availability.ts'
import { mainPage, goPage } from './test-fixtures.ts'

const games = loadAllGames()
const pokemon = loadAllPokemon()
const dexes = loadAllPokedexes()
const tables = parseAvailabilityTables({ main: mainPage() })
const getPokemon = (id: string) => pokemon.find((p) => p.id === id)!
const report = (id: string) => createAvailabilityReport(tables, getPokemon(id), games, pokemon)

describe('Box RS and Ranch catalog', () => {
  it.each([
    ['boxrs', 'rs-s', 'col', 25, 60, 386, 413],
    ['ranch', 'dp-p', 'pt', 1, 1500, 493, 646],
  ] as const)(
    'registers %s chronologically with its capacity and National checklist',
    (id, before, after, boxes, size, species, count) => {
      const game = games.find((game) => game.id === id)!
      const index = games.indexOf(game)
      expect(games[index - 1].id).toBe(before)
      expect(games[index + 1].id).toBe(after)
      expect(game).toMatchObject({
        series: 'storage',
        maxBoxes: boxes,
        maxBoxSize: size,
        maxPartySize: 0,
        pokedexes: [`national-${id}`],
      })
      const dex = dexes.find((dex) => dex.id === `national-${id}`)!
      expect(dex.entries).toHaveLength(count)
      expect(dex.entries.filter((entry) => !entry.isForm).map((entry) => entry.dexNum)).toEqual(
        Array.from({ length: species }, (_, i) => i + 1),
      )
      expect(dex.entries.some((entry) => entry.pid === 'eevee-f')).toBe(false)
    },
  )

  it('keeps Box gender data separate from its pre-gender-difference checklist', () => {
    expect(getPokemon('pikachu-f').storableIn).toContain('boxrs')
    expect(
      dexes.find((dex) => dex.id === 'national-boxrs')!.entries.some((e) => e.pid === 'pikachu-f'),
    ).toBe(false)
  })
})

describe('exact storage-service availability', () => {
  it.each([
    ['bulbasaur', 'boxrs', 'transferOnlyIn', true],
    ['pichu', 'boxrs', 'obtainableIn', true],
    ['unown-question', 'boxrs', 'transferOnlyIn', true],
    ['deoxys', 'boxrs', 'transferOnlyIn', true],
    ['deoxys-attack', 'boxrs', 'unavailable', false],
    ['castform-sunny', 'boxrs', 'unavailable', false],
    ['turtwig', 'boxrs', 'unavailable', false],
    ['mew', 'ranch', 'obtainableIn', true],
    ['pikachu-f', 'ranch', 'transferOnlyIn', true],
    ['combee', 'ranch', 'transferOnlyIn', true],
    ['combee-f', 'ranch', 'obtainableIn', true],
    ['shellos', 'ranch', 'transferOnlyIn', true],
    ['shellos-east', 'ranch', 'obtainableIn', true],
    ['octillery-f', 'ranch', 'eventOnlyIn', true],
    ['flygon', 'ranch', 'eventOnlyIn', true],
    ['meowth', 'ranch', 'eventOnlyIn', true],
    ['slaking', 'ranch', 'eventOnlyIn', true],
    ['metagross', 'ranch', 'eventOnlyIn', true],
    ['rotom-heat', 'ranch', 'transferOnlyIn', true],
    ['giratina-origin', 'ranch', 'transferOnlyIn', true],
    ['arceus-fire', 'ranch', 'transferOnlyIn', true],
    ['arceus-fairy', 'ranch', 'unavailable', false],
    ['shaymin-sky', 'ranch', 'transferOnlyIn', false],
    ['cherrim-sunshine', 'ranch', 'transferOnlyIn', false],
    ['castform-sunny', 'ranch', 'unavailable', false],
    ['eevee-f', 'ranch', 'unavailable', false],
    ['victini', 'ranch', 'unavailable', false],
    ['pikachu-original', 'ranch', 'unavailable', false],
  ] as const)('%s in %s is %s, storable=%s', (id, gameId, status, storable) => {
    expect(report(id).rows.find((row) => row.game.id === gameId)).toMatchObject({
      status,
      storable,
      basis: 'rule',
    })
    const saved = getPokemon(id)
    expect(saved.storableIn.includes(gameId)).toBe(storable)
    for (const field of ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn'] as const)
      expect(saved[field].includes(gameId)).toBe(status === field)
  })

  it('preserves every saved Box/Ranch classification on a full offline review', () => {
    for (const p of pokemon) {
      const candidate = availabilityJson(createAvailabilityReport(tables, p, games, pokemon))
      for (const field of ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'] as const)
        expect(
          candidate[field].filter((id) => ['boxrs', 'ranch'].includes(id)),
          `${p.id}.${field}`,
        ).toEqual(p[field].filter((id) => ['boxrs', 'ranch'].includes(id)))
    }
  })

  it('does not infer storage-service updates in a GO-only review', () => {
    const p = { ...getPokemon('bulbasaur'), storableIn: ['home'], transferOnlyIn: [] }
    const candidate = availabilityJson(
      createAvailabilityReport(parseAvailabilityTables({ go: goPage() }), p, games),
    )
    expect(candidate.storableIn).toEqual(['home'])
    expect(candidate.transferOnlyIn).not.toContain('ranch')
  })

  it('locks only Ranch native rewards, without restricting imported shinies or Box Eggs', () => {
    expect(getPokemon('mew').shinyLockedIn).toContain('ranch')
    expect(getPokemon('combee-f').shinyLockedIn).toContain('ranch')
    expect(getPokemon('combee').shinyLockedIn ?? []).not.toContain('ranch')
    expect(getPokemon('pichu').shinyLockedIn ?? []).not.toContain('boxrs')
  })
})

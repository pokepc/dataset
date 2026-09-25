import { describe, expect, it } from 'vitest'
import { loadAllGames, loadAllPokedexes, loadAllPokemon } from '../../lib/fs.ts'
import {
  availabilityJson,
  createAvailabilityReport,
  parseAvailabilityTables,
} from './availability.ts'
import { mainPage, goPage } from './test-fixtures.ts'
import { storageGameIds } from './storage-game-availability.ts'

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
    ['bulbasaur', 'bank', 'transferOnlyIn', true],
    ['celebi', 'bank', 'eventOnlyIn', true],
    ['meganium', 'bank', 'eventOnlyIn', true],
    ['meganium-f', 'bank', 'eventOnlyIn', true],
    ['regice', 'bank', 'eventOnlyIn', true],
    ['primarina', 'bank', 'eventOnlyIn', true],
    ['oranguru', 'bank', 'eventOnlyIn', true],
    ['meowstic-f', 'bank', 'transferOnlyIn', true],
    ['typhlosion-hisui', 'bank', 'unavailable', false],
    ['decidueye-hisui', 'bank', 'unavailable', false],
    ['pikachu-partner', 'bank', 'transferOnlyIn', true],
    ['pikachu-world', 'bank', 'unavailable', false],
    ['unown-question', 'bank', 'transferOnlyIn', true],
    ['deoxys-attack', 'bank', 'transferOnlyIn', true],
    ['raichu-alola', 'bank', 'transferOnlyIn', true],
    ['rotom-wash', 'bank', 'transferOnlyIn', true],
    ['vivillon-pokeball', 'bank', 'transferOnlyIn', true],
    ['hoopa-unbound', 'bank', 'transferOnlyIn', true],
    ['lycanroc-dusk', 'bank', 'transferOnlyIn', true],
    ['minior-violet', 'bank', 'transferOnlyIn', true],
    ['zeraora', 'bank', 'transferOnlyIn', true],
    ['meltan', 'bank', 'unavailable', false],
    ['melmetal', 'bank', 'unavailable', false],
    ['magearna-original', 'bank', 'unavailable', false],
    ['eevee-f', 'bank', 'unavailable', false],
    ['arceus-fire', 'bank', 'unavailable', false],
    ['giratina-origin', 'bank', 'unavailable', false],
    ['silvally-fire', 'bank', 'unavailable', false],
    ['genesect-burn', 'bank', 'unavailable', false],
    ['shaymin-sky', 'bank', 'unavailable', false],
    ['furfrou-heart', 'bank', 'unavailable', false],
    ['kyurem-black', 'bank', 'unavailable', false],
    ['necrozma-dusk-mane', 'bank', 'unavailable', false],
    ['rayquaza-mega', 'bank', 'unavailable', false],
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

  it('preserves every saved storage-service classification on a full offline review', () => {
    for (const p of pokemon) {
      const candidate = availabilityJson(createAvailabilityReport(tables, p, games, pokemon))
      for (const field of ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'] as const)
        expect(
          candidate[field].filter((id) => storageGameIds.some((game) => game === id)),
          `${p.id}.${field}`,
        ).toEqual(p[field].filter((id) => storageGameIds.some((game) => game === id)))
    }
  })

  it('resolves Bank from compatibility even when saved acquisition and storage are missing', () => {
    const p = {
      ...getPokemon('bulbasaur'),
      obtainableIn: [],
      transferOnlyIn: [],
      eventOnlyIn: [],
      storableIn: [],
    }
    const result = createAvailabilityReport(tables, p, games, pokemon)
    expect(result.rows.find((row) => row.game.id === 'bank')).toMatchObject({
      status: 'transferOnlyIn',
      storable: true,
      basis: 'rule',
    })
    expect(availabilityJson(result).transferOnlyIn).toContain('bank')
  })

  it('gives every Bank-compatible record one acquisition classification', () => {
    const stored = pokemon.filter((p) => p.storableIn.includes('bank'))
    expect(stored).toHaveLength(1032)
    expect(stored.filter((p) => p.transferOnlyIn.includes('bank'))).toHaveLength(1019)
    expect(stored.filter((p) => p.eventOnlyIn.includes('bank'))).toHaveLength(13)
    for (const p of pokemon) {
      expect(p.obtainableIn, p.id).not.toContain('bank')
      expect(p.transferOnlyIn.includes('bank') || p.eventOnlyIn.includes('bank'), p.id).toBe(
        p.storableIn.includes('bank'),
      )
    }
  })

  it('does not infer storage-service updates in a GO-only review', () => {
    const p = { ...getPokemon('bulbasaur'), storableIn: ['home'], transferOnlyIn: [] }
    const candidate = availabilityJson(
      createAvailabilityReport(parseAvailabilityTables({ go: goPage() }), p, games),
    )
    expect(candidate.storableIn).toEqual(['home'])
    expect(candidate.transferOnlyIn).not.toContain('ranch')
    expect(candidate.transferOnlyIn).not.toContain('bank')
  })

  it('locks only Ranch native rewards, without restricting imported shinies or Box Eggs', () => {
    expect(getPokemon('mew').shinyLockedIn).toContain('ranch')
    expect(getPokemon('combee-f').shinyLockedIn).toContain('ranch')
    expect(getPokemon('combee').shinyLockedIn ?? []).not.toContain('ranch')
    expect(getPokemon('pichu').shinyLockedIn ?? []).not.toContain('boxrs')
  })
})

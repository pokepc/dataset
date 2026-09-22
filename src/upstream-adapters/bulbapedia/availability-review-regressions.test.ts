import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  availabilityJson,
  createAvailabilityReport,
  parseAvailabilityTables,
  type AvailabilityGame,
  type AvailabilityPokemon,
} from './availability.ts'
import { mainPage } from './test-fixtures.ts'

const read = <T>(collection: string, id: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../data/${collection}/${id}.json`, import.meta.url), 'utf8'),
  )
const pokemon = (id: string) => read<AvailabilityPokemon>('pokemon', id)
const games = read<string[]>('indices', 'games').map((id) => read<AvailabilityGame>('games', id))
const tables = parseAvailabilityTables({ main: mainPage() })

describe('staged availability review regressions', () => {
  it('does not inherit pre-Fairy acquisition or storage from Arceus', () => {
    const base = pokemon('arceus')
    const selected = {
      ...pokemon('arceus-fairy'),
      transferOnlyIn: base.transferOnlyIn,
      storableIn: base.storableIn,
    }
    const result = availabilityJson(
      createAvailabilityReport(tables, selected, games, [base, selected]),
    )
    const oldGames = games.filter((game) => game.gen > 0 && game.gen < 6).map((game) => game.id)
    for (const field of ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn', 'storableIn'] as const)
      expect(result[field].filter((game) => oldGames.includes(game))).toEqual([])
    expect(result.storableIn).toContain('xy-x')
    expect(result.storableIn).not.toContain('home')
  })

  it('removes Gen III captures from Normal Deoxys without removing the actual captured forms', () => {
    const selected = {
      ...pokemon('deoxys'),
      obtainableIn: ['frlg-fr', 'frlg-lg'],
      eventOnlyIn: ['e'],
    }
    const result = availabilityJson(createAvailabilityReport(tables, selected, games))
    for (const field of ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn'] as const)
      expect(result[field].filter((game) => ['frlg-fr', 'frlg-lg', 'e'].includes(game))).toEqual([])
    for (const [id, game] of [
      ['deoxys-attack', 'frlg-fr'],
      ['deoxys-defense', 'frlg-lg'],
      ['deoxys-speed', 'e'],
    ]) {
      const saved = pokemon(id!)
      expect([...saved.obtainableIn, ...saved.eventOnlyIn]).toContain(game)
    }
  })

  it.each(['cramorant', 'zeraora'])(
    'adds GO storage for %s without changing other storage',
    (id) => {
      const saved = pokemon(id)
      const selected = { ...saved, storableIn: saved.storableIn.filter((game) => game !== 'go') }
      const result = availabilityJson(createAvailabilityReport(tables, selected, games))
      expect(result.storableIn).toEqual([...selected.storableIn, 'go'])
    },
  )

  it.each(['cramorant-gulping', 'cramorant-gorging'])(
    'does not give %s ordinary Cramorant storage',
    (id) => {
      const result = availabilityJson(
        createAvailabilityReport(tables, pokemon(id), games, [pokemon('cramorant'), pokemon(id)]),
      )
      expect(result.storableIn).not.toContain('go')
    },
  )
})

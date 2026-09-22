import { describe, expect, it } from 'vitest'
import { expandFormMethods, resolveFormRevert } from './form-methods'
import type { FormMethod } from './form-schemas'

const method: FormMethod = {
  from: ['necrozma-dusk-mane', 'necrozma-dawn-wings'],
  games: ['usum-us', 'usum-um'],
  trigger: 'special',
  item: { id: 'ultranecroziumz', role: 'held' },
  conditions: [{ key: 'mechanic', mechanic: 'ultra_burst' }],
  revert: ['faint', 'battle_end'],
}

describe('compact form reversions', () => {
  it('restores the individual source of a shared form without inheriting forward requirements', () => {
    const before = structuredClone(method)
    const expanded = expandFormMethods([{ id: 'necrozma-ultra', formMethods: [method] }])
    expect(expanded['necrozma-ultra'][0]).not.toHaveProperty('revert')
    for (const source of method.from) {
      expect(expanded[source]).toHaveLength(2)
      expect(expanded[source][0]).toEqual({
        from: ['necrozma-ultra'],
        games: method.games,
        trigger: 'automatic',
        conditions: [
          { key: 'battle_event', events: ['faint'] },
          { key: 'original_form', forms: [source] },
        ],
      })
    }
    expanded['necrozma-dawn-wings'][0].games!.push('new-game')
    expect(method).toEqual(before)
  })

  it('supports a fixed target instead of returning to the immediate source', () => {
    const expanded = expandFormMethods([
      {
        id: 'terapagos-stellar',
        formMethods: [
          {
            from: ['terapagos-terastal'],
            games: ['sv-s', 'sv-v'],
            trigger: 'special',
            conditions: [{ key: 'mechanic', mechanic: 'terastallization' }],
            revert: [
              {
                to: 'terapagos',
                trigger: 'automatic',
                conditions: [{ key: 'battle_event', events: ['battle_end'] }],
              },
            ],
          },
        ],
      },
    ])
    expect(expanded['terapagos-terastal']).toBeUndefined()
    expect(expanded.terapagos[0].conditions).toEqual([
      { key: 'battle_event', events: ['battle_end'] },
    ])
  })

  it('preserves the original source when entry alternatives are separate methods', () => {
    const expanded = expandFormMethods([
      {
        id: 'necrozma-ultra',
        formMethods: method.from.map((source) => ({ ...method, from: [source] })),
      },
    ])
    for (const source of method.from) {
      expect(expanded[source]).toHaveLength(2)
      for (const revert of expanded[source]) {
        expect(revert.conditions).toContainEqual({ key: 'original_form', forms: [source] })
      }
    }
  })

  it('distinguishes inherited, overridden and explicitly unknown game scopes', () => {
    expect(resolveFormRevert({ afterTurns: 3 }, method)).toEqual({
      games: method.games,
      trigger: 'automatic',
      conditions: [{ key: 'elapsed_time', amount: 3, unit: 'turns' }],
    })
    expect(
      resolveFormRevert(
        {
          games: ['home'],
          trigger: 'automatic',
          conditions: [{ key: 'storage_event', event: 'deposit', service: 'home' }],
        },
        method,
      ).games,
    ).toEqual(['home'])
    expect(
      resolveFormRevert({ games: null, trigger: 'automatic', conditions: [] }, method),
    ).not.toHaveProperty('games')
  })
})

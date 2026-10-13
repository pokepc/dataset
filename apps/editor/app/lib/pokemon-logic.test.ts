import { describe, expect, it } from 'vitest'
import {
  sanitizeAvailabilityState,
  toAvailabilityState,
  type AvailabilityState,
} from './pokemon-logic'

describe('pokemon-logic', () => {
  it('toAvailabilityState coerces non-array availability fields to empty arrays', () => {
    const state = toAvailabilityState({
      debutIn: 'red-blue',
      obtainableIn: ['red-blue', 1, null],
      storableIn: undefined,
      transferOnlyIn: 'gold-silver',
      eventOnlyIn: ['crystal'],
      shinyLockedIn: null,
    } as unknown as Pkds.Pokemon)

    expect(state).toEqual({
      debutIn: 'red-blue',
      obtainableIn: ['red-blue'],
      storableIn: [],
      transferOnlyIn: [],
      eventOnlyIn: ['crystal'],
      shinyLockedIn: [],
      shinyUnavailableIn: [],
      linkRequiredIn: [],
    })
  })

  it('sanitizeAvailabilityState normalizes arrays and preserves valid debut ids', () => {
    const gameIdOrder = ['red', 'blue', 'gold']
    const validGameIds = new Set(gameIdOrder)
    const debutIdOrder = ['red-set', 'gold-set']
    const validDebutIds = new Set(debutIdOrder)

    const normalized = sanitizeAvailabilityState(
      {
        debutIn: 'gold-set',
        obtainableIn: ['gold', 'blue', 'blue', 'missing'],
        storableIn: ['red', 'gold'],
        transferOnlyIn: ['blue', 'red', false as unknown as string],
        eventOnlyIn: ['gold', 'gold'],
        shinyLockedIn: ['blue', 'unknown'],
        shinyUnavailableIn: ['gold', 'blue', 'unknown', 'gold'],
        linkRequiredIn: ['red', 'gold', 'gold'],
      },
      gameIdOrder,
      validGameIds,
      debutIdOrder,
      validDebutIds,
    )

    expect(normalized).toEqual<AvailabilityState>({
      debutIn: 'gold-set',
      obtainableIn: ['blue', 'gold'],
      storableIn: ['red', 'gold'],
      transferOnlyIn: ['red', 'blue'],
      eventOnlyIn: ['gold'],
      // blue is dropped because the form is not storable there
      shinyLockedIn: ['blue'],
      shinyUnavailableIn: ['gold'],
      // red is dropped because the form has no native route there
      linkRequiredIn: ['gold'],
    })
  })

  it('sanitizeAvailabilityState falls back to the first valid debut candidate when needed', () => {
    const gameIdOrder = ['red', 'blue', 'gold']
    const validGameIds = new Set(gameIdOrder)
    const debutIdOrder = ['red-set', 'gold-set']
    const validDebutIds = new Set(debutIdOrder)

    const normalized = sanitizeAvailabilityState(
      {
        debutIn: 'invalid-debut',
        obtainableIn: ['gold'],
        storableIn: [],
        transferOnlyIn: [],
        eventOnlyIn: [],
        shinyLockedIn: [],
        shinyUnavailableIn: [],
        linkRequiredIn: [],
      },
      gameIdOrder,
      validGameIds,
      debutIdOrder,
      validDebutIds,
    )

    expect(normalized.debutIn).toBe('invalid-debut')

    const normalizedFromDefault = sanitizeAvailabilityState(
      {
        debutIn: '',
        obtainableIn: [],
        storableIn: [],
        transferOnlyIn: [],
        eventOnlyIn: [],
        shinyLockedIn: [],
        shinyUnavailableIn: [],
        linkRequiredIn: [],
      },
      gameIdOrder,
      validGameIds,
      debutIdOrder,
      validDebutIds,
    )

    expect(normalizedFromDefault.debutIn).toBe('red-set')
  })
})

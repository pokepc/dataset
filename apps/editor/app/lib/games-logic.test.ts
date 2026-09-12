import { describe, expect, it } from 'vitest'
import {
  availabilityKeys,
  cloneAvailabilityState,
  getAddableFemaleTransferOnlyPokemonIds,
  getMissingObtainablePokemonIds,
  getMissingTransferOnlyPokemonIds,
  getPrefilledTransferOnlyPokemonIds,
  getUnobtainablePokemonIds,
  normalizeGameAvailabilityState,
  type GameAvailabilityState,
} from './games-logic'

describe('games-logic', () => {
  it('exports the expected availability keys', () => {
    expect(availabilityKeys).toEqual([
      'debutedPokemon',
      'obtainablePokemon',
      'storablePokemon',
      'transferOnlyPokemon',
      'shinyLockedPokemon',
      'eventOnlyPokemon',
    ])
  })

  it('cloneAvailabilityState creates new arrays for every section', () => {
    const original: GameAvailabilityState = {
      debutedPokemon: ['bulbasaur'],
      obtainablePokemon: ['ivysaur'],
      storablePokemon: ['venusaur'],
      transferOnlyPokemon: ['charmander'],
      shinyLockedPokemon: ['charmeleon'],
      eventOnlyPokemon: ['charizard'],
    }

    const cloned = cloneAvailabilityState(original)
    cloned.debutedPokemon.push('squirtle')
    cloned.shinyLockedPokemon.length = 0

    expect(cloned).not.toBe(original)
    expect(cloned.debutedPokemon).not.toBe(original.debutedPokemon)
    expect(cloned.shinyLockedPokemon).not.toBe(original.shinyLockedPokemon)
    expect(original.debutedPokemon).toEqual(['bulbasaur'])
    expect(original.shinyLockedPokemon).toEqual(['charmeleon'])
  })

  it('normalizeGameAvailabilityState filters invalid ids, deduplicates, and sorts by pokemon order', () => {
    const pokemonOrder = ['pikachu', 'raichu', 'eevee', 'snorlax']
    const validPokemonIds = new Set(pokemonOrder)

    const normalized = normalizeGameAvailabilityState(
      {
        debutedPokemon: ['snorlax', 'pikachu', 'pikachu', 'missing'],
        obtainablePokemon: ['eevee', 'raichu', 25 as unknown as string, 'raichu'],
        storablePokemon: ['snorlax', 'pikachu', 'eevee'],
        transferOnlyPokemon: ['missing', 'snorlax', 'eevee', 'snorlax'],
        shinyLockedPokemon: 'pikachu' as unknown as string[],
        eventOnlyPokemon: ['raichu', 'pikachu', 'bad'],
      },
      pokemonOrder,
      validPokemonIds,
    )

    expect(normalized).toEqual({
      debutedPokemon: ['pikachu', 'snorlax'],
      obtainablePokemon: ['raichu', 'eevee'],
      storablePokemon: ['pikachu', 'eevee', 'snorlax'],
      transferOnlyPokemon: ['eevee', 'snorlax'],
      shinyLockedPokemon: [],
      eventOnlyPokemon: ['pikachu', 'raichu'],
    })
  })

  it('getPrefilledTransferOnlyPokemonIds includes battle-only candidates while excluding obtainable and event-only Pokemon', () => {
    const pokemonOrder = ['alpha', 'beta', 'gamma', 'delta', 'omega']

    expect(
      getPrefilledTransferOnlyPokemonIds(
        {
          debutedPokemon: [],
          obtainablePokemon: ['alpha'],
          storablePokemon: ['alpha', 'beta', 'gamma'],
          transferOnlyPokemon: [],
          shinyLockedPokemon: [],
          eventOnlyPokemon: ['gamma'],
        },
        pokemonOrder,
        ['omega'],
        ['beta'],
      ),
    ).toEqual(['omega'])
  })

  it('getMissingObtainablePokemonIds only returns allowed Pokemon that are not already assigned', () => {
    const pokemonOrder = ['alpha', 'beta', 'gamma', 'delta']

    expect(
      getMissingObtainablePokemonIds(
        {
          debutedPokemon: [],
          obtainablePokemon: ['alpha'],
          storablePokemon: [],
          transferOnlyPokemon: ['beta'],
          shinyLockedPokemon: [],
          eventOnlyPokemon: ['gamma'],
        },
        pokemonOrder,
        ['alpha', 'beta', 'gamma', 'delta'],
        ['delta'],
      ),
    ).toEqual([])
  })

  it('getAddableFemaleTransferOnlyPokemonIds only returns missing allowed non-battle-only female forms', () => {
    const pokemonOrder = ['alpha', 'alpha-f', 'beta', 'beta-f', 'gamma-f']

    expect(
      getAddableFemaleTransferOnlyPokemonIds(
        {
          debutedPokemon: [],
          obtainablePokemon: [],
          storablePokemon: [],
          transferOnlyPokemon: ['alpha', 'beta'],
          shinyLockedPokemon: [],
          eventOnlyPokemon: [],
        },
        pokemonOrder,
        {
          alpha: 'alpha-f',
          beta: 'beta-f',
          gamma: 'gamma-f',
        },
        ['alpha', 'alpha-f', 'beta', 'beta-f'],
        ['beta-f'],
        ['alpha-f'],
      ),
    ).toEqual([])
  })

  it('getMissingTransferOnlyPokemonIds excludes assigned and battle-only Pokemon', () => {
    const pokemonOrder = ['alpha', 'beta', 'gamma', 'delta', 'omega']

    expect(
      getMissingTransferOnlyPokemonIds(
        {
          debutedPokemon: [],
          obtainablePokemon: ['alpha'],
          storablePokemon: [],
          transferOnlyPokemon: ['beta'],
          shinyLockedPokemon: [],
          eventOnlyPokemon: ['gamma'],
        },
        pokemonOrder,
        ['alpha', 'beta', 'gamma', 'delta', 'omega'],
        ['omega'],
        ['delta'],
      ),
    ).toEqual([])
  })

  it('getUnobtainablePokemonIds returns allowed Pokemon missing from obtainable, transfer-only, and event-only', () => {
    const pokemonOrder = ['alpha', 'beta', 'gamma', 'delta', 'omega']

    expect(
      getUnobtainablePokemonIds(
        {
          debutedPokemon: [],
          obtainablePokemon: ['alpha'],
          storablePokemon: ['alpha', 'beta', 'omega'],
          transferOnlyPokemon: ['beta'],
          shinyLockedPokemon: [],
          eventOnlyPokemon: ['gamma'],
        },
        pokemonOrder,
        ['alpha', 'beta', 'gamma', 'delta', 'omega'],
      ),
    ).toEqual(['delta', 'omega'])
  })
})

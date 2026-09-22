import { describe, expect, it } from 'vitest'
import { evolutionConditionSchema, evolutionMethodSchema } from './evolution-schemas'
import { pokemonSchema } from './schemas'
import { evoConditionKeys } from './enums'

const malamar = {
  from: ['inkay'],
  games: ['sv-s', 'sv-v'],
  trigger: 'level_up',
  minLevel: 30,
  conditions: [{ key: 'device_upside_down' }],
}

describe('evolution methods', () => {
  it('exports every supported condition key exactly once', () => {
    expect(evolutionConditionSchema.options.map((option) => option.shape.key.value)).toEqual(
      evoConditionKeys,
    )
    expect(new Set(evoConditionKeys).size).toBe(evoConditionKeys.length)
  })

  it('preserves typed conditions, localized notes, and alternative methods', () => {
    const trade = {
      ...malamar,
      from: ['haunter'],
      trigger: 'trade',
      conditions: [],
      minLevel: undefined,
    }
    const item = {
      ...trade,
      games: ['la'],
      trigger: 'use_item',
      item: { id: 'linkingcord', role: 'used' },
      activation: 'manual',
      notes: { eng: 'Choose Evolve.', esp: 'Elige evolucionar.' },
    }
    const input = { evoMethods: [trade, item] }
    expect(pokemonSchema.pick({ evoMethods: true }).parse(input)).toEqual(input)
    expect(evolutionMethodSchema.parse(malamar)).toEqual(malamar)
    expect(
      evolutionMethodSchema.safeParse({ ...malamar, sources: ['https://example.com'] }).success,
    ).toBe(false)
    expect(evolutionMethodSchema.safeParse({ ...malamar, verification: 'verified' }).success).toBe(
      false,
    )
  })

  it('keeps each method associated with its own eligible predecessor forms', () => {
    const input = {
      evoMethods: [
        { ...malamar, from: ['source-form-a'], minLevel: 30 },
        { ...malamar, from: ['source-form-b', 'source-form-c'], minLevel: 40 },
      ],
    }
    expect(pokemonSchema.pick({ evoMethods: true }).parse(input)).toEqual(input)
  })

  it('keeps unknown game scope explicit instead of turning it into universal eligibility', () => {
    expect(evolutionMethodSchema.parse({ ...malamar, games: undefined }).games).toBeUndefined()
    expect(evolutionMethodSchema.safeParse({ ...malamar, games: [] }).success).toBe(false)
  })

  it.each([
    { key: 'walk_steps', count: 0, mode: 'lets_go' },
    { key: 'use_move', move: 'ragefist', count: -20 },
    { key: 'spin', direction: 'clockwise', seconds: 5 },
    { key: 'device_upside_down', params: {} },
    { key: 'inkay_method' },
    { key: 'nature', natures: ['hardy', 'hardy'] },
  ])('rejects invalid or unrecognized condition parameters: %j', (input) => {
    expect(evolutionConditionSchema.safeParse(input).success).toBe(false)
  })

  it('rejects missing or contradictory item actions and empty special methods', () => {
    expect(evolutionMethodSchema.safeParse({ ...malamar, trigger: 'use_item' }).success).toBe(false)
    expect(
      evolutionMethodSchema.safeParse({ ...malamar, item: { id: 'icestone', role: 'used' } })
        .success,
    ).toBe(false)
    expect(
      evolutionMethodSchema.safeParse({ ...malamar, trigger: 'special', conditions: [], notes: {} })
        .success,
    ).toBe(false)
    expect(evolutionMethodSchema.safeParse({ ...malamar, from: [] }).success).toBe(false)
    expect(
      evolutionMethodSchema.safeParse({
        ...malamar,
        conditions: [{ key: 'friendship' }, { key: 'friendship' }],
      }).success,
    ).toBe(false)
  })
})

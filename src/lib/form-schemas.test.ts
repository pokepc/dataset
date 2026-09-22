import { describe, expect, it } from 'vitest'
import { formConditionSchema, formMethodSchema } from './form-schemas'
import { formConditionKeys } from './enums'
import { pokemonSchema } from './schemas'

const fusion = {
  from: ['kyurem'],
  games: ['swsh-sw', 'swsh-sh'],
  trigger: 'fuse',
  item: { id: 'dnasplicers', role: 'used', consumed: false },
  conditions: [{ key: 'fusion_partner', pokemon: 'zekrom' }],
}

describe('form method contract', () => {
  it('exposes every condition as an iterable translation key', () => {
    expect(formConditionSchema.options.map((option) => option.shape.key.value)).toEqual(
      formConditionKeys,
    )
    expect(new Set(formConditionKeys).size).toBe(formConditionKeys.length)
  })

  it('preserves alternative source-specific methods and fusion partners', () => {
    expect(formMethodSchema.parse(fusion)).toEqual(fusion)
    const input = { formMethods: [fusion, { ...fusion, games: ['sv-s', 'sv-v'] }] }
    expect(pokemonSchema.pick({ formMethods: true }).parse(input)).toEqual(input)
    expect(formMethodSchema.parse({ ...fusion, games: undefined }).games).toBeUndefined()
  })

  it('supports conjunctions of distinct bounds and translated notes', () => {
    const input = {
      from: ['zygarde', 'zygarde-10'],
      trigger: 'automatic',
      conditions: [
        { key: 'hp', comparison: 'gt', percent: 0 },
        { key: 'hp', comparison: 'lte', percent: 50 },
      ],
      notes: { eng: 'At the end of the turn.', esp: 'Al final del turno.' },
    }
    expect(formMethodSchema.parse(input)).toEqual(input)
  })

  it.each([
    { ...fusion, from: [] },
    { ...fusion, from: ['kyurem', 'kyurem'] },
    { ...fusion, games: [] },
    { ...fusion, conditions: [] },
    { ...fusion, conditions: [...fusion.conditions, ...fusion.conditions] },
    { ...fusion, trigger: 'equip_item' },
    { ...fusion, trigger: 'use_item', item: { id: 'dnasplicers', role: 'held' } },
    { ...fusion, item: { id: 'dnasplicers', role: 'held', consumed: true } },
    { ...fusion, sources: ['https://example.com'] },
    { ...fusion, verification: 'verified' },
    { ...fusion, reversible: true },
    { ...fusion, conditions: [{ key: 'hp', comparison: 'gt', percent: 101 }] },
    { ...fusion, conditions: [{ key: 'interaction', interaction: 'invented_action' }] },
  ])('rejects invalid requirements and bundled audit metadata: %j', (input) => {
    expect(formMethodSchema.safeParse(input).success).toBe(false)
  })
})

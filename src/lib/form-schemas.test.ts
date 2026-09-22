import { describe, expect, it } from 'vitest'
import { formConditionSchema, formMethodSchema, formRevertSchema } from './form-schemas'
import { formConditionKeys, formRevertEvents } from './enums'
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

  it('accepts every exported reversion event and strict parameterized rules', () => {
    for (const event of formRevertEvents) expect(formRevertSchema.parse(event)).toBe(event)
    const revert = [
      'battle_end',
      'faint',
      { afterTurns: 3 },
      {
        to: 'kyurem',
        games: ['home'],
        trigger: 'separate',
        item: { id: 'dnasplicers', role: 'used', consumed: false },
        conditions: [],
      },
    ]
    expect(formMethodSchema.parse({ ...fusion, revert }).revert).toEqual(revert)
  })

  it.each([
    'invented_event',
    { afterTurns: 0 },
    { afterTurns: 1.5 },
    { afterTurns: 3, sources: ['https://example.com'] },
    { trigger: 'use_item', conditions: [] },
    { to: 'invalid_id', trigger: 'automatic', conditions: [] },
    { games: [], trigger: 'automatic', conditions: [] },
    { trigger: 'automatic', conditions: [], revert: ['battle_end'] },
  ])('rejects invalid or recursive revert rules: %j', (input) => {
    expect(formRevertSchema.safeParse(input).success).toBe(false)
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
    { ...fusion, revert: [] },
    { ...fusion, conditions: [{ key: 'hp', comparison: 'gt', percent: 101 }] },
    { ...fusion, conditions: [{ key: 'interaction', interaction: 'invented_action' }] },
  ])('rejects invalid requirements and bundled audit metadata: %j', (input) => {
    expect(formMethodSchema.safeParse(input).success).toBe(false)
  })
})

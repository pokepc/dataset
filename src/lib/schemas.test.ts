import { describe, expect, it } from 'vitest'
import { modernBoxPresetSchema, modernBoxPresetSlotSchema } from './schemas'

describe('modernBoxPresetSlotSchema', () => {
  it('accepts null', () => {
    expect(modernBoxPresetSlotSchema.parse(null)).toBeNull()
  })

  it('accepts string slot ids', () => {
    expect(modernBoxPresetSlotSchema.parse('bulbasaur')).toBe('bulbasaur')
  })

  it('accepts pokemon object slots with shiny and gmax flags', () => {
    expect(
      modernBoxPresetSlotSchema.parse({ pokemon: 'charizard', shiny: true, gmax: true }),
    ).toEqual({
      pokemon: 'charizard',
      shiny: true,
      gmax: true,
    })
  })

  it('rejects object slots with unknown fields', () => {
    expect(() => modernBoxPresetSlotSchema.parse({ pokemon: 'bulbasaur', other: true })).toThrow()
  })

  it('rejects object slots without a pokemon reference', () => {
    expect(() => modernBoxPresetSlotSchema.parse({ shiny: true })).toThrow()
  })
})

describe('modernBoxPresetSchema', () => {
  it('parses a preset that mixes string and pokemon-object slot variants', () => {
    const preset: Pkds.ModernBoxPreset = {
      schemaVersion: 1,
      id: 'mixed',
      gameSet: 'home',
      name: 'Mixed slot variants',
      boxes: [
        {
          slots: [
            'bulbasaur',
            { pokemon: 'charizard', gmax: true },
            { pokemon: 'mewtwo', shiny: true },
            null,
          ],
        },
      ],
    }
    expect(modernBoxPresetSchema.parse(preset)).toEqual(preset)
  })
})

import { describe, expect, it } from 'vitest'
import {
  collectModernBoxPresetSanitizerDiagnostics,
  incompatibleClassicPokemonIds,
  modernBoxPresetSlotFilters,
  sanitizeModernBoxPresetSlots,
} from './box-preset-sanitizer'

describe('box preset sanitizer', () => {
  const context = {
    gameSet: 'home',
    presetId: 'grouped-region',
    boxIndex: 0,
    validPokemonIds: new Set(['bulbasaur', 'charizard']),
  }

  it('keeps compatible strings and maps compatible object slots', () => {
    expect(
      sanitizeModernBoxPresetSlots(['bulbasaur', { pid: 'charizard', shiny: true, gmax: true }, null], context),
    ).toEqual(['bulbasaur', { pokemon: 'charizard', shiny: true, gmax: true }, null])
  })

  it('turns known incompatible classic pokemon ids into null slots', () => {
    const slots = [incompatibleClassicPokemonIds[0]]
    const sanitized = sanitizeModernBoxPresetSlots(slots, context)

    expect(sanitized).toEqual([null])
    expect(collectModernBoxPresetSanitizerDiagnostics(slots, sanitized, context)).toEqual([
      {
        reason: 'incompatible-classic-pokemon-id',
        pokemon: 'greninja--battle-bond',
        gameSet: 'home',
        presetId: 'grouped-region',
        boxIndex: 0,
        slotIndex: 0,
      },
    ])
  })

  it('exposes an extendable filter array', () => {
    expect(modernBoxPresetSlotFilters).toHaveLength(1)
  })
})

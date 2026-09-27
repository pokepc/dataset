import { describe, expect, it } from 'vitest'
import { loadAllNatures } from '../../src/lib/fs'

// The canonical nature table: rows raise one stat, columns lower one, the diagonal is neutral.
const stats = ['atk', 'def', 'spe', 'spa', 'spd'] as const
const table = [
  ['hardy', 'lonely', 'brave', 'adamant', 'naughty'],
  ['bold', 'docile', 'relaxed', 'impish', 'lax'],
  ['timid', 'hasty', 'serious', 'jolly', 'naive'],
  ['modest', 'mild', 'quiet', 'bashful', 'rash'],
  ['calm', 'gentle', 'sassy', 'careful', 'quirky'],
]
const canonical = table.flatMap((row, raised) =>
  row.map((id, lowered) => ({
    id,
    raises: raised === lowered ? null : stats[raised],
    lowers: raised === lowered ? null : stats[lowered],
  })),
)

describe('natures', () => {
  const natures = loadAllNatures()

  it('lists exactly the 25 natures', () => {
    expect(natures.map((nature) => nature.id).sort()).toEqual(
      canonical.map((nature) => nature.id).sort(),
    )
  })

  it.each(canonical)('$id raises $raises and lowers $lowers', ({ id, raises, lowers }) => {
    const nature = natures.find((entry) => entry.id === id)
    expect({ raises: nature?.raises ?? null, lowers: nature?.lowers ?? null }).toEqual({
      raises,
      lowers,
    })
  })
})

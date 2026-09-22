import { describe, expect, it } from 'vitest'
import {
  selectAvailabilitySource,
  type AvailabilitySourceState,
} from './availability-source-selection'

const source = (
  id: AvailabilitySourceState['id'],
  state: 'found' | 'missing' | 'error' = 'found',
  pending = false,
): AvailabilitySourceState => ({
  id,
  pending,
  rows: new Map([
    [
      'go',
      {
        gameId: 'go',
        state,
        entries: [],
        verdict: { status: 'unavailable', reason: 'Explicitly unreleased.' },
      },
    ],
  ]),
})

describe('combined availability evidence', () => {
  it('prefers a GO entry, including explicit unavailability, over main-page evidence', () => {
    const main = source('bulbapedia')
    const go = source('bulbapedia-go')
    expect(selectAvailabilitySource('go', [main, go])).toBe(go)
    expect(selectAvailabilitySource('swsh-sw', [main, go])).toBe(main)
  })

  it.each(['missing', 'error'] as const)(
    'falls back to main-page GO evidence when the GO entry is %s',
    (state) => {
      const main = source('bulbapedia')
      expect(selectAvailabilitySource('go', [main, source('bulbapedia-go', state)])).toBe(main)
    },
  )

  it('uses ready evidence during loading, then shows loading or the GO error if no evidence exists', () => {
    const main = source('bulbapedia')
    const loadingGo = source('bulbapedia-go', 'missing', true)
    expect(selectAvailabilitySource('go', [main, loadingGo])).toBe(main)
    expect(selectAvailabilitySource('go', [source('bulbapedia', 'missing'), loadingGo])).toBe(
      loadingGo,
    )
    const failedGo = source('bulbapedia-go', 'error')
    expect(selectAvailabilitySource('go', [source('bulbapedia', 'missing'), failedGo])).toBe(
      failedGo,
    )
  })
})

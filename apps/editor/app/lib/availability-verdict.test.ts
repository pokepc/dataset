import { describe, expect, it } from 'vitest'
import type { AvailabilitySourceRow } from '@pokepc/dataset/lib/availability-sources'
import { summarizeAvailabilitySources } from './availability-verdict'

const source = (name: string, status: NonNullable<AvailabilitySourceRow['verdict']>['status']) => ({
  name,
  row: {
    gameId: 'sv-s',
    state: 'found' as const,
    entries: [],
    verdict: { status, reason: `${name} evidence` },
  },
})

describe('upstream availability verdict', () => {
  it.each([
    ['obtainable', '✅'],
    ['transfer-only', '🔀'],
    ['event-only', '🎁'],
    ['unavailable', '❌'],
  ] as const)('displays %s only with classified source evidence', (status, symbol) => {
    expect(summarizeAvailabilitySources([source('Bulbapedia', status)])).toMatchObject({
      status,
      symbol,
      reason: expect.stringContaining('Bulbapedia evidence'),
    })
  })

  it('does not turn missing records, unsupported games or failures into unavailability', () => {
    expect(
      summarizeAvailabilitySources([
        { name: 'Bulbapedia', row: { gameId: 'sv-s', state: 'missing', entries: [] } },
        { name: 'Serebii', row: { gameId: 'sv-s', state: 'unsupported', entries: [] } },
        { name: 'PokéAPI', error: 'HTTP 503' },
      ]),
    ).toMatchObject({ status: 'unknown', symbol: '—', reason: expect.stringContaining('HTTP 503') })
  })

  it('waits for all requests instead of presenting a partial verdict as final', () => {
    expect(
      summarizeAvailabilitySources([
        source('Bulbapedia', 'unavailable'),
        { name: 'Serebii', pending: true },
      ]).status,
    ).toBe('loading')
  })

  it('distinguishes stale server responses from unclear source evidence', () => {
    expect(
      summarizeAvailabilitySources([
        { name: 'Bulbapedia', row: { gameId: 'sv-s', state: 'found', entries: [] } },
      ]),
    ).toMatchObject({ status: 'outdated', label: 'Restart editor' })
  })

  it.each(['transfer-only', 'unavailable'] as const)(
    'flags a contradiction between an ordinary encounter and %s',
    (status) => {
      expect(
        summarizeAvailabilitySources([
          source('Bulbapedia', 'obtainable'),
          source('Serebii', status),
        ]),
      ).toMatchObject({ status: 'conflict', symbol: '⚠️' })
    },
  )

  it('keeps events non-exclusive when a source documents a transfer route', () => {
    expect(
      summarizeAvailabilitySources([
        source('Bulbapedia', 'event-only'),
        source('Serebii', 'transfer-only'),
      ]).status,
    ).toBe('transfer-only')
  })

  it('does not claim exclusive acquisition or unavailability while methods remain ambiguous', () => {
    for (const status of ['transfer-only', 'event-only', 'unavailable'] as const) {
      expect(
        summarizeAvailabilitySources([source('Bulbapedia', status), source('Serebii', 'unknown')])
          .status,
      ).toBe('unknown')
    }
    expect(
      summarizeAvailabilitySources([
        source('Bulbapedia', 'obtainable'),
        source('Serebii', 'unknown'),
      ]).status,
    ).toBe('obtainable')
  })
})

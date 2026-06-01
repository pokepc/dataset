import { describe, expect, it } from 'vitest'
import { MemoryCache } from '../src/utils/memory-cache'

describe('MemoryCache', () => {
  it('returns undefined after key expiration', async () => {
    const cache = new MemoryCache(10)
    cache.set('k', 'value', 5)

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(cache.get('k')).toBeUndefined()
  })

  it('recomputes cached values after expiration', async () => {
    const cache = new MemoryCache(10)
    let calls = 0

    const first = cache.cached(
      'k',
      () => {
        calls += 1
        return `value-${calls}`
      },
      5,
    )

    await new Promise((resolve) => setTimeout(resolve, 20))

    const second = cache.cached(
      'k',
      () => {
        calls += 1
        return `value-${calls}`
      },
      5,
    )

    expect(first).toBe('value-1')
    expect(second).toBe('value-2')
    expect(calls).toBe(2)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchPokeApiJson } from './client'

let cacheDir: string
beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'pokepc-pokeapi-cache-'))
})
afterEach(async () => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  await rm(cacheDir, { recursive: true, force: true })
})

describe('cached PokéAPI requests', () => {
  it('reuses disk cache across calls and refreshes only when requested', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify([{ version: 'red' }])))
    vi.stubGlobal('fetch', fetch)
    const options = { cache: true, cacheDir, retries: 1 }
    const first = await fetchPokeApiJson('pokemon/25/encounters', options)
    await expect(fetchPokeApiJson('pokemon/25/encounters', options)).resolves.toEqual(first)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    await fetchPokeApiJson('pokemon/25/encounters', { ...options, forceRefresh: true })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('aborts an active request without retrying or caching its response', async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockImplementation(async (_url, { signal }: { signal: AbortSignal }) => {
      controller.abort(new Error('Stopped'))
      signal.throwIfAborted()
    })
    vi.stubGlobal('fetch', fetch)
    await expect(
      fetchPokeApiJson('pokemon/25/encounters', {
        cacheDir,
        signal: controller.signal,
        retries: 2,
      }),
    ).rejects.toThrow('Stopped')
    expect(fetch).toHaveBeenCalledOnce()
    fetch.mockImplementation(async () => new Response('[]'))
    await expect(
      fetchPokeApiJson('pokemon/25/encounters', { cacheDir, retries: 1 }),
    ).resolves.toEqual([])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('rejects an already-aborted lookup even if its response is cached', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('[]'))
    vi.stubGlobal('fetch', fetch)
    await fetchPokeApiJson('pokemon/25/encounters', { cacheDir, cache: true })
    const signal = AbortSignal.abort(new Error('Stopped'))
    await expect(fetchPokeApiJson('pokemon/25/encounters', { cacheDir, signal })).rejects.toThrow(
      'Stopped',
    )
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('spaces real requests while allowing cache hits without another request', async () => {
    vi.useFakeTimers()
    const times: number[] = []
    const fetch = vi.fn().mockImplementation(async () => {
      times.push(Date.now())
      return new Response('[]')
    })
    vi.stubGlobal('fetch', fetch)
    const first = fetchPokeApiJson('pokemon/25/encounters', { cache: false, minIntervalMs: 500 })
    await vi.advanceTimersByTimeAsync(500)
    await first
    const second = fetchPokeApiJson('pokemon/26/encounters', { cache: false, minIntervalMs: 500 })
    await vi.advanceTimersByTimeAsync(500)
    await second
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(500)
  })

  it('bounds retryable requests and never retries a missing resource', async () => {
    vi.useFakeTimers()
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response('Unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const failed = expect(
      fetchPokeApiJson('pokemon/25/encounters', { cache: false, retries: 2 }),
    ).rejects.toThrow('503')
    await vi.advanceTimersByTimeAsync(2_000)
    await failed
    expect(fetch).toHaveBeenCalledTimes(2)
    fetch.mockClear().mockImplementation(async () => new Response('Missing', { status: 404 }))
    const missing = expect(
      fetchPokeApiJson('pokemon/25/encounters', { cache: false, retries: 2 }),
    ).rejects.toThrow('404')
    await vi.advanceTimersByTimeAsync(1)
    await missing
    expect(fetch).toHaveBeenCalledOnce()
  })
})

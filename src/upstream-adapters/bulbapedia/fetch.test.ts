import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchAvailabilityPage } from './fetch'
import * as availability from './availability'

const html = '<h1>Main availability fixture</h1>'
let cacheDir: string
beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'pokepc-bulbapedia-fetch-'))
  vi.stubEnv('BULBAPEDIA_CACHE_DIR', cacheDir)
  // Parser behavior has source-shaped fixture coverage in availability.test.ts.
  vi.spyOn(availability, 'parseAvailabilityTables').mockImplementation((pages) => {
    if (![pages.main, pages.go].some((page) => page?.includes('availability fixture')))
      throw new Error('Invalid table fixture')
    return {} as availability.AvailabilityTables
  })
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(cacheDir, { recursive: true, force: true })
})

describe('cached Bulbapedia availability lists', () => {
  it('fetches only the designated list URLs with cancellation and identifying headers', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response(html))
    vi.stubGlobal('fetch', fetch)
    await fetchAvailabilityPage('main')
    await fetchAvailabilityPage('go')
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      availability.availabilityUrls.main,
      availability.availabilityUrls.go,
    ])
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(fetch.mock.calls[0][1].headers['User-Agent']).toContain('PokePC-Dataset')
    expect(availability.parseAvailabilityTables).toHaveBeenCalledWith({ main: html })
    expect(availability.parseAvailabilityTables).toHaveBeenCalledWith({ go: html })
    expect(await readdir(cacheDir)).toHaveLength(2)
  })

  it('reuses complete HTML from disk and replaces it only on explicit refresh', async () => {
    const fullHtml = `${html}<p>Other page content</p>`
    const fetch = vi.fn().mockImplementation(async () => new Response(fullHtml))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchAvailabilityPage('main')).resolves.toBe(fullHtml)
    const files = await readdir(cacheDir)
    expect(files).toHaveLength(1)
    expect(JSON.parse(await readFile(join(cacheDir, files[0]), 'utf8'))).toEqual({
      version: 2,
      url: availability.availabilityUrls.main,
      html: fullHtml,
    })
    fetch.mockRejectedValue(new Error('Network must not be used for a cache hit'))
    await expect(fetchAvailabilityPage('main')).resolves.toBe(fullHtml)
    expect(fetch).toHaveBeenCalledOnce()
    const refreshed = `${html}<p>Updated rows</p>`
    fetch.mockImplementation(async () => new Response(refreshed))
    await expect(fetchAvailabilityPage('main', undefined, { forceRefresh: true })).resolves.toBe(
      refreshed,
    )
    await expect(fetchAvailabilityPage('main')).resolves.toBe(refreshed)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await readdir(cacheDir)).toEqual(files)
  })

  it.each([403, 429, 503, 200])(
    'does not cache HTTP %i errors or invalid tables',
    async (status) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('Access denied', { status }))
        .mockResolvedValueOnce(new Response(html))
      vi.stubGlobal('fetch', fetch)
      await expect(fetchAvailabilityPage('main')).rejects.toThrow(
        status === 200 ? 'Invalid Bulbapedia main availability page' : `HTTP ${status}`,
      )
      expect(await readdir(cacheDir)).toEqual([])
      await expect(fetchAvailabilityPage('main')).resolves.toBe(html)
      expect(fetch).toHaveBeenCalledTimes(2)
    },
  )

  it.each([
    '{broken JSON',
    JSON.stringify({ version: 1, url: availability.availabilityUrls.main, html }),
    JSON.stringify({ version: 2, url: 'https://example.invalid', html }),
    JSON.stringify({
      version: 2,
      url: availability.availabilityUrls.main,
      html: '<h1>Challenge</h1>',
    }),
  ])('repairs invalid cache entries (%s)', async (invalid) => {
    const fetch = vi.fn().mockImplementation(async () => new Response(html))
    vi.stubGlobal('fetch', fetch)
    await fetchAvailabilityPage('main')
    const [file] = await readdir(cacheDir)
    await writeFile(join(cacheDir, file), invalid)
    await expect(fetchAvailabilityPage('main')).resolves.toBe(html)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(await readFile(join(cacheDir, file), 'utf8')).html).toBe(html)
  })

  it('reports a failed refresh without falling back or replacing the previous cache', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(html))
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    await fetchAvailabilityPage('main')
    const [file] = await readdir(cacheDir)
    const previous = await readFile(join(cacheDir, file), 'utf8')
    await expect(fetchAvailabilityPage('main', undefined, { forceRefresh: true })).rejects.toThrow(
      'HTTP 503',
    )
    expect(await readFile(join(cacheDir, file), 'utf8')).toBe(previous)
    await expect(fetchAvailabilityPage('main')).resolves.toBe(html)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('preserves the cause of network failures', async () => {
    const cause = new Error('Connection timed out')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause))
    await expect(fetchAvailabilityPage('main')).rejects.toMatchObject({ cause })
  })

  it('honors cancellation even on a cache hit', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(html))
    vi.stubGlobal('fetch', fetch)
    await fetchAvailabilityPage('main')
    await expect(
      fetchAvailabilityPage('main', AbortSignal.abort(new Error('Stopped'))),
    ).rejects.toThrow('Stopped')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not cache a page when canceled while reading the response', async () => {
    const controller = new AbortController()
    const response = new Response(html)
    vi.spyOn(response, 'text').mockImplementation(async () => {
      controller.abort(new Error('Stopped'))
      return html
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(fetchAvailabilityPage('main', controller.signal)).rejects.toThrow('Stopped')
    expect(await readdir(cacheDir)).toEqual([])
  })
})

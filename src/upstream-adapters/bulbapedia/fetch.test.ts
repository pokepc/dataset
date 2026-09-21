import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchSpeciesPage } from './cli'

const url = 'https://bulbapedia.bulbagarden.net/wiki/Pikachu_(Pok%C3%A9mon)'
const html = '<h1>Pikachu (Pokémon)</h1><h3 id="Game_locations">Game locations</h3>'
let cacheDir: string
beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'pokepc-bulbapedia-fetch-'))
  vi.stubEnv('BULBAPEDIA_CACHE_DIR', cacheDir)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(cacheDir, { recursive: true, force: true })
})

describe('cached Bulbapedia pages', () => {
  it('reuses complete HTML from disk and replaces it only on an explicit refresh', async () => {
    const fullHtml = `${html}<h3>Evolution</h3><table><tr><td>AI context</td></tr></table>`
    const fetch = vi.fn().mockImplementation(async () => new Response(fullHtml))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchSpeciesPage(url)).resolves.toBe(fullHtml)
    const files = await readdir(cacheDir)
    expect(files).toHaveLength(1)
    expect(JSON.parse(await readFile(join(cacheDir, files[0]), 'utf8'))).toEqual({
      version: 1,
      url,
      html: fullHtml,
    })
    fetch.mockRejectedValue(new Error('Network must not be used for a cache hit'))
    await expect(fetchSpeciesPage(url)).resolves.toBe(fullHtml)
    expect(fetch).toHaveBeenCalledOnce()
    const refreshed = `${html}<p>Updated locations</p>`
    fetch.mockImplementation(async () => new Response(refreshed))
    await expect(fetchSpeciesPage(url, undefined, { forceRefresh: true })).resolves.toBe(refreshed)
    await expect(fetchSpeciesPage(url)).resolves.toBe(refreshed)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await readdir(cacheDir)).toEqual(files)
  })

  it.each([403, 429, 503, 200])(
    'does not cache HTTP %i error or challenge responses',
    async (status) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('Access denied', { status }))
        .mockResolvedValueOnce(new Response(html))
      vi.stubGlobal('fetch', fetch)
      await expect(fetchSpeciesPage(url)).rejects.toThrow(
        status === 200 ? 'species page' : `HTTP ${status}`,
      )
      expect(await readdir(cacheDir)).toEqual([])
      await expect(fetchSpeciesPage(url)).resolves.toBe(html)
      expect(fetch).toHaveBeenCalledTimes(2)
    },
  )

  it.each([
    '{broken JSON',
    JSON.stringify({ version: 2, url, html }),
    JSON.stringify({ version: 1, url: `${url}-other`, html }),
    JSON.stringify({ version: 1, url, html: '<h1>Challenge page</h1>' }),
  ])('repairs invalid cache entries (%s)', async (invalid) => {
    const fetch = vi.fn().mockImplementation(async () => new Response(html))
    vi.stubGlobal('fetch', fetch)
    await fetchSpeciesPage(url)
    const [file] = await readdir(cacheDir)
    await writeFile(join(cacheDir, file), invalid)
    await expect(fetchSpeciesPage(url)).resolves.toBe(html)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(await readFile(join(cacheDir, file), 'utf8')).html).toBe(html)
  })

  it('reports a failed refresh without falling back or replacing the previous page', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(html))
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    await fetchSpeciesPage(url)
    const [file] = await readdir(cacheDir)
    const previous = await readFile(join(cacheDir, file), 'utf8')
    await expect(fetchSpeciesPage(url, undefined, { forceRefresh: true })).rejects.toThrow(
      'HTTP 503',
    )
    expect(await readFile(join(cacheDir, file), 'utf8')).toBe(previous)
    await expect(fetchSpeciesPage(url)).resolves.toBe(html)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('honors cancellation even on a cache hit', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(html))
    vi.stubGlobal('fetch', fetch)
    await fetchSpeciesPage(url)
    await expect(fetchSpeciesPage(url, AbortSignal.abort(new Error('Stopped')))).rejects.toThrow(
      'Stopped',
    )
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
    await expect(fetchSpeciesPage(url, controller.signal)).rejects.toThrow('Stopped')
    expect(await readdir(cacheDir)).toEqual([])
  })
})

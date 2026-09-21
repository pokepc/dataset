import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import arcanine from '../../../data/pokemon/arcanine.json'
import hisuianArcanine from '../../../data/pokemon/arcanine-hisui.json'
import mrMime from '../../../data/pokemon/mrmime-galar.json'
import type { AvailabilityGame, AvailabilityPokemon } from '../bulbapedia/availability.ts'
import { fetchSerebiiEvidence, serebiiTargets } from './availability-evidence.ts'

const game = (id: string, type: AvailabilityGame['type'] = 'game'): AvailabilityGame => ({
  id,
  name: id,
  type,
  gen: 9,
  gameSet: null,
  gameSuperSet: null,
})
const target = { url: 'https://www.serebii.net/pokedex-sv/arcanine/', gameIds: ['sv-s', 'sv-v'] }
const fixture = `<!doctype html><html><head>
  <title>Arcanine - #059 - Serebii.net Pok&eacute;dex</title></head><body>
  <nav>Unrelated species links</nav><script>tracking()</script>
  <table class="dextable"><tr><td>Name</td></tr><tr><td>Arcanine</td></tr></table>
  <table class="dextable"><tr><td>Evolutionary Chain</td></tr><tr><td>
    <table class="evochain"><tr><td><a href="/pokedex-sv/growlithe/"><img src="/pokemon/058-h.png"></a></td>
    <td><img title="Fire Stone" src="/evoicon/firestone.png"></td>
    <td><a href="/pokedex-sv/arcanine/"><img src="/pokemon/059-h.png"></a></td></tr></table>
  </td></tr></table>
  <table class="dextable"><tr><td>Alternate Forms</td></tr><tr><td>
    <table><tr><td>Kantonian Form</td><td>Hisuian Form</td></tr></table>
    Regional forms retain their form when evolved.
  </td></tr></table>
  <table class="dextable"><tr><td colspan="3"><h2>Locations</h2></td></tr>
    <tr><td>Scarlet</td><td>North Province</td></tr>
    <tr><td>Violet</td><td>North Province</td></tr>
    <tr><td rowspan="2">The Teal Mask</td><td>Scarlet</td><td>Evolve Growlithe <small>Hisuian Form</small></td></tr>
    <tr><td>Violet</td><td><a href="/scarletviolet/giftpokemon.shtml">Evolve Growlithe</a><br>Hisuian Form</td></tr>
  </table>
  <table class="dextable"><tr><td>Level Up Moves</td></tr><tr><td>Flamethrower</td></tr></table>
  </body></html>`

describe('targeted Serebii coverage', () => {
  it('groups only requested, supported concrete games into generation pages', () => {
    const ids = [
      'rb-r',
      'rb-b',
      'gs-g',
      'frlg-fr',
      'hgss-hg',
      'b2w2-b2',
      'oras-or',
      'usum-us',
      'swsh-sw',
      'bdsp-bd',
      'la',
      'sv-s',
      'sv-v',
      'go',
      'home',
      'lgpe-lgp',
      'lza',
      'col',
      'wiwa-wi',
      'sv-tealmask',
      'sv',
    ]
    const result = serebiiTargets(
      arcanine,
      ids.map((id) => game(id)),
      ids,
    )
    expect(result.map(({ url }) => url)).toEqual([
      'https://www.serebii.net/pokedex/059.shtml',
      'https://www.serebii.net/pokedex-gs/059.shtml',
      'https://www.serebii.net/pokedex-rs/059.shtml',
      'https://www.serebii.net/pokedex-dp/059.shtml',
      'https://www.serebii.net/pokedex-bw/059.shtml',
      'https://www.serebii.net/pokedex-xy/059.shtml',
      'https://www.serebii.net/pokedex-sm/059.shtml',
      'https://www.serebii.net/pokedex-swsh/arcanine/',
      target.url,
    ])
    expect(result[0].gameIds).toEqual(['rb-r', 'rb-b'])
    expect(result[7].gameIds).toEqual(['swsh-sw', 'bdsp-bd', 'la'])
    expect(result[8].gameIds).toEqual(['sv-s', 'sv-v'])
    expect(serebiiTargets(arcanine, [game('sv-s'), game('sv-v')], ['sv-v'])).toEqual([
      { url: target.url, gameIds: ['sv-v'] },
    ])
  })

  it('does not target a species before its national dex existed, or non-game records', () => {
    const later = { ...arcanine, dexNum: 906 }
    expect(serebiiTargets(later, [game('rb-r'), game('swsh-sw')], ['rb-r', 'swsh-sw'])).toEqual([])
    expect(serebiiTargets(arcanine, [game('sv-s', 'set')], ['sv-s'])).toEqual([])
  })

  it('shares pages across forms and restores known Serebii slug punctuation', () => {
    const games = [game('sv-s'), game('sv-v')]
    expect(serebiiTargets(hisuianArcanine, games, target.gameIds)).toEqual([target])
    expect(serebiiTargets(arcanine, games, target.gameIds)).toEqual([target])
    expect(serebiiTargets(mrMime, [game('swsh-sw')], ['swsh-sw'])[0].url).toBe(
      'https://www.serebii.net/pokedex-swsh/mr.mime/',
    )
    const upper = { ...arcanine, refs: { ...arcanine.refs, serebii: 'Arcanine' } }
    expect(serebiiTargets(upper, games, target.gameIds)).toEqual([target])
  })

  it.each(['../arcanine', 'https://evil.test/', 'arcanine?x', '', 'arcanine\\evil'])(
    'rejects unsafe modern species reference %s',
    (serebii) => {
      const pokemon = { ...arcanine, refs: { ...arcanine.refs, serebii } }
      expect(() => serebiiTargets(pokemon, [game('sv-s')], ['sv-s'])).toThrow('Invalid Serebii')
    },
  )
})

describe('cached Serebii evidence', () => {
  let cacheDir: string
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
  let now = Date.now()
  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'pkds-serebii-'))
    fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response(fixture))
    vi.stubGlobal('fetch', fetchMock)
    // Keep tests independent of real pacing; the adapter still reserves request
    // slots, while no test requests a public server.
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1_000))
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await rm(cacheDir, { recursive: true, force: true })
  })

  it('keeps complete location, evolution and form evidence, and caches it across forms', async () => {
    const result = await fetchSerebiiEvidence(target, hisuianArcanine, { cacheDir })
    expect(result.gameIds).toEqual(['sv-s', 'sv-v'])
    expect(result.html).toContain('The Teal Mask')
    expect(result.html).toContain('Hisuian Form')
    expect(result.html).toContain('Fire Stone')
    expect(result.html).toContain('058-h.png')
    expect(result.html).toContain('rowspan="2"')
    expect(result.html).toContain('<small>Hisuian Form</small>')
    expect(result.html).toContain('giftpokemon.shtml')
    expect(result.html).not.toMatch(/tracking|Flamethrower|Unrelated species|class=/)
    const second = await fetchSerebiiEvidence({ ...target, gameIds: ['sv-v'] }, arcanine, {
      cacheDir,
    })
    expect(second).toEqual({ ...result, gameIds: ['sv-v'] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(target.url, {
      signal: expect.any(AbortSignal),
      redirect: 'error',
    })
    const [filename] = await readdir(cacheDir)
    expect(filename).toMatch(/^[a-f0-9]{64}\.json$/)
    expect(JSON.parse(await readFile(join(cacheDir, filename), 'utf8')).html).toBe(result.html)
  })

  it('refreshes explicitly and repairs invalid cached HTML with one request', async () => {
    await fetchSerebiiEvidence(target, arcanine, { cacheDir })
    await fetchSerebiiEvidence(target, arcanine, { cacheDir, forceRefresh: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [filename] = await readdir(cacheDir)
    await writeFile(
      join(cacheDir, filename),
      JSON.stringify({ version: 1, url: target.url, html: 'Challenge' }),
    )
    await fetchSerebiiEvidence(target, arcanine, { cacheDir })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['a challenge', '<title>Just a moment...</title>'],
    ['the wrong dex number', fixture.replace('#059', '#058')],
    ['the wrong species name', fixture.replace('Arcanine - #059', 'Growlithe - #059')],
    ['missing location tables', fixture.replace('<h2>Locations</h2>', '<h2>Moves</h2>')],
    ['oversized evidence', fixture.replace('North Province', 'A'.repeat(60_001))],
  ])('rejects %s without caching the response', async (_, html) => {
    fetchMock.mockResolvedValueOnce(new Response(html))
    await expect(fetchSerebiiEvidence(target, arcanine, { cacheDir })).rejects.toThrow('Serebii')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await readdir(cacheDir)).toEqual([])
  })

  it('fails HTTP errors without retries and rejects oversized pages', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }))
    await expect(fetchSerebiiEvidence(target, arcanine, { cacheDir })).rejects.toThrow('HTTP 404')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockResolvedValueOnce(
      new Response(fixture, { headers: { 'content-length': '2000001' } }),
    )
    await expect(fetchSerebiiEvidence(target, arcanine, { cacheDir })).rejects.toThrow(
      'maximum supported size',
    )
    expect(await readdir(cacheDir)).toEqual([])
  })

  it('honors older-page character encodings', async () => {
    const latin = fixture.replace('Regional forms', 'Régional forms')
    fetchMock.mockResolvedValueOnce(
      new Response(Buffer.from(latin, 'latin1'), {
        headers: { 'content-type': 'text/html; charset=iso-8859-1' },
      }),
    )
    const result = await fetchSerebiiEvidence(target, arcanine, { cacheDir })
    expect(result.html).toContain('Régional forms')
  })

  it.each([
    { ...target, url: 'https://evil.test/pokedex-sv/arcanine/' },
    { ...target, url: 'https://www.serebii.net/pokedex-sv/growlithe/' },
    { ...target, gameIds: ['go'] },
    { ...target, gameIds: ['sv-s', 'swsh-sw'] },
    { ...target, gameIds: [] },
  ])('rejects unconstructed URLs and inaccurate game coverage before requests', async (input) => {
    await expect(fetchSerebiiEvidence(input, arcanine, { cacheDir })).rejects.toThrow(
      'Invalid Serebii',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('honors cancellation before a cache read or request', async () => {
    await fetchSerebiiEvidence(target, arcanine, { cacheDir })
    const controller = new AbortController()
    controller.abort(new Error('Cancelled by user'))
    await expect(
      fetchSerebiiEvidence(target, arcanine, { cacheDir, signal: controller.signal }),
    ).rejects.toThrow('Cancelled by user')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('passes cancellation through an active fetch and leaves no partial cache', async () => {
    const controller = new AbortController()
    let started!: () => void
    const requestStarted = new Promise<void>((resolve) => (started = resolve))
    fetchMock.mockImplementationOnce(async (_, init) => {
      started()
      return new Promise<Response>((_, reject) => {
        init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
      })
    })
    const result = fetchSerebiiEvidence(target, arcanine, { cacheDir, signal: controller.signal })
    await requestStarted
    controller.abort(new Error('Cancelled active request'))
    await expect(result).rejects.toThrow('Cancelled active request')
    expect(await readdir(cacheDir)).toEqual([])
  })

  it('preserves annotation and evolution information for regional forms without classifying acquisition', async () => {
    const pokemon: AvailabilityPokemon = hisuianArcanine
    const result = await fetchSerebiiEvidence(target, pokemon, { cacheDir })
    expect(Object.keys(result).sort()).toEqual(['gameIds', 'html', 'url'])
    expect(result.html).toContain('Evolve Growlithe')
    expect(result.html).toContain('Kantonian Form')
    expect(result.html).toContain('Hisuian Form')
  })
})

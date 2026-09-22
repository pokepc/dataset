import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from './cli.ts'
import { fetchCandidates } from './fetch.ts'

vi.mock('./fetch.ts', () => ({ fetchCandidates: vi.fn(), pokeApiRevision: 'test-revision' }))

describe('locations import write safety', () => {
  let directory: string
  let output: string
  let cache: string
  const original = '[{"id":"faraway-place","name":"Faraway Place","gameIds":"*"}]\n'

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pkds-locations-'))
    output = join(directory, 'locations.json')
    cache = join(directory, 'cache')
    await mkdir(join(directory, 'indices'))
    await mkdir(join(directory, 'games'))
    await writeFile(join(directory, 'types.json'), '[]')
    await writeFile(join(directory, 'regions.json'), '[{"id":"kanto"}]')
    await writeFile(join(directory, 'indices/games.json'), '["rb-r"]')
    await writeFile(
      join(directory, 'games/rb-r.json'),
      '{"id":"rb-r","type":"game","pokeApiGameVersionId":1}',
    )
    await writeFile(output, original)
    vi.stubEnv('POKEPC_DATASET_DIR', directory)
    vi.stubEnv('LOCATIONS_CACHE_DIR', cache)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.mocked(fetchCandidates)
      .mockReset()
      .mockResolvedValue({
        candidates: [
          {
            source: 'pokeapi',
            sourceId: 'kanto-route-1',
            url: 'https://pokeapi.co/api/v2/location/285/',
            name: 'Route 1',
            region: 'kanto',
            games: ['rb-r'],
            pokeApiId: 285,
          },
        ],
        failures: [],
      })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  })

  it('previews without changing the dataset and writes the candidate and report', async () => {
    await main(['--offline'])
    expect(await readFile(output, 'utf8')).toBe(original)
    const report = JSON.parse(await readFile(join(cache, 'report.json'), 'utf8'))
    expect(report.summary).toMatchObject({ locations: 5, fetchFailures: 0, removed: [] })
    expect(
      report.provenance.find((entry: { id: string }) => entry.id === 'kanto-route-1'),
    ).toBeDefined()
    expect(JSON.parse(await readFile(join(cache, 'candidate.json'), 'utf8'))).toHaveLength(5)
  })

  it('writes validated output and is byte-identical on a repeat import', async () => {
    await main(['--offline', '--write'])
    const written = await readFile(output, 'utf8')
    expect(JSON.parse(written).at(-1)).toEqual({
      id: 'kanto-route-1',
      name: 'Route 1',
      region: 'kanto',
      games: ['rb-r'],
      pokeApiId: 285,
    })
    await main(['--offline', '--write'])
    expect(await readFile(output, 'utf8')).toBe(written)
  })

  it('refuses to write after a source page failure but keeps the report', async () => {
    vi.mocked(fetchCandidates).mockResolvedValue({
      candidates: [],
      failures: [{ url: 'https://pokemondb.net/location/test', error: 'HTTP 503' }],
    })
    await expect(main(['--write'])).rejects.toThrow('Source failures prevent writing')
    expect(await readFile(output, 'utf8')).toBe(original)
    expect(JSON.parse(await readFile(join(cache, 'report.json'), 'utf8')).failures).toHaveLength(1)
  })

  it('refuses unreviewed removals', async () => {
    const previous = '[{"id":"kanto-existing-location"}]'
    await writeFile(output, previous)
    await expect(main(['--write'])).rejects.toThrow('Unreviewed removals prevent writing')
    expect(await readFile(output, 'utf8')).toBe(previous)
  })

  it('preserves a concurrent edit made during the import', async () => {
    vi.mocked(fetchCandidates).mockImplementation(async () => {
      await writeFile(output, '[]\n')
      return { candidates: [], failures: [] }
    })
    await expect(main(['--write'])).rejects.toThrow('changed during import')
    expect(await readFile(output, 'utf8')).toBe('[]\n')
  })
})

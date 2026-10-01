import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pokeApiResourceKinds, type PokeApiResourceKind } from './client'
import { enrichChampionsRecordsWithPokeApiIds } from './enrich-champions'

type StubResource = {
  id: number
  name: string
}

type StubResources = Partial<Record<PokeApiResourceKind, StubResource[]>>

type ChampionsRecord = {
  id: string
  championsId: string
  slug: string
  name: string
  pokeApiId?: number | null
}

const eelevate: ChampionsRecord = {
  id: 'eelevate',
  championsId: '313',
  slug: 'eelevate',
  name: 'Eelevate',
}
const overgrow: ChampionsRecord = {
  id: 'overgrow',
  championsId: '65',
  slug: 'overgrow',
  name: 'Overgrow',
}

describe('enrichChampionsRecordsWithPokeApiIds', () => {
  beforeEach(() => {
    // Otherwise the stub server's responses land in the real PokeAPI cache.
    vi.stubEnv('POKEAPI_CACHE', '0')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('writes a null pokeApiId when PokeAPI has no such resource', async () => {
    const { result, abilities } = await enrichStubbedChampionsData({
      abilities: [eelevate],
      upstream: {},
    })

    expect(abilities.eelevate).toHaveProperty('pokeApiId', null)
    expect(result.abilities.matched).toBe(0)
    expect(result.abilities.missing.map((entry) => entry.id)).toEqual(['eelevate'])
  })

  it('writes the upstream id when PokeAPI has the resource', async () => {
    const { result, abilities } = await enrichStubbedChampionsData({
      abilities: [overgrow],
      upstream: { ability: [{ id: 65, name: 'overgrow' }] },
    })

    expect(abilities.overgrow.pokeApiId).toBe(65)
    expect(result.abilities.matched).toBe(1)
    expect(result.abilities.missing).toEqual([])
  })

  it('replaces a hand-written id PokeAPI does not have with null', async () => {
    const { abilities } = await enrichStubbedChampionsData({
      abilities: [{ ...eelevate, pokeApiId: 312 }],
      upstream: {},
    })

    expect(abilities.eelevate).toHaveProperty('pokeApiId', null)
  })

  it('corrects a hand-written id that disagrees with upstream', async () => {
    const { abilities } = await enrichStubbedChampionsData({
      abilities: [{ ...overgrow, pokeApiId: 999 }],
      upstream: { ability: [{ id: 65, name: 'overgrow' }] },
    })

    expect(abilities.overgrow.pokeApiId).toBe(65)
  })

  it('is idempotent across runs', async () => {
    const upstream: StubResources = { ability: [{ id: 65, name: 'overgrow' }] }
    const first = await enrichStubbedChampionsData({ abilities: [eelevate, overgrow], upstream })
    const second = await enrichStubbedChampionsData({
      abilities: Object.values(first.abilities),
      upstream,
    })

    expect(second.abilities).toEqual(first.abilities)
  })

  it('keeps pokeApiId in the same position whether it is null or a number', async () => {
    const { abilities } = await enrichStubbedChampionsData({
      abilities: [eelevate, overgrow],
      upstream: { ability: [{ id: 65, name: 'overgrow' }] },
    })

    expect(Object.keys(abilities.eelevate)).toEqual(Object.keys(abilities.overgrow))
    expect(Object.keys(abilities.eelevate)).toEqual([
      'id',
      'championsId',
      'pokeApiId',
      'slug',
      'name',
    ])
  })
})

async function enrichStubbedChampionsData(options: {
  abilities: ChampionsRecord[]
  upstream: StubResources
}) {
  const { baseUrl, server } = await startStubPokeApiServer(options.upstream)

  try {
    const { records, result } = await enrichChampionsRecordsWithPokeApiIds(
      { abilities: options.abilities, items: [], moves: [] },
      { pokeApiBaseUrl: baseUrl },
    )

    return {
      result,
      abilities: Object.fromEntries(records.abilities.map((record) => [record.id, record])),
    }
  } finally {
    await closeServer(server)
  }
}

async function startStubPokeApiServer(
  resources: StubResources,
): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const kind = pokeApiResourceKinds.find((resourceKind) =>
      url.pathname.startsWith(`/${resourceKind}/`),
    )

    if (kind === undefined) {
      response.writeHead(404).end()
      return
    }

    const results = (resources[kind] ?? []).map((resource) => ({
      name: resource.name,
      url: `http://localhost/${kind}/${resource.id}/`,
    }))

    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ count: results.length, results }))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()

  if (address === null || typeof address === 'string') {
    await closeServer(server)
    throw new Error('Expected the stub PokeAPI server to listen on a TCP port')
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, server }
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve()
        return
      }

      reject(error)
    })
  })
}

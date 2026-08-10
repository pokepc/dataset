import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPokeApiResourceIndexes,
  pokeApiResourceKinds,
  type PokeApiResourceIndexes,
  type PokeApiResourceKind,
} from './client'

type StubResource = {
  id: number
  name: string
}

type StubResources = Partial<Record<PokeApiResourceKind, StubResource[]>>

describe('fetchPokeApiResourceIndexes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the lowest id when upstream lists the same name twice', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const indexes = await fetchStubbedPokeApiResourceIndexes({
      item: [
        { id: 723, name: 'roseli-berry' },
        { id: 2279, name: 'roseli-berry' },
      ],
    })

    expect(indexes.item.byName.get('roseli-berry')?.id).toBe(723)
    expect(indexes.item.byName.get('roseliberry')?.id).toBe(723)
    expect(warnSpy.mock.calls.map(([message]) => message)).toEqual([
      'Duplicate PokeAPI item resource name roseli-berry (ids 723, 2279); keeping id 723 for lookup key roseli-berry',
      'Duplicate PokeAPI item resource name roseli-berry (ids 723, 2279); keeping id 723 for lookup key roseliberry',
    ])
  })

  it('keeps both duplicated ids resolvable by id', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const indexes = await fetchStubbedPokeApiResourceIndexes({
      item: [
        { id: 723, name: 'roseli-berry' },
        { id: 2279, name: 'roseli-berry' },
      ],
    })

    expect(indexes.item.byId.get('723')?.name).toBe('roseli-berry')
    expect(indexes.item.byId.get('2279')?.name).toBe('roseli-berry')
  })

  it('keeps the lowest id regardless of upstream order', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const indexes = await fetchStubbedPokeApiResourceIndexes({
      item: [
        { id: 2279, name: 'roseli-berry' },
        { id: 723, name: 'roseli-berry' },
      ],
    })

    expect(indexes.item.byName.get('roseli-berry')?.id).toBe(723)
    expect(indexes.item.byName.get('roseliberry')?.id).toBe(723)
  })

  it('throws when different names collide on the same lookup key', async () => {
    await expect(
      fetchStubbedPokeApiResourceIndexes({
        move: [
          { id: 10, name: 'foo-bar' },
          { id: 20, name: 'foobar' },
        ],
      }),
    ).rejects.toThrow('Duplicate PokeAPI move resource lookup key foobar: foo-bar, foobar')
  })

  it('tolerates an identical duplicate row without warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const indexes = await fetchStubbedPokeApiResourceIndexes({
      ability: [
        { id: 65, name: 'overgrow' },
        { id: 65, name: 'overgrow' },
      ],
    })

    expect(indexes.ability.byId.get('65')?.name).toBe('overgrow')
    expect(indexes.ability.byName.get('overgrow')?.id).toBe(65)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('throws when one id carries two names', async () => {
    await expect(
      fetchStubbedPokeApiResourceIndexes({
        ability: [
          { id: 65, name: 'overgrow' },
          { id: 65, name: 'blaze' },
        ],
      }),
    ).rejects.toThrow('Duplicate PokeAPI ability resource id 65: overgrow, blaze')
  })
})

async function fetchStubbedPokeApiResourceIndexes(
  resources: StubResources,
): Promise<PokeApiResourceIndexes> {
  const { baseUrl, server } = await startStubPokeApiServer(resources)

  try {
    return await fetchPokeApiResourceIndexes({ baseUrl, cache: false, retries: 1 })
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

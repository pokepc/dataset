export const DEFAULT_POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2'

export const pokeApiResourceKinds = ['ability', 'item', 'move'] as const
export type PokeApiResourceKind = (typeof pokeApiResourceKinds)[number]

export type PokeApiResourceSummary = {
  name: string
  url: string
}

export type PokeApiResourceIndexEntry = {
  id: number
  name: string
}

export type PokeApiResourceIndex = {
  byId: Map<string, PokeApiResourceIndexEntry>
  byName: Map<string, PokeApiResourceIndexEntry>
}
export type PokeApiResourceIndexes = Record<PokeApiResourceKind, PokeApiResourceIndex>

type PokeApiResourceListResponse = {
  count: number
  results: PokeApiResourceSummary[]
}

export async function fetchPokeApiResourceIndexes(
  baseUrl = DEFAULT_POKEAPI_BASE_URL,
): Promise<PokeApiResourceIndexes> {
  const [ability, item, move] = await Promise.all(
    pokeApiResourceKinds.map((kind) => fetchPokeApiResourceIndex(kind, baseUrl)),
  )

  return { ability, item, move }
}

async function fetchPokeApiResourceIndex(
  kind: PokeApiResourceKind,
  baseUrl: string,
): Promise<PokeApiResourceIndex> {
  const list = await fetchPokeApiResourceList(kind, baseUrl)
  const index: PokeApiResourceIndex = {
    byId: new Map(),
    byName: new Map(),
  }

  for (const resource of list.results) {
    const id = parsePokeApiResourceId(resource.url, kind)
    const entry = { id, name: resource.name }
    const idKey = String(id)

    if (index.byId.has(idKey)) {
      throw new Error(`Duplicate PokeAPI ${kind} resource id: ${idKey}`)
    }

    index.byId.set(idKey, entry)

    for (const nameKey of pokeApiResourceNameKeys(resource.name)) {
      const existingEntry = index.byName.get(nameKey)

      if (existingEntry !== undefined && existingEntry.id !== id) {
        throw new Error(
          `Duplicate PokeAPI ${kind} resource lookup key ${nameKey}: ${existingEntry.name}, ${resource.name}`,
        )
      }

      index.byName.set(nameKey, entry)
    }
  }

  return index
}

async function fetchPokeApiResourceList(
  kind: PokeApiResourceKind,
  baseUrl: string,
): Promise<PokeApiResourceListResponse> {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${kind}/`)
  url.searchParams.set('limit', '100000')
  url.searchParams.set('offset', '0')

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch PokeAPI ${kind} list: ${response.status} ${response.statusText}`,
    )
  }

  const json: unknown = await response.json()

  if (!isPokeApiResourceListResponse(json)) {
    throw new Error(`Unexpected PokeAPI ${kind} list response shape`)
  }

  if (json.results.length < json.count) {
    throw new Error(
      `Expected all PokeAPI ${kind} resources in one list response, got ${json.results.length} of ${json.count}`,
    )
  }

  return json
}

function isPokeApiResourceListResponse(value: unknown): value is PokeApiResourceListResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const response = value as Record<string, unknown>

  return (
    typeof response.count === 'number' &&
    Array.isArray(response.results) &&
    response.results.every(isPokeApiResourceSummary)
  )
}

function isPokeApiResourceSummary(value: unknown): value is PokeApiResourceSummary {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const resource = value as Record<string, unknown>

  return typeof resource.name === 'string' && typeof resource.url === 'string'
}

function parsePokeApiResourceId(resourceUrl: string, kind: PokeApiResourceKind): number {
  const url = new URL(resourceUrl)
  const segments = url.pathname.split('/').filter(Boolean)
  const kindIndex = segments.lastIndexOf(kind)
  const id = kindIndex === -1 ? undefined : segments[kindIndex + 1]

  if (id === undefined || !/^\d+$/.test(id)) {
    throw new Error(`Could not parse PokeAPI ${kind} id from URL: ${resourceUrl}`)
  }

  return Number(id)
}

export function pokeApiResourceNameKeys(value: string): string[] {
  return Array.from(
    new Set([
      value.toLowerCase(),
      value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ''),
    ]),
  ).filter((key) => key.length > 0)
}

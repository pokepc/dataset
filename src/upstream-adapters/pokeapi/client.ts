import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DEFAULT_POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2'
export const DEFAULT_POKEAPI_CACHE_DIR = join(process.cwd(), '.local/pokeapi')

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

export type PokeApiFetchOptions = {
  baseUrl?: string
  cache?: boolean
  cacheDir?: string
  forceRefresh?: boolean
  retries?: number
}

type PokeApiResourceListResponse = {
  count: number
  results: PokeApiResourceSummary[]
}

export async function fetchPokeApiResourceIndexes(
  baseUrlOrOptions: string | PokeApiFetchOptions = DEFAULT_POKEAPI_BASE_URL,
): Promise<PokeApiResourceIndexes> {
  const options = normalizePokeApiFetchOptions(baseUrlOrOptions)
  const [ability, item, move] = await Promise.all(
    pokeApiResourceKinds.map((kind) => fetchPokeApiResourceIndex(kind, options)),
  )

  return { ability, item, move }
}

async function fetchPokeApiResourceIndex(
  kind: PokeApiResourceKind,
  options: PokeApiFetchOptions,
): Promise<PokeApiResourceIndex> {
  const list = await fetchPokeApiResourceList(kind, options)
  const index: PokeApiResourceIndex = {
    byId: new Map(),
    byName: new Map(),
  }

  for (const resource of list.results) {
    const id = parsePokeApiResourceId(resource.url, kind)
    const entry = { id, name: resource.name }
    const idKey = String(id)
    const existingIdEntry = index.byId.get(idKey)

    if (existingIdEntry !== undefined && existingIdEntry.name !== resource.name) {
      throw new Error(
        `Duplicate PokeAPI ${kind} resource id ${idKey}: ${existingIdEntry.name}, ${resource.name}`,
      )
    }

    index.byId.set(idKey, entry)

    for (const nameKey of pokeApiResourceNameKeys(resource.name)) {
      const existingEntry = index.byName.get(nameKey)

      if (existingEntry === undefined || existingEntry.id === id) {
        index.byName.set(nameKey, entry)
        continue
      }

      if (existingEntry.name !== resource.name) {
        throw new Error(
          `Duplicate PokeAPI ${kind} resource lookup key ${nameKey}: ${existingEntry.name}, ${resource.name}`,
        )
      }

      // Upstream sometimes lists the same resource name under two ids; keep the lowest so
      // lookups stay stable when a newer duplicate row appears.
      const keptEntry = existingEntry.id < id ? existingEntry : entry

      console.warn(
        `Duplicate PokeAPI ${kind} resource name ${resource.name} (ids ${existingEntry.id}, ${id}); keeping id ${keptEntry.id} for lookup key ${nameKey}`,
      )
      index.byName.set(nameKey, keptEntry)
    }
  }

  return index
}

async function fetchPokeApiResourceList(
  kind: PokeApiResourceKind,
  options: PokeApiFetchOptions,
): Promise<PokeApiResourceListResponse> {
  const baseUrl = options.baseUrl ?? DEFAULT_POKEAPI_BASE_URL
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${kind}/`)
  url.searchParams.set('limit', '100000')
  url.searchParams.set('offset', '0')

  const json = await fetchPokeApiJson(url, options)

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

export async function fetchPokeApiJson(
  pathnameOrUrl: string | URL,
  options: PokeApiFetchOptions = {},
): Promise<unknown> {
  const resolvedOptions = normalizePokeApiFetchOptions(options)
  const url = resolvePokeApiUrl(pathnameOrUrl, resolvedOptions.baseUrl)
  const cacheEnabled = resolvedOptions.cache ?? process.env.POKEAPI_CACHE !== '0'
  const cachePath = pokeApiCachePath(url, resolvedOptions.cacheDir)

  if (cacheEnabled && !resolvedOptions.forceRefresh) {
    const cachedJson = readCachedPokeApiJson(cachePath)

    if (cachedJson !== undefined) {
      return cachedJson
    }
  }

  const json = await fetchPokeApiJsonFromNetwork(url, resolvedOptions.retries)

  if (cacheEnabled) {
    writeCachedPokeApiJson(cachePath, json)
  }

  return json
}

function normalizePokeApiFetchOptions(
  options: string | PokeApiFetchOptions,
): Required<PokeApiFetchOptions> {
  const input = typeof options === 'string' ? { baseUrl: options } : options

  return {
    baseUrl: input.baseUrl ?? DEFAULT_POKEAPI_BASE_URL,
    cache: input.cache ?? process.env.POKEAPI_CACHE !== '0',
    cacheDir: input.cacheDir ?? process.env.POKEAPI_CACHE_DIR ?? DEFAULT_POKEAPI_CACHE_DIR,
    forceRefresh: input.forceRefresh ?? process.env.POKEAPI_REFRESH_CACHE === '1',
    retries: input.retries ?? 3,
  }
}

function resolvePokeApiUrl(pathnameOrUrl: string | URL, baseUrl: string): URL {
  if (pathnameOrUrl instanceof URL) {
    return pathnameOrUrl
  }

  if (/^https?:\/\//i.test(pathnameOrUrl)) {
    return new URL(pathnameOrUrl)
  }

  const base = baseUrl.replace(/\/+$/, '')
  const pathname = pathnameOrUrl.replace(/^\/+/, '').replace(/\/?$/, '/')
  return new URL(`${base}/${pathname}`)
}

async function fetchPokeApiJsonFromNetwork(url: URL, retries: number): Promise<unknown> {
  let lastError: unknown

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
        },
      })

      if (response.ok) {
        return await response.json()
      }

      const body = await response.text()
      lastError = new Error(
        `${response.status} ${response.statusText}${body.length > 0 ? `: ${body.slice(0, 240)}` : ''}`,
      )

      if (response.status !== 429 && response.status < 500) {
        break
      }
    } catch (error) {
      lastError = error
    }

    await sleep(backoffMs(attempt))
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function readCachedPokeApiJson(cachePath: string): unknown | undefined {
  if (!existsSync(cachePath)) {
    return undefined
  }

  try {
    return JSON.parse(readFileSync(cachePath, 'utf8'))
  } catch {
    return undefined
  }
}

function writeCachedPokeApiJson(cachePath: string, json: unknown): void {
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, `${JSON.stringify(json)}\n`)
}

function pokeApiCachePath(url: URL, cacheDir: string): string {
  const segments = [
    sanitizeCachePathSegment(url.hostname),
    ...url.pathname.split('/').filter(Boolean).map(sanitizeCachePathSegment),
  ]
  const searchSuffix = url.search.length > 0 ? `-${stableSearchSuffix(url.searchParams)}` : ''
  const filename = `${segments.pop() ?? 'index'}${searchSuffix}.json`

  return join(cacheDir, ...segments, filename)
}

function stableSearchSuffix(searchParams: URLSearchParams): string {
  return Array.from(searchParams.entries())
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      `${leftKey}=${leftValue}`.localeCompare(`${rightKey}=${rightValue}`),
    )
    .map(([key, value]) => `${sanitizeCachePathSegment(key)}-${sanitizeCachePathSegment(value)}`)
    .join('-')
}

function sanitizeCachePathSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return sanitized.length > 0 ? sanitized : '_'
}

function backoffMs(attempt: number): number {
  return Math.min(15_000, 750 * 2 ** Math.max(0, attempt - 1))
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return
  }

  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
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

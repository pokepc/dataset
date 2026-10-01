import { champoutPokeApiResourceNameAliases } from '../projectpokemon-champout/fixtures/pokeapi'
import {
  DEFAULT_POKEAPI_BASE_URL,
  fetchPokeApiResourceIndexes,
  pokeApiResourceNameKeys,
  type PokeApiResourceIndex,
  type PokeApiResourceIndexEntry,
  type PokeApiResourceKind,
} from './client'

export type EnrichChampionsDataOptions = {
  pokeApiBaseUrl?: string
}

export type EnrichedChampionsDomainResult = {
  matched: number
  missing: MissingPokeApiResource[]
}

export type EnrichChampionsDataResult = Record<
  'abilities' | 'items' | 'moves',
  EnrichedChampionsDomainResult
>

export type MissingPokeApiResource = {
  id: string
  championsId: string
  slug: string
  name: string
  triedIdCandidates: string[]
  championsIdMatchedResource?: PokeApiResourceIndexEntry
}

/** A Champions record that links to a PokéAPI resource. */
export type ChampionsLinkedRecord = {
  id: string
  championsId: string
  slug: string
  name: string
  pokeApiId?: number | null
}

export type ChampionsLinkedRecords<T extends ChampionsLinkedRecord = ChampionsLinkedRecord> =
  Record<keyof EnrichChampionsDataResult, T[]>

const championsDomains = [
  { key: 'abilities', kind: 'ability' },
  { key: 'items', kind: 'item' },
  { key: 'moves', kind: 'move' },
] as const satisfies readonly { key: keyof EnrichChampionsDataResult; kind: PokeApiResourceKind }[]

/**
 * Sets `pokeApiId` on Champions abilities, items and moves from the PokéAPI resource indexes:
 * the matching id, or null when PokéAPI has no such resource. Returns enriched copies.
 */
export async function enrichChampionsRecordsWithPokeApiIds<R extends ChampionsLinkedRecords>(
  records: R,
  options: EnrichChampionsDataOptions = {},
): Promise<{ records: R; result: EnrichChampionsDataResult }> {
  const resourceIndexes = await fetchPokeApiResourceIndexes(
    options.pokeApiBaseUrl ?? DEFAULT_POKEAPI_BASE_URL,
  )
  const enriched = { ...records }
  const result = {} as EnrichChampionsDataResult
  for (const domain of championsDomains) {
    const prepared = enrichDomain(domain.kind, records[domain.key], resourceIndexes[domain.kind])
    enriched[domain.key] = prepared.records as R[typeof domain.key]
    result[domain.key] = { matched: prepared.matched, missing: prepared.missing }
  }

  if (Object.values(result).some((domainResult) => domainResult.missing.length > 0)) {
    console.warn(formatMissingPokeApiResourcesWarning(result))
  }
  return { records: enriched, result }
}

export function formatEnrichChampionsDataSummary(result: EnrichChampionsDataResult): string {
  return [
    formatDomainSummary('abilities', result.abilities),
    formatDomainSummary('items', result.items),
    formatDomainSummary('moves', result.moves),
  ].join(', ')
}

function enrichDomain<T extends ChampionsLinkedRecord>(
  kind: PokeApiResourceKind,
  records: readonly T[],
  resourceIndex: PokeApiResourceIndex,
): EnrichedChampionsDomainResult & { records: T[] } {
  const missing: MissingPokeApiResource[] = []
  let matched = 0

  const enrichedRecords = records.map((record) => {
    const { id, championsId, slug, name } = record
    const triedIdCandidates = pokeApiIdCandidates(kind, id)
    const championsIdMatchedResource = resourceIndex.byId.get(championsId)
    const pokeApiId = findPokeApiId(resourceIndex, championsId, triedIdCandidates)

    if (pokeApiId === undefined) {
      missing.push({ id, championsId, slug, name, triedIdCandidates, championsIdMatchedResource })
    } else {
      matched += 1
    }

    return withPokeApiId(record, pokeApiId)
  })

  return { matched, missing, records: enrichedRecords }
}

function findPokeApiId(
  resourceIndex: PokeApiResourceIndex,
  championsId: string,
  idCandidates: string[],
): number | undefined {
  for (const candidate of idCandidates) {
    const resource = findPokeApiResourceByName(resourceIndex, candidate)

    if (resource !== undefined) {
      return resource.id
    }
  }

  const resourceByChampionsId = resourceIndex.byId.get(championsId)

  if (resourceByChampionsId === undefined) {
    return undefined
  }

  return resourceByChampionsId.id
}

function findPokeApiResourceByName(
  resourceIndex: PokeApiResourceIndex,
  candidate: string,
): PokeApiResourceIndexEntry | undefined {
  for (const key of pokeApiResourceNameKeys(candidate)) {
    const resource = resourceIndex.byName.get(key)

    if (resource !== undefined) {
      return resource
    }
  }

  return undefined
}

function pokeApiIdCandidates(kind: PokeApiResourceKind, id: string): string[] {
  return uniqueStrings([id, ...(champoutPokeApiResourceNameAliases[kind]?.[id] ?? [])])
}

function withPokeApiId<T extends ChampionsLinkedRecord>(
  record: T,
  pokeApiId: number | undefined,
): T {
  const { id, championsId, slug, ...rest } = record
  delete rest.pokeApiId

  // Null rather than absent, so "PokeAPI has no id for this yet" is stated in
  // the data instead of looking like a field nobody got round to filling in.
  // Anything hand-written here is replaced: an id PokeAPI has not published is
  // a guess, and a guess that outlives a build is worse than a null.
  return { id, championsId, pokeApiId: pokeApiId ?? null, slug, ...rest } as unknown as T
}

function uniqueStrings(values: readonly unknown[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string')))
}

function formatDomainSummary(
  domain: keyof EnrichChampionsDataResult,
  result: EnrichedChampionsDomainResult,
): string {
  const missing = result.missing.length === 0 ? '' : `, ${result.missing.length} unmatched`

  return `${result.matched} ${domain} with PokeAPI IDs${missing}`
}

function formatMissingPokeApiResourcesWarning(result: EnrichChampionsDataResult): string {
  const lines = ['Missing PokeAPI resources; they were written with a null pokeApiId.']

  for (const [domain, domainResult] of Object.entries(result)) {
    if (domainResult.missing.length === 0) {
      continue
    }

    lines.push(`${domain}: ${domainResult.missing.length} missing`)

    for (const missing of domainResult.missing) {
      const championsIdMatch =
        missing.championsIdMatchedResource === undefined
          ? 'no PokeAPI resource with that numeric id'
          : `numeric id belongs to ${missing.championsIdMatchedResource.name}`

      lines.push(
        `- ${missing.id} (${missing.name}; championsId ${missing.championsId}; tried id candidates ${missing.triedIdCandidates.join(', ')}; ${championsIdMatch})`,
      )
    }
  }

  return lines.join('\n')
}

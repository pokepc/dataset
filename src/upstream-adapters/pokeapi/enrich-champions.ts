import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { champoutPokeApiResourceNameAliases } from '../projectpokemon-champout/fixtures/pokeapi'
import {
  DEFAULT_POKEAPI_BASE_URL,
  fetchPokeApiResourceIndexes,
  pokeApiResourceNameKeys,
  type PokeApiResourceIndex,
  type PokeApiResourceIndexEntry,
  type PokeApiResourceKind,
} from './client'

export const DEFAULT_CHAMPIONS_DATA_ROOT = join(process.cwd(), 'data-next/champions')

export type EnrichChampionsDataOptions = {
  championsDataRoot?: string
  pokeApiBaseUrl?: string
}

export type EnrichedChampionsDomainResult = {
  filePath: string
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

type ChampionsDomain = {
  key: keyof EnrichChampionsDataResult
  kind: PokeApiResourceKind
  fileName: string
}

type JsonRecord = Record<string, unknown>

type PreparedChampionsDomain = EnrichedChampionsDomainResult & {
  records: JsonRecord[]
}

const championsDomains = [
  { key: 'abilities', kind: 'ability', fileName: 'abilities.json' },
  { key: 'items', kind: 'item', fileName: 'items.json' },
  { key: 'moves', kind: 'move', fileName: 'moves.json' },
] as const satisfies readonly ChampionsDomain[]

export async function enrichChampionsDataWithPokeApiIds(
  options: EnrichChampionsDataOptions = {},
): Promise<EnrichChampionsDataResult> {
  const championsDataRoot = options.championsDataRoot ?? DEFAULT_CHAMPIONS_DATA_ROOT
  const pokeApiBaseUrl = options.pokeApiBaseUrl ?? DEFAULT_POKEAPI_BASE_URL
  const resourceIndexes = await fetchPokeApiResourceIndexes(pokeApiBaseUrl)
  const preparedDomains = championsDomains.map((domain) =>
    prepareChampionsDomainWithPokeApiIds(
      domain.kind,
      join(championsDataRoot, domain.fileName),
      resourceIndexes[domain.kind],
    ),
  )
  const result = Object.fromEntries(
    championsDomains.map((domain, index) => {
      const preparedDomain = preparedDomains[index]

      return [
        domain.key,
        {
          filePath: preparedDomain.filePath,
          matched: preparedDomain.matched,
          missing: preparedDomain.missing,
        },
      ]
    }),
  ) as EnrichChampionsDataResult

  const missingCount = Object.values(result).reduce(
    (count, domainResult) => count + domainResult.missing.length,
    0,
  )

  if (missingCount > 0) {
    console.warn(formatMissingPokeApiResourcesWarning(result))
  }

  for (const preparedDomain of preparedDomains) {
    writeJsonFile(preparedDomain.filePath, preparedDomain.records)
  }

  return result
}

export function formatEnrichChampionsDataSummary(result: EnrichChampionsDataResult): string {
  return [
    formatDomainSummary('abilities', result.abilities),
    formatDomainSummary('items', result.items),
    formatDomainSummary('moves', result.moves),
  ].join(', ')
}

function prepareChampionsDomainWithPokeApiIds(
  kind: PokeApiResourceKind,
  filePath: string,
  resourceIndex: PokeApiResourceIndex,
): PreparedChampionsDomain {
  const records = readJsonRecordArray(filePath)
  const missing: MissingPokeApiResource[] = []
  let matched = 0

  const enrichedRecords = records.map((record, index) => {
    const id = requiredString(record, 'id', filePath, index)
    const championsId = requiredString(record, 'championsId', filePath, index)
    const slug = requiredString(record, 'slug', filePath, index)
    const name = requiredString(record, 'name', filePath, index)
    const triedIdCandidates = pokeApiIdCandidates(kind, id)
    const championsIdMatchedResource = resourceIndex.byId.get(championsId)
    const pokeApiId = findPokeApiId(resourceIndex, championsId, triedIdCandidates)

    if (pokeApiId === undefined) {
      missing.push({
        id,
        championsId,
        slug,
        name,
        triedIdCandidates,
        championsIdMatchedResource,
      })
    } else {
      matched += 1
    }

    return withPokeApiId(record, pokeApiId)
  })

  return { filePath, matched, missing, records: enrichedRecords }
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

function withPokeApiId(record: JsonRecord, pokeApiId: number | undefined): JsonRecord {
  const { id, championsId, slug, ...rest } = record
  delete rest.pokeApiId

  // Null rather than absent, so "PokeAPI has no id for this yet" is stated in
  // the data instead of looking like a field nobody got round to filling in.
  // Anything hand-written here is replaced: an id PokeAPI has not published is
  // a guess, and a guess that outlives a build is worse than a null.
  return { id, championsId, pokeApiId: pokeApiId ?? null, slug, ...rest }
}

function readJsonRecordArray(filePath: string): JsonRecord[] {
  const json: unknown = JSON.parse(readFileSync(filePath, 'utf8'))

  if (!Array.isArray(json)) {
    throw new Error(`Expected ${filePath} to contain an array`)
  }

  return json.map((record, index) => {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw new Error(`Expected ${filePath}[${index}] to contain an object`)
    }

    return record as JsonRecord
  })
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function requiredString(record: JsonRecord, key: string, filePath: string, index: number): string {
  const value = record[key]

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected ${filePath}[${index}].${key} to be a non-empty string`)
  }

  return value
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

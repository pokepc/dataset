import {
  aliases,
  canonicalNames,
  gameEvidence,
  primaryPokeApiIds,
  sourceOverrides,
} from './overrides.ts'
import type { Candidate, Game, Location } from './types.ts'
import { exceptionsById } from './exceptions.ts'

export const generalLocations: Location[] = [
  { id: 'distant-land', name: 'Distant Land', games: null, region: null, pokeApiId: 260 },
  { id: 'faraway-place', name: 'Faraway Place', games: null, region: null, pokeApiId: 267 },
  {
    id: 'fateful-encounter',
    name: 'Fateful Encounter',
    games: null,
    region: null,
    pokeApiId: null,
  },
  { id: 'mystery-zone', name: 'Mystery Zone', games: null, region: null, pokeApiId: 264 },
]

export function slug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'‘]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function lexical(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function sortLocations(locations: Location[], regions: { id: string }[]): Location[] {
  const order = new Map(regions.map((region, i) => [region.id, i]))
  const rank = (region: string | null) => {
    if (region === null) return -1
    const value = order.get(region)
    if (value === undefined) throw new Error(`Unknown location region: ${region}`)
    return value
  }
  // Validate even a one-record list, for which Array.sort never calls its comparator.
  locations.forEach((location) => rank(location.region))
  return [...locations].sort((a, b) => rank(a.region) - rank(b.region) || lexical(a.id, b.id))
}

export type Disposition = { candidate: Candidate; id?: string; reason: string }
export type Normalized = {
  locations: Location[]
  provenance: { id: string; sources: Candidate[] }[]
  excluded: Disposition[]
  unresolved: Disposition[]
}

export function normalizeLocations(
  candidates: Candidate[],
  games: Game[],
  regions: { id: string }[],
): Normalized {
  const gameOrder = new Map(games.map((game, i) => [game.id, i]))
  const individualGames = new Set(
    games.filter((game) => game.type === 'game').map((game) => game.id),
  )
  const regionIds = new Set(regions.map((region) => region.id))
  const groups = new Map<string, { region: string | null; name: string; sources: Candidate[] }>()
  const excluded: Disposition[] = []
  const unresolved: Disposition[] = []
  // Geographic corrections are driven by the actual Pokéarth catalogs, not a game's home region.
  const geography = new Map<string, string>()
  for (const candidate of candidates) {
    if (
      candidate.source === 'serebii' &&
      (candidate.region === 'kitakami' || candidate.sourceId.includes('/terarium/'))
    )
      geography.set(slug(candidate.name), candidate.region!)
  }
  for (const candidate of candidates) {
    const override = sourceOverrides[`${candidate.source}:${candidate.sourceId}`]
    if (override?.exclude) {
      excluded.push({ candidate, reason: override.reason })
      continue
    }
    let name = override?.name ?? candidate.name.trim().replace(/\s+/g, ' ')
    // Some legacy HTML mixes Windows-1252 markup and UTF-8 names.
    if (/[ÃÂ]/.test(name)) {
      const repaired = Buffer.from(name, 'latin1').toString('utf8')
      if (!repaired.includes('\uFFFD')) name = repaired
    }
    const nameSlug = slug(name)
    if (generalLocations.some((location) => location.id === nameSlug)) {
      excluded.push({
        candidate,
        id: nameSlug,
        reason: 'Merged into the curated general label, with its canonical PokéAPI ID.',
      })
      continue
    }
    if (
      /roaming|\(roaming\)|all-poliwag|all-rattata|all-bugs/i.test(
        candidate.sourceId + ' ' + name,
      ) ||
      /-(pokemart|pokecenter)$/.test(candidate.sourceId) ||
      /^(.*-)?(max-dens|isle-of-armor-caves)$/.test(candidate.sourceId)
    ) {
      excluded.push({
        candidate,
        reason: 'Encounter aggregate or unnamed technical location, not a distinct named place.',
      })
      continue
    }
    let region = override && 'region' in override ? override.region! : candidate.region
    if (region === 'paldea' && geography.has(nameSlug)) region = geography.get(nameSlug)!
    if (region === null && candidate.source === 'pokeapi') {
      excluded.push({
        candidate,
        reason:
          'Event, person, or transfer-origin metadata outside named places and the curated general labels.',
      })
      continue
    }
    if (region && !regionIds.has(region)) {
      excluded.push({
        candidate,
        reason: `Region ${region} has no supported game in this dataset.`,
      })
      continue
    }
    if (regionIds.has(nameSlug) || nameSlug === 'sevii-islands') {
      excluded.push({ candidate, reason: 'Whole-region navigation or encounter aggregate.' })
      continue
    }
    const rawId = override?.id ?? `${region ? `${region}-` : ''}${nameSlug}`
    const mergedId = aliases[rawId] ?? rawId
    const exception = exceptionsById.get(mergedId)
    if (exception?.decision === 'exclude') {
      excluded.push({ candidate, id: mergedId, reason: `Bulbapedia review: ${exception.reason}` })
      continue
    }
    const id = exception?.canonicalId ?? mergedId
    if (exception?.decision === 'include') name = exception.name
    const existing = groups.get(id)
    if (existing && existing.region !== region) throw new Error(`Conflicting regions for ${id}`)
    const normalizedCandidate = {
      ...candidate,
      name,
      region,
      games: override?.games ?? [...new Set(candidate.games)],
    }
    if (existing) existing.sources.push(normalizedCandidate)
    else groups.set(id, { region, name, sources: [normalizedCandidate] })
    if (exception?.decision === 'include') {
      const group = groups.get(id)!
      if (
        !group.sources.some(
          (source) => source.source === 'bulbapedia' && source.sourceId === exception.id,
        )
      ) {
        group.sources.push({
          source: 'bulbapedia',
          sourceId: exception.id,
          url: exception.url,
          name: exception.name,
          region,
          games: exception.games,
          pokeApiId: null,
        })
      }
    }
  }
  const locations = [...generalLocations]
  const provenance: Normalized['provenance'] = generalLocations.map((location) => ({
    id: location.id,
    sources: [
      ...candidates.filter((candidate) => slug(candidate.name) === location.id),
      ...(exceptionsById.has(location.id)
        ? [
            {
              source: 'bulbapedia' as const,
              sourceId: location.id,
              url: exceptionsById.get(location.id)!.url,
              name: location.name,
              region: null,
              games: [],
              pokeApiId: null,
            },
          ]
        : []),
    ],
  }))
  for (const [id, group] of groups) {
    const evidence = gameEvidence[id]
    if (evidence) {
      group.sources.push(
        ...evidence.urls.map((url) => ({
          source: 'manual' as const,
          sourceId: id,
          url,
          name: group.name,
          region: group.region,
          games: evidence.games,
          pokeApiId: null,
        })),
      )
    }
    const ids = [
      ...new Set(
        group.sources.flatMap((source) => (source.pokeApiId === null ? [] : [source.pokeApiId])),
      ),
    ]
    if (primaryPokeApiIds[id] && !ids.includes(primaryPokeApiIds[id])) {
      throw new Error(
        `Primary PokéAPI ID ${primaryPokeApiIds[id]} is absent from the sources for ${id}`,
      )
    }
    let problem: string | undefined
    const memberGames = [...new Set(group.sources.flatMap((source) => source.games))]
    for (const game of memberGames) {
      if (!individualGames.has(game)) throw new Error(`Invalid individual game ${game} for ${id}`)
    }
    if (!memberGames.length) problem = 'No positive individual-game evidence.'
    if (ids.length > 1 && !primaryPokeApiIds[id])
      problem = `Ambiguous PokéAPI identities: ${ids.join(', ')}.`
    if (!/^[a-z0-9-]{1,50}$/.test(id)) problem = 'Canonical ID requires an explicit shorter alias.'
    if (problem) {
      for (const candidate of group.sources) unresolved.push({ candidate, id, reason: problem })
      continue
    }
    const preferred = group.sources.find((source) => source.pokeApiId !== null) ?? group.sources[0]
    locations.push({
      id,
      name: canonicalNames[id] ?? exceptionsById.get(id)?.name ?? preferred.name,
      games: memberGames.sort((a, b) => gameOrder.get(a)! - gameOrder.get(b)!),
      region: group.region,
      pokeApiId: primaryPokeApiIds[id] ?? ids[0] ?? null,
    })
    provenance.push({ id, sources: group.sources })
  }
  return {
    locations: sortLocations(locations, regions),
    provenance: provenance.sort((a, b) => lexical(a.id, b.id)),
    excluded,
    unresolved,
  }
}

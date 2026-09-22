import { SourceCache, mapConcurrent } from './cache.ts'
import { parsePokeApiLocations } from './pokeapi.ts'
import { parsePokemonDbCatalog, parsePokemonDbPage } from './pokemondb.ts'
import { parseSerebiiCatalog, parseSerebiiPage } from './serebii.ts'
import type { Candidate, Game } from './types.ts'
import { gameEvidence } from './overrides.ts'

export const pokeApiRevision = '575291cdb197a7e3a320297be276c9de4ef8401a'
export const csvFiles = [
  'locations',
  'location_names',
  'location_areas',
  'encounters',
  'versions',
  'regions',
]
export const supportedRegions = new Set([
  'kanto',
  'johto',
  'hoenn',
  'orre',
  'sinnoh',
  'unova',
  'kalos',
  'alola',
  'galar',
  'hisui',
  'paldea',
  'kitakami',
])

export type FetchResult = {
  candidates: Candidate[]
  failures: { url: string; error: string }[]
}

export async function fetchCandidates(cache: SourceCache, games: Game[]): Promise<FetchResult> {
  const failures: FetchResult['failures'] = []
  const csv: Record<string, string> = {}
  for (const file of csvFiles) {
    csv[file] = await cache.text(
      `https://raw.githubusercontent.com/PokeAPI/pokeapi/${pokeApiRevision}/data/v2/csv/${file}.csv`,
    )
  }
  const candidates = parsePokeApiLocations(csv, games)
  console.log(
    `Loaded ${candidates.length} PokéAPI locations from revision ${pokeApiRevision.slice(0, 8)}.`,
  )
  const dbCatalog = parsePokemonDbCatalog(await cache.text('https://pokemondb.net/location'))
  const serebiiCatalog = parseSerebiiCatalog(await cache.text('https://www.serebii.net/pokearth/'))
  let completed = 0
  await mapConcurrent(dbCatalog, 3, async (entry) => {
    for (const url of entry.pages) {
      try {
        entry.games.push(...parsePokemonDbPage(await cache.text(url)))
      } catch (error) {
        failures.push({ url, error: String(error) })
      }
    }
    if (++completed % 100 === 0)
      console.log(`Read ${completed}/${dbCatalog.length} PokémonDB locations.`)
  })
  candidates.push(...dbCatalog)
  completed = 0
  await mapConcurrent(serebiiCatalog, 3, async (entry) => {
    if (entry.region && supportedRegions.has(entry.region)) {
      const visited = new Set<string>()
      const queue = [...entry.pages]
      while (queue.length) {
        const url = queue.shift()!
        if (visited.has(url)) continue
        visited.add(url)
        try {
          const page = parseSerebiiPage(await cache.text(url), url)
          entry.games.push(...page.games)
          queue.push(...page.pages.filter((x) => !visited.has(x)))
        } catch (error) {
          failures.push({ url, error: String(error) })
        }
      }
      entry.pages = [...visited]
    }
    if (++completed % 100 === 0)
      console.log(`Read ${completed}/${serebiiCatalog.length} Pokéarth locations.`)
  })
  candidates.push(...serebiiCatalog)
  for (const url of new Set(Object.values(gameEvidence).flatMap((evidence) => evidence.urls))) {
    try {
      await cache.text(url)
    } catch (error) {
      failures.push({ url, error: String(error) })
    }
  }
  return { candidates, failures: failures.sort((a, b) => a.url.localeCompare(b.url)) }
}

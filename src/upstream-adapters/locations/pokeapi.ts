import type { Candidate } from './types.ts'

type Game = { id: string; type: string; pokeApiGameVersionId: number | null }
type CsvRow = Record<string, string>

/** RFC 4180-style fields, including escaped quotes and embedded newlines. */
export function parseCsv(csv: string): CsvRow[] {
  return readCsv(csv).rows
}

function readCsv(csv: string): { headers: string[]; rows: CsvRow[] } {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let closedQuote = false
  const input = csv.replace(/^\uFEFF/, '')
  const finishField = () => {
    row.push(field)
    field = ''
    closedQuote = false
  }
  const finishRow = () => {
    finishField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
          closedQuote = true
        }
      } else {
        field += char
      }
    } else if (char === ',') {
      finishField()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      finishRow()
    } else if (char === '"' && field === '' && !closedQuote) {
      quoted = true
    } else {
      if (closedQuote || char === '"') throw new Error('Malformed CSV quoting')
      field += char
    }
  }
  if (quoted) throw new Error('Unterminated CSV quoted field')
  if (row.length > 0 || field !== '' || closedQuote) finishRow()

  const headers = rows.shift()
  if (!headers || headers.some((header) => !header.trim())) {
    throw new Error('CSV must have nonempty column names')
  }
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column')
  return {
    headers,
    rows: rows.map((cells, index) => {
      if (cells.length !== headers.length) {
        throw new Error(
          `CSV row ${index + 2}: expected ${headers.length} fields, got ${cells.length}`,
        )
      }
      return Object.fromEntries(headers.map((header, column) => [header, cells[column]]))
    }),
  }
}

function positiveId(value: string, context: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`Invalid ${context}: ${JSON.stringify(value)}`)
  }
  return Number(value)
}

function indexed(rows: CsvRow[], table: string): Map<number, CsvRow> {
  const result = new Map<number, CsvRow>()
  for (const row of rows) {
    const id = positiveId(row.id, `${table} id`)
    if (result.has(id)) throw new Error(`Duplicate ${table} id: ${id}`)
    result.set(id, row)
  }
  return result
}

// A DLC version is specific to one base version, including paired expansions.
const dlcBaseVersions: Record<string, string> = {
  'the-isle-of-armor-sword': 'sword',
  'the-isle-of-armor-shield': 'shield',
  'the-crown-tundra-sword': 'sword',
  'the-crown-tundra-shield': 'shield',
  'the-teal-mask-scarlet': 'scarlet',
  'the-teal-mask-violet': 'violet',
  'the-indigo-disk-scarlet': 'scarlet',
  'the-indigo-disk-violet': 'violet',
  'mega-dimension': 'legends-za',
}

// These upstream records have no English row in the pinned official CSV snapshot.
// Keep explicit spellings inspectable by the provenance/review report.
export const pokeApiFallbackNames: Readonly<Record<string, string>> = {
  'hoenn-pokemart': 'Poké Mart',
  'hoenn-pokecenter': 'Pokémon Center',
  'kanto-pokemart': 'Poké Mart',
  'kanto-pokecenter': 'Pokémon Center',
  'sinnoh-pokemart': 'Poké Mart',
  'johto-pokemart': 'Poké Mart',
  'mirage-island': 'Mirage Island',
  'kalos-berry-fields': 'Berry Fields',
}

/** Join official bulk CSV resources without inferring games from generations. */
export function parsePokeApiLocations(csv: Record<string, string>, games: Game[]): Candidate[] {
  const table = (name: string, columns: string[]): CsvRow[] => {
    if (typeof csv[name] !== 'string') throw new Error(`Missing PokéAPI CSV: ${name}`)
    const { headers, rows } = readCsv(csv[name])
    if (columns.some((column) => !headers.includes(column))) {
      throw new Error(`Missing required column in PokéAPI ${name} CSV`)
    }
    return rows
  }
  const regions = indexed(table('regions', ['id', 'identifier']), 'region')
  const versions = indexed(table('versions', ['id', 'version_group_id', 'identifier']), 'version')
  const locations = indexed(table('locations', ['id', 'region_id', 'identifier']), 'location')
  const areas = indexed(
    table('location_areas', ['id', 'location_id', 'game_index', 'identifier']),
    'location area',
  )
  const names = table('location_names', ['location_id', 'local_language_id', 'name', 'subtitle'])
  const encounters = table('encounters', [
    'id',
    'version_id',
    'location_area_id',
    'encounter_slot_id',
    'pokemon_id',
    'min_level',
    'max_level',
  ])

  for (const [name, rows] of [
    ['region', regions],
    ['version', versions],
    ['location', locations],
  ] as const) {
    const identifiers = new Set<string>()
    for (const row of rows.values()) {
      if (!row.identifier.trim() || identifiers.has(row.identifier)) {
        throw new Error(`Missing or duplicate ${name} identifier: ${row.identifier}`)
      }
      identifiers.add(row.identifier)
    }
  }

  const versionByIdentifier = new Map(
    [...versions].map(([id, version]) => [version.identifier, id]),
  )
  const gameByVersion = new Map<number, string>()
  for (const game of games) {
    if (game.type !== 'game' || game.pokeApiGameVersionId === null) continue
    if (!versions.has(game.pokeApiGameVersionId)) {
      throw new Error(
        `Game ${game.id} references missing PokéAPI version ${game.pokeApiGameVersionId}`,
      )
    }
    if (gameByVersion.has(game.pokeApiGameVersionId)) {
      throw new Error(
        `Multiple individual games reference PokéAPI version ${game.pokeApiGameVersionId}`,
      )
    }
    gameByVersion.set(game.pokeApiGameVersionId, game.id)
  }
  for (const [identifier, base] of Object.entries(dlcBaseVersions)) {
    const versionId = versionByIdentifier.get(identifier)
    const baseVersionId = versionByIdentifier.get(base)
    const game = baseVersionId === undefined ? undefined : gameByVersion.get(baseVersionId)
    if (versionId !== undefined && game !== undefined) gameByVersion.set(versionId, game)
  }

  const englishNames = new Map<number, string>()
  for (const row of names) {
    const locationId = positiveId(row.location_id, 'location name location_id')
    if (!locations.has(locationId))
      throw new Error(`Location name references missing location ${locationId}`)
    if (row.local_language_id !== '9') continue
    if (englishNames.has(locationId))
      throw new Error(`Duplicate English name for location ${locationId}`)
    const name = row.name.trim().replace(/\s+/g, ' ')
    if (!name) throw new Error(`Empty English name for location ${locationId}`)
    const subtitle = row.subtitle.trim().replace(/\s+/g, ' ')
    englishNames.set(locationId, subtitle ? `${name} (${subtitle})` : name)
  }

  const parentByArea = new Map<number, number>()
  for (const [areaId, area] of areas) {
    const locationId = positiveId(area.location_id, 'location area location_id')
    if (!locations.has(locationId))
      throw new Error(`Location area ${areaId} references missing location ${locationId}`)
    parentByArea.set(areaId, locationId)
  }
  const gamesByLocation = new Map<number, Set<string>>()
  const encounterIds = new Set<number>()
  for (const encounter of encounters) {
    const id = positiveId(encounter.id, 'encounter id')
    if (encounterIds.has(id)) throw new Error(`Duplicate encounter id: ${id}`)
    encounterIds.add(id)
    const versionId = positiveId(encounter.version_id, 'encounter version_id')
    if (!versions.has(versionId))
      throw new Error(`Encounter ${id} references missing version ${versionId}`)
    const areaId = positiveId(encounter.location_area_id, 'encounter location_area_id')
    const locationId = parentByArea.get(areaId)
    if (locationId === undefined)
      throw new Error(`Encounter ${id} references missing location area ${areaId}`)
    const game = gameByVersion.get(versionId)
    if (game === undefined) continue
    const supportedGames = gamesByLocation.get(locationId) ?? new Set<string>()
    supportedGames.add(game)
    gamesByLocation.set(locationId, supportedGames)
  }

  return [...locations].map(([id, location]) => {
    const name = englishNames.get(id) ?? pokeApiFallbackNames[location.identifier]
    if (!name) throw new Error(`Missing English name for location ${id} (${location.identifier})`)
    const regionId =
      location.region_id === '' ? null : positiveId(location.region_id, 'location region_id')
    const region = regionId === null ? null : regions.get(regionId)?.identifier
    if (region === undefined)
      throw new Error(`Location ${id} references missing region ${regionId}`)
    const supportedGames = gamesByLocation.get(id)
    return {
      source: 'pokeapi',
      sourceId: location.identifier,
      url: `https://pokeapi.co/api/v2/location/${id}/`,
      name,
      region,
      games: games.filter((game) => supportedGames?.has(game.id)).map((game) => game.id),
      pokeApiId: id,
    }
  })
}

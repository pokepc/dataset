import type { Encounter } from '../../lib/types.ts'
import { dlcBaseVersions, parseCsv } from '../locations/pokeapi.ts'
import { excludedPokeApiLocations, pokeApiLocationAliases } from './overrides.ts'

type CsvRow = Record<string, string>
export type EncounterGame = { id: string; type: string; pokeApiGameVersionId: number | null }
export type EncounterLocation = { id: string; pokeApiId: number | null }
export type EncounterPokemon = { id: string; isDefault: boolean; refs?: { pkApiId: string } }

export const encounterCsvFiles = [
  'encounters',
  'encounter_slots',
  'encounter_methods',
  'encounter_condition_value_map',
  'encounter_condition_values',
  'location_areas',
  'versions',
  'pokemon',
] as const

export type Unresolved = {
  reason: 'unmapped-version' | 'unmapped-location' | 'ambiguous-pokemon' | 'unknown-pokemon'
  key: string
  rows: number
}

export type EncounterImport = {
  /** Encounters per dataset Pokémon id, sorted for stable output. */
  encounters: Map<string, Encounter[]>
  rows: number
  importedRows: number
  excludedRows: number
  unresolved: Unresolved[]
}

function table(csv: Record<string, string>, name: string, columns: string[]): CsvRow[] {
  if (typeof csv[name] !== 'string') throw new Error(`Missing PokéAPI CSV: ${name}`)
  const rows = parseCsv(csv[name])
  if (rows.length && columns.some((column) => !(column in rows[0])))
    throw new Error(`Missing required column in PokéAPI ${name} CSV`)
  return rows
}

function byId(rows: CsvRow[]): Map<string, CsvRow> {
  return new Map(rows.map((row) => [row.id, row]))
}

/**
 * Aggregate PokéAPI encounter rows into one entry per game, place, method and condition set,
 * keeping the widest level range. Location areas fold into their parent location.
 *
 * A PokéAPI Pokémon id shared by several dataset records (gender forms, Megas, cosmetic forms)
 * attaches to the default record: PokéAPI does not tell those forms apart in encounters.
 */
export function parsePokeApiEncounters(
  csv: Record<string, string>,
  data: { games: EncounterGame[]; locations: EncounterLocation[]; pokemon: EncounterPokemon[] },
): EncounterImport {
  const versions = byId(table(csv, 'versions', ['id', 'identifier']))
  const areas = byId(table(csv, 'location_areas', ['id', 'location_id']))
  const slots = byId(table(csv, 'encounter_slots', ['id', 'encounter_method_id']))
  const methods = byId(table(csv, 'encounter_methods', ['id', 'identifier', 'order']))
  const conditionValues = byId(table(csv, 'encounter_condition_values', ['id', 'identifier']))
  const apiPokemon = byId(table(csv, 'pokemon', ['id', 'identifier']))
  const conditionsByEncounter = new Map<string, string[]>()
  for (const row of table(csv, 'encounter_condition_value_map', [
    'encounter_id',
    'encounter_condition_value_id',
  ])) {
    const value = conditionValues.get(row.encounter_condition_value_id)
    if (!value)
      throw new Error(`Unknown encounter condition value ${row.encounter_condition_value_id}`)
    const list = conditionsByEncounter.get(row.encounter_id) ?? []
    list.push(value.identifier)
    conditionsByEncounter.set(row.encounter_id, list)
  }

  const gameByVersion = new Map<string, string>()
  for (const game of data.games) {
    if (game.type === 'game' && game.pokeApiGameVersionId !== null)
      gameByVersion.set(String(game.pokeApiGameVersionId), game.id)
  }
  const versionByIdentifier = new Map([...versions.values()].map((v) => [v.identifier, v.id]))
  for (const [identifier, base] of Object.entries(dlcBaseVersions)) {
    const versionId = versionByIdentifier.get(identifier)
    const game = gameByVersion.get(versionByIdentifier.get(base) ?? '')
    if (versionId !== undefined && game !== undefined) gameByVersion.set(versionId, game)
  }
  const gameOrder = new Map(data.games.map((game, index) => [game.id, index]))

  const locationByApiId = new Map<string, string>()
  for (const location of data.locations) {
    if (location.pokeApiId !== null) locationByApiId.set(String(location.pokeApiId), location.id)
  }
  for (const [apiId, alias] of Object.entries(pokeApiLocationAliases)) {
    if (!data.locations.some((location) => location.id === alias.location))
      throw new Error(`Location alias ${apiId} targets unknown location ${alias.location}`)
    locationByApiId.set(apiId, alias.location)
  }

  const recordsByApiId = new Map<string, EncounterPokemon[]>()
  for (const record of data.pokemon) {
    const apiId = record.refs?.pkApiId
    if (!apiId) continue
    recordsByApiId.set(apiId, [...(recordsByApiId.get(apiId) ?? []), record])
  }
  const resolvePokemon = (apiId: string): EncounterPokemon[] => {
    const records = recordsByApiId.get(apiId) ?? []
    return records.length > 1 ? records.filter((record) => record.isDefault) : records
  }

  const unresolved = new Map<string, Unresolved>()
  const miss = (reason: Unresolved['reason'], key: string) => {
    const id = `${reason}:${key}`
    const entry = unresolved.get(id) ?? { reason, key, rows: 0 }
    entry.rows++
    unresolved.set(id, entry)
  }
  const merged = new Map<string, Encounter & { pokemon: string; methodOrder: number }>()
  let rows = 0
  let importedRows = 0
  let excludedRows = 0
  for (const row of table(csv, 'encounters', [
    'id',
    'version_id',
    'location_area_id',
    'encounter_slot_id',
    'pokemon_id',
    'min_level',
    'max_level',
  ])) {
    rows++
    const game = gameByVersion.get(row.version_id)
    if (!game) {
      miss('unmapped-version', versions.get(row.version_id)?.identifier ?? row.version_id)
      continue
    }
    const area = areas.get(row.location_area_id)
    if (!area)
      throw new Error(`Encounter ${row.id} references missing area ${row.location_area_id}`)
    if (area.location_id in excludedPokeApiLocations) {
      excludedRows++
      continue
    }
    const location = locationByApiId.get(area.location_id)
    if (!location) {
      miss('unmapped-location', area.location_id)
      continue
    }
    const records = resolvePokemon(row.pokemon_id)
    const apiName = apiPokemon.get(row.pokemon_id)?.identifier ?? row.pokemon_id
    if (records.length !== 1) {
      miss(records.length ? 'ambiguous-pokemon' : 'unknown-pokemon', apiName)
      continue
    }
    const slot = slots.get(row.encounter_slot_id)
    const method = slot && methods.get(slot.encounter_method_id)
    if (!method) throw new Error(`Encounter ${row.id} has no encounter method`)
    const conditions = [...new Set(conditionsByEncounter.get(row.id) ?? [])].sort()
    const minLevel = Number(row.min_level)
    const maxLevel = Number(row.max_level)
    const pokemon = records[0].id
    const key = [pokemon, game, location, method.identifier, conditions.join('+')].join('|')
    const existing = merged.get(key)
    if (existing) {
      existing.minLevel = Math.min(existing.minLevel, minLevel)
      existing.maxLevel = Math.max(existing.maxLevel, maxLevel)
    } else {
      merged.set(key, {
        pokemon,
        methodOrder: Number(method.order),
        game,
        location,
        method: method.identifier,
        minLevel,
        maxLevel,
        conditions,
        source: 'pokeapi',
      })
    }
    importedRows++
  }

  const sorted = [...merged.values()].sort(
    (a, b) =>
      gameOrder.get(a.game)! - gameOrder.get(b.game)! ||
      (a.location < b.location ? -1 : a.location > b.location ? 1 : 0) ||
      a.methodOrder - b.methodOrder ||
      a.minLevel - b.minLevel ||
      a.maxLevel - b.maxLevel ||
      a.conditions.join('+').localeCompare(b.conditions.join('+')),
  )
  const encounters = new Map<string, Encounter[]>()
  for (const { pokemon, methodOrder: _, ...encounter } of sorted) {
    encounters.set(pokemon, [...(encounters.get(pokemon) ?? []), encounter])
  }
  return {
    encounters: new Map([...encounters].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    rows,
    importedRows,
    excludedRows,
    unresolved: [...unresolved.values()].sort((a, b) => b.rows - a.rows),
  }
}

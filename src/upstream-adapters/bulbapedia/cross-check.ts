import { z } from 'zod'
import { styleText } from 'node:util'
import { fetchPokeApiJson, type PokeApiFetchOptions } from '../pokeapi/client.ts'
import {
  fetchSerebiiEvidence,
  serebiiTargets,
  type SerebiiEvidence,
} from '../serebii/availability-evidence.ts'
import {
  availabilityFields,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityReport,
} from './availability.ts'

const resource = z.object({ name: z.string(), url: z.string().url() })
const encounterSchema = z.array(
  z.object({
    location_area: resource,
    version_details: z.array(
      z.object({
        version: resource,
        encounter_details: z.array(
          z.object({
            method: resource,
            condition_values: z.array(resource),
          }),
        ),
      }),
    ),
  }),
)

type EncounterData = {
  gameId: string
  versionId: number
  version: string
  location: string
  methods: { name: string; conditions: string[] }[]
}
export type PokeApiEncounter = EncounterData & {
  formScope: 'selected-form' | 'form-ambiguous'
  formReason: string
}
export type AvailabilityCrossChecks = {
  pokeApi: {
    url: string | null
    status: 'checked' | 'unavailable' | 'unmapped'
    encounters: PokeApiEncounter[]
  }
  serebii: SerebiiEvidence[]
  conflicts: { id: string; gameId: string; message: string; evidence: string }[]
  unresolvedConflictIds: string[]
  warnings: string[]
}

// Paired DLC versions have no one-to-one local version ID; resolve their explicit
// version name to one parent. Never apply a version-group encounter to both games.
const dlcVersions: Record<string, { dlc: string; game: string }> = {
  'the-isle-of-armor-sword': { dlc: 'swsh-islearmor', game: 'swsh-sw' },
  'the-isle-of-armor-shield': { dlc: 'swsh-islearmor', game: 'swsh-sh' },
  'the-crown-tundra-sword': { dlc: 'swsh-crowntundra', game: 'swsh-sw' },
  'the-crown-tundra-shield': { dlc: 'swsh-crowntundra', game: 'swsh-sh' },
  'the-teal-mask-scarlet': { dlc: 'sv-tealmask', game: 'sv-s' },
  'the-teal-mask-violet': { dlc: 'sv-tealmask', game: 'sv-v' },
  'the-indigo-disk-scarlet': { dlc: 'sv-indigodisk', game: 'sv-s' },
  'the-indigo-disk-violet': { dlc: 'sv-indigodisk', game: 'sv-v' },
}

export function parsePokeApiEncounters(value: unknown, games: AvailabilityGame[]) {
  const encounters: EncounterData[] = []
  const unmapped = new Set<string>()
  for (const area of encounterSchema.parse(value)) {
    for (const version of area.version_details) {
      const url = new URL(version.version.url)
      const match =
        url.origin === 'https://pokeapi.co' && /^\/api\/v2\/version\/(\d+)\/$/.exec(url.pathname)
      if (!match) throw new Error('PokéAPI encounter has an invalid version reference.')
      const versionId = Number(match[1])
      const matches = games.filter(
        (game) => game.type === 'game' && game.pokeApiGameVersionId === versionId,
      )
      const dlc = dlcVersions[version.version.name]
      if (
        !matches.length &&
        dlc &&
        games.some((game) => game.id === dlc.dlc && game.type === 'dlc')
      ) {
        const parent = games.find((game) => game.id === dlc.game && game.type === 'game')
        if (parent) matches.push(parent)
      }
      if (!matches.length) unmapped.add(version.version.name)
      if (matches.length > 1)
        throw new Error(`Ambiguous dataset mapping for PokéAPI version ${versionId}.`)
      for (const game of matches) {
        if (!version.encounter_details.length) continue
        encounters.push({
          gameId: game.id,
          versionId,
          version: version.version.name,
          location: area.location_area.name,
          methods: version.encounter_details.map((entry) => ({
            name: entry.method.name,
            conditions: entry.condition_values.map((condition) => condition.name),
          })),
        })
      }
    }
  }
  return { encounters, unmapped: [...unmapped] }
}

function scopeEncounter(
  encounter: EncounterData,
  pokemon: AvailabilityPokemon,
  siblings: AvailabilityPokemon[],
  games: AvailabilityGame[],
): PokeApiEncounter {
  let reason: string | undefined
  if (pokemon.isBattleOnlyForm) {
    reason = 'Species encounters do not independently establish a battle-only form.'
  } else if (
    !pokemon.isDefault &&
    !pokemon.isFemaleForm &&
    siblings.some((other) => other.id !== pokemon.id && other.refs.pkApiId === pokemon.refs.pkApiId)
  ) {
    reason = 'PokéAPI ID is shared with other forms; the encounter does not identify this form.'
  } else if (pokemon.isDefault || (pokemon.isFemaleForm && !pokemon.isRegional)) {
    const game = games.find((entry) => entry.id === encounter.gameId)!
    const regionalForms = siblings.filter(
      (other) =>
        other.dexNum === pokemon.dexNum &&
        other.isRegional &&
        !other.isBattleOnlyForm &&
        other.gen <= game.gen,
    )
    if (regionalForms.length) {
      reason = `Base-endpoint encounter has no form qualifier; regional forms existed by this game's generation (${regionalForms.map((form) => form.id).join(', ')}).`
    }
  }
  return {
    ...encounter,
    formScope: reason ? 'form-ambiguous' : 'selected-form',
    formReason:
      reason ??
      'The mapped endpoint identifies the selected form without known regional ambiguity in this generation.',
  }
}

type CrossCheckOptions = {
  pokeApi?: PokeApiFetchOptions
  serebii?: { cacheDir?: string; forceRefresh?: boolean }
}

/** One collector per CLI run: failures and successful URLs are shared across forms. */
export function createAvailabilityCrossChecker(options: CrossCheckOptions = {}) {
  const pokeRequests = new Map<string, Promise<unknown>>()
  const serebiiRequests = new Map<string, Promise<SerebiiEvidence>>()
  return async function crossCheck(
    report: AvailabilityReport,
    games: AvailabilityGame[],
    siblings: AvailabilityPokemon[],
    signal?: AbortSignal,
  ): Promise<AvailabilityReport> {
    signal?.throwIfAborted()
    const pokemon = report.pokemon
    const pkApiId = pokemon.refs.pkApiId
    const evidence: AvailabilityCrossChecks = {
      pokeApi: { url: null, status: 'unmapped', encounters: [] },
      serebii: [],
      conflicts: [],
      unresolvedConflictIds: [],
      warnings: [],
    }
    if (/^[1-9]\d*$/.test(pkApiId)) {
      const path = `pokemon/${pkApiId}/encounters`
      evidence.pokeApi.url = `https://pokeapi.co/api/v2/${path}/`
      try {
        let request = pokeRequests.get(path)
        if (!request) {
          request = fetchPokeApiJson(path, {
            retries: 2,
            minIntervalMs: 500,
            ...options.pokeApi,
            signal,
          })
          pokeRequests.set(path, request)
        }
        const response = await request
        signal?.throwIfAborted()
        const parsed = parsePokeApiEncounters(response, games)
        evidence.pokeApi.status = 'checked'
        evidence.pokeApi.encounters = parsed.encounters.map((encounter) =>
          scopeEncounter(encounter, pokemon, siblings, games),
        )
        if (parsed.unmapped.length)
          evidence.warnings.push(
            `PokéAPI versions without dataset mapping: ${parsed.unmapped.join(', ')}.`,
          )
      } catch (error) {
        signal?.throwIfAborted()
        evidence.pokeApi.status = 'unavailable'
        evidence.warnings.push(
          `PokéAPI cross-check unavailable: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    } else evidence.warnings.push('No exact Pokémon PokéAPI ID; encounter cross-check skipped.')
    for (const row of report.rows) {
      if (row.basis === 'rule' || row.status === 'obtainableIn') continue
      const encounters = evidence.pokeApi.encounters.filter(
        (entry) => entry.gameId === row.game.id && entry.formScope === 'selected-form',
      )
      if (!encounters.length) continue
      evidence.conflicts.push({
        id: `pokeapi:${row.game.id}`,
        gameId: row.game.id,
        message: `PokéAPI records encounters but the Bulbapedia candidate is ${row.status}.`,
        evidence: encounters
          .map(
            (entry) =>
              `${entry.version}: ${entry.location} (${entry.methods.map((method) => `${method.name}${method.conditions.length ? `; ${method.conditions.join(', ')}` : ''}`).join(' / ')})`,
          )
          .join('; '),
      })
    }
    evidence.unresolvedConflictIds = evidence.conflicts.map((conflict) => conflict.id)
    const targets = new Set(evidence.conflicts.map((conflict) => conflict.gameId))
    for (const row of report.rows) {
      // Unqualified species rows before this form existed are expected, not useful
      // Serebii targets. Actual encounter contradictions above still get priority.
      if (row.basis === 'rule' || row.game.gen < (pokemon.isFemaleForm ? 2 : pokemon.gen)) continue
      const changed = availabilityFields.some(
        (field) => pokemon[field].includes(row.game.id) !== (row.status === field),
      )
      if (
        row.methods.some((method) => method.status === 'unknown') ||
        (changed && row.status !== 'obtainableIn')
      )
        targets.add(row.game.id)
    }
    const conflictingGames = new Set(evidence.conflicts.map((conflict) => conflict.gameId))
    let pages: ReturnType<typeof serebiiTargets> = []
    try {
      pages = serebiiTargets(pokemon, games, [...targets])
    } catch (error) {
      evidence.warnings.push(
        `Serebii target mapping unavailable: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    pages.sort(
      (a, b) =>
        Number(b.gameIds.some((id) => conflictingGames.has(id))) -
        Number(a.gameIds.some((id) => conflictingGames.has(id))),
    )
    const selectedPages = pages.slice(0, 3)
    const covered = new Set(selectedPages.flatMap((page) => page.gameIds))
    const uncovered = [...targets].filter((id) => !covered.has(id))
    if (uncovered.length)
      evidence.warnings.push(
        `No targeted Serebii evidence for ${uncovered.join(', ')} (unsupported page or three-page request limit).`,
      )
    for (const target of selectedPages) {
      signal?.throwIfAborted()
      try {
        let request = serebiiRequests.get(target.url)
        if (!request) {
          request = fetchSerebiiEvidence(target, pokemon, { ...options.serebii, signal })
          serebiiRequests.set(target.url, request)
        }
        evidence.serebii.push({ ...(await request), gameIds: target.gameIds })
      } catch (error) {
        signal?.throwIfAborted()
        evidence.warnings.push(
          `Serebii evidence unavailable for ${target.gameIds.join(', ')}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    signal?.throwIfAborted()
    return { ...report, crossChecks: evidence }
  }
}

export function formatCrossChecks(
  report: AvailabilityReport,
  stream: NodeJS.WritableStream = process.stdout,
): string {
  const checks = report.crossChecks
  if (!checks) return ''
  const ambiguous = new Map(
    checks.pokeApi.encounters
      .filter((entry) => entry.formScope === 'form-ambiguous')
      .map((entry) => [entry.gameId, entry.formReason]),
  )
  return [
    `Cross-check: PokéAPI ${checks.pokeApi.status} (${checks.pokeApi.encounters.length} mapped encounter records); ${checks.serebii.length} targeted Serebii pages.`,
    ...[...ambiguous].map(([gameId, reason]) =>
      styleText(
        'yellow',
        `Limitation (${gameId}): ${reason} Context only; not a source conflict.`,
        { stream },
      ),
    ),
    ...checks.conflicts
      .filter((conflict) => checks.unresolvedConflictIds.includes(conflict.id))
      .map((conflict) =>
        styleText(
          'yellow',
          `Uncertain (${conflict.gameId}): ${conflict.message} ${conflict.evidence}`,
          { stream },
        ),
      ),
    ...checks.warnings.map((warning) => styleText('yellow', `Warning: ${warning}`, { stream })),
  ].join('\n')
}

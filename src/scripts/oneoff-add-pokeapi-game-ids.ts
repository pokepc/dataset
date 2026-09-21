import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { format } from 'oxfmt'
import { z } from 'zod'
import { gameSchema } from '../lib/schemas'
import { resolveDatasetDirectory } from '../utils/dataset-directory'
import { fetchPokeApiJson, type PokeApiFetchOptions } from '../upstream-adapters/pokeapi/client'

const resourceSchema = z.object({ name: z.string().min(1), url: z.url() })
const groupSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  versions: z.array(resourceSchema).min(1),
})
type VersionGroup = z.infer<typeof groupSchema>
type GameIdentity = Pick<Pkds.Game, 'id' | 'nameSlug' | 'type'>
type GameReferences = Pick<Pkds.Game, 'pokeApiGameVersionId' | 'pokeApiGameVersionGroupId'>

// Only naming differences are overridden. Numeric IDs always come from PokéAPI.
const upstreamNames: Record<string, string> = {
  xd: 'xd',
  b2w2: 'black-2-white-2',
  'b2w2-b2': 'black-2',
  'b2w2-w2': 'white-2',
  lgpe: 'lets-go-pikachu-lets-go-eevee',
  'lgpe-lgp': 'lets-go-pikachu',
  'lgpe-lge': 'lets-go-eevee',
  'lza-megadimension': 'mega-dimension',
}

function resourceId(url: string, kind: 'version' | 'version-group'): number {
  const match = new URL(url).pathname.match(new RegExp(`^/api/v2/${kind}/([1-9]\\d*)/?$`))
  if (!match || !Number.isSafeInteger(Number(match[1])))
    throw new Error(`Invalid PokéAPI ${kind} URL: ${url}`)
  return Number(match[1])
}

export async function fetchVersionGroups(
  options: PokeApiFetchOptions = {},
): Promise<VersionGroup[]> {
  const base = (options.baseUrl ?? 'https://pokeapi.co/api/v2').replace(/\/+$/, '')
  const list = z
    .object({
      count: z.number().int().positive(),
      results: z.array(resourceSchema).min(1),
    })
    .parse(await fetchPokeApiJson(new URL(`${base}/version-group/?limit=200`), options))
  if (list.results.length !== list.count)
    throw new Error('PokéAPI returned an incomplete version-group index; no files were changed.')
  const groups: VersionGroup[] = []
  for (let offset = 0; offset < list.results.length; offset += 4) {
    const batch = await Promise.all(
      list.results.slice(offset, offset + 4).map(async (entry) => {
        const id = resourceId(entry.url, 'version-group')
        const group = groupSchema.parse(await fetchPokeApiJson(`version-group/${id}`, options))
        if (group.id !== id || group.name !== entry.name)
          throw new Error(`PokéAPI version-group identity mismatch for ${entry.name}.`)
        return group
      }),
    )
    groups.push(...batch)
    console.log(`Loaded ${groups.length}/${list.count} PokéAPI version groups.`)
  }
  return groups
}

export function createGameReferenceMapper(
  groups: VersionGroup[],
): (game: GameIdentity) => GameReferences {
  const groupIds = new Set<number>()
  const groupsByName = new Map<string, number>()
  const versionIds = new Set<number>()
  const versionsByName = new Map<string, GameReferences>()
  if (!groups.length) throw new Error('No PokéAPI version groups supplied.')
  for (const input of groups) {
    const group = groupSchema.parse(input)
    if (groupIds.has(group.id) || groupsByName.has(group.name))
      throw new Error(`Duplicate PokéAPI version group: ${group.name}.`)
    groupIds.add(group.id)
    groupsByName.set(group.name, group.id)
    for (const version of group.versions) {
      const id = resourceId(version.url, 'version')
      if (versionIds.has(id) || versionsByName.has(version.name))
        throw new Error(`Duplicate PokéAPI version: ${version.name}.`)
      versionIds.add(id)
      versionsByName.set(version.name, {
        pokeApiGameVersionId: id,
        pokeApiGameVersionGroupId: group.id,
      })
    }
  }
  return (game) => {
    const empty = { pokeApiGameVersionId: null, pokeApiGameVersionGroupId: null }
    if (game.type === 'superset') return empty
    const name = upstreamNames[game.id] ?? game.nameSlug
    const version = versionsByName.get(name)
    if (game.type !== 'set' && version) return { ...version }
    return { ...empty, pokeApiGameVersionGroupId: groupsByName.get(name) ?? null }
  }
}

export async function addGameReferences(
  dataDirectory: string,
  groups: VersionGroup[],
  write = false,
): Promise<{ changed: number; mappings: ({ id: string } & GameReferences)[] }> {
  const mapReferences = createGameReferenceMapper(groups)
  const ids = z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .parse(JSON.parse(await readFile(resolve(dataDirectory, 'indices/games.json'), 'utf8')))
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate IDs in the local games index.')
  const config = JSON.parse(await readFile(new URL('../../.oxfmtrc.json', import.meta.url), 'utf8'))
  const plans = []
  // Validate and format the complete batch before the first write.
  for (const id of ids) {
    const file = resolve(dataDirectory, 'games', `${id}.json`)
    const original = await readFile(file, 'utf8')
    const current = JSON.parse(original)
    if (current.id !== id) throw new Error(`Game identity does not match its filename: ${file}`)
    const references = mapReferences(current)
    for (const [field, value] of Object.entries(references)) {
      if (current[field] != null && current[field] !== value)
        throw new Error(
          `Conflicting ${field} for ${id}: ${current[field]} -> ${value}. Review manually.`,
        )
    }
    const candidate = { ...current, ...references }
    gameSchema.parse(candidate)
    const formatted = await format(file, JSON.stringify(candidate, null, 2), config)
    if (formatted.errors.length)
      throw new Error(
        `Could not format ${id}: ${formatted.errors.map((error) => error.message).join('; ')}`,
      )
    plans.push({ id, references, file, original, formatted: formatted.code })
  }
  const changes = plans.filter((plan) => plan.formatted !== plan.original)
  if (write) {
    for (const plan of plans) {
      if ((await readFile(plan.file, 'utf8')) !== plan.original)
        throw new Error(`Game changed during lookup: ${plan.id}. Run the script again.`)
    }
    for (const plan of changes) await writeFile(plan.file, plan.formatted)
  }
  return {
    changed: changes.length,
    mappings: plans.map(({ id, references }) => ({ id, ...references })),
  }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args: args.filter((arg, index) => !(index === 0 && arg === '--')),
    options: {
      write: { type: 'boolean' },
      refresh: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(`Usage: pnpm games:pokeapi-ids [--write] [--refresh]

Populate pokeApiGameVersionId and pokeApiGameVersionGroupId from PokéAPI.
Without --write, preview only. --write validates and formats every game before saving.
--refresh bypasses the existing PokéAPI cache. Unmapped or grouped resources use null.
Existing non-null IDs are never silently replaced with conflicting values.
POKEPC_DATASET_DIR can select another dataset directory.`)
    return
  }
  const dataDirectory = resolveDatasetDirectory(import.meta.url, process.env.POKEPC_DATASET_DIR)
  console.log('Loading PokéAPI game metadata…')
  const groups = await fetchVersionGroups({ forceRefresh: values.refresh })
  const result = await addGameReferences(dataDirectory, groups, values.write)
  for (const { id, pokeApiGameVersionId, pokeApiGameVersionGroupId } of result.mappings)
    console.log(
      `${id}: version=${pokeApiGameVersionId ?? 'null'}, group=${pokeApiGameVersionGroupId ?? 'null'}`,
    )
  console.log(
    `${values.write ? 'Updated and formatted' : 'Would update'} ${result.changed}/${result.mappings.length} game files.`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

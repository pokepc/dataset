import { z } from 'zod'
import { createDocument } from 'zod-openapi'
import type {
  ZodOpenApiOperationObject,
  ZodOpenApiPathsObject,
  ZodOpenApiResponseObject,
} from 'zod-openapi'
import { moddableKinds, textFileSchemas, type ModdableKind, type TextKind } from '../lib/schemas.ts'
import { rootArrayRoutes, type StaticDataRoute } from './manifest.ts'
import {
  AbilityListSchema,
  BattleStateListSchema,
  BoxPresetTextSchema,
  ClassicBoxPresetMapSchema,
  CodeMapKindParamSchema,
  CodeMapSchema,
  ErrorResponseSchema,
  GameIdParamSchema,
  GameSchema,
  GameSetParamSchema,
  ItemListSchema,
  LocaleParamSchema,
  ModdedGameSetParamSchema,
  ModernBoxPresetIndexSchema,
  ModernBoxPresetSchema,
  MoveListSchema,
  OverrideSchemas,
  PokedexIdParamSchema,
  PokedexSchema,
  PokemonIdParamSchema,
  PokemonMugshotMetadataSchema,
  PokemonSchema,
  PresetIdParamSchema,
  RosterSchema,
  StringIndexSchema,
  TextFileSchemas,
  TextOverrideFileSchemas,
} from './schemas.ts'

export type StaticApiDocumentOptions = {
  serverUrl?: string
  version: string
}

/** Where the v7 to v8 migration guide is published (task-13). */
export const MIGRATION_GUIDE_URL =
  'https://github.com/pokepc/dataset/blob/main/docs/migrating-to-v8.md'

function jsonResponse(schema: z.ZodType, description: string): ZodOpenApiResponseObject {
  return { description, content: { 'application/json': { schema } } }
}

function notFoundResponse(description: string): ZodOpenApiResponseObject {
  return jsonResponse(ErrorResponseSchema, description)
}

type FileRoute = {
  operationId: string
  summary: string
  description: string
  tags: string[]
  schema: z.ZodType
  params?: z.ZodObject
  /** Response for paths with parameters that may not match a file. */
  notFound?: string
}

function fileOperation(route: FileRoute): ZodOpenApiOperationObject {
  return {
    operationId: route.operationId,
    summary: route.summary,
    description: route.description,
    tags: route.tags,
    ...(route.params ? { requestParams: { path: route.params } } : {}),
    responses: {
      '200': jsonResponse(route.schema, 'Static JSON file.'),
      ...(route.notFound ? { '404': notFoundResponse(route.notFound) } : {}),
    },
  }
}

function staticFileOperation(route: StaticDataRoute): ZodOpenApiOperationObject {
  return fileOperation(route)
}

const pascal = (kind: string) =>
  kind
    .split('-')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')

/** Merged collection schemas of moddable kinds (Pokémon are one file per id). */
const mergedListSchemas: Record<Exclude<ModdableKind, 'pokemon'>, z.ZodType> = {
  moves: MoveListSchema,
  abilities: AbilityListSchema,
  items: ItemListSchema,
  'battle-states': BattleStateListSchema,
}

export function createStaticApiDocument(options: StaticApiDocumentOptions) {
  const serverUrl = options.serverUrl ?? '.'
  const paths: ZodOpenApiPathsObject = {}
  const add = (path: string, route: FileRoute) => {
    paths[path] = { get: fileOperation(route) }
  }

  // ---- Base data at the root
  for (const route of rootArrayRoutes) paths[route.path] = { get: staticFileOperation(route) }

  for (const [kind, label] of [
    ['pokemon', 'Pokemon'],
    ['games', 'game'],
    ['pokedexes', 'Pokedex'],
  ] as const) {
    add(`/indices/${kind}.json`, {
      operationId: `get${pascal(kind)}Index`,
      summary: `List ${label} IDs`,
      description: `Ordered index of ${label} JSON file IDs.`,
      tags: ['Indices'],
      schema: StringIndexSchema,
    })
  }

  add('/pokemon/{pokemonId}.json', {
    operationId: 'getPokemon',
    summary: 'Get a Pokemon file',
    description: 'Base Pokemon record, without text (see `/i18n/{locale}/pokemon.json`).',
    tags: ['Pokemon'],
    params: z.object({ pokemonId: PokemonIdParamSchema }),
    schema: PokemonSchema,
    notFound: 'Static Pokemon file not found.',
  })
  add('/games/{gameId}.json', {
    operationId: 'getGame',
    summary: 'Get a game file',
    description:
      'Game, version, set or DLC record. Resolve a version or DLC to its game set through `gameSet`.',
    tags: ['Games'],
    params: z.object({ gameId: GameIdParamSchema }),
    schema: GameSchema,
    notFound: 'Static game file not found.',
  })
  add('/pokedexes/{pokedexId}.json', {
    operationId: 'getPokedex',
    summary: 'Get a Pokedex file',
    description: 'Base Pokedex record, without text (see `/i18n/{locale}/pokedexes.json`).',
    tags: ['Pokedexes'],
    params: z.object({ pokedexId: PokedexIdParamSchema }),
    schema: PokedexSchema,
    notFound: 'Static Pokedex file not found.',
  })
  add('/boxpresets/classic/{gameSet}.json', {
    operationId: 'getClassicBoxPresetMap',
    summary: 'Get classic box presets for a game set',
    description: 'Classic box presets keyed by preset ID.',
    tags: ['Box presets'],
    params: z.object({ gameSet: GameSetParamSchema }),
    schema: ClassicBoxPresetMapSchema,
    notFound: 'Static classic box preset file not found.',
  })
  add('/boxpresets/modern/{gameSet}.json', {
    operationId: 'getModernBoxPresetIndex',
    summary: 'List modern box preset IDs for a game set',
    description: 'Modern box preset IDs in display order.',
    tags: ['Box presets'],
    params: z.object({ gameSet: GameSetParamSchema }),
    schema: ModernBoxPresetIndexSchema,
    notFound: 'Static modern box preset index file not found.',
  })
  add('/boxpresets/modern/{gameSet}/{presetId}.json', {
    operationId: 'getModernBoxPreset',
    summary: 'Get a modern box preset',
    description: 'Modern box preset selected by game set ID and preset ID.',
    tags: ['Box presets'],
    params: z.object({ gameSet: GameSetParamSchema, presetId: PresetIdParamSchema }),
    schema: ModernBoxPresetSchema,
    notFound: 'Static modern box preset file not found.',
  })
  add('/metadata/pokemon-mugshots.json', {
    operationId: 'getPokemonMugshotMetadata',
    summary: 'Get Pokemon mugshot metadata',
    description: 'Static Pokemon mugshot display metadata keyed by Pokemon ID.',
    tags: ['Metadata'],
    schema: PokemonMugshotMetadataSchema,
  })
  add('/codes/{kind}.json', {
    operationId: 'getCodeMap',
    summary: 'Get a code map',
    description: 'Append-only integer codes for stored ids. Codes never change meaning.',
    tags: ['Metadata'],
    params: z.object({ kind: CodeMapKindParamSchema }),
    schema: CodeMapSchema,
  })

  // ---- Text per locale
  for (const kind of Object.keys(textFileSchemas) as TextKind[]) {
    add(`/i18n/{locale}/${kind}.json`, {
      operationId: `get${pascal(kind)}Text`,
      summary: `Get ${kind} text for a locale`,
      description: `Text of ${kind} keyed by id. Missing translations are omitted, never filled from another locale.`,
      tags: ['Text'],
      params: z.object({ locale: LocaleParamSchema }),
      schema: TextFileSchemas[kind],
      notFound: 'No text of this kind for the locale.',
    })
  }
  add('/i18n/{locale}/boxpresets/{variant}/{gameSet}.json', {
    operationId: 'getBoxPresetText',
    summary: 'Get box preset text',
    description: 'Box preset names, descriptions and box titles keyed by preset ID.',
    tags: ['Text'],
    params: z.object({
      locale: LocaleParamSchema,
      variant: z.enum(['classic', 'modern']),
      gameSet: GameSetParamSchema,
    }),
    schema: BoxPresetTextSchema,
    notFound: 'No box preset text for this locale and game set.',
  })
  paths['/i18n/{locale}/pokemon-prose/{pokemonId}.md'] = {
    get: {
      operationId: 'getPokemonProse',
      summary: 'Get Pokemon prose',
      description: 'Game-independent species prose (Markdown), where written for the locale.',
      tags: ['Text'],
      requestParams: {
        path: z.object({ locale: LocaleParamSchema, pokemonId: PokemonIdParamSchema }),
      },
      responses: {
        '200': {
          description: 'Markdown file.',
          content: { 'text/markdown': { schema: z.string() } },
        },
        '404': notFoundResponse('No prose for this Pokemon and locale.'),
      },
    },
  }

  // ---- Game set mods (as stored) and merged data
  const set = z.object({ gameSet: ModdedGameSetParamSchema })
  add('/mods/{gameSet}/roster.json', {
    operationId: 'getGameSetRoster',
    summary: 'Get a game set roster',
    description: 'Ids of each kind the game set contains; also lists what its merged folder holds.',
    tags: ['Game sets'],
    params: set,
    schema: RosterSchema,
    notFound: 'The game set has no mods.',
  })
  add('/mods/{gameSet}/pokemon/{pokemonId}.json', {
    operationId: 'getPokemonOverride',
    summary: 'Get a Pokemon override',
    description: 'Sparse override of a base Pokemon in the game set (`$unset` removes properties).',
    tags: ['Game sets'],
    params: set.extend({ pokemonId: PokemonIdParamSchema }),
    schema: OverrideSchemas.pokemon,
    notFound: 'The Pokemon has no override in this game set.',
  })
  for (const kind of moddableKinds.filter((kind) => kind !== 'pokemon')) {
    add(`/mods/{gameSet}/${kind}.json`, {
      operationId: `get${pascal(kind)}Overrides`,
      summary: `Get ${kind} overrides`,
      description: `Sparse overrides of base ${kind} in the game set.`,
      tags: ['Game sets'],
      params: set,
      schema: z.array(OverrideSchemas[kind]),
      notFound: `The game set does not override ${kind}.`,
    })
  }
  for (const kind of moddableKinds) {
    add(`/mods/{gameSet}/i18n/{locale}/${kind}.json`, {
      operationId: `get${pascal(kind)}TextOverrides`,
      summary: `Get ${kind} text overrides`,
      description: `Text of ${kind} that differs in the game set.`,
      tags: ['Game sets'],
      params: set.extend({ locale: LocaleParamSchema }),
      schema: TextOverrideFileSchemas[kind],
      notFound: 'No text overrides of this kind.',
    })
  }

  add('/games/{gameSet}/pokemon/{pokemonId}.json', {
    operationId: 'getMergedPokemon',
    summary: 'Get a Pokemon as a game set has it',
    description:
      'Base record with the game set overrides applied (`mergeGameSet` in `@pokepc/dataset/lib/merge`). Only Pokemon in the roster exist.',
    tags: ['Merged game sets'],
    params: set.extend({ pokemonId: PokemonIdParamSchema }),
    schema: PokemonSchema,
    notFound: 'The Pokemon is not in this game set, or the set has no mods.',
  })
  for (const kind of moddableKinds.filter((kind) => kind !== 'pokemon')) {
    add(`/games/{gameSet}/${kind}.json`, {
      operationId: `getMerged${pascal(kind)}`,
      summary: `List ${kind} as a game set has them`,
      description: `The game set's ${kind}, in base order, with overrides applied.`,
      tags: ['Merged game sets'],
      params: set,
      schema: mergedListSchemas[kind],
      notFound: 'The game set has no mods.',
    })
  }
  for (const kind of moddableKinds) {
    add(`/games/{gameSet}/i18n/{locale}/${kind}.json`, {
      operationId: `getMerged${pascal(kind)}Text`,
      summary: `Get ${kind} text as a game set has it`,
      description: `Base text of the set's ${kind} with the set's text applied. Missing translations are omitted.`,
      tags: ['Merged game sets'],
      params: set.extend({ locale: LocaleParamSchema }),
      schema: TextFileSchemas[kind],
      notFound: 'No text of this kind for the game set and locale.',
    })
  }

  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'PokePC Dataset Static API',
      version: options.version,
      description: [
        'Static JSON API for the PokePC dataset (v8 layout).',
        '',
        'Base records are at the root and hold no text; text lives in `/i18n/{locale}/`. Game sets with mods also publish merged data under `/games/{gameSet}/`; every other set uses base data.',
        '',
        `Migrating from v7: ${MIGRATION_GUIDE_URL}`,
      ].join('\n'),
    },
    servers: [{ url: serverUrl, description: 'Static dataset host.' }],
    tags: [
      { name: 'Root data' },
      { name: 'Indices' },
      { name: 'Pokemon' },
      { name: 'Games' },
      { name: 'Pokedexes' },
      { name: 'Box presets' },
      { name: 'Metadata' },
      { name: 'Text' },
      { name: 'Game sets' },
      { name: 'Merged game sets' },
    ],
    paths,
  })
}

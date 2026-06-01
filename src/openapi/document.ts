import { z } from 'zod'
import { createDocument } from 'zod-openapi'
import type {
  ZodOpenApiOperationObject,
  ZodOpenApiPathsObject,
  ZodOpenApiResponseObject,
} from 'zod-openapi'
import { rootArrayRoutes, type StaticDataRoute } from './manifest.ts'
import {
  ClassicBoxPresetMapSchema,
  ErrorResponseSchema,
  GameIdParamSchema,
  GameSchema,
  GameSetParamSchema,
  ModernBoxPresetIndexSchema,
  ModernBoxPresetSchema,
  PokedexIdParamSchema,
  PokedexSchema,
  PokemonIdParamSchema,
  PokemonMugshotMetadataSchema,
  PokemonSchema,
  PresetIdParamSchema,
  StringIndexSchema,
} from './schemas.ts'

export type StaticApiDocumentOptions = {
  serverUrl?: string
  version: string
}

function jsonResponse(schema: z.ZodType, description: string): ZodOpenApiResponseObject {
  return {
    description,
    content: {
      'application/json': {
        schema,
      },
    },
  }
}

function notFoundResponse(description: string): ZodOpenApiResponseObject {
  return jsonResponse(ErrorResponseSchema, description)
}

function staticFileOperation(route: StaticDataRoute): ZodOpenApiOperationObject {
  return {
    operationId: route.operationId,
    summary: route.summary,
    description: route.description,
    tags: route.tags,
    responses: {
      '200': jsonResponse(route.schema, 'Static JSON file.'),
    },
  }
}

function addRootArrayRoutes(paths: ZodOpenApiPathsObject) {
  for (const route of rootArrayRoutes) {
    paths[route.path] = {
      get: staticFileOperation(route),
    }
  }
}

export function createStaticApiDocument(options: StaticApiDocumentOptions) {
  const serverUrl = options.serverUrl ?? '.'
  const paths: ZodOpenApiPathsObject = {}

  addRootArrayRoutes(paths)

  paths['/data/indices/pokemon.json'] = {
    get: {
      operationId: 'getPokemonIndex',
      summary: 'List Pokemon IDs',
      description: 'Ordered index of Pokemon JSON file IDs.',
      tags: ['Indices'],
      responses: {
        '200': jsonResponse(StringIndexSchema, 'Ordered Pokemon ID index.'),
      },
    },
  }

  paths['/data/indices/games.json'] = {
    get: {
      operationId: 'getGamesIndex',
      summary: 'List game IDs',
      description: 'Ordered index of game JSON file IDs.',
      tags: ['Indices'],
      responses: {
        '200': jsonResponse(StringIndexSchema, 'Ordered game ID index.'),
      },
    },
  }

  paths['/data/indices/pokedexes.json'] = {
    get: {
      operationId: 'getPokedexesIndex',
      summary: 'List Pokedex IDs',
      description: 'Ordered index of Pokedex JSON file IDs.',
      tags: ['Indices'],
      responses: {
        '200': jsonResponse(StringIndexSchema, 'Ordered Pokedex ID index.'),
      },
    },
  }

  paths['/data/pokemon/{pokemonId}.json'] = {
    get: {
      operationId: 'getPokemon',
      summary: 'Get a Pokemon file',
      description: 'Static Pokemon JSON file selected by Pokemon ID.',
      tags: ['Pokemon'],
      requestParams: {
        path: z.object({ pokemonId: PokemonIdParamSchema }),
      },
      responses: {
        '200': jsonResponse(PokemonSchema, 'Pokemon JSON file.'),
        '404': notFoundResponse('Static Pokemon file not found.'),
      },
    },
  }

  paths['/data/games/{gameId}.json'] = {
    get: {
      operationId: 'getGame',
      summary: 'Get a game file',
      description: 'Static game JSON file selected by game ID.',
      tags: ['Games'],
      requestParams: {
        path: z.object({ gameId: GameIdParamSchema }),
      },
      responses: {
        '200': jsonResponse(GameSchema, 'Game JSON file.'),
        '404': notFoundResponse('Static game file not found.'),
      },
    },
  }

  paths['/data/pokedexes/{pokedexId}.json'] = {
    get: {
      operationId: 'getPokedex',
      summary: 'Get a Pokedex file',
      description: 'Static Pokedex JSON file selected by Pokedex ID.',
      tags: ['Pokedexes'],
      requestParams: {
        path: z.object({ pokedexId: PokedexIdParamSchema }),
      },
      responses: {
        '200': jsonResponse(PokedexSchema, 'Pokedex JSON file.'),
        '404': notFoundResponse('Static Pokedex file not found.'),
      },
    },
  }

  paths['/data/boxpresets/classic/{gameSet}.json'] = {
    get: {
      operationId: 'getClassicBoxPresetMap',
      summary: 'Get classic box presets for a game set',
      description: 'Static classic box preset map selected by game set ID.',
      tags: ['Box presets'],
      requestParams: {
        path: z.object({ gameSet: GameSetParamSchema }),
      },
      responses: {
        '200': jsonResponse(ClassicBoxPresetMapSchema, 'Classic box preset map.'),
        '404': notFoundResponse('Static classic box preset file not found.'),
      },
    },
  }

  paths['/data/boxpresets/modern/{gameSet}.json'] = {
    get: {
      operationId: 'getModernBoxPresetIndex',
      summary: 'List modern box preset IDs for a game set',
      description: 'Static modern box preset index selected by game set ID.',
      tags: ['Box presets'],
      requestParams: {
        path: z.object({ gameSet: GameSetParamSchema }),
      },
      responses: {
        '200': jsonResponse(ModernBoxPresetIndexSchema, 'Modern box preset ID index.'),
        '404': notFoundResponse('Static modern box preset index file not found.'),
      },
    },
  }

  paths['/data/boxpresets/modern/{gameSet}/{presetId}.json'] = {
    get: {
      operationId: 'getModernBoxPreset',
      summary: 'Get a modern box preset',
      description: 'Static modern box preset selected by game set ID and preset ID.',
      tags: ['Box presets'],
      requestParams: {
        path: z.object({
          gameSet: GameSetParamSchema,
          presetId: PresetIdParamSchema,
        }),
      },
      responses: {
        '200': jsonResponse(ModernBoxPresetSchema, 'Modern box preset file.'),
        '404': notFoundResponse('Static modern box preset file not found.'),
      },
    },
  }

  paths['/data/metadata/pokemon-mugshots.json'] = {
    get: {
      operationId: 'getPokemonMugshotMetadata',
      summary: 'Get Pokemon mugshot metadata',
      description: 'Static Pokemon mugshot display metadata keyed by Pokemon ID.',
      tags: ['Metadata'],
      responses: {
        '200': jsonResponse(PokemonMugshotMetadataSchema, 'Pokemon mugshot metadata.'),
      },
    },
  }

  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'PokePC Dataset Static API',
      version: options.version,
      description: 'Static JSON API for the PokePC dataset, suitable for GitHub Pages.',
    },
    servers: [
      {
        url: serverUrl,
        description: 'Static dataset host.',
      },
    ],
    tags: [
      { name: 'Root data' },
      { name: 'Indices' },
      { name: 'Pokemon' },
      { name: 'Games' },
      { name: 'Pokedexes' },
      { name: 'Box presets' },
      { name: 'Metadata' },
    ],
    paths,
  })
}

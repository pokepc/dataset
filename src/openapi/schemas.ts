import { z } from 'zod'
import { localeCodes } from '../lib/languages.ts'
import {
  abilitySchema,
  battleStateSchema,
  boxPresetTextFileSchema,
  characterSchema,
  classicBoxPresetSchema,
  codeMapSchema,
  colorSchema,
  gameSchema,
  generationSchema,
  itemSchema,
  languageSchema,
  locationSchema,
  markSchema,
  moddableOverrideSchemas,
  moddableTextOverrideFileSchemas,
  modernBoxPresetIndexSchema,
  modernBoxPresetSchema,
  moveSchema,
  natureSchema,
  originMarkSchema,
  personalitySchema,
  pokeballSchema,
  pokedexSchema,
  pokemonMugshotsSchema,
  pokemonSchema,
  regionSchema,
  ribbonSchema,
  rosterSchema,
  textFileSchemas,
  typeSchema,
  type ModdableKind,
  type TextKind,
} from '../lib/schemas.ts'

export const slugSchema = z
  .string()
  .max(50)
  .regex(/^[a-z0-9-]+$/)

const pascal = (kind: string) =>
  kind
    .split('-')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')

export const AbilitySchema = abilitySchema.meta({ id: 'Ability' })
export const AbilityListSchema = z.array(AbilitySchema).meta({ id: 'AbilityList' })
export const BattleStateSchema = battleStateSchema.meta({ id: 'BattleState' })
export const BattleStateListSchema = z.array(BattleStateSchema).meta({ id: 'BattleStateList' })
export const CharacterSchema = characterSchema.meta({ id: 'Character' })
export const CharacterListSchema = z.array(CharacterSchema).meta({ id: 'CharacterList' })
export const ColorSchema = colorSchema.meta({ id: 'Color' })
export const ColorListSchema = z.array(ColorSchema).meta({ id: 'ColorList' })
export const GameSchema = gameSchema.meta({ id: 'Game' })
export const GenerationSchema = generationSchema.meta({ id: 'Generation' })
export const GenerationListSchema = z.array(GenerationSchema).meta({ id: 'GenerationList' })
export const ItemSchema = itemSchema.meta({ id: 'Item' })
export const ItemListSchema = z.array(ItemSchema).meta({ id: 'ItemList' })
export const LanguageSchema = languageSchema.meta({ id: 'Language' })
export const LanguageListSchema = z.array(LanguageSchema).meta({ id: 'LanguageList' })
export const MarkSchema = markSchema.meta({ id: 'Mark' })
export const MarkListSchema = z.array(MarkSchema).meta({ id: 'MarkList' })
export const MoveSchema = moveSchema.meta({ id: 'Move' })
export const MoveListSchema = z.array(MoveSchema).meta({ id: 'MoveList' })
export const NatureSchema = natureSchema.meta({ id: 'Nature' })
export const NatureListSchema = z.array(NatureSchema).meta({ id: 'NatureList' })
export const OriginMarkSchema = originMarkSchema.meta({ id: 'OriginMark' })
export const OriginMarkListSchema = z.array(OriginMarkSchema).meta({ id: 'OriginMarkList' })
export const PersonalitySchema = personalitySchema.meta({ id: 'Personality' })
export const PersonalityListSchema = z.array(PersonalitySchema).meta({ id: 'PersonalityList' })
export const PokeballSchema = pokeballSchema.meta({ id: 'Pokeball' })
export const PokeballListSchema = z.array(PokeballSchema).meta({ id: 'PokeballList' })
export const PokedexSchema = pokedexSchema.meta({ id: 'Pokedex' })
export const PokemonSchema = pokemonSchema.meta({ id: 'Pokemon' })
export const RegionSchema = regionSchema.meta({ id: 'Region' })
export const RegionListSchema = z.array(RegionSchema).meta({ id: 'RegionList' })
export const RibbonSchema = ribbonSchema.meta({ id: 'Ribbon' })
export const RibbonListSchema = z.array(RibbonSchema).meta({ id: 'RibbonList' })
export const TypeSchema = typeSchema.meta({ id: 'Type' })
export const TypeListSchema = z.array(TypeSchema).meta({ id: 'TypeList' })
export const CodeMapSchema = codeMapSchema.meta({
  id: 'CodeMap',
  description: 'Append-only map of dataset ids to stable integer codes.',
})

export const ClassicBoxPresetSchema = classicBoxPresetSchema.meta({ id: 'ClassicBoxPreset' })
export const ClassicBoxPresetMapSchema = z
  .record(slugSchema, ClassicBoxPresetSchema)
  .meta({ id: 'ClassicBoxPresetMap' })

export const ModernBoxPresetIndexSchema = modernBoxPresetIndexSchema.meta({
  id: 'ModernBoxPresetIndex',
})
export const ModernBoxPresetSchema = modernBoxPresetSchema.meta({ id: 'ModernBoxPreset' })

export const StringIndexSchema = z.array(slugSchema).meta({
  id: 'StringIndex',
  description: 'Ordered list of dataset entity IDs.',
})

export const LocationSchema = locationSchema.meta({ id: 'Location' })
export const LocationListSchema = z.array(LocationSchema).meta({ id: 'LocationList' })

export const PokemonMugshotMetadataSchema = pokemonMugshotsSchema.meta({
  id: 'PokemonMugshotMetadata',
})

// ---- Text

/** Text file schema per kind: entity id → text fields. Missing text is omitted, never filled in. */
export const TextFileSchemas = Object.fromEntries(
  Object.entries(textFileSchemas).map(([kind, schema]) => [
    kind,
    schema.meta({ id: `${pascal(kind)}Text`, description: `Text of ${kind} keyed by id.` }),
  ]),
) as { [K in TextKind]: (typeof textFileSchemas)[K] }

export const BoxPresetTextSchema = boxPresetTextFileSchema.meta({
  id: 'BoxPresetText',
  description: 'Box preset text keyed by preset id; `boxes` holds titles aligned with boxes.',
})

// ---- Mods and merged game sets

export const RosterSchema = rosterSchema.meta({
  id: 'GameSetRoster',
  description: 'Ids each listed kind has in the game set; unlisted kinds keep every base record.',
})

export const OverrideSchemas = Object.fromEntries(
  Object.entries(moddableOverrideSchemas).map(([kind, schema]) => [
    kind,
    schema.meta({ id: `${pascal(kind)}Override` }),
  ]),
) as { [K in ModdableKind]: (typeof moddableOverrideSchemas)[K] }

export const TextOverrideFileSchemas = Object.fromEntries(
  Object.entries(moddableTextOverrideFileSchemas).map(([kind, schema]) => [
    kind,
    schema.meta({ id: `${pascal(kind)}TextOverride` }),
  ]),
) as { [K in ModdableKind]: (typeof moddableTextOverrideFileSchemas)[K] }

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    statusCode: z.number().int(),
  })
  .strict()
  .meta({
    id: 'ErrorResponse',
    example: {
      error: 'Not Found',
      message: 'Static JSON file not found.',
      statusCode: 404,
    },
  })

export const GameSetParamSchema = slugSchema.meta({
  description: 'Game set ID.',
  example: 'swsh',
})

export const ModdedGameSetParamSchema = slugSchema.meta({
  description:
    'ID of a game set with mods; only those have merged data (8.0.0: champions). Other sets use base data.',
  example: 'champions',
})

export const GameIdParamSchema = slugSchema.meta({
  description: 'Game ID.',
  example: 'swsh',
})

export const LocaleParamSchema = z.enum(localeCodes).meta({
  description: 'v8 locale code.',
  example: 'eng',
})

export const PokedexIdParamSchema = slugSchema.meta({
  description: 'Pokedex ID.',
  example: 'national',
})

export const PokemonIdParamSchema = slugSchema.meta({
  description: 'Pokemon ID.',
  example: 'bulbasaur',
})

export const PresetIdParamSchema = slugSchema.meta({
  description: 'Box preset ID.',
  example: 'fully-sorted',
})

export const CodeMapKindParamSchema = z.enum(['pokemon', 'ribbons', 'marks', 'moves']).meta({
  description: 'Code map kind.',
  example: 'pokemon',
})

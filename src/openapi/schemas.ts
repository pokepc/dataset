import { z } from 'zod'
import {
  abilitySchema,
  boxPresetSchema,
  characterSchema,
  colorSchema,
  gameSchema,
  generationSchema,
  itemSchema,
  languageSchema,
  markSchema,
  modernBoxPresetIndexSchema,
  modernBoxPresetSchema,
  moveSchema,
  natureSchema,
  originMarkSchema,
  personalitySchema,
  pokeballSchema,
  pokedexSchema,
  pokemonSchema,
  regionSchema,
  ribbonSchema,
  typeSchema,
} from '../lib/schemas.ts'

export const slugSchema = z
  .string()
  .max(50)
  .regex(/^[a-z0-9-]+$/)

export const AbilitySchema = abilitySchema.meta({ id: 'Ability' })
export const AbilityListSchema = z.array(AbilitySchema).meta({ id: 'AbilityList' })
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

export const ClassicBoxPresetSchema = boxPresetSchema.meta({ id: 'ClassicBoxPreset' })
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

export const LocationSchema = z
  .object({
    id: slugSchema,
    name: z.string().max(120),
    gameIds: z.literal('*').or(z.array(slugSchema)),
  })
  .strict()
  .meta({ id: 'Location' })

export const LocationListSchema = z.array(LocationSchema).meta({ id: 'LocationList' })

export const PokemonMugshotSchema = z
  .object({
    x: z.number().int().optional(),
    y: z.number().int().optional(),
    scale: z.number().int().optional(),
    flipped: z.boolean().optional(),
    pokeId: slugSchema.optional(),
  })
  .strict()
  .meta({ id: 'PokemonMugshot' })

export const PokemonMugshotMetadataSchema = z
  .record(slugSchema, PokemonMugshotSchema)
  .meta({ id: 'PokemonMugshotMetadata' })

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

export const GameIdParamSchema = slugSchema.meta({
  description: 'Game ID.',
  example: 'swsh',
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

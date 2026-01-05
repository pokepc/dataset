import type z from 'zod'
import type {
  gamePlatforms,
  gameSeries,
  gameType,
  genders,
  itemCategory,
  ivJudgeValues,
  languageAlpha3Codes,
  languageIds,
  languageInGameCodes,
  moveCategory,
  pokeballCategory,
  pokemonSizes,
  ribbonCategory,
  statIds,
  titleTypes,
  typeIds,
} from './enums'
import type {
  abilitySchema,
  boxPresetBoxPokemonSchema,
  boxPresetBoxSchema,
  boxPresetSchema,
  characterSchema,
  colorSchema,
  gameFeaturesSchema,
  gameSchema,
  generationSchema,
  i18nTextSchema,
  itemSchema,
  languageSchema,
  markSchema,
  moveSchema,
  natureSchema,
  originMarkSchema,
  personalitySchema,
  pokeballSchema,
  pokedexEntrySchema,
  pokedexSchema,
  pokemonRefsSchema,
  pokemonSchema,
  pokemonSearchFilterSchema,
  regionSchema,
  ribbonSchema,
  typeSchema,
} from './schemas'

// These types are declared globally, so you don't need to import them in your code.
// Use them with the `Pkds.` prefix. e.g. `Pkds.Pokemon`
declare global {
  // PokéPC Dataset namespace (Pkds)
  namespace Pkds {
    // Classic PokéPC Types
    export type LegacyBoxPreset = z.infer<typeof boxPresetSchema>
    export type LegacyBoxPresetByGameset = {
      gameset: string
      presets: LegacyBoxPreset[]
    }
    export type LegacyBoxPresetBox = z.infer<typeof boxPresetBoxSchema>
    export type LegacyBoxPresetBoxPokemon = z.infer<typeof boxPresetBoxPokemonSchema>
    // Schema-based Types
    export type Ability = z.infer<typeof abilitySchema>
    export type Personality = z.infer<typeof personalitySchema>
    export type Character = z.infer<typeof characterSchema>
    export type Color = z.infer<typeof colorSchema>
    export type Game = z.infer<typeof gameSchema>
    export type GameFeatures = z.infer<typeof gameFeaturesSchema>
    export type GameType = (typeof gameType)[number]
    export type GamePlatform = (typeof gamePlatforms)[number]
    export type GameSeries = (typeof gameSeries)[number]
    export type Generation = z.infer<typeof generationSchema>
    export type Item = z.infer<typeof itemSchema>
    export type ItemCategory = (typeof itemCategory)[number]
    export type Pokeball = z.infer<typeof pokeballSchema>
    export type PokeballCategory = (typeof pokeballCategory)[number]
    export type Language = z.infer<typeof languageSchema>
    /**
     * Used as language IDs
     */
    export type LanguageAlpha2 = (typeof languageIds)[number]
    /**
     * Used as translation keys
     */
    export type LanguageAlpha3 = (typeof languageAlpha3Codes)[number]
    /**
     * Used as language codes in-game
     */
    export type LanguageInGameCode = (typeof languageInGameCodes)[number]
    export type Mark = z.infer<typeof markSchema>
    export type Ribbon = z.infer<typeof ribbonSchema>
    export type RibbonCategory = (typeof ribbonCategory)[number]
    export type OriginMark = z.infer<typeof originMarkSchema>
    export type Region = z.infer<typeof regionSchema>
    export type Type = z.infer<typeof typeSchema>
    export type TypeId = (typeof typeIds)[number]
    export type Nature = z.infer<typeof natureSchema>
    export type StatId = (typeof statIds)[number]
    export type Move = z.infer<typeof moveSchema>
    export type MoveCategory = (typeof moveCategory)[number]
    export type Pokedex = z.infer<typeof pokedexSchema>
    export type PokedexEntry = z.infer<typeof pokedexEntrySchema>
    export type I18nText = z.infer<typeof i18nTextSchema>
    export type PokemonRefs = z.infer<typeof pokemonRefsSchema>
    export type Pokemon = z.infer<typeof pokemonSchema>
    export type Gender = (typeof genders)[number] | null
    export type TitleType = (typeof titleTypes)[number]
    export type PokemonSize = (typeof pokemonSizes)[number]
    export type IvJudgeValue = (typeof ivJudgeValues)[number]

    // Computed Types -------------------------------------------------------------

    export type PokemonBase = Pick<Pkds.Pokemon, 'id' | 'nid' | 'isForm'>

    export type PokemonText = {
      lang: Pkds.LanguageAlpha3
      name: string
      genusText?: string
      speciesName?: string
      formName?: string
    }

    export type TranslatedPokemon = Pkds.Pokemon &
      PokemonText & {
        speciesGen: number
        searchableText: string
      }

    export type GamesByKey = Record<string, Game | undefined>
    export type PokedexesByKey = Record<string, Pokedex | undefined>
    export type PokemonByKey = Record<string, Pokemon | undefined>
    export type TranslatedPokemonByKey = Record<string, TranslatedPokemon | undefined>
    export type CharactersByKey = Record<string, Character | undefined>
    export type TypesByKey = Record<string, Type | undefined>
    export type AbilitiesByKey = Record<string, Ability | undefined>
    export type MovesByKey = Record<string, Move | undefined>
    export type ItemsByKey = Record<string, Item | undefined>

    export type BaseStats = {
      hp: number
      atk: number
      def: number
      spAtk: number
      spDef: number
      speed: number
    }

    export type PokemonNameInfo = {
      displayName: string
      displayFormName?: string
      fullName: string
      speciesName?: string
      formName?: string
      isNicknamed: boolean
      lang: Pkds.LanguageAlpha3
    }

    // Search types
    export type PokemonSearchFilter = Partial<z.infer<typeof pokemonSearchFilterSchema>>
    export type PokemonSearchResults = {
      pokemon: Array<Pkds.TranslatedPokemon>
      meta: {
        total: number
        skipped: boolean
      }
    }
  }
}

export {}

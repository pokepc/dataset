import type z from 'zod'
import type {
  abilityTagIds,
  battleStyles,
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
  raidStyles,
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
  modernBoxPresetBoxSchema,
  modernBoxPresetIndexSchema,
  modernBoxPresetSchema,
  modernBoxPresetSlotSchema,
  modernBoxPresetTags,
  moveSchema,
  natureSchema,
  onlineFeaturesSchema,
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
    export type ModernBoxPresetTag = (typeof modernBoxPresetTags)[number]
    export type ModernBoxPresetIndex = z.infer<typeof modernBoxPresetIndexSchema>
    export type ModernBoxPreset = z.infer<typeof modernBoxPresetSchema>
    export type ModernBoxPresetBox = z.infer<typeof modernBoxPresetBoxSchema>
    export type ModernBoxPresetSlot = z.infer<typeof modernBoxPresetSlotSchema>
    // Schema-based Types
    export type Ability = z.infer<typeof abilitySchema>
    export type AbilityTagId = (typeof abilityTagIds)[number]
    export type Personality = z.infer<typeof personalitySchema>
    export type Character = z.infer<typeof characterSchema>
    export type Color = z.infer<typeof colorSchema>
    export type Game = z.infer<typeof gameSchema>
    export type GameFeatures = z.infer<typeof gameFeaturesSchema>
    export type GameOnlineFeatures = z.infer<typeof onlineFeaturesSchema>
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
    export type GameBattleStyle = (typeof battleStyles)[number]
    export type GameRaidStyle = (typeof raidStyles)[number]

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

declare global {
  namespace Pkds {
    export type Sortable<T> = T & { sortIndex: number }

    export type PokedexesWithStats = {
      dexes: Pokedex[]
      totalPokemon: number
      totalSpecies: number
      totalForms: number
      allPokemon: PokedexEntry[]
    }

    export type CdnDataBundle = {
      pokemon: Pkds.Pokemon[]
      games: Pkds.Game[]
      pokedexes: Pkds.Pokedex[]
      abilities: Pkds.Ability[]
      moves: Pkds.Move[]
      items: Pkds.Item[]
      pokeballs: Pkds.Pokeball[]
      characters: Pkds.Character[]
      personalities: Pkds.Personality[]
      ribbons: Pkds.Ribbon[]
      marks: Pkds.Mark[]
      originMarks: Pkds.OriginMark[]
      types: Pkds.Type[]
      natures: Pkds.Nature[]
      regions: Pkds.Region[]
    }

    export type CdnDataBundleComputed = {
      supportedGames: Pkds.Game[]
      supportedGamesById: Record<string, Pkds.Game | undefined>
      supportedGamesBySlug: Record<string, Pkds.Game | undefined>
      pokedexesById: Record<string, Pkds.Pokedex | undefined>
      pokemonByNid: Record<string, Pkds.Pokemon | undefined>
      pokemonById: Record<string, Pkds.Pokemon | undefined>
      searchablePokemon: Pkds.TranslatedPokemon[]
      searchablePokemonByNid: Pkds.TranslatedPokemonByKey
      searchablePokemonById: Pkds.TranslatedPokemonByKey
      charactersById: Record<string, Pkds.Character | undefined>
      typesById: Record<string, Pkds.Type | undefined>
      abilitiesById: Record<string, Pkds.Ability | undefined>
      gamesById: Record<string, Pkds.Game | undefined>
      movesById: Record<string, Pkds.Move | undefined>
      itemsById: Record<string, Pkds.Item | undefined>
      pokeballsById: Record<string, Pkds.Pokeball | undefined>
      originMarksById: Record<string, Pkds.OriginMark | undefined>
      marksById: Record<string, Pkds.Mark | undefined>
      ribbonsById: Record<string, Pkds.Ribbon | undefined>
      naturesById: Record<string, Pkds.Nature | undefined>
      regionsById: Record<string, Pkds.Region | undefined>
      personalitiesById: Record<string, Pkds.Personality | undefined>
    }

    export type FullCdnDataBundle = CdnDataBundle & CdnDataBundleComputed
    export type FullCdnDataBundleLoad = Readonly<FullCdnDataBundle> & {
      loaded: boolean
    }
  }

  var __pokepcData: Pkds.FullCdnDataBundleLoad

  export type CatalogBoxCellPokemonData = {
    nid: string
    box?: number
    cell?: number
    shiny?: boolean | null
    origMark?: string | null
    origGame?: string | null
    size?: 'xs' | 's' | 'm' | 'l' | 'xl' | null
    [key: string]: any
  }

  export type CatalogBoxCellData = CatalogBoxCellPokemonData | null

  export type CatalogBoxData = {
    id?: string
    name?: string | null
    pokemon: CatalogBoxCellData[]
    sortIndex?: number
    [key: string]: unknown
  }
}

export {}

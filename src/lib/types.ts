import type { z } from 'zod'
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
  pokeballCategory,
  pokemonSizes,
  raidStyles,
  ribbonCategory,
  statIds,
  titleTypes,
  typeIds,
} from './enums'
import type {
  evolutionConditionSchema,
  evolutionMethodSchema,
  formConditionSchema,
  formMethodSchema,
  formRevertDetailSchema,
  formRevertSchema,
  abilitySchema,
  battleStateSchema,
  boxPresetTextSchema,
  characterSchema,
  classicBoxPresetBoxPokemonSchema,
  classicBoxPresetBoxSchema,
  classicBoxPresetFileSchema,
  classicBoxPresetSchema,
  codeMapEntrySchema,
  colorSchema,
  gameFeaturesSchema,
  gameSchema,
  generationSchema,
  itemSchema,
  languageSchema,
  locationSchema,
  markSchema,
  modernBoxPresetBoxSchema,
  modernBoxPresetSchema,
  modernBoxPresetSlotSchema,
  modernBoxPresetTags,
  moddableRecordSchemas,
  moddableOverrideSchemas,
  moddableTextOverrideSchemas,
  moveSchema,
  natureSchema,
  onlineFeaturesSchema,
  originMarkSchema,
  personalitySchema,
  pokeballSchema,
  pokedexEntrySchema,
  pokedexSchema,
  pokemonMugshotsSchema,
  pokemonRefsSchema,
  pokemonSchema,
  regionSchema,
  ribbonSchema,
  rosterSchema,
  textSchemas,
  typeSchema,
  ModdableKind,
  TextKind,
} from './schemas'

export type { CollectionKind, EntityKind, ModdableKind, TextKind } from './schemas'
export type { LocaleCode } from './languages'
export type {
  BattleItemCategory,
  BattleState as BattleStateId,
  MoveCategory,
  MoveClass,
  MoveTarget,
  PokemonType,
  StatusCondition,
} from './enums'

// ---- Base records (no text; see the *Text types)

export type Ability = z.infer<typeof abilitySchema>
export type BattleState = z.infer<typeof battleStateSchema>
export type Character = z.infer<typeof characterSchema>
export type CodeMapEntry = z.infer<typeof codeMapEntrySchema>
export type Color = z.infer<typeof colorSchema>
export type EvolutionCondition = z.infer<typeof evolutionConditionSchema>
export type EvolutionMethod = z.infer<typeof evolutionMethodSchema>
export type FormCondition = z.infer<typeof formConditionSchema>
export type FormMethod = z.infer<typeof formMethodSchema>
export type FormRevert = z.infer<typeof formRevertSchema>
export type FormRevertDetail = z.infer<typeof formRevertDetailSchema>
export type Game = z.infer<typeof gameSchema>
export type GameFeatures = z.infer<typeof gameFeaturesSchema>
export type GameOnlineFeatures = z.infer<typeof onlineFeaturesSchema>
export type Generation = z.infer<typeof generationSchema>
export type Item = z.infer<typeof itemSchema>
export type Language = z.infer<typeof languageSchema>
export type Location = z.infer<typeof locationSchema>
export type Mark = z.infer<typeof markSchema>
export type Move = z.infer<typeof moveSchema>
export type Nature = z.infer<typeof natureSchema>
export type OriginMark = z.infer<typeof originMarkSchema>
export type Personality = z.infer<typeof personalitySchema>
export type Pokeball = z.infer<typeof pokeballSchema>
export type Pokedex = z.infer<typeof pokedexSchema>
export type PokedexEntry = z.infer<typeof pokedexEntrySchema>
export type Pokemon = z.infer<typeof pokemonSchema>
export type PokemonMugshots = z.infer<typeof pokemonMugshotsSchema>
export type PokemonRefs = z.infer<typeof pokemonRefsSchema>
export type Region = z.infer<typeof regionSchema>
export type Ribbon = z.infer<typeof ribbonSchema>
export type Type = z.infer<typeof typeSchema>

export type ClassicBoxPreset = z.infer<typeof classicBoxPresetSchema>
export type ClassicBoxPresetBox = z.infer<typeof classicBoxPresetBoxSchema>
export type ClassicBoxPresetBoxPokemon = z.infer<typeof classicBoxPresetBoxPokemonSchema>
export type ClassicBoxPresetFile = z.infer<typeof classicBoxPresetFileSchema>
export type ModernBoxPreset = z.infer<typeof modernBoxPresetSchema>
export type ModernBoxPresetBox = z.infer<typeof modernBoxPresetBoxSchema>
export type ModernBoxPresetSlot = z.infer<typeof modernBoxPresetSlotSchema>
export type ModernBoxPresetTag = (typeof modernBoxPresetTags)[number]

// ---- Enums

export type AbilityTagId = (typeof abilityTagIds)[number]
export type GameBattleStyle = (typeof battleStyles)[number]
export type GamePlatform = (typeof gamePlatforms)[number]
export type GameRaidStyle = (typeof raidStyles)[number]
export type GameSeries = (typeof gameSeries)[number]
export type GameType = (typeof gameType)[number]
export type Gender = (typeof genders)[number] | null
export type ItemCategory = (typeof itemCategory)[number]
export type IvJudgeValue = (typeof ivJudgeValues)[number]
export type LanguageId = (typeof languageIds)[number]
export type LanguageV7Key = (typeof languageAlpha3Codes)[number]
export type LanguageInGameCode = (typeof languageInGameCodes)[number]
export type PokeballCategory = (typeof pokeballCategory)[number]
export type PokemonSize = (typeof pokemonSizes)[number]
export type RibbonCategory = (typeof ribbonCategory)[number]
export type StatId = (typeof statIds)[number]
export type TitleType = (typeof titleTypes)[number]
export type TypeId = (typeof typeIds)[number]

// ---- Mods

/** Merged (or base) record of a moddable kind. */
export type ModdableRecord<K extends ModdableKind = ModdableKind> = z.infer<
  (typeof moddableRecordSchemas)[K]
>
export type RecordOverride<K extends ModdableKind = ModdableKind> = z.infer<
  (typeof moddableOverrideSchemas)[K]
>
export type Roster = z.infer<typeof rosterSchema>

// ---- Text

export type Text<K extends TextKind = TextKind> = z.infer<(typeof textSchemas)[K]>
/** Contents of `i18n/<locale>/<kind>.json`: text keyed by entity id. */
export type TextFile<K extends TextKind = TextKind> = Record<string, Text<K>>
export type TextOverride<K extends ModdableKind = ModdableKind> = z.infer<
  (typeof moddableTextOverrideSchemas)[K]
>
export type PokemonText = Text<'pokemon'>
export type BoxPresetText = z.infer<typeof boxPresetTextSchema>

// ---- Global aliases
//
// v7 declared the record types globally under `Pkds` (e.g. `Pkds.Pokemon`). v8 keeps those names
// as aliases of the named exports above; the record shapes are the v8 ones, without text.
type V8Ability = Ability
type V8BattleState = BattleState
type V8Character = Character
type V8CodeMapEntry = CodeMapEntry
type V8Color = Color
type V8EvolutionCondition = EvolutionCondition
type V8EvolutionMethod = EvolutionMethod
type V8FormCondition = FormCondition
type V8FormMethod = FormMethod
type V8FormRevert = FormRevert
type V8FormRevertDetail = FormRevertDetail
type V8Game = Game
type V8GameFeatures = GameFeatures
type V8GameOnlineFeatures = GameOnlineFeatures
type V8Generation = Generation
type V8Item = Item
type V8Language = Language
type V8Location = Location
type V8Mark = Mark
type V8Move = Move
type V8Nature = Nature
type V8OriginMark = OriginMark
type V8Personality = Personality
type V8Pokeball = Pokeball
type V8Pokedex = Pokedex
type V8PokedexEntry = PokedexEntry
type V8Pokemon = Pokemon
type V8PokemonRefs = PokemonRefs
type V8Region = Region
type V8Ribbon = Ribbon
type V8Type = Type
type V8ClassicBoxPreset = ClassicBoxPreset
type V8ModernBoxPreset = ModernBoxPreset
type V8ModernBoxPresetBox = ModernBoxPresetBox
type V8ModernBoxPresetSlot = ModernBoxPresetSlot
type V8ModernBoxPresetTag = ModernBoxPresetTag
type V8AbilityTagId = AbilityTagId
type V8GameType = GameType
type V8GamePlatform = GamePlatform
type V8GameSeries = GameSeries
type V8Gender = Gender
type V8ItemCategory = ItemCategory
type V8PokeballCategory = PokeballCategory
type V8RibbonCategory = RibbonCategory
type V8StatId = StatId
type V8TypeId = TypeId
type V8PokemonSize = PokemonSize
type V8TitleType = TitleType
type V8IvJudgeValue = IvJudgeValue
type V8GameBattleStyle = GameBattleStyle
type V8GameRaidStyle = GameRaidStyle
type V8PokemonText = PokemonText

declare global {
  // PokéPC Dataset namespace (Pkds)
  namespace Pkds {
    export type Ability = V8Ability
    export type BattleState = V8BattleState
    export type Character = V8Character
    export type CodeMapEntry = V8CodeMapEntry
    export type Color = V8Color
    export type EvolutionCondition = V8EvolutionCondition
    export type EvolutionMethod = V8EvolutionMethod
    export type FormCondition = V8FormCondition
    export type FormMethod = V8FormMethod
    export type FormRevert = V8FormRevert
    export type FormRevertDetail = V8FormRevertDetail
    export type Game = V8Game
    export type GameFeatures = V8GameFeatures
    export type GameOnlineFeatures = V8GameOnlineFeatures
    export type Generation = V8Generation
    export type Item = V8Item
    export type Language = V8Language
    export type Location = V8Location
    export type Mark = V8Mark
    export type Move = V8Move
    export type Nature = V8Nature
    export type OriginMark = V8OriginMark
    export type Personality = V8Personality
    export type Pokeball = V8Pokeball
    export type Pokedex = V8Pokedex
    export type PokedexEntry = V8PokedexEntry
    export type Pokemon = V8Pokemon
    export type PokemonRefs = V8PokemonRefs
    export type PokemonText = V8PokemonText
    export type Region = V8Region
    export type Ribbon = V8Ribbon
    export type Type = V8Type
    export type ClassicBoxPreset = V8ClassicBoxPreset
    export type ModernBoxPreset = V8ModernBoxPreset
    export type ModernBoxPresetBox = V8ModernBoxPresetBox
    export type ModernBoxPresetSlot = V8ModernBoxPresetSlot
    export type ModernBoxPresetTag = V8ModernBoxPresetTag
    export type AbilityTagId = V8AbilityTagId
    export type GameType = V8GameType
    export type GamePlatform = V8GamePlatform
    export type GameSeries = V8GameSeries
    export type Gender = V8Gender
    export type ItemCategory = V8ItemCategory
    export type PokeballCategory = V8PokeballCategory
    export type RibbonCategory = V8RibbonCategory
    export type StatId = V8StatId
    export type TypeId = V8TypeId
    export type PokemonSize = V8PokemonSize
    export type TitleType = V8TitleType
    export type IvJudgeValue = V8IvJudgeValue
    export type GameBattleStyle = V8GameBattleStyle
    export type GameRaidStyle = V8GameRaidStyle
    export type PokemonBase = Pick<V8Pokemon, 'id' | 'nid' | 'isForm'>
  }
}

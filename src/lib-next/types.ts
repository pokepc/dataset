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

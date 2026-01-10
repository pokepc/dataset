import { z } from 'zod'
import { POKEPC_LATEST_GENERATION } from './constants'
import {
  gamePlatforms,
  gameSeries,
  gameType,
  genders,
  itemCategory,
  languageAlpha3Codes,
  languageIds,
  languageInGameCodes,
  moveCategory,
  pokeballCategory,
  ribbonCategory,
  statIds,
  typeIds,
} from './enums'

const common = {
  name: z.string().max(50),
  gen: z.coerce.number().int().min(0).max(POKEPC_LATEST_GENERATION),
  slug: z
    .string()
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  desc: z.string().max(2000).nullable(),
  shortDesc: z.string().max(200),
  //   sortIndex: z.coerce.number().min(0),
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
  dateDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  statId: z.enum(statIds),
  typeId: z.enum(typeIds),
  int: z.coerce.number().int(),
  dexNum: z.union([z.string().regex(/^\d{1,5}$/), z.coerce.number().int().min(0).max(99999)]),
  level: z.coerce.number().int().min(1).max(100),
  statValue: z.coerce.number().int().min(-1).max(255),
}

const base = {
  entity: z.object({
    id: common.slug,
    name: common.name,
    // sortIndex: defs.sortIndex,
  }),
  entityWithGenAndDescs: z.object({
    id: common.slug,
    name: common.name,
    gen: common.gen,
    shortDesc: common.shortDesc,
    desc: common.desc,
    // sortIndex: defs.sortIndex,
  }),
  entityWithGenAndDescsAndShowdownName: z.object({
    id: common.slug,
    name: common.name,
    psName: common.name,
    gen: common.gen,
    shortDesc: common.shortDesc,
    desc: common.desc,
    // sortIndex: defs.sortIndex,
  }),
}

export const abilitySchema = base.entityWithGenAndDescsAndShowdownName
export const personalitySchema = z.object({
  id: common.slug,
  shortDesc: common.shortDesc,
  //   sortIndex: defs.sortIndex,
})
export const characterSchema = base.entity.extend({
  // sprite: z.string(),
})
export const colorSchema = base.entity.extend({
  color: common.colorHex,
})
export const gameFeaturesSchema = z.object({
  storage: z.boolean(), // when true, the game has a storage system (boxes, etc)
  pokedex: z.boolean(), // when true, the game has at least one pokedex
  training: z.boolean(), // when true, the Pokemon are trainable with traditional methods (evs, ivs, hyper training, etc)
  shiny: z.boolean(),
  items: z.boolean(),
  gender: z.boolean(),
  pokerus: z.boolean(), // All except Gen 1, GO and from S/V onwards
  nature: z.boolean(),
  ribbons: z.boolean(), // Since gen 3
  marks: z.boolean(), // Since gen 8
  markings: z.boolean(), // Since gen 3 (circle, triangle, square, heart, star, diamond)
  shadow: z.boolean(), // Colosseum, XD and GO
  ball: z.boolean(), // Caught balls, since gen 4
  mega: z.boolean(),
  zmove: z.boolean(),
  gmax: z.boolean(),
  alpha: z.boolean(),
  tera: z.boolean(),
  plusmvs: z.boolean(), // mastered moves, LA and LZA only
  mints: z.boolean(),
  sizes: z.boolean(), // For some games like Let's GO, Legends, etc.
  abilities: z.boolean(), // gen 1-2 and Legends games have no abilities
})
export const gameSchema = base.entity.extend({
  gen: common.gen,
  nameSlug: common.slug,
  codename: common.name.nullable(),
  type: z.enum(gameType),
  series: z.enum(gameSeries),
  gameSet: common.slug.nullable(),
  gameSuperSet: common.slug.nullable(),
  releaseDate: common.dateDay,
  region: common.slug.nullable(),
  originMark: common.slug.nullable(),
  pokedexes: z.array(common.slug),
  maxBoxes: common.int,
  maxBoxSize: common.int,
  platforms: z.array(z.enum(gamePlatforms)).min(1),
  features: gameFeaturesSchema,
  isUnreleased: z.coerce.boolean().optional(),
  // sprite: z.string(),
  // spriteIcon: z.string(),
})
export const generationSchema = z.object({
  id: common.int,
  minDexNum: common.int,
  maxDexNum: common.int,
})
export const itemSchema = base.entityWithGenAndDescsAndShowdownName.extend({
  category: z.enum(itemCategory),
  unholdable: z.coerce.boolean().optional(),
  // sprite: z.string(),
})
export const pokeballSchema = base.entityWithGenAndDescs.extend({
  category: z.enum(pokeballCategory),
  unusable: z.coerce.boolean().optional(),
})
export const languageSchema = base.entity.extend({
  id: z.enum(languageIds),
  name: z.string(),
  nameEng: z.string(),
  alpha3: z.enum(languageAlpha3Codes),
  inGameCode: z.enum(languageInGameCodes),
  locale: z.string(),
  flag: z.string(),
})
export const markSchema = base.entityWithGenAndDescs.extend({
  title: common.shortDesc,
  conditions: common.shortDesc,
  chance: z.string(),
  chanceCharm: z.string(),
  // sprite: z.string(),
})
export const ribbonSchema = base.entityWithGenAndDescs.extend({
  title: common.shortDesc,
  category: z.enum(ribbonCategory),
  // sprite: z.string(),
})
export const originMarkSchema = base.entity
export const regionSchema = base.entity
export const typeSchema = base.entity.extend({
  color: common.colorHex,
  isCanonical: z.boolean(),
})
export const natureSchema = base.entity.extend({
  raises: common.statId.nullable(),
  lowers: common.statId.nullable(),
})
export const moveSchema = base.entityWithGenAndDescsAndShowdownName.extend({
  type: common.typeId,
  power: common.int.min(0).max(999),
  accuracy: common.int.min(0).max(101),
  pp: common.int.min(0).max(100),
  category: z.enum(moveCategory),
  priority: common.int.min(-10).max(10),
  isZ: z.boolean(),
  isGmax: z.boolean(),
})

export const pokedexEntrySchema = z.object({
  pid: common.slug,
  dexNum: common.dexNum,
  isForm: z.coerce.boolean(),
  originDex: common.slug.optional(),
})

export const pokedexSchema = base.entity.extend({
  gen: common.gen,
  region: common.slug.nullable(),
  isNational: z.coerce.boolean(),
  baseDex: common.slug.nullable(),
  pkApiId: z.string().nullable(),
  entries: z.array(pokedexEntrySchema.strict()),
})

export const i18nTextSchema = z.record(z.enum(languageAlpha3Codes), z.string().optional())
export const pokemonRefsSchema = z.object({
  pkApiId: z.string(),
  pkApiFormId: z.string(),
  pkApiFormSlug: z.string(),
  smogon: z.string(),
  showdown: z.string(),
  showdownName: z.string(),
  serebii: z.string(),
  bulbapedia: z.string(),
})

export const pokemonSchema = z.object({
  id: common.slug,
  nid: common.slug,
  dexNum: common.dexNum,
  formId: common.slug.optional(),
  // sprite2d: z.string().nullable(), // TODO:! make not nullable
  // sprite3d: z.string().nullable(), // TODO:! make not nullable
  // sprite3dShiny: z.string().nullable(), // TODO:! make not nullable
  region: common.slug,
  gen: common.gen,
  type1: common.slug,
  type2: common.slug.optional(),
  color: common.slug,
  ability1: common.slug,
  ability2: common.slug.optional(),
  abilityHidden: common.slug.optional(),
  abilitySpecial: common.slug.optional(),
  isPrerelease: z.coerce.boolean(),
  isDefault: z.coerce.boolean(),
  isForm: z.coerce.boolean(),
  formItem: common.slug.optional(),
  isLegendary: z.coerce.boolean(),
  isMythical: z.coerce.boolean(),
  isBaby: z.coerce.boolean(),
  isUltraBeast: z.coerce.boolean(),
  isParadox: z.coerce.boolean(),
  paradoxSpecies: z.array(common.slug).optional(),
  isConvergent: z.coerce.boolean(),
  convergentSpecies: z.array(common.slug).optional(),
  isCosmeticForm: z.coerce.boolean(),
  isFemaleForm: z.coerce.boolean(),
  hasGenderDifferences: z.coerce.boolean(),
  isBattleOnlyForm: z.coerce.boolean(),
  isFusion: z.coerce.boolean(),
  isMega: z.coerce.boolean(),
  isPrimal: z.coerce.boolean(),
  isGmax: z.coerce.boolean(),
  isRegional: z.coerce.boolean(),
  canGmax: z.coerce.boolean(),
  canDynamax: z.coerce.boolean(),
  canBeAlpha: z.coerce.boolean(),
  // ---- Obtainability:
  debutIn: common.slug, // the first game it appeared in
  obtainableIn: z.array(common.slug), // if it can be obtained in-game any time, without temporary or online events
  eventOnlyIn: z.array(common.slug), // if it's exclusive to an event, and not obtainable in-game
  storableIn: z.array(common.slug), // if it's storable in the game's boxes
  shinyReleased: z.coerce.boolean(),
  shinyBase: common.slug.optional(),
  shinyLockedIn: z.array(common.slug).optional(), // if it's shiny locked in that game.
  // -------------------
  baseHp: common.statValue,
  baseAtk: common.statValue,
  baseDef: common.statValue,
  baseSpAtk: common.statValue,
  baseSpDef: common.statValue,
  baseSpeed: common.statValue,
  height: common.int.min(-1).max(999999),
  weight: common.int.min(-1).max(999999),
  maleRate: z.coerce.number().min(-1).max(100),
  femaleRate: z.coerce.number().min(-1).max(100),
  baseSpecies: common.slug.optional(),
  baseForms: z.array(common.slug),
  forms: z.array(common.slug),
  formsDesc: z.string().optional(),
  family: common.slug.optional(),
  refs: pokemonRefsSchema,
  // evolution:
  evolvesFrom: common.slug.optional(),
  evoFromLevel: common.level.optional(),
  evoFromItem: common.slug.optional(),
  evoFromMove: common.slug.optional(),
  evoFromAbility: common.slug.optional(), // not provided by showdown (e.g. needed for rockruff (own tempo))
  evoFromGender: z.enum(genders).optional(),
  evoFromTrading: z.coerce.boolean().optional(),
  evoFromFriendship: z.coerce.boolean().optional(),
  evoFromCondition: z.string().optional(),
  // translations:
  names: i18nTextSchema,
  genus: i18nTextSchema,
  speciesNames: i18nTextSchema,
  formNames: i18nTextSchema,
})

// --- legacy

export const boxPresetIndexItemSchema = z
  .object({
    id: common.slug,
    gameSet: common.slug,
    legacyId: common.slug.nullable(),
    name: common.name,
    isHidden: z.coerce.boolean().optional(),
  })
  .strict()

export const boxPresetBoxPokemonSchema = common.slug.nullable().or(
  z.object({
    pid: common.slug,
    gmax: z.coerce.boolean().optional(),
    shinyLocked: z.coerce.boolean().optional(),
    shiny: z.coerce.boolean().optional(),
  }),
)

export const boxPresetBoxSchema = z.object({
  title: common.name.optional(),
  pokemon: z.array(boxPresetBoxPokemonSchema),
})

export const boxPresetSchema = z.object({
  id: common.slug,
  legacyId: common.slug.optional(),
  name: common.name,
  version: z.coerce.number().int().min(0),
  gameSet: common.slug.nullable(),
  description: z.string(),
  boxes: z.array(boxPresetBoxSchema),
  isHidden: z.coerce.boolean().optional(),
})

export const boxPresetMapSchema = z.record(z.string(), z.record(z.string(), boxPresetSchema))

export const pokemonSearchFilterSchema = z.object({
  q: z.string().optional().catch(undefined),
  gen: z.coerce.number().min(1).max(POKEPC_LATEST_GENERATION).optional().catch(undefined),
  lang: z.string().optional().default('en'),
  // pokemon-specific filters:
  color: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  forms: z.coerce.boolean().optional().catch(undefined),
  shiny: z.coerce.boolean().optional().catch(undefined),
})

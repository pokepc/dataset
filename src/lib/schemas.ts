/**
 * v8 record, override, roster and locale file schemas. The storage model they validate is
 * specified in Backlog doc-2 (v8 data architecture).
 *
 * Records hold no user-facing text: v7 text fields moved to the per-locale files described by the
 * `*TextSchema` schemas below.
 */
import { z } from 'zod'
import { POKEPC_LATEST_GENERATION } from '../lib/constants'
import {
  abilityTagIds,
  battleItemCategories,
  battleStates,
  battleStyles,
  gamePlatforms,
  gameSeries,
  gameType,
  itemCategory,
  languageAlpha3Codes,
  languageIds,
  languageInGameCodes,
  moveCategory,
  moveClasses,
  moveTargets,
  pokeballCategory,
  raidStyles,
  ribbonCategory,
  statIds,
  typeIds,
} from './enums'
import { evolutionMethodSchema } from './evolution-schemas'
import { formMethodSchema } from './form-schemas'
import { localeCodes } from './languages'

export { evolutionConditionSchema, evolutionMethodSchema } from './evolution-schemas'
export {
  formConditionSchema,
  formMethodSchema,
  formRevertDetailSchema,
  formRevertSchema,
} from './form-schemas'

// ---- Common

export const slugSchema = z
  .string()
  .max(50)
  .regex(/^[a-z0-9-]+$/)
const uniqueSlugs = z
  .array(slugSchema)
  .refine((values) => new Set(values).size === values.length, 'Duplicate IDs')
const gen = z.number().int().min(0).max(POKEPC_LATEST_GENERATION)
const int = z.number().int()
const colorHex = z.string().regex(/^#[0-9a-f]{6}$/i)
const dateDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const dexNum = z.union([z.string().regex(/^\d{1,5}$/), z.number().int().min(0).max(99999)])
const statValue = z.number().int().min(-1).max(255)
/** Id of the entity in the Pokémon Champions game data. */
const championsId = z.string().regex(/^\d+$/)
/** PokéAPI resource id; `null` when PokéAPI has no such resource. Never guessed. */
const pokeApiId = z.number().int().positive().nullable()

export const localeCodeSchema = z.enum(localeCodes)

// ---- Base records

export const abilitySchema = z.strictObject({
  id: slugSchema,
  psName: z.string().max(50),
  gen,
  tags: z.array(z.enum(abilityTagIds)).min(1),
  immunities: z.array(z.enum(typeIds)).optional(),
  weaknesses: z.array(z.enum(typeIds)).optional(),
  championsId: championsId.optional(),
  pokeApiId: pokeApiId.optional(),
})

export const battleStateSchema = z.strictObject({
  id: slugSchema,
  championsId,
  state: z.enum(battleStates),
})

export const characterSchema = z.strictObject({ id: slugSchema })

export const colorSchema = z.strictObject({ id: slugSchema, color: colorHex })

export const gameFeaturesSchema = z.strictObject({
  storage: z.boolean(), // when true, the game has a storage system (boxes, etc)
  party: z.boolean(), // when true, Pokemon are carried in a party (see maxPartySize)
  battleTeams: z.boolean(), // when true, teams can be registered for battles (see maxBattleTeams)
  pokedex: z.boolean(), // when true, the game has at least one pokedex
  training: z.boolean(), // when true, the Pokemon are trainable with traditional methods (evs, ivs, hyper training, etc)
  shiny: z.boolean(),
  items: z.boolean(),
  gender: z.boolean(),
  pokerus: z.boolean(), // All except Gen 1, GO and from S/V onwards
  nature: z.boolean(),
  ribbons: z.boolean(), // Since gen 3
  marks: z.boolean(), // Since gen 8
  markings: z.boolean(), // Per-Pokemon categorization: markings in core games, tags in GO
  shadow: z.boolean(), // Colosseum, XD and GO
  ball: z.boolean(), // Caught balls, since gen 4
  mega: z.boolean(),
  zmove: z.boolean(),
  gmax: z.boolean(),
  alpha: z.boolean(),
  tera: z.boolean(),
  plusmvs: z.boolean(), // mastered moves, LA and LZA only
  mints: z.boolean(),
  sizes: z.boolean(), // Individual Pokemon sizes, as in GO and Legends: Z-A
  abilities: z.boolean(), // gen 1-2 and Legends games have no abilities
})

export const onlineFeaturesSchema = z.strictObject({
  battles: z.boolean(),
  battleStyles: z.array(z.enum(battleStyles)),
  trades: z.boolean(),
  raids: z.boolean(),
  raidStyles: z.array(z.enum(raidStyles)),
  coop: z.boolean(),
})

export const gameSchema = z.strictObject({
  id: slugSchema,
  gen,
  nameSlug: slugSchema,
  pokeApiGameVersionId: z.number().int().positive().nullable(), // /version/{id}; null for grouped or unmapped records
  pokeApiGameVersionGroupId: z.number().int().positive().nullable(), // /version-group/{id}; null when no exact group exists
  codename: z.string().max(50).nullable(),
  type: z.enum(gameType),
  series: z.enum(gameSeries),
  gameSet: slugSchema.nullable(),
  gameSuperSet: slugSchema.nullable(),
  releaseDate: dateDay,
  delistedDate: z.iso
    .date()
    .nullish()
    .describe(
      'Announced end of new digital purchases/downloads (YYYY-MM-DD, UTC when a cutoff time is known). Does not end redownloads or offline play. Null/omitted means no applicable date recorded.',
    ),
  serviceEndDate: z.iso
    .date()
    .nullish()
    .describe(
      'Announced shutdown of the online service required to use the game (YYYY-MM-DD, UTC when a cutoff time is known). May be in the future. Excludes storefront closure and optional online features. Null/omitted means no applicable date recorded.',
    ),
  region: slugSchema.nullable(),
  originMark: slugSchema.nullable(),
  pokedexes: z.array(slugSchema),
  maxBoxes: int, // PC boxes, plus extra boxes rounding up any side storage (XD: 8 + 2 for the 45-slot Purify Chamber)
  maxBoxSize: int,
  maxPartySize: int, // Pokemon carried at once, 0 when the game has no party
  maxBattleTeams: int, // registrable battle teams, 0 when unsupported (the gen 5-6 Battle Box counts as 1)
  platforms: z.array(z.enum(gamePlatforms)).min(1),
  isUnreleased: z.boolean().optional(),
  features: gameFeaturesSchema,
  onlineFeatures: onlineFeaturesSchema.optional(),
})

export const generationSchema = z.strictObject({
  id: int,
  minDexNum: int,
  maxDexNum: int,
})

export const itemSchema = z.strictObject({
  id: slugSchema,
  psName: z.string().max(50),
  gen,
  category: z.enum(itemCategory),
  unholdable: z.boolean().optional(),
  championsId: championsId.optional(),
  pokeApiId: pokeApiId.optional(),
  /** Battle effect categories, as Pokémon Champions groups held items. */
  battleCategories: z.array(z.enum(battleItemCategories)).optional(),
})

export const languageSchema = z.strictObject({
  id: z.enum(languageIds),
  name: z.string(), // endonym, e.g. "Deutsch"
  nameEng: z.string(),
  alpha3: z.enum(languageAlpha3Codes), // v7 translation key
  inGameCode: z.enum(languageInGameCodes),
  locale: z.string(),
  flag: z.string(),
  pkApiId: z.number().int().positive().nullable(), // PokeAPI language id
  code: localeCodeSchema, // v8 locale code: names this language's i18n/<code>/ directories
})

export const locationSchema = z.strictObject({
  id: slugSchema,
  games: z.array(slugSchema).min(1).nullable(),
  region: slugSchema.nullable(),
  pokeApiId: z.number().int().positive().nullable(),
})

export const markSchema = z.strictObject({
  id: slugSchema,
  gen,
  chance: z.string(),
  chanceCharm: z.string(),
})

export const moveSchema = z.strictObject({
  id: slugSchema,
  psName: z.string().max(50),
  gen,
  type: z.enum(typeIds),
  power: int.min(0).max(999),
  accuracy: int.min(0).max(101),
  pp: int.min(0).max(100),
  category: z.enum(moveCategory),
  priority: int.min(-10).max(10),
  isZ: z.boolean(),
  isGmax: z.boolean(),
  target: z.enum(moveTargets).optional(),
  classification: z.array(z.enum(moveClasses)).optional(),
  contact: z.boolean().optional(), // direct contact move
  championsId: championsId.optional(),
  pokeApiId: pokeApiId.optional(),
  /** Set by mods only: the game set has the move but does not let Pokémon use it. */
  usable: z.literal(false).optional(),
})

export const natureSchema = z.strictObject({
  id: slugSchema,
  raises: z.enum(statIds).nullable(),
  lowers: z.enum(statIds).nullable(),
})

export const originMarkSchema = z.strictObject({ id: slugSchema })

export const personalitySchema = z.strictObject({ id: slugSchema })

export const pokeballSchema = z.strictObject({
  id: slugSchema,
  gen,
  category: z.enum(pokeballCategory),
  unusable: z.boolean().optional(),
})

export const pokedexEntrySchema = z.strictObject({
  pid: slugSchema,
  dexNum,
  isForm: z.boolean(),
  transferOnly: z.boolean().optional(),
  originDex: slugSchema.optional(),
  isNonCanonical: z.boolean().optional(), // not a canonical main-series species or form, e.g. Mosslax
  // Data for entries that the main-series dataset does not describe, e.g. Pokopia's special forms.
  meta: z
    .strictObject({
      id: slugSchema, // key of the entry's text in the Pokédex locale files
      type1: slugSchema.optional(),
      type2: slugSchema.optional(),
      attributes: z.record(slugSchema, z.string()).optional(), // key-value info
      tags: z.array(slugSchema).optional(),
      canonicalPid: slugSchema.optional(), // e.g. for professor tangrowth, it would be tangrowth
      imgNid: slugSchema.optional(), // if using a different nid for the image
    })
    .optional(),
})

export const pokedexSchema = z.strictObject({
  id: slugSchema,
  gen,
  region: slugSchema.nullable(),
  isNational: z.boolean(),
  baseDex: slugSchema.nullable(),
  pkApiId: z.string().nullable(),
  entries: z.array(pokedexEntrySchema),
})

export const pokemonRefsSchema = z.strictObject({
  pkApiId: z.string(),
  pkApiFormId: z.string(),
  pkApiFormSlug: z.string(),
  smogon: z.string(),
  showdown: z.string(),
  showdownName: z.string(),
  serebii: z.string(),
  bulbapedia: z.string(),
})

export const pokemonSchema = z.strictObject({
  id: slugSchema,
  nid: slugSchema,
  imgNid: slugSchema.optional(), // if using a different nid for the image
  dexNum,
  formId: slugSchema.optional(),
  region: slugSchema,
  gen,
  type1: slugSchema,
  type2: slugSchema.optional(),
  color: slugSchema,
  ability1: slugSchema,
  ability2: slugSchema.optional(),
  abilityHidden: slugSchema.optional(),
  abilitySpecial: slugSchema.optional(),
  legacyAbilities: z
    .array(slugSchema)
    .optional()
    .describe(
      'Previously obtainable ability IDs for this exact form, excluding its current abilities and any unused or unreleased assignments.',
    ),
  isPrerelease: z.boolean(),
  isDefault: z.boolean(),
  isForm: z.boolean(),
  isLegendary: z.boolean(),
  isMythical: z.boolean(),
  isBaby: z.boolean(),
  isUltraBeast: z.boolean(),
  isParadox: z.boolean(),
  paradoxSpecies: z.array(slugSchema).optional(),
  isConvergent: z.boolean(),
  convergentSpecies: z.array(slugSchema).optional(),
  isCosmeticForm: z.boolean(),
  isFemaleForm: z.boolean(),
  hasGenderDifferences: z.boolean(),
  isBattleOnlyForm: z.boolean(),
  isFusion: z.boolean(),
  isMega: z.boolean(),
  isPrimal: z.boolean(),
  isGmax: z.boolean(),
  isRegional: z.boolean(),
  canGmax: z.boolean(),
  canDynamax: z.boolean(),
  canBeAlpha: z.boolean(),
  // ---- Availability: canonical definitions in Backlog doc-7.
  debutIn: slugSchema, // the first game it appeared in
  obtainableIn: z.array(slugSchema), // exportable ordinary acquisition; Megas require a native base route; GO allows non-exportable releases but excludes researched event-only routes; excludes Champions recruits
  transferOnlyIn: z.array(slugSchema), // external acquisition/dependency, including distributions and verified visitors
  storableIn: z.array(slugSchema), // exact form persists in storage; independent of acquisition/exportability
  eventOnlyIn: z.array(slugSchema), // obtainable via in-game events, including GO event-gated research/pass rewards; disjoint from obtainableIn and transferOnlyIn
  shinyLockedIn: z.array(slugSchema).optional(), // native acquisition is shiny-locked; does not prohibit imported shinies
  shinyReleased: z.boolean(), // a legal shiny of this form has been released somewhere
  shinyBase: slugSchema.optional(), // shared shiny appearance reference, not availability inheritance
  // -------------------
  baseHp: statValue,
  baseAtk: statValue,
  baseDef: statValue,
  baseSpAtk: statValue,
  baseSpDef: statValue,
  baseSpeed: statValue,
  height: int.min(-1).max(999999),
  weight: int.min(-1).max(999999),
  maleRate: z.number().min(-1).max(100),
  femaleRate: z.number().min(-1).max(100),
  baseSpecies: slugSchema.optional(),
  baseForms: z.array(slugSchema),
  forms: z.array(slugSchema),
  family: slugSchema.optional(),
  refs: pokemonRefsSchema,
  championsId: z
    .string()
    .regex(/^\d{7}$/)
    .optional(),
  // Evolution methods are alternatives. Missing game scope is unknown, not universal support.
  evoMethods: z.array(evolutionMethodSchema).min(1).optional(),
  // Incoming form transitions, including separately described reverse transitions.
  formMethods: z.array(formMethodSchema).min(1).optional(),
  /** Set by mods only: move ids this Pokémon can learn in the game set. */
  learnset: uniqueSlugs.optional(),
})

export const regionSchema = z.strictObject({ id: slugSchema })

export const ribbonSchema = z.strictObject({
  id: slugSchema,
  gen,
  category: z.enum(ribbonCategory),
})

export const typeSchema = z.strictObject({
  id: slugSchema,
  color: colorHex,
  isCanonical: z.boolean(),
})

/**
 * One entry of an append-only code map (data/codes). A code is a stable small integer that
 * consumers may store instead of the id, so a released code never changes meaning.
 */
export const codeMapEntrySchema = z.strictObject({
  id: slugSchema,
  // Fits a PostgreSQL smallint and doubles as a bit position in registration bitmaps.
  code: z.number().int().min(0).max(32767),
  // The id no longer exists in the dataset; its code stays reserved forever.
  retired: z.literal(true).optional(),
  // The live id that replaces a retired one, when there is one.
  replacedBy: slugSchema.optional(),
})
export const codeMapSchema = z.array(codeMapEntrySchema)

export const pokemonMugshotSchema = z.strictObject({
  pokeId: slugSchema.optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  scale: z.number().optional(),
  flipped: z.boolean().optional(),
})
export const pokemonMugshotsSchema = z.record(slugSchema, pokemonMugshotSchema)

export const indexSchema = uniqueSlugs

// ---- Box presets

export const classicBoxPresetBoxPokemonSchema = slugSchema.nullable().or(
  z.strictObject({
    pid: slugSchema,
    gmax: z.boolean().optional(),
    shinyLocked: z.boolean().optional(),
    shiny: z.boolean().optional(),
  }),
)

export const classicBoxPresetBoxSchema = z.strictObject({
  pokemon: z.array(classicBoxPresetBoxPokemonSchema),
})

export const classicBoxPresetSchema = z.strictObject({
  id: slugSchema,
  fullId: slugSchema.optional(), // `<set>-<id>`
  legacyId: slugSchema.optional(),
  version: z.number().int().min(0),
  gameSet: slugSchema.nullable(),
  boxes: z.array(classicBoxPresetBoxSchema),
  isHidden: z.boolean().optional(),
})

/** `boxpresets/classic/<set>.json`: presets keyed by id. */
export const classicBoxPresetFileSchema = z.record(slugSchema, classicBoxPresetSchema)

export const modernBoxPresetTags = [
  'recommended',
  'national',
  'grouped',
  'sorted',
  'minimal',
  'shiny',
  'forms',
] as const

/** `boxpresets/modern/<set>.json`: preset ids in display order. */
export const modernBoxPresetIndexSchema = uniqueSlugs

export const modernBoxPresetSlotSchema = slugSchema.nullable().or(
  z.strictObject({
    pokemon: slugSchema,
    shiny: z.boolean().optional(),
    gmax: z.boolean().optional(),
    shinyLocked: z.boolean().optional(),
  }),
)

export const modernBoxPresetBoxSchema = z.strictObject({
  slots: z.array(modernBoxPresetSlotSchema),
})

export const modernBoxPresetSchema = z.strictObject({
  // 2: v8, text moved to locale files.
  schemaVersion: z.literal(2),
  id: slugSchema,
  gameSet: slugSchema,
  source: z
    .strictObject({
      kind: z.literal('classic'),
      gameSet: slugSchema,
      presetId: slugSchema,
      version: z.number().int().min(0).optional(),
      legacyId: slugSchema.optional(),
    })
    .optional(),
  tags: z.array(z.enum(modernBoxPresetTags)).optional(),
  boxes: z.array(modernBoxPresetBoxSchema),
})

// ---- Collections

export const abilitiesSchema = z.array(abilitySchema)
export const battleStatesSchema = z.array(battleStateSchema)
export const charactersSchema = z.array(characterSchema)
export const colorsSchema = z.array(colorSchema)
export const generationsSchema = z.array(generationSchema)
export const itemsSchema = z.array(itemSchema)
export const languagesSchema = z.array(languageSchema)
export const locationsSchema = z.array(locationSchema)
export const marksSchema = z.array(markSchema)
export const movesSchema = z.array(moveSchema)
export const naturesSchema = z.array(natureSchema)
export const originMarksSchema = z.array(originMarkSchema)
export const personalitiesSchema = z.array(personalitySchema)
export const pokeballsSchema = z.array(pokeballSchema)
export const regionsSchema = z.array(regionSchema)
export const ribbonsSchema = z.array(ribbonSchema)
export const typesSchema = z.array(typeSchema)

/** Base collection files (`<kind>.json`) and the schema of one record. */
export const collectionRecordSchemas = {
  abilities: abilitySchema,
  'battle-states': battleStateSchema,
  characters: characterSchema,
  colors: colorSchema,
  generations: generationSchema,
  items: itemSchema,
  languages: languageSchema,
  locations: locationSchema,
  marks: markSchema,
  moves: moveSchema,
  natures: natureSchema,
  originmarks: originMarkSchema,
  personalities: personalitySchema,
  pokeballs: pokeballSchema,
  regions: regionSchema,
  ribbons: ribbonSchema,
  types: typeSchema,
} as const
export type CollectionKind = keyof typeof collectionRecordSchemas

/** Per-entity kinds: `<kind>/<id>.json`, ordered by `indices/<kind>.json`. */
export const entityRecordSchemas = {
  pokemon: pokemonSchema,
  games: gameSchema,
  pokedexes: pokedexSchema,
} as const
export type EntityKind = keyof typeof entityRecordSchemas

// ---- Mods

/** Kinds that can differ per game set. */
export const moddableKinds = ['pokemon', 'moves', 'abilities', 'items', 'battle-states'] as const
export type ModdableKind = (typeof moddableKinds)[number]

export const moddableRecordSchemas = {
  pokemon: pokemonSchema,
  moves: moveSchema,
  abilities: abilitySchema,
  items: itemSchema,
  'battle-states': battleStateSchema,
} as const satisfies Record<ModdableKind, z.ZodObject>

/**
 * Sparse override of a base record: its `id`, the properties that differ in the game set and
 * `$unset`, the properties the set removes. Arrays and nested objects replace the base value.
 */
function overrideSchemaOf<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  const keys = Object.keys(schema.shape).filter((key) => key !== 'id') as [string, ...string[]]
  return schema
    .partial()
    .extend({
      id: slugSchema,
      $unset: z.array(z.enum(keys)).min(1).optional(),
    })
    .strict()
    .superRefine((override, ctx) => {
      const record = override as Record<string, unknown>
      const set = Object.keys(record).filter((key) => key !== 'id' && key !== '$unset')
      const unset = (record.$unset as string[] | undefined) ?? []
      if (set.length === 0 && unset.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'An override must change at least one property' })
      }
      for (const key of unset) {
        if (set.includes(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['$unset'],
            message: `"${key}" cannot be both set and unset`,
          })
        }
      }
    })
}

export const pokemonOverrideSchema = overrideSchemaOf(pokemonSchema)
export const moveOverrideSchema = overrideSchemaOf(moveSchema)
export const abilityOverrideSchema = overrideSchemaOf(abilitySchema)
export const itemOverrideSchema = overrideSchemaOf(itemSchema)
export const battleStateOverrideSchema = overrideSchemaOf(battleStateSchema)

export const moddableOverrideSchemas = {
  pokemon: pokemonOverrideSchema,
  moves: moveOverrideSchema,
  abilities: abilityOverrideSchema,
  items: itemOverrideSchema,
  'battle-states': battleStateOverrideSchema,
} as const satisfies Record<ModdableKind, z.ZodType>

/** `mods/<set>/<kind>.json` for collection kinds. */
export const movesOverridesSchema = z.array(moveOverrideSchema)
export const abilitiesOverridesSchema = z.array(abilityOverrideSchema)
export const itemsOverridesSchema = z.array(itemOverrideSchema)
export const battleStatesOverridesSchema = z.array(battleStateOverrideSchema)

/**
 * `mods/<set>/roster.json`: the ids of each listed kind that exist in the set, in any order (merged
 * output follows base order). Unlisted kinds keep every base record; `[]` excludes the kind.
 */
export const rosterSchema = z.strictObject({
  pokemon: uniqueSlugs.optional(),
  moves: uniqueSlugs.optional(),
  abilities: uniqueSlugs.optional(),
  items: uniqueSlugs.optional(),
  'battle-states': uniqueSlugs.optional(),
})

// ---- Text (i18n/<locale>/<kind>.json and mods/<set>/i18n/<locale>/<kind>.json)

const text = z.string()

export const nameTextSchema = z.strictObject({ name: text.optional() })

export const describedTextSchema = z.strictObject({
  name: text.optional(),
  shortDesc: text.optional(),
  desc: text.optional(),
})

export const itemTextSchema = describedTextSchema.extend({ pluralName: text.optional() }).strict()

export const battleStateTextSchema = z.strictObject({
  name: text.optional(),
  desc: text.optional(),
})

export const ribbonTextSchema = describedTextSchema.extend({ title: text.optional() }).strict()

export const markTextSchema = ribbonTextSchema.extend({ conditions: text.optional() }).strict()

export const personalityTextSchema = z.strictObject({ shortDesc: text.optional() })

export const pokemonNameTextSchema = z.strictObject({
  name: text.optional(),
  speciesName: text.optional(),
  formName: text.optional(), // "" means the form officially has no name in this locale
})

/** Notes keyed by evolution method index, e.g. `{ "0": "…" }`. */
export const evoNotesSchema = z.record(z.string().regex(/^\d+$/), z.string().min(1))
/** Notes keyed by form method index, or `<method>.revert.<revert>` for revert details. */
export const formNotesSchema = z.record(
  z.string().regex(/^\d+(\.revert\.\d+)?$/),
  z.string().min(1),
)

export const pokemonTextSchema = pokemonNameTextSchema
  .extend({
    genus: text.optional(),
    formsDesc: text.optional(),
    evoNotes: evoNotesSchema.optional(),
    formNotes: formNotesSchema.optional(),
  })
  .strict()

export const pokedexTextSchema = describedTextSchema
  .extend({
    /** Text of entries with `meta`, keyed by `meta.id`. */
    entries: z.record(slugSchema, pokemonNameTextSchema).optional(),
  })
  .strict()

/** Text of one preset; `boxes` holds box titles aligned with the preset's boxes. */
export const boxPresetTextSchema = z.strictObject({
  name: text.optional(),
  description: text.optional(),
  boxes: z.array(text.nullable()).optional(),
})

/** Text schema of one entity, per kind. */
export const textSchemas = {
  abilities: describedTextSchema,
  'battle-states': battleStateTextSchema,
  characters: nameTextSchema,
  colors: nameTextSchema,
  games: nameTextSchema,
  items: itemTextSchema,
  locations: nameTextSchema,
  marks: markTextSchema,
  moves: describedTextSchema,
  natures: nameTextSchema,
  originmarks: nameTextSchema,
  personalities: personalityTextSchema,
  pokeballs: describedTextSchema,
  pokedexes: pokedexTextSchema,
  pokemon: pokemonTextSchema,
  regions: nameTextSchema,
  ribbons: ribbonTextSchema,
  types: nameTextSchema,
} as const
export type TextKind = keyof typeof textSchemas

/** `i18n/<locale>/<kind>.json`: text keyed by entity id. */
export function textFileSchemaOf<T extends z.ZodType>(entrySchema: T) {
  return z.record(slugSchema, entrySchema)
}

export const textFileSchemas = Object.fromEntries(
  Object.entries(textSchemas).map(([kind, schema]) => [kind, textFileSchemaOf(schema)]),
) as { [K in TextKind]: z.ZodRecord<typeof slugSchema, (typeof textSchemas)[K]> }

/** `i18n/<locale>/boxpresets/<variant>/<set>.json`: preset text keyed by preset id. */
export const boxPresetTextFileSchema = textFileSchemaOf(boxPresetTextSchema)

/** Mod text entry: fields that differ in the set, plus `$unset` for base fields it lacks. */
function textOverrideSchemaOf<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  const keys = Object.keys(schema.shape) as [string, ...string[]]
  return schema
    .extend({ $unset: z.array(z.enum(keys)).min(1).optional() })
    .strict()
    .superRefine((entry, ctx) => {
      const record = entry as Record<string, unknown>
      const set = Object.keys(record).filter((key) => key !== '$unset')
      const unset = (record.$unset as string[] | undefined) ?? []
      if (set.length === 0 && unset.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'A text override must change at least one field' })
      }
      for (const key of unset) {
        if (set.includes(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['$unset'],
            message: `"${key}" cannot be both set and unset`,
          })
        }
      }
    })
}

export const moddableTextOverrideSchemas = {
  pokemon: textOverrideSchemaOf(pokemonTextSchema),
  moves: textOverrideSchemaOf(describedTextSchema),
  abilities: textOverrideSchemaOf(describedTextSchema),
  items: textOverrideSchemaOf(itemTextSchema),
  'battle-states': textOverrideSchemaOf(battleStateTextSchema),
} as const satisfies Record<ModdableKind, z.ZodType>

/** `mods/<set>/i18n/<locale>/<kind>.json`. */
export const moddableTextOverrideFileSchemas = {
  pokemon: textFileSchemaOf(moddableTextOverrideSchemas.pokemon),
  moves: textFileSchemaOf(moddableTextOverrideSchemas.moves),
  abilities: textFileSchemaOf(moddableTextOverrideSchemas.abilities),
  items: textFileSchemaOf(moddableTextOverrideSchemas.items),
  'battle-states': textFileSchemaOf(moddableTextOverrideSchemas['battle-states']),
} as const satisfies Record<ModdableKind, z.ZodType>

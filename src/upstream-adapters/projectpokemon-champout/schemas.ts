import { z } from 'zod'
import {
  battleStates,
  itemCategories,
  moveCategories,
  moveClasses,
  moveTargets,
  pokemonTypes,
} from '../../lib-next/enums'

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const baseSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  name: z.string(),
  description: z.string(),
})

export const championsLinkedBaseSchema = z.object({
  id: slugSchema,
  championsId: z.string(),
  slug: slugSchema,
  name: z.string(),
  description: z.string(),
})

export const i18nSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  slugLoc: slugSchema,
  name: z.string(),
  description: z.string(), // description template, with placeholders like `{0}`
})
export type I18nRecord = z.infer<typeof i18nSchema>

export const itemI18nSchema = i18nSchema.extend({
  pluralName: z.string(),
})
export type ItemI18nRecord = z.infer<typeof itemI18nSchema>

export const moveSchema = championsLinkedBaseSchema.extend({
  type: z.enum(pokemonTypes),
  category: z.enum(moveCategories),
  power: z.number().min(0).max(999),
  pp: z.number().min(0).max(99),
  accuracy: z.number().min(0).max(101),
  priority: z.number().min(-10).max(10),
  target: z.enum(moveTargets),
  classification: z.array(z.enum(moveClasses)),
  contact: z.boolean(), // if its a direct contact move or not
  usable: z.boolean(), // if the game allows you to use it or not (e.g. legacy)
})
export type MoveRecord = z.infer<typeof moveSchema>

export const abilitySchema = championsLinkedBaseSchema.extend({})
export type AbilityRecord = z.infer<typeof abilitySchema>

export const itemSchema = championsLinkedBaseSchema.extend({
  pluralName: z.string(),
  categories: z.array(z.enum(itemCategories)),
})
export type ItemRecord = z.infer<typeof itemSchema>

export const battleStateSchema = baseSchema.extend({
  state: z.enum(battleStates),
})
export type BattleStateRecord = z.infer<typeof battleStateSchema>

export const pokemonSchema = z.object({
  id: slugSchema,
  nid: slugSchema,
  name: z.string(),
  formName: z.string().optional(),
  pokeApiId: z.number().int().positive(),
  pokeApiFormId: z.number().int().positive().optional(),
  showdownId: z.string(),
  baseSpecies: slugSchema.optional(),
  championsId: z.string().regex(/^\d{7}$/),
  type1: z.enum(pokemonTypes),
  type2: z.enum(pokemonTypes).nullable(),
  abilities: z.array(slugSchema),
  baseHp: z.number().int().min(1),
  baseAtk: z.number().int().min(1),
  baseDef: z.number().int().min(1),
  baseSpAtk: z.number().int().min(1),
  baseSpDef: z.number().int().min(1),
  baseSpeed: z.number().int().min(1),
  height: z.number().int().min(-1),
  weight: z.number().int().min(-1),
  isForm: z.boolean(),
  isBattleOnly: z.boolean(),
  isCosmetic: z.boolean(),
  isFemale: z.boolean(),
})
export type PokemonRecord = z.infer<typeof pokemonSchema>

export const pokemonI18nSchema = z.object({
  id: slugSchema,
  championsId: z.string().regex(/^\d{7}$/),
  name: z.string(),
  formName: z.string().optional(),
})
export type PokemonI18nRecord = z.infer<typeof pokemonI18nSchema>

export const pokemonMovesRecordSchema = z.object({
  id: slugSchema,
  moves: z.array(slugSchema),
})
export type PokemonMovesRecord = z.infer<typeof pokemonMovesRecordSchema>

export const pokemonMovesSchema = z.array(pokemonMovesRecordSchema)

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

export const moveSchema = baseSchema.extend({
  typeCode: z.number().int().min(0).max(17),
  type: z.enum(pokemonTypes),
  categoryCode: z.number().int().min(0).max(2),
  category: z.enum(moveCategories),
  power: z.number().min(0).max(999),
  pp: z.number().min(0).max(99),
  accuracy: z.number().min(0).max(101),
  priority: z.number().min(-10).max(10),
  targetCode: z.number().int().min(0).max(14),
  target: z.enum(moveTargets),
  classificationCodes: z.array(z.number().int().min(1).max(12)).max(2),
  classification: z.array(z.enum(moveClasses)),
  isDirect: z.boolean(), // if its a direct contact move or not
  isUsable: z.boolean(), // if the game allows you to use it or not (e.g. legacy)
})
export type MoveRecord = z.infer<typeof moveSchema>

export const abilitySchema = baseSchema.extend({})
export type AbilityRecord = z.infer<typeof abilitySchema>

export const itemSchema = baseSchema.extend({
  pluralName: z.string(),
  categoryCodes: z.array(z.number().int().min(1).max(10)).max(3),
  categories: z.array(z.enum(itemCategories)),
})
export type ItemRecord = z.infer<typeof itemSchema>

export const battleStateSchema = baseSchema.extend({
  stateCode: z.number().int().positive(),
  state: z.enum(battleStates),
})
export type BattleStateRecord = z.infer<typeof battleStateSchema>

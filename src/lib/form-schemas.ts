import { z } from 'zod'
import {
  formBattleConditions,
  formBattleEvents,
  formComparisons,
  formConditionKeys,
  formEnvironments,
  formInteractions,
  formItemRoles,
  formLocations,
  formMechanics,
  formMoveRelations,
  formSeasons,
  formStatusRelations,
  formStatuses,
  formStorageEvents,
  formStorageServices,
  formTimesOfDay,
  formTimeUnits,
  formTriggers,
  formWeather,
  formWeatherRelations,
  languageAlpha3Codes,
  moveCategory,
} from './enums.ts'

const id = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/)
const ids = z
  .array(id)
  .min(1)
  .refine((values) => new Set(values).size === values.length, 'Duplicate IDs')
const key = z.enum(formConditionKeys).enum

/** Requirements for a transition, with stable translation keys and typed parameters. */
export const formConditionSchema = z.discriminatedUnion('key', [
  z.strictObject({ key: z.literal(key.ability), abilities: ids }),
  z.strictObject({
    key: z.literal(key.known_move),
    move: id,
    relation: z.enum(formMoveRelations).optional(),
  }),
  z.strictObject({ key: z.literal(key.move_used), move: id }),
  z.strictObject({
    key: z.literal(key.move_category),
    categories: z.array(z.enum(moveCategory)).min(1),
  }),
  z.strictObject({ key: z.literal(key.time_of_day), time: z.enum(formTimesOfDay) }),
  z.strictObject({
    key: z.literal(key.status),
    status: z.enum(formStatuses),
    relation: z.enum(formStatusRelations),
  }),
  z.strictObject({ key: z.literal(key.fusion_partner), pokemon: id }),
  z.strictObject({ key: z.literal(key.interaction), interaction: z.enum(formInteractions) }),
  z.strictObject({ key: z.literal(key.location), location: z.enum(formLocations) }),
  z.strictObject({ key: z.literal(key.environment), environment: z.enum(formEnvironments) }),
  z.strictObject({ key: z.literal(key.season), season: z.enum(formSeasons) }),
  z.strictObject({
    key: z.literal(key.elapsed_time),
    amount: z.number().positive(),
    unit: z.enum(formTimeUnits),
  }),
  z.strictObject({
    key: z.literal(key.storage_event),
    event: z.enum(formStorageEvents),
    service: z.enum(formStorageServices).optional(),
  }),
  z.strictObject({ key: z.literal(key.transfer), destination: id }),
  z.strictObject({
    key: z.literal(key.battle_event),
    events: z.array(z.enum(formBattleEvents)).min(1),
  }),
  z.strictObject({ key: z.literal(key.original_form), forms: ids }),
  z.strictObject({ key: z.literal(key.intrinsic_form), forms: ids }),
  z.strictObject({ key: z.literal(key.spare_party_slot) }),
  z.strictObject({ key: z.literal(key.mechanic), mechanic: z.enum(formMechanics) }),
  z.strictObject({
    key: z.literal(key.hp),
    comparison: z.enum(formComparisons),
    percent: z.number().min(0).max(100),
  }),
  z.strictObject({
    key: z.literal(key.weather),
    weather: z.array(z.enum(formWeather)).min(1),
    relation: z.enum(formWeatherRelations),
  }),
  z.strictObject({ key: z.literal(key.held_item_absent), items: ids }),
  z.strictObject({ key: z.literal(key.battle_condition), condition: z.enum(formBattleConditions) }),
])

export const formMethodSchema = z
  .strictObject({
    from: ids,
    games: ids.optional(),
    trigger: z.enum(formTriggers),
    minLevel: z.number().int().min(1).max(100).optional(),
    item: z
      .strictObject({ id, role: z.enum(formItemRoles), consumed: z.boolean().optional() })
      .optional(),
    conditions: z.array(formConditionSchema),
    notes: z
      .partialRecord(z.enum(languageAlpha3Codes), z.string().min(1))
      .refine((text) => Object.values(text).some(Boolean), 'Provide at least one translation')
      .optional(),
  })
  .superRefine((method, ctx) => {
    const requiredRole =
      method.trigger === 'use_item' ? 'used' : method.trigger === 'equip_item' ? 'held' : undefined
    if (requiredRole && method.item?.role !== requiredRole) {
      ctx.addIssue({
        code: 'custom',
        path: ['item'],
        message: `${method.trigger} requires a ${requiredRole} item`,
      })
    }
    if (method.item?.consumed && method.item.role !== 'used') {
      ctx.addIssue({
        code: 'custom',
        path: ['item', 'consumed'],
        message: 'Only used items can be consumed',
      })
    }
    if (
      method.trigger === 'fuse' &&
      !method.conditions.some((condition) => condition.key === 'fusion_partner')
    ) {
      ctx.addIssue({ code: 'custom', path: ['conditions'], message: 'Fusion requires a partner' })
    }
    if (method.trigger === 'special' && method.conditions.length === 0 && !method.notes) {
      ctx.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: 'Special methods require a condition or explanatory note',
      })
    }
    const conditions = method.conditions.map((condition) => JSON.stringify(condition))
    if (new Set(conditions).size !== conditions.length) {
      ctx.addIssue({ code: 'custom', path: ['conditions'], message: 'Duplicate condition' })
    }
  })

export type FormCondition = z.infer<typeof formConditionSchema>
export type FormMethod = z.infer<typeof formMethodSchema>

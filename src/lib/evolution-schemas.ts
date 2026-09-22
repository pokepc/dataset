import { z } from 'zod'
import {
  evoActivations,
  evoConditionKeys,
  evoGenders,
  evoItemRoles,
  evoLocations,
  evoMoveStyles,
  evoRegionRelations,
  evoScrolls,
  evoSpinComparisons,
  evoSpinDirections,
  evoStatComparisons,
  evoTimesOfDay,
  evoTriggers,
  evoWalkModes,
  evoWeather,
  languageAlpha3Codes,
  typeIds,
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
const count = z.number().int().positive()
const localizedText = z
  .partialRecord(z.enum(languageAlpha3Codes), z.string().min(1))
  .refine((text) => Object.values(text).some(Boolean), 'Provide at least one translation')
const conditionKey = z.enum(evoConditionKeys).enum

/** Stable translation keys with validated parameters, not an executable expression language. */
export const evolutionConditionSchema = z.discriminatedUnion('key', [
  z.strictObject({ key: z.literal(conditionKey.friendship) }),
  z.strictObject({ key: z.literal(conditionKey.affection), minLevel: count }),
  z.strictObject({
    key: z.literal(conditionKey.beauty),
    minValue: z.number().int().min(0).max(255),
  }),
  z.strictObject({ key: z.literal(conditionKey.gender), gender: z.enum(evoGenders) }),
  z.strictObject({ key: z.literal(conditionKey.time_of_day), time: z.enum(evoTimesOfDay) }),
  z.strictObject({ key: z.literal(conditionKey.known_move), move: id }),
  z.strictObject({ key: z.literal(conditionKey.known_move_type), type: z.enum(typeIds) }),
  z.strictObject({ key: z.literal(conditionKey.ability), abilities: ids }),
  z.strictObject({ key: z.literal(conditionKey.party_pokemon), pokemon: id }),
  z.strictObject({ key: z.literal(conditionKey.party_type), type: z.enum(typeIds) }),
  z.strictObject({ key: z.literal(conditionKey.trade_partner), pokemon: id }),
  z.strictObject({
    key: z.literal(conditionKey.attack_defense_comparison),
    comparison: z.enum(evoStatComparisons),
  }),
  z.strictObject({
    key: z.literal(conditionKey.overworld_weather),
    weather: z.array(z.enum(evoWeather)).min(1),
  }),
  z.strictObject({
    key: z.literal(conditionKey.location),
    location: z.enum(evoLocations),
  }),
  z.strictObject({
    key: z.literal(conditionKey.region),
    region: id,
    relation: z.enum(evoRegionRelations),
  }),
  z.strictObject({ key: z.literal(conditionKey.device_upside_down) }),
  z.strictObject({ key: z.literal(conditionKey.union_circle) }),
  z.strictObject({ key: z.literal(conditionKey.walk_steps), count, mode: z.enum(evoWalkModes) }),
  z.strictObject({ key: z.literal(conditionKey.outside_poke_ball) }),
  z.strictObject({ key: z.literal(conditionKey.battle_experience) }),
  z.strictObject({
    key: z.literal(conditionKey.use_move),
    move: id,
    count,
    style: z.enum(evoMoveStyles).optional(),
  }),
  z.strictObject({ key: z.literal(conditionKey.hit_with_move), move: id, count }),
  z.strictObject({ key: z.literal(conditionKey.recoil_damage_without_fainting), amount: count }),
  z.strictObject({ key: z.literal(conditionKey.damage_without_fainting), amount: count }),
  z.strictObject({ key: z.literal(conditionKey.critical_hits_in_one_battle), count }),
  z.strictObject({
    key: z.literal(conditionKey.defeat_pokemon_holding_item),
    pokemon: id,
    item: id,
    count,
  }),
  z.strictObject({
    key: z.literal(conditionKey.spin),
    direction: z.enum(evoSpinDirections),
    seconds: z.number().positive(),
    comparison: z.enum(evoSpinComparisons),
  }),
  z.strictObject({
    key: z.literal(conditionKey.hidden_value_branch),
    percentage: z.number().positive().max(100),
  }),
  z.strictObject({ key: z.literal(conditionKey.nature), natures: ids }),
  z.strictObject({ key: z.literal(conditionKey.spare_party_slot) }),
  z.strictObject({ key: z.literal(conditionKey.spare_poke_ball) }),
  z.strictObject({ key: z.literal(conditionKey.evolve_other), pokemon: id }),
  z.strictObject({ key: z.literal(conditionKey.full_moon) }),
  z.strictObject({
    key: z.literal(conditionKey.interact_with_scroll),
    scroll: z.enum(evoScrolls),
  }),
  z.strictObject({ key: z.literal(conditionKey.vivillon_pattern), pattern: id }),
  z.strictObject({ key: z.literal(conditionKey.candy), pokemon: id, count }),
])

export const evolutionMethodSchema = z
  .strictObject({
    // Alternatives between entries, conjunction within an entry; `from` is a choice of source forms.
    from: ids,
    games: ids.optional(),
    trigger: z.enum(evoTriggers),
    minLevel: z.number().int().min(1).max(100).optional(),
    item: z.strictObject({ id, role: z.enum(evoItemRoles), quantity: count.optional() }).optional(),
    conditions: z.array(evolutionConditionSchema),
    additionalResult: z.boolean().optional(),
    // PLA exposes an Evolve action instead of automatically evolving when requirements are met.
    activation: z.enum(evoActivations).optional(),
    notes: localizedText.optional(),
  })
  .superRefine((method, ctx) => {
    if (method.trigger === 'use_item' && method.item?.role !== 'used') {
      ctx.addIssue({
        code: 'custom',
        path: ['item'],
        message: 'Item-use methods require a used item',
      })
    }
    if (method.item?.role === 'used' && method.trigger !== 'use_item') {
      ctx.addIssue({
        code: 'custom',
        path: ['trigger'],
        message: 'Used items require the use_item trigger',
      })
    }
    if (method.trigger === 'special' && method.conditions.length === 0 && !method.notes) {
      ctx.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: 'Special methods require a condition or explanatory note',
      })
    }
    const keys = method.conditions.map((condition) => condition.key)
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: 'Use one condition per key; separate alternatives into methods',
      })
    }
  })

export type EvolutionCondition = z.infer<typeof evolutionConditionSchema>
export type EvolutionMethod = z.infer<typeof evolutionMethodSchema>

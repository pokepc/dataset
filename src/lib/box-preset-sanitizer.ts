import { modernBoxPresetSlotSchema } from './schemas'

export type ModernBoxPresetSlotInput =
  | null
  | string
  | {
      pid: string
      shiny?: boolean
      gmax?: boolean
      shinyLocked?: boolean
    }

export type ModernBoxPresetSlotSanitizerContext = {
  gameSet: string
  presetId: string
  boxIndex: number
  slotIndex: number
  validPokemonIds: ReadonlySet<string>
}

export type ModernBoxPresetSlotFilter = (
  slot: ModernBoxPresetSlotInput,
  context: ModernBoxPresetSlotSanitizerContext,
) => ModernBoxPresetSlotInput

export type ModernBoxPresetSanitizerDiagnostic = {
  reason: 'incompatible-classic-pokemon-id'
  pokemon: string
  gameSet: string
  presetId: string
  boxIndex: number
  slotIndex: number
}

export const incompatibleClassicPokemonIds = [
  'greninja--battle-bond',
  'rockruff--own-tempo',
  'zygarde--power-construct',
  'zygarde-10--power-construct',
] as const
const incompatibleClassicPokemonIdSet = new Set<string>(incompatibleClassicPokemonIds)

function getSlotPokemonId(slot: ModernBoxPresetSlotInput): string | null {
  if (slot === null) return null
  if (typeof slot === 'string') return slot
  return slot.pid
}

function isIncompatibleClassicPokemonId(slot: ModernBoxPresetSlotInput): boolean {
  const pokemonId = getSlotPokemonId(slot)
  return pokemonId !== null && incompatibleClassicPokemonIdSet.has(pokemonId)
}

export const modernBoxPresetSlotFilters: ModernBoxPresetSlotFilter[] = [
  (slot) => (isIncompatibleClassicPokemonId(slot) ? null : slot),
]

export function sanitizeModernBoxPresetSlot(
  slot: ModernBoxPresetSlotInput,
  context: ModernBoxPresetSlotSanitizerContext,
): Pkds.ModernBoxPresetSlot {
  const sanitized = modernBoxPresetSlotFilters.reduce(
    (currentSlot, filter) => filter(currentSlot, context),
    slot,
  )
  if (sanitized === null || typeof sanitized === 'string') {
    return sanitized
  }
  return modernBoxPresetSlotSchema.parse({
    pokemon: sanitized.pid,
    shiny: sanitized.shiny,
    gmax: sanitized.gmax,
    shinyLocked: sanitized.shinyLocked,
  })
}

export function sanitizeModernBoxPresetSlots(
  slots: ModernBoxPresetSlotInput[],
  context: Omit<ModernBoxPresetSlotSanitizerContext, 'slotIndex'>,
): Pkds.ModernBoxPresetSlot[] {
  return slots.map((slot, slotIndex) =>
    sanitizeModernBoxPresetSlot(slot, {
      ...context,
      slotIndex,
    }),
  )
}

export function collectModernBoxPresetSanitizerDiagnostics(
  originalSlots: ModernBoxPresetSlotInput[],
  sanitizedSlots: Pkds.ModernBoxPresetSlot[],
  context: Omit<ModernBoxPresetSlotSanitizerContext, 'slotIndex'>,
): ModernBoxPresetSanitizerDiagnostic[] {
  return originalSlots.flatMap((slot, slotIndex) => {
    const pokemon = getSlotPokemonId(slot)
    if (pokemon === null || sanitizedSlots[slotIndex] !== null) return []
    if (!incompatibleClassicPokemonIdSet.has(pokemon)) return []
    return [
      {
        reason: 'incompatible-classic-pokemon-id' as const,
        pokemon,
        gameSet: context.gameSet,
        presetId: context.presetId,
        boxIndex: context.boxIndex,
        slotIndex,
      },
    ]
  })
}

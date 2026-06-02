export const gameTypes = ['superset', 'set', 'game', 'dlc'] as const
export type GameType = (typeof gameTypes)[number]

export const gameSeries = ['main', 'spinoff', 'storage', 'legends'] as const
export type GameSeries = (typeof gameSeries)[number]

export const gamePlatforms = [
  'gb',
  'gbc',
  'gba',
  'nds',
  '3ds',
  'mobile',
  'ngc',
  'wii',
  'wiiu',
  'switch',
  'switch2',
] as const
export type GamePlatform = (typeof gamePlatforms)[number]

export const pokemonTypes = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const

export const pokemonTypesInternalOrder: PokemonType[] = [
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
  'fairy',
]
export type PokemonType = (typeof pokemonTypes)[number]

export const moveCategories = ['physical', 'special', 'status'] as const
export type MoveCategory = (typeof moveCategories)[number]

export const moveClasses = [
  'punching',
  'sound_based',
  'dance',
  'slicing',
  'wind',
  'powder',
  'ball_bomb',
  'pulse',
  'biting',
  'explosive',
  'mental',
  'healing',
] as const
export type MoveClass = (typeof moveClasses)[number]

export const moveTargets = [
  'single_target',
  'self',
  'single_ally',
  'all_allies',
  'random_opponent',
  'all_opponents',
  'entire_field',
  'opponents_side',
  'users_side',
  'all_pokemon',
  'varies',
] as const
export type MoveTarget = (typeof moveTargets)[number]

export const statusConditions = [
  'paralyzed',
  'frozen',
  'poisoned',
  'badly_poisoned',
  'burned',
  'asleep',
] as const
export type StatusCondition = (typeof statusConditions)[number]

export const battleStates = [
  'harsh_sunlight',
  'rain',
  'sandstorm',
  'snow',
  'electric_terrain',
  'grassy_terrain',
  'misty_terrain',
  'trick_room',
  'magic_room',
  'wonder_room',
  'critical_hit_ratio_boost',
  'confused',
  'infatuated',
  'drowsy',
  'encore',
  'no_ability',
  'unable_to_repeat',
  'tailwind',
  'move_disabled',
  'cant_escape',
  'locked_on',
  'electric_boost',
  'gravity',
  'safeguard',
  'stealth_rock',
  'stockpiling',
  'taunted',
  'magnet_rise',
  'toxic_spikes',
  'wish',
  'sticky_web',
  'ingrained',
  'cursed',
  'trick_or_treating',
  'light_screen',
  'reflect',
  'sealing_off',
  'perishing',
  'spikes',
  'destiny_bound',
  'forest_cursed',
  'leech_seeded',
  'bound',
  'rampaging',
  'badly_poisoned',
  'future_attack',
  'uproar',
  'aqua_ring',
  'landed',
  'fairy_locked',
  'psychic_terrain',
  'throat_chopped',
  'aurora_veil',
  'salt_cured',
  'syrupy',
  'healing_prevented',
  'recharging',
  'charging',
  'sky_high',
  'submerged',
  'underground',
  'concealed',
  'minimized',
  'atk_def_swapped',
  'flash_fire',
  'micle_berry',
]
export type BattleState = (typeof battleStates)[number]

export const itemCategories = [
  'power_boost',
  'recovery',
  'defense',
  'stat_boost',
  'effect_extend',
  'berry',
  'other',
  'mega_stone',
] as const
export type ItemCategory = (typeof itemCategories)[number]

export const bagCategories = [
  'ball',
  'medicine',
  'battle',
  'berry',
  'machine',
  'mega_stone',
  'z_crystal',
  'treasure',
  'ingredient',
  'material',
  'key',
  'other',
] as const
export type BagCategory = (typeof bagCategories)[number]

export const pokeballCategories = ['regular', 'special', 'hisuian', 'other'] as const
export type PokeballCategory = (typeof pokeballCategories)[number]

export const ribbonCategories = ['league', 'contest', 'tower', 'memory', 'gift'] as const
export type RibbonCategory = (typeof ribbonCategories)[number]

export const statIds = ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'] as const
export type StatId = (typeof statIds)[number]

export const titleTypes = ['ribbon', 'mark', 'custom'] as const
export type TitleType = (typeof titleTypes)[number]

export const pokemonSizes = ['xs', 's', 'm', 'l', 'xl'] as const
export type PokemonSize = (typeof pokemonSizes)[number]

export const genders = ['m', 'f'] as const // m: male, f: female, null/undefined: genderless
export type Gender = (typeof genders)[number]

/**
 * In most core series games:
 * - IV of 0: "No good" (or "Not So Good" in Let's GO)
 * - IV range of 1-15: "Decent" (or "OK" in Let's GO)
 * - IV range of 16-25: "Pretty good" (or "Good" in Let's GO)
 * - IV range 26-29: "Very good"
 * - IV of 30: "Fantastic"
 * - IV of 31: "Best"
 *  */
export const ivJudgeValues = ['nogood', 'decent', 'good', 'verygood', 'fantastic', 'best'] as const
export type IvJudgeValue = (typeof ivJudgeValues)[number]

export const battleStyles = ['singles', 'doubles', 'triples', 'rotation', 'royale'] as const
export type BattleStyle = (typeof battleStyles)[number]

export const raidStyles = ['dynamax', 'tera'] as const
export type RaidStyle = (typeof raidStyles)[number]

export const gameType = ['superset', 'set', 'game', 'dlc'] as const
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
export const gameSeries = ['main', 'spinoff', 'storage', 'legends'] as const
export const itemCategory = [
  'ball',
  'medicine',
  'battle',
  'berry',
  'machine',
  'megastone',
  'zcrystal',
  'treasure',
  'ingredient',
  'material',
  'key',
  'other',
] as const
export const pokeballCategory = ['regular', 'special', 'hisuian', 'other'] as const
export const languageIds = [
  'en',
  'es',
  'esla',
  'fr',
  'de',
  'it',
  'ja',
  'ko',
  'chs',
  'cht',
  'pt',
] as const
export const languageAlpha3Codes = [
  'eng',
  'esp',
  'esla',
  'fra',
  'deu',
  'ita',
  'jap',
  'kor',
  'chs',
  'cht',
  'por',
] as const

/**
 * @deprecated use gameLocales from lib-next/languages
 */
export const languageInGameCodes = [
  'ENG',
  'ES-ES',
  'ES-LA',
  'FRA',
  'DEU',
  'ITA',
  'JPN',
  'KOR',
  'CHT',
  'CHS',
  'PT-BR',
] as const

export const ribbonCategory = ['league', 'contest', 'tower', 'memory', 'gift'] as const
export const typeIds = [
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
  // Special types:
  // 'shadow', // Shadow pokemon in Colosseum and XD
  'stellar', // keep. it can be used as Tera type and move damage in Scarlet and Violet
] as const

/** Category tags on abilities (data/abilities.json `tags`). */
export const abilityTagIds = [
  'alert',
  'ally-helper',
  'stat-boost',
  'move-boost',
  'bypass',
  'defense',
  'handicap',
  'heal',
  'items',
  'priority-control',
  'damage',
  'target-weaken',
  'status-trigger',
  'status-immunity',
  'steal',
  'weather',
  'terrain',
  'trap',
  'ability-change',
  'type-change',
  'species-specific',
  'other',
] as const

export const statIds = ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'] as const
export const moveCategory = ['physical', 'special', 'status'] as const
export const genders = ['m', 'f'] as const // m: male, f: female, null/undefined: genderless
export const titleTypes = ['ribbon', 'mark', 'custom'] as const
export const pokemonSizes = ['xs', 's', 'm', 'l', 'xl'] as const

/*
In most core series games:
IV of 0: "No good" (or "Not So Good" in Let's GO)
IV range of 1-15: "Decent" (or "OK" in Let's GO)
IV range of 16-25: "Pretty good" (or "Good" in Let's GO)
IV range 26-29: "Very good"
IV of 30: "Fantastic"
IV of 31: "Best"
 */
export const ivJudgeValues = ['nogood', 'decent', 'good', 'verygood', 'fantastic', 'best'] as const

export const battleStyles = ['singles', 'doubles', 'triples', 'rotation', 'royale'] as const
export const raidStyles = ['dynamax', 'tera'] as const

/** Evolution vocabulary, also used by the evolution schemas. */
export const evoTriggers = ['level_up', 'trade', 'use_item', 'special'] as const
export const evoItemRoles = ['held', 'used', 'bag'] as const
export const evoActivations = ['automatic', 'manual'] as const
export const evoConditionKeys = [
  'friendship',
  'affection',
  'beauty',
  'gender',
  'time_of_day',
  'known_move',
  'known_move_type',
  'ability',
  'party_pokemon',
  'party_type',
  'trade_partner',
  'attack_defense_comparison',
  'overworld_weather',
  'location',
  'region',
  'device_upside_down',
  'union_circle',
  'walk_steps',
  'outside_poke_ball',
  'battle_experience',
  'use_move',
  'hit_with_move',
  'recoil_damage_without_fainting',
  'damage_without_fainting',
  'critical_hits_in_one_battle',
  'defeat_pokemon_holding_item',
  'spin',
  'hidden_value_branch',
  'nature',
  'spare_party_slot',
  'spare_poke_ball',
  'evolve_other',
  'full_moon',
  'interact_with_scroll',
  'vivillon_pattern',
  'candy',
] as const
export const evoGenders = ['male', 'female', 'genderless'] as const
export const evoTimesOfDay = ['day', 'night', 'dusk'] as const
export const evoStatComparisons = ['lt', 'eq', 'gt'] as const
export const evoWeather = ['rain', 'fog'] as const
export const evoLocations = [
  'magnetic_field',
  'moss_rock',
  'ice_rock',
  'mount_lanakila',
  'dusty_bowl_arch',
  'coulant_waterway_bridge',
] as const
export const evoRegionRelations = ['in', 'outside'] as const
export const evoWalkModes = ['lets_go'] as const
export const evoMoveStyles = ['agile', 'strong'] as const
export const evoSpinDirections = ['clockwise', 'counterclockwise', 'either'] as const
export const evoSpinComparisons = ['lt', 'gt'] as const
export const evoScrolls = ['darkness', 'waters'] as const

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
export const pokemonSizes = ['xxxs', 'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const

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

/** Form transition vocabulary, also used by the form schemas. */
export const formTriggers = [
  'use_item',
  'equip_item',
  'remove_item',
  'learn_move',
  'forget_move',
  'use_move',
  'interact',
  'fuse',
  'separate',
  'automatic',
  'special',
] as const
export const formItemRoles = ['held', 'used', 'bag'] as const
export const formConditionKeys = [
  'ability',
  'known_move',
  'move_used',
  'move_category',
  'time_of_day',
  'status',
  'fusion_partner',
  'interaction',
  'location',
  'environment',
  'season',
  'elapsed_time',
  'storage_event',
  'transfer',
  'battle_event',
  'original_form',
  'intrinsic_form',
  'spare_party_slot',
  'mechanic',
  'hp',
  'weather',
  'held_item_absent',
  'battle_condition',
] as const
export const formMoveRelations = ['knows', 'does_not_know'] as const
export const formTimesOfDay = ['morning', 'day', 'dusk', 'evening', 'night'] as const
export const formStatuses = ['frozen', 'frostbite', 'fainted'] as const
export const formStatusRelations = ['is', 'not'] as const
export const formInteractions = [
  'contest_spectacular_ends',
  'deoxys_meteorite',
  'electric_fan',
  'enter_contest_spectacular',
  'enter_union_room',
  'enter_wifi_club',
  'furfrou_groom',
  'furfrou_restore_natural',
  'lawn_mower',
  'leave_distortion_world',
  'light_bulb',
  'load_game',
  'microwave_oven',
  'reassembly_unit',
  'recall_outside_battle',
  'refrigerator',
  'return_appliance',
  'washing_machine',
] as const
export const formLocations = [
  'alabaster_icelands',
  'ambrette_fossil_lab_meteorites',
  'bell_tower',
  'burned_tower',
  'cobalt_coastlands',
  'coronet_highlands',
  'crimson_mirelands',
  'dalizapa_passage',
  'distortion_world',
  'east_province_area_one',
  'east_province_area_two',
  'friseur_furfrou',
  'glaseado_mountain',
  'hauoli_city_salon',
  'hokulani_observatory_meteorite',
  'jaune_sector_6',
  'jubilife_village',
  'jubilife_village_player_quarters',
  'kanto_route_3_meteorites',
  'malie_city_salon',
  'nacrene_museum_meteorite',
  'north_province_area_one',
  'obsidian_fieldlands',
  'professor_birchs_lab',
  'professor_cozmos_house_meteorite',
  'professor_kukuis_lab',
  'shopping_mall_nine_basement',
  'silph_co_rotom_room',
  'slateport_pokemon_fan_club',
  'socarrat_trail',
  'south_province_area_five',
  'south_province_area_four',
  'south_province_area_one',
  'sprout_tower',
  'sycamore_pokemon_lab',
  'team_galactic_eterna_building_rotom_room',
  'veilstone_city_meteorites',
  'west_province_area_three',
  'west_province_area_two',
] as const
export const formEnvironments = [
  'building',
  'cave_or_beach',
  'outdoors_or_tall_grass',
  'outside_distortion_world',
  'snowstorm',
] as const
export const formSeasons = ['spring', 'summer', 'autumn', 'winter'] as const
export const formTimeUnits = ['turns', 'days', 'seconds'] as const
export const formStorageEvents = ['deposit', 'withdrawal'] as const
export const formStorageServices = ['bank', 'day_care', 'home', 'nursery', 'pc'] as const
export const formBattleEvents = [
  'battle_start',
  'battle_end',
  'switch_in',
  'switch_out',
  'end_of_turn',
  'before_move',
  'after_move',
  'damaging_hit',
  'physical_hit',
  'faint',
] as const
/** Event shorthand accepted by formMethods[].revert. */
export const formRevertEvents = formBattleEvents
export const formMechanics = [
  'change_a_move_other_than_secret_sword',
  'dynamax',
  'gigantamax',
  'in_party',
  'legend_plate',
  'mega_evolution',
  'not_holding_griseous_orb',
  'participated_in_battle',
  'terastallization',
  'ultra_burst',
] as const
export const formComparisons = ['lt', 'lte', 'eq', 'gte', 'gt'] as const
export const formWeather = ['sun', 'rain', 'hail', 'snow', 'none'] as const
export const formWeatherRelations = ['in', 'outside'] as const
export const formBattleConditions = [
  'ability_is_not_sheer_force',
  'at_least_40_additional_zygarde_cells',
  'battle_bond_not_previously_used',
  'battle_continues',
  'confusion_self_hit',
  'directly_knock_out_opponent',
  'disguise_not_bypassed',
  'forecast_suppressed_or_replaced',
  'gigantamax_factor',
  'hail_or_snow_begins',
  'ice_face_not_bypassed',
  'in_battle',
  'judgment_type_match',
  'legends_arceus_sunshine_conditions_ended',
  'mega_gauge_full',
  'mega_power_depleted',
  'move_affects_at_least_one_target',
  'move_deals_damage',
  'not_dynamaxed',
  'not_terastallized',
  'rayquaza_mega_eligible',
  'sunlight_effect_or_flower_gift_inactive',
  'ultra_burst_unused_by_trainer',
  'weather_effects_active',
  'weather_effects_negated',
  'zen_mode_suppressed_or_replaced',
] as const

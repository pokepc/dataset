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
export const languageIds = ['en', 'es', 'esla', 'fr', 'de', 'it', 'ja', 'ko', 'chs', 'cht'] as const
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
] as const
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

import type {
  ItemCategory,
  MoveCategory,
  MoveClass,
  MoveTarget,
  PokemonType,
} from '../../lib-next/enums'
import { appLangsBySlug, type LangInfo } from '../../lib-next/languages'

export const I18N_CODE = [
  'deu',
  'esp',
  'fra',
  'ita',
  'jpn',
  'kor',
  'latam',
  'sch',
  'tch',
  'usa',
  // 'bra' // TODO add when released
] as const
export type I18nCode = (typeof I18N_CODE)[number]

export const langMap: Record<I18nCode, LangInfo> = {
  usa: appLangsBySlug.en,
  esp: appLangsBySlug.es,
  latam: appLangsBySlug.mx,
  deu: appLangsBySlug.de,
  ita: appLangsBySlug.it,
  fra: appLangsBySlug.fr,
  kor: appLangsBySlug.kr,
  jpn: appLangsBySlug.jp,
  tch: appLangsBySlug.tw,
  sch: appLangsBySlug.cn,
  // bra:  appLangsBySlug.br,
}

export const MOVE_CATEGORY_BY_CODE = {
  0: 'physical',
  1: 'special',
  2: 'status',
} as const satisfies Readonly<Partial<Record<number, MoveCategory>>>

export const MOVE_CLASSIFICATION_BY_CODE = {
  1: 'punching',
  2: 'sound_based',
  3: 'dance',
  4: 'slicing',
  5: 'wind',
  6: 'powder',
  7: 'ball_bomb',
  8: 'pulse',
  9: 'biting',
  10: 'explosive',
  11: 'mental',
  12: 'healing',
} as const satisfies Readonly<Partial<Record<number, MoveClass>>>

export const MOVE_TARGET_BY_CODE = {
  0: 'single_target',
  1: 'self',
  2: 'single_ally',
  3: 'all_allies',
  4: 'random_opponent',
  5: 'all_opponents',
  6: 'entire_field',
  7: 'opponents_side',
  8: 'users_side',
  9: 'all_pokemon',
  10: 'varies',
  11: 'opponents_side',
  12: 'users_side',
  13: 'varies',
  14: 'all_allies',
} as const satisfies Readonly<Partial<Record<number, MoveTarget>>>

export const ITEM_CATEGORY_BY_CODE = {
  1: 'stat_boost',
  2: 'power_boost',
  3: 'defense',
  4: 'recovery',
  5: 'effect_extend',
  6: 'berry',
  8: 'mega_stone',
  10: 'other',
} as const satisfies Readonly<Partial<Record<number, ItemCategory>>>

export const POKEMON_TYPE_BY_CODE = {
  0: 'normal',
  1: 'fighting',
  2: 'flying',
  3: 'poison',
  4: 'ground',
  5: 'rock',
  6: 'bug',
  7: 'ghost',
  8: 'steel',
  9: 'fire',
  10: 'water',
  11: 'grass',
  12: 'electric',
  13: 'psychic',
  14: 'ice',
  15: 'dragon',
  16: 'dark',
  17: 'fairy',
} as const satisfies Readonly<Partial<Record<number, PokemonType>>>

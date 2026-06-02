// Browser-compatible locales
export const browserLocales = [
  'en',
  'es',
  'es-419', // official code for ES-LATAM
  'de',
  'it',
  'fr',
  'ko',
  'ja',
  'zh-tw',
  'zh-cn',
  'pt-br',
] as const
export type BrowserLocale = (typeof browserLocales)[number]
export const DEFAULT_LOCALE: BrowserLocale = 'en'

// In-game locale codes (in their lang)
export const gameLocales = [
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
export type GameLocale = (typeof gameLocales)[number]
export const DEFAULT_GAME_LOCALE: GameLocale = 'ENG'

// These are 2-char codes commonly used in website URLs and domains
// Use them in URL paths, DB, etc. but not in HTML lang attributes (use locale instead)
export const langSlugs = [
  'en',
  'es',
  'mx', // latam spanish (mexican spanish is the standard basis for es-419/ES-LA)
  'de',
  'it',
  'fr',
  'kr',
  'jp',
  'tw', // traditional chinese (taiwanese)
  'cn', // simplified chinese (mainland)
  'br', // brazilian portuguese
] as const
export type LangSlug = (typeof langSlugs)[number]
export const DEFAULT_LANG_SLUG: LangSlug = 'en'

export const browserLocaleMap: Record<BrowserLocale, { slug: LangSlug; gameLocale: GameLocale }> = {
  en: { slug: 'en', gameLocale: 'ENG' },
  es: { slug: 'es', gameLocale: 'ES-ES' },
  'es-419': { slug: 'mx', gameLocale: 'ES-LA' },
  de: { slug: 'de', gameLocale: 'DEU' },
  it: { slug: 'it', gameLocale: 'ITA' },
  fr: { slug: 'fr', gameLocale: 'FRA' },
  ko: { slug: 'kr', gameLocale: 'KOR' },
  ja: { slug: 'jp', gameLocale: 'JPN' },
  'zh-tw': { slug: 'tw', gameLocale: 'CHT' },
  'zh-cn': { slug: 'cn', gameLocale: 'CHS' },
  'pt-br': { slug: 'br', gameLocale: 'PT-BR' },
}
export const gameLocaleMap: Record<GameLocale, { slug: LangSlug; browserLocale: BrowserLocale }> = {
  ENG: { slug: 'en', browserLocale: 'en' },
  'ES-ES': { slug: 'es', browserLocale: 'es' },
  'ES-LA': { slug: 'mx', browserLocale: 'es-419' },
  DEU: { slug: 'de', browserLocale: 'de' },
  ITA: { slug: 'it', browserLocale: 'it' },
  FRA: { slug: 'fr', browserLocale: 'fr' },
  KOR: { slug: 'kr', browserLocale: 'ko' },
  JPN: { slug: 'jp', browserLocale: 'ja' },
  CHT: { slug: 'tw', browserLocale: 'zh-tw' },
  CHS: { slug: 'cn', browserLocale: 'zh-cn' },
  'PT-BR': { slug: 'br', browserLocale: 'pt-br' },
}

export const langSlugMap: Record<
  LangSlug,
  { gameLocale: GameLocale; browserLocale: BrowserLocale }
> = {
  en: { gameLocale: 'ENG', browserLocale: 'en' },
  es: { gameLocale: 'ES-ES', browserLocale: 'es' },
  mx: { gameLocale: 'ES-LA', browserLocale: 'es-419' },
  de: { gameLocale: 'DEU', browserLocale: 'de' },
  it: { gameLocale: 'ITA', browserLocale: 'it' },
  fr: { gameLocale: 'FRA', browserLocale: 'fr' },
  kr: { gameLocale: 'KOR', browserLocale: 'ko' },
  jp: { gameLocale: 'JPN', browserLocale: 'ja' },
  tw: { gameLocale: 'CHT', browserLocale: 'zh-tw' },
  cn: { gameLocale: 'CHS', browserLocale: 'zh-cn' },
  br: { gameLocale: 'PT-BR', browserLocale: 'pt-br' },
}

export const langMeta: Record<LangSlug, { name: string; engName: string; flag: string }> = {
  en: { name: 'English', engName: 'English', flag: '🇺🇸' },
  es: { name: 'Español', engName: 'Spanish', flag: '🇪🇸' },
  mx: { name: 'Español (Latinoamérica)', engName: 'Spanish (Latin America)', flag: '🇲🇽' },
  de: { name: 'Deutsch', engName: 'German', flag: '🇩🇪' },
  it: { name: 'Italiano', engName: 'Italian', flag: '🇮🇹' },
  fr: { name: 'Français', engName: 'French', flag: '🇫🇷' },
  kr: { name: '한국어', engName: 'Korean', flag: '🇰🇷' },
  jp: { name: '日本語', engName: 'Japanese', flag: '🇯🇵' },
  tw: { name: '繁體中文', engName: 'Traditional Chinese', flag: '🇹🇼' },
  cn: { name: '简体中文', engName: 'Simplified Chinese', flag: '🇨🇳' },
  br: { name: 'Português (Brasil)', engName: 'Portuguese (Brazil)', flag: '🇧🇷' },
}

export type LangInfo = {
  slug: LangSlug
  locale: BrowserLocale
  gameLocale: GameLocale
  name: string
  engName: string
  flag: string
}

export const appLangs: LangInfo[] = browserLocales.map((locale) => ({
  slug: browserLocaleMap[locale].slug,
  locale,
  gameLocale: browserLocaleMap[locale].gameLocale,
  name: langMeta[browserLocaleMap[locale].slug].name,
  engName: langMeta[browserLocaleMap[locale].slug].engName,
  flag: langMeta[browserLocaleMap[locale].slug].flag,
}))

export const appLangsBySlug = Object.fromEntries(
  Object.values(appLangs).map((info) => [info.slug, info]),
) as Record<LangSlug, LangInfo>

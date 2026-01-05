export type SupportedPokeLang2Char = Exclude<Pkds.LanguageAlpha2, 'esla'>
export type SupportedPokeLang3Char = Exclude<Pkds.LanguageAlpha3, 'esla'>
export type SupportedPokeLang = SupportedPokeLang2Char | SupportedPokeLang3Char

export type PokeLangData = {
  flag: string
  code2Char: Pkds.LanguageAlpha2
  code3Char: Pkds.LanguageAlpha3
  locale: string
  title: string
  fullTitle: string
  synonyms: string[]
}

export const pokeLangData: Record<`${SupportedPokeLang2Char}`, PokeLangData> = {
  en: {
    flag: '🇺🇸',
    code2Char: 'en',
    code3Char: 'eng',
    locale: 'en-US',
    title: 'English',
    fullTitle: 'English',
    synonyms: ['en', 'eng', 'en-US', 'en-gb'],
  },
  de: {
    flag: '🇩🇪',
    code2Char: 'de',
    code3Char: 'deu',
    locale: 'de',
    title: 'Deutsch',
    fullTitle: 'Deutsch (German)',
    synonyms: ['de', 'deu', 'de-DE'],
  },
  fr: {
    flag: '🇫🇷',
    code2Char: 'fr',
    code3Char: 'fra',
    locale: 'fr',
    title: 'Français',
    fullTitle: 'Français (French)',
    synonyms: ['fr', 'fra', 'fr-FR'],
  },
  es: {
    flag: '🇪🇸',
    code2Char: 'es',
    code3Char: 'esp',
    locale: 'es-ES',
    title: 'Español',
    fullTitle: 'Español (Spanish)',
    synonyms: ['es', 'esp', 'es-ES'],
  },
  it: {
    flag: '🇮🇹',
    code2Char: 'it',
    code3Char: 'ita',
    locale: 'it',
    title: 'Italiano',
    fullTitle: 'Italiano',
    synonyms: ['it', 'ita', 'it-IT'],
  },
  ja: {
    flag: '🇯🇵',
    code2Char: 'ja',
    code3Char: 'jap',
    locale: 'ja',
    title: '日本語',
    fullTitle: '日本語 (Japanese)',
    synonyms: ['ja', 'jap', 'jpn', 'ja-JP', 'jp-JP'],
  },
  ko: {
    flag: '🇰🇷',
    code2Char: 'ko',
    code3Char: 'kor',
    locale: 'ko',
    title: '한국어',
    fullTitle: '한국어 (Korean)',
    synonyms: ['ko', 'kor', 'ko-KR'],
  },
  cht: {
    flag: '🇹🇼',
    code2Char: 'cht',
    code3Char: 'cht',
    locale: 'zh-TW',
    title: '繁體中文',
    fullTitle: '繁體中文 (Traditional Chinese)',
    synonyms: ['cht', 'cht-TW', 'zh-Hant', 'zh-TW'],
  },
  chs: {
    flag: '🇨🇳',
    code2Char: 'chs',
    code3Char: 'chs',
    locale: 'zh-CN',
    title: '简体中文',
    fullTitle: '简体中文 (Simplified Chinese)',
    synonyms: ['chs', 'chs-CN', 'zh-Hans', 'zh-CN'],
  },
}

export type PokemonGameLocaleData = {
  id: Pkds.LanguageInGameCode
  name: string
}

export const pokemonGameLocales: Array<PokemonGameLocaleData> = [
  { id: 'ENG', name: 'English' },
  { id: 'ES-ES', name: 'Spanish (Spain)' },
  { id: 'ES-LA', name: 'Spanish (Latin America)' },
  { id: 'DEU', name: 'German' },
  { id: 'FRA', name: 'French' },
  { id: 'ITA', name: 'Italian' },
  { id: 'JPN', name: 'Japanese' },
  { id: 'KOR', name: 'Korean' },
  { id: 'CHT', name: 'Chinese (Traditional)' },
  { id: 'CHS', name: 'Chinese (Simplified)' },
]

export const pokemonLangToGameLocale: Record<
  Pkds.LanguageAlpha2 | Pkds.LanguageAlpha3,
  Pkds.LanguageInGameCode
> = {
  en: 'ENG',
  eng: 'ENG',
  de: 'DEU',
  deu: 'DEU',
  fr: 'FRA',
  fra: 'FRA',
  es: 'ES-ES',
  esp: 'ES-ES',
  esla: 'ES-LA',
  it: 'ITA',
  ita: 'ITA',
  ko: 'KOR',
  kor: 'KOR',
  cht: 'CHT',
  chs: 'CHS',
  ja: 'JPN',
  jap: 'JPN',
}

export const supportedPokeLangs: Record<SupportedPokeLang, PokeLangData> = {
  en: pokeLangData.en,
  eng: pokeLangData.en,
  de: pokeLangData.de,
  deu: pokeLangData.de,
  fr: pokeLangData.fr,
  fra: pokeLangData.fr,
  es: pokeLangData.es,
  esp: pokeLangData.es,
  it: pokeLangData.it,
  ita: pokeLangData.it,
  ko: pokeLangData.ko,
  kor: pokeLangData.ko,
  cht: pokeLangData.cht,
  chs: pokeLangData.chs,
  ja: pokeLangData.ja,
  jap: pokeLangData.ja,
}

export const supportedPokeLangIds2Char: SupportedPokeLang2Char[] = [
  'en',
  'de',
  'fr',
  'es',
  'it',
  'ko',
  'cht',
  'chs',
  'ja',
]

export const supportedPokeLangIds3Char: SupportedPokeLang3Char[] = [
  'eng',
  'deu',
  'fra',
  'esp',
  'ita',
  'kor',
  'cht',
  'chs',
  'jap',
]

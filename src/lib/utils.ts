// ----- Dataset UTILS --------------------------------------------

import { arrayUnique, capitalizeFirstLetter } from '../utils/utils-internal'
import type { LocaleCode } from './languages'
import type { Game, Gender, Pokemon, PokemonText, TextFile } from './types'
export { sortStringsInGivenOrder } from '../utils/utils-internal'

export function formatDexNum(num: number | string, positions: number = 4): string {
  return num.toString().padStart(positions, '0')
}

export function dexNumToInt(num: number | string): number {
  return typeof num === 'string' ? Number.parseInt(num.replace(/^0+/, '')) : num
}

export function dexNumToGen(nationalDexNum: number | string): number {
  const num = dexNumToInt(nationalDexNum)

  if (num <= 151) return 1
  if (num <= 251) return 2
  if (num <= 386) return 3
  if (num <= 493) return 4
  if (num <= 649) return 5
  if (num <= 721) return 6
  if (num <= 809) return 7
  if (num <= 905) return 8
  return 9
}

export function randomPokemonList<T extends Pick<Pokemon, 'id' | 'nid' | 'isForm'>>(
  pokemonList: Array<T>,
  quantity = 16,
  withForms = true,
): Array<T> {
  const filteredPokes = withForms ? pokemonList : pokemonList.filter((pkm) => !pkm.isForm)
  const minIndex = 1
  const maxIndex = filteredPokes.length
  const distinctPokeIndices = new Set<number>()

  while (distinctPokeIndices.size < quantity) {
    const newPoke = Math.floor(Math.random() * (maxIndex - minIndex + 1)) + minIndex
    distinctPokeIndices.add(newPoke)
  }

  return Array.from(distinctPokeIndices)
    .map((index) => filteredPokes[index])
    .filter(Boolean)
}

export function getPossiblePokemonGenders(meta: Pokemon): Gender[] {
  if (meta.hasGenderDifferences && meta.isFemaleForm) {
    return ['f']
  }
  if (meta.hasGenderDifferences && !meta.isFemaleForm) {
    return ['m']
  }
  if (meta.maleRate >= 100) {
    return ['m']
  }
  if (meta.femaleRate >= 100) {
    return ['f']
  }
  if (meta.maleRate <= 0 && meta.femaleRate <= 0) {
    return []
  }
  return ['m', 'f']
}

export function getPokemonGender(
  inputGender: string | null | undefined,
  meta: Pokemon,
  options?: { allowEmpty?: boolean },
): Gender {
  const possibleGenders = getPossiblePokemonGenders(meta)
  if (possibleGenders.length === 1) {
    return possibleGenders[0]
  }
  if (possibleGenders.length === 0) {
    return null
  }

  if (inputGender === 'm' || inputGender === 'f') {
    return inputGender
  }

  if (options?.allowEmpty) {
    // if allowEmpty is true, we won't determine/guess the gender, and return null
    // at this point, inputGender is either null or undefined as well
    return null
  }

  // if the gender is not specified, we need to determine it based on the maleRate and femaleRate
  if (meta.maleRate >= meta.femaleRate) {
    return 'm'
  }

  // if the femaleRate is greater than the maleRate, then the gender is female
  return 'f'
}

// ----- Text and translation

/** A Pokémon joined with its text in one locale, ready for display and search. */
export type TranslatedPokemon = Pokemon & {
  locale: LocaleCode
  /** Full name; the id when the locale has no name for it. */
  name: string
  speciesName?: string
  formName?: string
  genus?: string
  speciesGen: number
  searchableText: string
}

export type PokemonNameInfo = {
  displayName: string
  displayFormName?: string
  fullName: string
  speciesName?: string
  formName?: string
  isNicknamed: boolean
  locale: LocaleCode
}

export type TranslatePokemonOptions = {
  /** Text in every locale that search should match (defaults to the given text). */
  searchTexts?: Array<PokemonText | undefined>
  dexNumPositions?: number
}

/**
 * Joins a Pokémon with its text in one locale. Missing text is not filled from another locale;
 * pass fallback text yourself when you want one.
 */
export function translatePokemon(
  pokemon: Pokemon,
  text: PokemonText | undefined,
  locale: LocaleCode,
  options: TranslatePokemonOptions = {},
): TranslatedPokemon {
  const name = text?.name ?? pokemon.id
  return {
    ...pokemon,
    locale,
    name,
    speciesName: text?.speciesName ?? name,
    formName: text?.formName,
    genus: text?.genus,
    speciesGen: dexNumToGen(pokemon.dexNum),
    dexNum: formatDexNum(
      pokemon.dexNum,
      options.dexNumPositions ?? Math.max(3, String(pokemon.dexNum).length),
    ),
    searchableText: generatePokemonSearchableText(pokemon, options.searchTexts ?? [text]),
  }
}

/** Translates a list with one locale file, e.g. `loadText('pokemon', 'eng')`. */
export function translatePokemonList(
  pokemonList: Pokemon[],
  textFile: TextFile<'pokemon'>,
  locale: LocaleCode,
  searchTextFiles: Array<TextFile<'pokemon'>> = [textFile],
): TranslatedPokemon[] {
  return pokemonList.map((pokemon) =>
    translatePokemon(pokemon, textFile[pokemon.id], locale, {
      searchTexts: searchTextFiles.map((file) => file[pokemon.id]),
    }),
  )
}

export function generatePokemonDescription(pokemon: TranslatedPokemon) {
  const parts = []
  const features = []

  if (pokemon.genus) parts.push(pokemon.genus)
  if (pokemon.isForm && pokemon.formName) parts.push(`Form: ${pokemon.formName}`)
  if (pokemon.isMythical) features.push('Mythical')
  if (pokemon.isLegendary) features.push('Legendary')

  const types = [pokemon.type1]
  if (pokemon.type2) types.push(pokemon.type2)
  parts.push(`${types.map(capitalizeFirstLetter).join('/')} type`)
  parts.push(`It was discovered in Generation ${pokemon.gen}`)

  if (features.length > 0) {
    parts.push(`Classified as a ${features.join(' and ')} Pokémon`)
  }

  return parts.join('. ') + '.'
}

/** Lowercase search text: names from the given locale texts plus ids, types and flags. */
export function generatePokemonSearchableText(
  poke: Pokemon,
  texts: Array<PokemonText | undefined> = [],
) {
  const pokeName = arrayUnique(texts.map((text) => text?.name).filter(Boolean)).join(' ')
  const pokeFormName = arrayUnique(texts.map((text) => text?.formName).filter(Boolean)).join(' ')
  const speciesGen = dexNumToGen(poke.dexNum)

  return [
    pokeName,
    pokeFormName,
    poke.dexNum,
    poke.id,
    `type:${poke.type1}`,
    poke.type2 ? `type:${poke.type2}` : '',
    `region:${poke.region}`,
    `color:${poke.color}${poke.color === 'brown' ? ' color:orange' : ''}`,
    `gen${speciesGen} gen:${speciesGen} gen${poke.gen} gen:${poke.gen}`,
    poke.isMythical ? 'mythical' : '',
    poke.isLegendary ? 'legendary' : '',
    poke.isFemaleForm ? 'female' : '',
    poke.isBaby ? 'baby' : '',
    poke.isUltraBeast ? 'ultrabeast ultra beast' : '',
    poke.isRegional ? 'regional' : '',
    poke.isFusion ? 'fusion' : '',
    poke.isParadox ? 'paradox' : '',
    poke.isConvergent ? 'convergent' : '',
    poke.isCosmeticForm ? 'cosmetic' : '',
    poke.isGmax ? 'gigantamax gmax' : '',
    poke.isForm ? `is-form` : ``,
    poke.isMega ? `is-mega` : ``,
    poke.isBattleOnlyForm ? `is-battle-only` : `not-battle-only`,
    poke.storableIn.length > 0 ? 'is-storable' : 'not-storable',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function getGameCategoryLabel(game: Game): string {
  switch (game.series) {
    case 'main':
      return 'Main-series'
    case 'legends':
      return 'Legends-series'
    case 'storage':
      return 'Storage-series'
    default:
      return 'Spin-off'
  }
}

/** English summary of a game; `gameName` comes from the games locale file. */
export function generateGameDescription(game: Game, gameName: string, gameCatText: string) {
  const platforms = game.platforms.map((platform: string) => platform.toUpperCase()).join(' / ')
  const parts = []
  const genPart = game.gen > 0 ? ` from Generation ${game.gen} ` : ''
  const releaseText = game.isUnreleased ? 'that will be released for' : 'released for'

  parts.push(
    `Pokémon ${gameName} is a ${gameCatText} ${game.type} ${genPart}${releaseText} ${platforms}`,
  )

  if (game.region && game.region !== 'unknown') {
    const capitalizedRegion = game.region.charAt(0).toUpperCase() + game.region.slice(1)
    parts.push(`The game takes place in the ${capitalizedRegion} region`)
  }

  return parts.join('. ') + '.'
}

export function resolvePokemonName(meta: TranslatedPokemon, nickname?: string): PokemonNameInfo {
  const nameObj: PokemonNameInfo = {
    displayName: meta.speciesName ?? meta.name,
    displayFormName: meta.formName,
    fullName: meta.name,
    speciesName: meta.speciesName ?? meta.name,
    formName: meta.formName,
    isNicknamed: !!nickname,
    locale: meta.locale,
  }

  if (meta.isForm) {
    if (meta.isMega || meta.isPrimal || meta.isGmax) {
      nameObj.displayName = nameObj.fullName
    } else if (meta.formName) {
      nameObj.displayName = `${nameObj.speciesName} (${meta.formName})`
    }
  }
  if (nickname) {
    nameObj.displayName = `${nickname} - ${nameObj.displayName}`
  }
  return nameObj
}

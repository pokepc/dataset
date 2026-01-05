// ----- Generic UTILS --------------------------------------------

export function arrayUnique<T>(index: T[]): T[] {
  return [...new Set(index)]
}

export function ucfirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function sanitizeSearchQuery(query?: string | null) {
  if (query === undefined || query === null) {
    return ''
  }
  return (
    query
      // .trim()
      .toLowerCase()
      // replace multiple spaces with a single space
      .replace(/\s{2,}/, ' ')
      // replace commas with a space
      .replace(/,/g, ' ')
      // replace multiple spaces with a single space
      .replace(/\s{2,}/, ' ')
  )
}

// ----- Dataset UTILS --------------------------------------------

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

export function randomPokemonList<T extends Pkds.PokemonBase>(
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

export function getPossiblePokemonGenders(meta: Pkds.Pokemon): Pkds.Gender[] {
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
  meta: Pkds.Pokemon,
  options?: { allowEmpty?: boolean },
): Pkds.Gender {
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

// ----- Dataset Text and Translation UTILS --------------------------------------------

export function translatePokemonText(
  pkm: Pkds.Pokemon,
  lang3Char: Pkds.LanguageAlpha3,
): Pkds.PokemonText {
  const fallback = lang3Char === 'eng' ? undefined : translatePokemon(pkm, 'eng')
  const pkmName = pkm.names[lang3Char] ?? fallback?.name ?? pkm.id

  const texts: Pkds.PokemonText = {
    lang: lang3Char,
    genusText: pkm.genus[lang3Char] ?? fallback?.genusText,
    name: pkmName,
    speciesName: pkm.speciesNames[lang3Char] ?? pkmName ?? fallback?.speciesName ?? pkmName,
    formName: pkm.formNames[lang3Char] ?? fallback?.formName,
  }

  return texts
}

export function translatePokemon(
  pokemon: Pkds.Pokemon | Pkds.TranslatedPokemon,
  lang: Pkds.LanguageAlpha3,
  dexNumPositions?: number,
): Pkds.TranslatedPokemon {
  if (!('name' in pokemon)) {
    return {
      ...pokemon,
      ...translatePokemonText(pokemon, lang),
      speciesGen: dexNumToGen(pokemon.dexNum),
      dexNum: formatDexNum(
        pokemon.dexNum,
        dexNumPositions ?? Math.max(3, String(pokemon.dexNum).length),
      ),
      searchableText: generatePokemonSearchableText(pokemon),
    }
  }

  return {
    ...pokemon,
    ...translatePokemonText(pokemon, lang),
  }
}

export function translatePokemonList(
  pokemonList: Array<Pkds.Pokemon | Pkds.TranslatedPokemon>,
  lang: Pkds.LanguageAlpha3,
): Array<Pkds.TranslatedPokemon> {
  return pokemonList.map((pokemon) => translatePokemon(pokemon, lang))
}

export function translatePokemonById(
  pokemonList: Array<Pkds.Pokemon | Pkds.TranslatedPokemon>,
  lang: Pkds.LanguageAlpha3,
): Record<string, Pkds.TranslatedPokemon> {
  return Object.fromEntries(
    pokemonList.map((pokemon) => [pokemon.id, translatePokemon(pokemon, lang)]),
  )
}

export function translatePokemonByNid(
  pokemonList: Array<Pkds.Pokemon | Pkds.TranslatedPokemon>,
  lang: Pkds.LanguageAlpha3,
): Record<string, Pkds.TranslatedPokemon> {
  return Object.fromEntries(
    pokemonList.map((pokemon) => [pokemon.nid, translatePokemon(pokemon, lang)]),
  )
}

export function generatePokemonDescription(
  pokemon: Pkds.TranslatedPokemon,
  lang3Char: Pkds.LanguageAlpha3,
) {
  const parts = []
  const features = []
  const text = translatePokemonText(pokemon, lang3Char)

  // Basic description
  parts.push(`${text.genusText}`)

  // Form information
  if (pokemon.isForm) {
    parts.push(`Form: ${pokemon.formName}`)
  }

  // Pokemon category
  if (pokemon.isMythical) {
    features.push('Mythical')
  }
  if (pokemon.isLegendary) {
    features.push('Legendary')
  }

  // Type and generation information
  const types = [pokemon.type1]
  if (pokemon.type2) types.push(pokemon.type2)
  parts.push(`${types.map(ucfirst).join('/')} type`)
  parts.push(`It was discovered in Generation ${pokemon.gen}`)

  if (features.length > 0) {
    parts.push(`Classified as a ${features.join(' and ')} Pokémon`)
  }

  return parts.join('. ') + '.'
}

export function generatePokemonSearchableText(poke: Pkds.Pokemon) {
  const pokeName = arrayUnique(Object.values(poke.names ?? {})).join(' ')
  const pokeFormName = arrayUnique(Object.values(poke.formNames ?? {})).join(' ')
  const speciesGen = dexNumToGen(poke.dexNum)

  const fullText = [
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
    poke.isGmax ? 'gigantamax' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return fullText
}

export function getGameCategoryLabel(game: Pkds.Game): string {
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

export function generateGameDescription(game: Pkds.Game, gameCatText: string) {
  const platforms = game.platforms.map((platform: string) => platform.toUpperCase()).join(' / ')
  const features = []
  const parts = []
  const genPart = game.gen > 0 ? ` from Generation ${game.gen} ` : ''

  parts.push(
    `Pokémon ${game.name} is a ${gameCatText} ${game.type} ${genPart}released for ${platforms}`,
  )

  // if (game.gen > 0) {
  //   parts.push(`It's a Generation ${game.gen} game`)
  // }

  if (game.features.gmax) features.push('Gigantamax')
  if (game.features.tera) features.push('Terastallization')
  if (game.features.alpha) features.push('Alpha Pokémon')

  if (features.length > 0) {
    // parts.push(`It features ${features.join(', ')}`)
  }

  if (game.region && game.region !== 'unknown') {
    const capitalizedRegion = game.region.charAt(0).toUpperCase() + game.region.slice(1)
    parts.push(`The game takes place in the ${capitalizedRegion} region`)
  }

  return parts.join('. ') + '.'
}

export function resolvePokemonName(
  meta: Pkds.TranslatedPokemon,
  nickname?: string,
  lang3Char?: Pkds.LanguageAlpha3,
): Pkds.PokemonNameInfo {
  const txt: Pkds.PokemonText = lang3Char
    ? translatePokemonText(meta, lang3Char)
    : {
        lang: meta.lang,
        name: meta.name,
        speciesName: meta.speciesName,
        formName: meta.formName,
        genusText: meta.genusText,
      }

  const nameObj: Pkds.PokemonNameInfo = {
    displayName: txt.speciesName ?? txt.name,
    displayFormName: txt.formName,
    fullName: txt.name,
    speciesName: txt.speciesName ?? txt.name,
    formName: txt.formName,
    isNicknamed: !!nickname,
    lang: txt.lang,
  }

  if (meta.isForm) {
    if (meta.isMega || meta.isPrimal || meta.isGmax) {
      nameObj.displayName = nameObj.fullName
    } else if (txt.formName) {
      nameObj.displayName = `${nameObj.speciesName} (${txt.formName})`
    }
  }
  if (nickname) {
    nameObj.displayName = `${nickname} - ${nameObj.displayName}`
  }
  return nameObj
}

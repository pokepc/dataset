import type { AvailabilityPokemon, LocationMethod } from './availability.ts'
import { resolveMainAvailability, type MainAvailability } from './main-availability.ts'
import { resolveVivillonAvailability } from './vivillon-availability-rules.ts'
import { resolveCuratedFormAvailability } from './curated-form-availability.ts'

export const megaEvolutionUrl = 'https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution'

// Exact reward forms only; HOME cannot transform these gifts into alternate forms.
const homeDexCompletionGifts: Record<string, string> = {
  meloetta: 'Paldea, Kitakami and Blueberry Pokédexes (Scarlet/Violet origins)',
  enamorus: 'Hisui Pokédex (Legends: Arceus origins)',
  manaphy: 'Sinnoh Pokédex (Brilliant Diamond/Shining Pearl origins)',
  keldeo: 'Galar, Isle of Armor and Crown Tundra Pokédexes (Sword/Shield origins)',
  meltan: 'Kanto Pokédex (Let’s Go origins)',
  'magearna-original': 'National Pokédex through Eternatus, including Mythical Pokémon',
}

const megaGames: Record<string, readonly string[]> = {
  xy: ['xy-x', 'xy-y', 'oras-or', 'oras-as', 'sm-s', 'sm-m', 'usum-us', 'usum-um', 'lza'],
  oras: ['oras-or', 'oras-as', 'sm-s', 'sm-m', 'usum-us', 'usum-um', 'lza'],
  lza: ['lza'],
}

/** Explicit transformation rules supplement the main table; GO always uses its own tables. */
export function resolveFormAvailabilityRule(
  main: MainAvailability,
  pokemon: AvailabilityPokemon,
  gameId: string,
  siblings: AvailabilityPokemon[],
): LocationMethod | undefined {
  if (gameId === 'home' && Object.hasOwn(homeDexCompletionGifts, pokemon.id))
    return {
      text: `HOME Pokédex-completion Mystery Gift: ${homeDexCompletionGifts[pokemon.id]}.`,
      status: 'eventOnlyIn',
      sourceUrl:
        pokemon.id === 'magearna-original'
          ? 'https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9dex_(HOME)#Pokédex_entries'
          : 'https://home.pokemon.com/en-gb/features/',
    }
  const vivillon = resolveVivillonAvailability(main, pokemon, gameId)
  if (vivillon) return vivillon
  const curated = resolveCuratedFormAvailability(main, pokemon, gameId, siblings)
  if (curated) return curated
  if (pokemon.isGmax && pokemon.id === 'melmetal-gmax' && gameId === 'home')
    return {
      text: 'Gigantamax Melmetal: HOME in-game gift event after transferring a GO Pokémon.',
      status: 'eventOnlyIn',
      sourceUrl: null,
    }
  // Future games and Champions are deliberately outside these rules.
  if (!main.gameIds.has(gameId)) return undefined

  if (pokemon.isGmax) {
    const supported = gameId === 'swsh-sw' || gameId === 'swsh-sh'
    return {
      text: 'Gigantamax rule: available in Sword and Shield.',
      status: !supported
        ? 'unavailable'
        : pokemon.id === 'melmetal-gmax'
          ? 'transferOnlyIn'
          : 'obtainableIn',
      ...(supported && pokemon.id === 'melmetal-gmax'
        ? { note: 'The Gigantamax-capable Melmetal must come from the HOME gift event.' }
        : {}),
      sourceUrl: null,
    }
  }

  if (!pokemon.isMega) return undefined
  if (
    ['latias-mega', 'latios-mega'].includes(pokemon.id) &&
    (gameId === 'xy-x' || gameId === 'xy-y')
  )
    return {
      text: 'Mega Latias/Latios in X/Y require a Mega Stone traded from OR/AS.',
      status: 'transferOnlyIn',
      sourceUrl: megaEvolutionUrl,
    }
  const supportedGames = megaGames[pokemon.debutIn ?? '']
  if (!supportedGames)
    return {
      text: `Unrecognized Mega introduction group: ${pokemon.debutIn ?? 'missing'}.`,
      status: 'unknown',
      sourceUrl: megaEvolutionUrl,
    }
  const letsGo =
    (gameId === 'lgpe-lgp' || gameId === 'lgpe-lge') &&
    Number(pokemon.dexNum) <= 151 &&
    pokemon.debutIn !== 'lza'
  const supported = supportedGames.includes(gameId) || letsGo
  const method: LocationMethod = {
    text: `Mega Evolution rule: ${pokemon.debutIn} introduction group${letsGo ? '; Kanto Mega in Let’s Go' : ''}.`,
    status: supported ? 'obtainableIn' : 'unavailable',
    sourceUrl: megaEvolutionUrl,
  }
  if (!supported) return method

  // Exact base forms matter (e.g. Original Color Magearna). If the table omits a battle form,
  // its species row can still establish acquisition; the group rule only establishes Mega support.
  const bases = (pokemon.baseForms ?? [pokemon.baseSpecies]).flatMap((id) => {
    const base = siblings.find((entry) => entry.id === id)
    const row = base && resolveMainAvailability(main, base)
    return row ? [{ id, method: row.methods.get(gameId) }] : []
  })
  if (!bases.length) {
    const species = main.rows.get(Number(pokemon.dexNum))?.find((row) => !row.form)
    if (species) bases.push({ id: pokemon.baseSpecies, method: species.methods.get(gameId) })
  }
  if (bases.length && bases.every((base) => base.method?.status === 'eventOnlyIn')) {
    method.status = 'eventOnlyIn'
    method.note = `Base-form in-game event gate from the main availability table: ${bases.map((base) => `${base.id} (${base.method!.text})`).join(', ')}.`
  } else if (
    bases.length &&
    bases.every((base) =>
      ['transferOnlyIn', 'eventOnlyIn', 'unavailable'].includes(base.method?.status ?? ''),
    ) &&
    bases.some((base) => base.method?.status === 'transferOnlyIn')
  ) {
    method.status = 'transferOnlyIn'
    method.note = `Mega Evolution requires an external base Pokémon: ${bases.map((base) => `${base.id} (${base.method!.text})`).join(', ')}.`
  } else if (bases.some((base) => !base.method || base.method.status === 'unknown')) {
    method.status = 'unknown'
    method.note = 'The base-form source cell is inconclusive; its acquisition cannot be determined.'
  }
  return method
}

import type { AvailabilityPokemon, LocationMethod } from './availability.ts'
import { resolveMainAvailability, type MainAvailability } from './main-availability.ts'

export const megaEvolutionUrl = 'https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution'

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
  // its species row can still establish an event gate; the group rule establishes Mega support.
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
  } else if (bases.some((base) => !base.method || base.method.status === 'unknown')) {
    method.status = 'unknown'
    method.note = 'The base-form source cell is inconclusive; its event gate cannot be determined.'
  }
  return method
}

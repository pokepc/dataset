import type { AvailabilityGame, AvailabilityPokemon, LocationMethod } from './availability.ts'

export const storageGameIds = ['boxrs', 'ranch'] as const
export type StorageGameId = (typeof storageGameIds)[number]

const sources = {
  boxrs: 'https://bulbapedia.bulbagarden.net/wiki/Pokémon_Box_Ruby_&_Sapphire',
  ranch: 'https://bulbapedia.bulbagarden.net/wiki/My_Pokémon_Ranch',
  trades: 'https://bulbapedia.bulbagarden.net/wiki/Hayley%27s_trades',
  platinum: 'https://www.serebii.net/ranch/platinum.shtml',
}

const boxEggs = new Set(['swablu', 'zigzagoon', 'skitty', 'pichu'])

// Exact rewards, including the fixed gender where the dataset has separate records.
export const ranchTrades = new Set([
  'pikachu',
  'vulpix',
  'ponyta',
  'lickitung',
  'tangela',
  'eevee',
  'aerodactyl',
  'yanma',
  'miltank',
  'shroomish',
  'wailmer',
  'wynaut',
  'staravia',
  'combee-f',
  'pachirisu-f',
  'shellos-east',
  'buneary',
  'croagunk',
  'finneon-f',
  'snover',
  'phione',
  'mew',
])
const ranchEventTrades = new Set(['octillery-f', 'flygon', 'meowth', 'slaking', 'metagross'])
const ranchForms = new Set([
  'deoxys-attack',
  'deoxys-defense',
  'deoxys-speed',
  'burmy-sandy',
  'burmy-trash',
  'wormadam-sandy',
  'wormadam-trash',
  'cherrim-sunshine',
  'shellos-east',
  'gastrodon-east',
  'rotom-heat',
  'rotom-wash',
  'rotom-frost',
  'rotom-fan',
  'rotom-mow',
  'giratina-origin',
  'shaymin-sky',
  ...[
    'fighting',
    'flying',
    'poison',
    'ground',
    'rock',
    'bug',
    'ghost',
    'steel',
    'fire',
    'water',
    'grass',
    'electric',
    'psychic',
    'ice',
    'dragon',
    'dark',
  ].map((type) => `arceus-${type}`),
])

/** Supported exact records, including transformations that can occur during a Ranch visit. */
export function supportsStorageGame(pokemon: AvailabilityPokemon, gameId: StorageGameId): boolean {
  if (pokemon.gen > (gameId === 'boxrs' ? 3 : 4) || pokemon.id === 'eevee-f') return false
  if (pokemon.isDefault || (pokemon.isFemaleForm && pokemon.isCosmeticForm))
    return !pokemon.isBattleOnlyForm
  if (/^unown-(?:[b-z]|exclamation|question)$/.test(pokemon.id)) return true
  // Explicit forms avoid granting support to future forms through old species metadata.
  return gameId === 'ranch' && ranchForms.has(pokemon.id)
}

export function storableInStorageGame(
  pokemon: AvailabilityPokemon,
  gameId: StorageGameId,
): boolean {
  return (
    supportsStorageGame(pokemon, gameId) &&
    !['shaymin-sky', 'cherrim-sunshine'].includes(pokemon.id)
  )
}

export function storageGameAvailabilityRule(
  pokemon: AvailabilityPokemon,
  gameId: string,
): LocationMethod | undefined {
  if (gameId !== 'boxrs' && gameId !== 'ranch') return undefined
  if (!supportsStorageGame(pokemon, gameId))
    return {
      status: 'unavailable',
      text: 'This exact form is not supported by this storage service.',
      sourceUrl: sources[gameId],
    }
  if (gameId === 'boxrs')
    return {
      status: boxEggs.has(pokemon.id) ? 'obtainableIn' : 'transferOnlyIn',
      text: boxEggs.has(pokemon.id)
        ? 'Permanent bonus Egg supplied by Pokémon Box; hatches in a connected GBA game.'
        : 'Deposit from Ruby, Sapphire, Emerald, FireRed or LeafGreen.',
      sourceUrl: sources.boxrs,
    }
  if (ranchTrades.has(pokemon.id))
    return {
      status: 'obtainableIn',
      text: 'Permanent Hayley trade, withdrawable to a connected game.',
      sourceUrl: sources.trades,
    }
  if (ranchEventTrades.has(pokemon.id))
    return {
      status: 'eventOnlyIn',
      text: 'Historical Japan-only guest-Mii event trade inside Ranch.',
      sourceUrl: sources.trades,
    }
  return {
    status: 'transferOnlyIn',
    text: 'Deposit from Diamond/Pearl, or Platinum with the Japan-only update. Temporary Ranch transformations depend on an imported Pokémon.',
    sourceUrl: sources.platinum,
  }
}

/** Apply only the two researched services after any existing form inheritance/reversion rules. */
export function storageGameStorageRule(
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  previous?: { gameIds: string[]; note: string },
): { gameIds: string[]; note: string } | undefined {
  const supportedGames = storageGameIds.filter((id) => games.some((game) => game.id === id))
  if (!supportedGames.length) return previous
  const gameIds = (previous?.gameIds ?? pokemon.storableIn).filter(
    (id) => !supportedGames.some((gameId) => gameId === id),
  )
  const order = new Map(games.map((game, index) => [game.id, index]))
  for (const id of supportedGames) {
    if (!storableInStorageGame(pokemon, id)) continue
    const index = gameIds.findIndex(
      (existing) => (order.get(existing) ?? Infinity) > order.get(id)!,
    )
    gameIds.splice(index === -1 ? gameIds.length : index, 0, id)
  }
  return {
    gameIds,
    note: [
      previous?.note,
      'Box RS and Ranch use researched compatibility rules; temporary visit-only forms are not persistent storage. Other storage memberships are preserved.',
    ]
      .filter(Boolean)
      .join(' '),
  }
}

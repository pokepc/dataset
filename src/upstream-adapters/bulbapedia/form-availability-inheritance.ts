import type { AvailabilityGame, AvailabilityPokemon, LocationMethod } from './availability.ts'

export const furfrouFormUrl =
  'https://bulbapedia.bulbagarden.net/wiki/Furfrou_(Pok%C3%A9mon)#Form_data'

const types =
  'fighting|flying|poison|ground|rock|bug|ghost|steel|fire|water|grass|electric|psychic|ice|dragon|dark|fairy'
const heldItemTypes = new RegExp(`^(arceus|silvally)-(${types})$`)
const otherHeldItemForms = new Set([
  'genesect-douse',
  'genesect-shock',
  'genesect-burn',
  'genesect-chill',
  'dialga-origin',
  'palkia-origin',
  'giratina-origin',
  'zacian-crowned',
  'zamazenta-crowned',
  'ogerpon-wellspring',
  'ogerpon-hearthflame',
  'ogerpon-cornerstone',
  'kyogre-primal',
  'groudon-primal',
])
const inheritedForms: [RegExp, string][] = [
  [/^pumpkaboo-(small|large|super)$/, 'pumpkaboo'],
  [/^gourgeist-(small|large|super)$/, 'gourgeist'],
  [
    /^alcremie-(vanilla-cream|ruby-cream|matcha-cream|mint-cream|lemon-cream|salted-cream|ruby-swirl|caramel-swirl|rainbow-swirl)-(strawberry|berry|love|star|clover|flower|ribbon)$/,
    'alcremie',
  ],
  [/^unown-[b-z]$/, 'unown'],
  [new RegExp(`^arceus-(${types})$`), 'arceus'],
  [new RegExp(`^silvally-(${types})$`), 'silvally'],
  [/^flabebe-(yellow|orange|blue|white)$/, 'flabebe'],
  [/^floette-(yellow|orange|blue|white)$/, 'floette'],
  [/^florges-(yellow|orange|blue|white)$/, 'florges'],
  [/^furfrou-(heart|star|diamond|debutante|matron|dandy|la-reine|kabuki|pharaoh)$/, 'furfrou'],
  [/^minior-(red|orange|yellow|green|blue|indigo|violet)$/, 'minior-red'],
  [/^rotom-(heat|wash|frost|fan|mow)$/, 'rotom'],
  [/^genesect-(douse|shock|burn|chill)$/, 'genesect'],
]

export type FormInheritance = { baseId: string; sourceId: string }

/** Storage rules remain game-specific; using a form-change item does not imply it remains held. */
export function requiresHeldItemForForm(
  pokemon: Pick<AvailabilityPokemon, 'id' | 'isMega'>,
): boolean {
  return (
    heldItemTypes.test(pokemon.id) ||
    otherHeldItemForms.has(pokemon.id) ||
    (pokemon.isMega === true && pokemon.id !== 'rayquaza-mega')
  )
}

/** Only the explicitly agreed families inherit. Special patterns, caps and transformations do not. */
export function formAvailabilityInheritance(
  pokemon: AvailabilityPokemon,
): FormInheritance | undefined {
  if (pokemon.isMega || pokemon.isGmax || pokemon.isBattleOnlyForm) return undefined
  const baseId = inheritedForms.find(([pattern]) => pattern.test(pokemon.id))?.[1]
  if (!baseId) return undefined
  // The table calls Minior's species row "Minior", but our normal, storable base is its red core.
  return { baseId, sourceId: baseId === 'minior-red' ? 'minior' : baseId }
}

export function formAvailabilityRestriction(
  pokemon: AvailabilityPokemon,
  game: AvailabilityGame,
): LocationMethod | undefined {
  if (pokemon.id === 'arceus-fairy' && game.gen > 0 && game.gen < 6)
    return {
      text: 'Fairy Arceus and the Pixie Plate were introduced in Generation VI.',
      status: 'unavailable',
      sourceUrl: 'https://bulbapedia.bulbagarden.net/wiki/Pixie_Plate',
    }
  if (['home', 'bank'].includes(game.id) && requiresHeldItemForForm(pokemon))
    return {
      text: 'Bank and HOME cannot retain a form that requires a held item; it reverts to its base form.',
      status: 'unavailable',
      sourceUrl: null,
    }
  if (game.id === 'home' && formAvailabilityInheritance(pokemon)?.baseId === 'rotom')
    return {
      text: 'Rotom appliance forms can be transferred to HOME and stored without a held item. The HOME gift is base Rotom only.',
      status: 'transferOnlyIn',
      sourceUrl: null,
    }
  const exclusiveGame =
    pokemon.id === 'arceus-legendary' ? 'la' : pokemon.id === 'floette-eternal' ? 'lza' : undefined
  if (exclusiveGame)
    return {
      text: `${pokemon.id} is obtainable only in ${exclusiveGame === 'la' ? 'Legends: Arceus' : 'Legends: Z-A'}.`,
      status: game.id === exclusiveGame ? 'obtainableIn' : 'unavailable',
      sourceUrl: null,
    }
  if (
    pokemon.id.startsWith('rotom-') &&
    formAvailabilityInheritance(pokemon) &&
    ((game.gen > 0 && game.gen < 4) || game.id === 'dp-d' || game.id === 'dp-p')
  )
    return {
      text: 'Rotom appliance forms were introduced in Platinum.',
      status: 'unavailable',
      sourceUrl: null,
    }
  return undefined
}

export function formStorageRule(
  pokemon: AvailabilityPokemon,
  base: AvailabilityPokemon | undefined,
  games: AvailabilityGame[],
): { gameIds: string[]; note: string } | undefined {
  if (pokemon.id === 'arceus-legendary')
    return {
      gameIds: ['la'],
      note: 'Legendary Plate Arceus storage is restricted to Legends: Arceus.',
    }
  const heldItem = requiresHeldItemForForm(pokemon)
  if (!base && !heldItem) return undefined
  let gameIds = [...(base ?? pokemon).storableIn]
  let note = base
    ? `storableIn inherits ${base.id}.`
    : 'Existing storage is retained except for Bank and HOME.'
  if (pokemon.id === 'arceus-fairy') {
    const excluded = new Set(
      games.filter((game) => game.gen > 0 && game.gen < 6).map((game) => game.id),
    )
    gameIds = gameIds.filter((id) => !excluded.has(id))
    note += ' Fairy Arceus did not exist before Generation VI.'
  }
  if (heldItem) {
    gameIds = gameIds.filter((id) => !['home', 'bank'].includes(id))
    note += ' Bank and HOME cannot retain a form that requires a held item.'
  }
  if (base?.id === 'furfrou') {
    // Gen VII reverts on withdrawal, so depositing a trimmed Furfrou there is still supported.
    gameIds = gameIds.filter((id) => !['xy-x', 'xy-y', 'oras-or', 'oras-as', 'bank'].includes(id))
    note += ` Furfrou trims revert on Gen VI/Bank deposit; Gen VII, GO, HOME and later saved storage are retained. ${furfrouFormUrl}`
  }
  if (base?.id === 'rotom') {
    const excluded = new Set(
      games
        .filter((game) => formAvailabilityRestriction(pokemon, game)?.status === 'unavailable')
        .map((game) => game.id),
    )
    gameIds = gameIds.filter((id) => !excluded.has(id))
    note += ' Appliance forms are excluded before Platinum.'
  }
  return { gameIds, note }
}

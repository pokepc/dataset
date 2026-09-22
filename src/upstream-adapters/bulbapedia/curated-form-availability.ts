import type {
  AvailabilityGame,
  AvailabilityPokemon,
  AvailabilityStatus,
  LocationMethod,
} from './availability.ts'
import { resolveMainAvailability, type MainAvailability } from './main-availability.ts'

type FormRule = {
  base: string
  forms: string[]
  note: string
  reference?: string
  games?: readonly string[]
  overrides?: Record<string, AvailabilityStatus>
  partnerDex?: number
  battle?: boolean
  fused?: boolean
}

const article = (species: string) =>
  `https://bulbapedia.bulbagarden.net/wiki/${species}_(Pok%C3%A9mon)#Form_data`

const gen3 = ['rs-r', 'rs-s', 'col', 'frlg-fr', 'frlg-lg', 'e', 'xd']
const gen4 = ['dp-d', 'dp-p', 'pt', 'hgss-hg', 'hgss-ss']
const platinum = ['pt', 'hgss-hg', 'hgss-ss']
const b2w2 = ['b2w2-b2', 'b2w2-w2']
const gen5 = ['bw-b', 'bw-w', ...b2w2]
const xy = ['xy-x', 'xy-y']
const oras = ['oras-or', 'oras-as']
const gen6 = [...xy, ...oras]
const sm = ['sm-s', 'sm-m']
const usum = ['usum-us', 'usum-um']
const gen7 = [...sm, ...usum]
const swsh = ['swsh-sw', 'swsh-sh']
const bdsp = ['bdsp-bd', 'bdsp-sp']
const sv = ['sv-s', 'sv-v']
const fromGen4 = [...gen4, ...gen5, ...gen6, ...gen7, ...swsh, ...bdsp, 'la', ...sv, 'lza']
const fromPlatinum = [...platinum, ...gen5, ...gen6, ...gen7, ...swsh, ...bdsp, 'la', ...sv, 'lza']
const fromB2w2 = [...b2w2, ...gen6, ...gen7, ...swsh, ...bdsp, 'la', ...sv, 'lza']
const external = (games: string[]): Record<string, AvailabilityStatus> =>
  Object.fromEntries(games.map((game) => [game, 'transferOnlyIn']))

/** Reviewed main-game form mechanics. These rules never supply a missing GO release. */
export const curatedFormRules: FormRule[] = [
  {
    base: 'castform',
    forms: ['castform-sunny', 'castform-rainy', 'castform-snowy'],
    battle: true,
    note: 'Forecast changes form with weather; main-game acquisition follows Castform.',
  },
  {
    base: 'cherrim',
    forms: ['cherrim-sunshine'],
    battle: true,
    note: 'Sunshine is Cherrim’s temporary weather-dependent form, including in Legends: Arceus.',
  },
  {
    base: 'aegislash',
    forms: ['aegislash-blade'],
    battle: true,
    note: 'Blade Forme is the native battle transformation, including Legends: Z-A despite its lack of Abilities.',
  },
  {
    base: 'mimikyu',
    forms: ['mimikyu-busted'],
    battle: true,
    note: 'Busted Form follows the base’s acquisition; the disguise mechanic also exists in Legends: Z-A.',
  },
  {
    base: 'eiscue',
    forms: ['eiscue-noice'],
    battle: true,
    note: 'Ice Face produces Noice Face in battle; acquisition follows the base form.',
  },
  {
    base: 'morpeko',
    forms: ['morpeko-hangry'],
    battle: true,
    note: 'Hangry Mode is a battle transformation; Legends: Z-A uses Aura Wheel rather than end-of-turn Hunger Switch.',
  },
  {
    base: 'palafin',
    forms: ['palafin-hero'],
    battle: true,
    note: 'Zero to Hero produces Hero Form in battle; acquisition follows Palafin.',
  },
  {
    base: 'cramorant',
    forms: ['cramorant-gulping', 'cramorant-gorging'],
    battle: true,
    note: 'Gulp Missile produces temporary prey-carrying forms; acquisition follows Cramorant.',
  },
  {
    base: 'darmanitan',
    forms: ['darmanitan-zen'],
    battle: true,
    note: 'Zen Mode requires the Hidden Ability: Desert Resort/N’s Darmanitan, DexNav, or later Ability Patch/native HA routes; imported routes remain external.',
  },
  {
    base: 'darmanitan-galar',
    forms: ['darmanitan-galar-zen'],
    battle: true,
    note: 'Galarian Zen Mode follows Galarian Darmanitan, with Hidden Ability access in Sword/Shield.',
  },
  {
    base: 'xerneas',
    forms: ['xerneas-active'],
    battle: true,
    note: 'Active Mode is Xerneas’s automatic battle appearance, not an independent encounter.',
  },
  {
    base: 'meloetta',
    forms: ['meloetta-pirouette'],
    battle: true,
    note: 'Relic Song enables Pirouette in supported main games, including Legends: Z-A; a HOME gift cannot transform within HOME.',
  },
  {
    base: 'wishiwashi',
    forms: ['wishiwashi-school'],
    battle: true,
    note: 'Schooling at level 20 and sufficient HP is a temporary battle state of the native base.',
  },
  {
    base: 'burmy',
    forms: ['burmy-sandy', 'burmy-trash'],
    note: 'Battle environment changes Burmy’s cloak; Legends: Arceus uses the encounter region.',
  },
  {
    base: 'wormadam',
    forms: ['wormadam-sandy', 'wormadam-trash'],
    note: 'Evolve the corresponding female Burmy cloak; both cloaks have native routes wherever the base does.',
  },
  {
    base: 'oricorio',
    forms: ['oricorio-pom-pom', 'oricorio-pau', 'oricorio-sensu'],
    games: [...gen7, ...sv],
    note: 'Native encounters or the corresponding nectar supply these styles; GO regional releases are separate.',
  },
  {
    base: 'sinistea',
    forms: ['sinistea-antique'],
    games: [...swsh, ...sv],
    note: 'Antique has native wild encounters in both supported game sets; breeding produces Phony instead.',
  },
  {
    base: 'polteageist',
    forms: ['polteageist-antique'],
    games: [...swsh, ...sv],
    note: 'Evolve native Antique Sinistea with a Chipped Pot, not ordinary Sinistea or its offspring.',
  },
  {
    base: 'urshifu',
    forms: ['urshifu-rapid-strike'],
    games: [...swsh, ...sv],
    note: 'Native Kubfu can use the Tower of Waters in Sword/Shield or Scroll of Waters in Scarlet/Violet.',
  },
  {
    base: 'basculegion',
    forms: ['basculegion-f'],
    games: ['la', ...sv],
    note: 'Evolve a female White-Striped Basculin; both sexes have native routes in these games.',
  },
  {
    base: 'oinkologne',
    forms: ['oinkologne-f'],
    games: sv,
    note: 'Female Lechonk/Oinkologne are native; sex is not a transferable form-change mechanic.',
  },
  {
    base: 'maushold',
    forms: ['maushold-three'],
    games: sv,
    note: 'Rare native evolution and raids can produce Family of Three; rarity does not change acquisition category.',
  },
  {
    base: 'squawkabilly',
    forms: ['squawkabilly-blue', 'squawkabilly-yellow', 'squawkabilly-white'],
    games: [...sv, 'lza'],
    note: 'All four plumages have native encounters in Scarlet/Violet and Legends: Z-A; plumage cannot be changed.',
  },
  {
    base: 'tatsugiri',
    forms: ['tatsugiri-droopy', 'tatsugiri-stretchy'],
    games: [...sv, 'lza'],
    note: 'Both forms have native encounters in Scarlet/Violet and Hyperspace Lumiose, with independently parsed GO releases.',
  },
  {
    base: 'dudunsparce',
    forms: ['dudunsparce-three-segment'],
    games: sv,
    note: 'Rare native Dunsparce evolution produces Three-Segment Form.',
  },
  {
    base: 'poltchageist',
    forms: ['poltchageist-artisan'],
    games: sv,
    note: 'Artisan has native Kitakami encounters; breeding does not reproduce the special form.',
  },
  {
    base: 'sinistcha',
    forms: ['sinistcha-masterpiece'],
    games: sv,
    note: 'Evolve native Artisan Poltchageist using the Masterpiece Teacup.',
  },
  {
    base: 'unown',
    forms: ['unown-exclamation', 'unown-question'],
    games: [...gen3, ...fromGen4],
    note: 'Punctuation forms first caught in FRLG are compatible with all Gen III games; exclude Gen II.',
  },
  ...(['attack', 'defense', 'speed'] as const).map((form, index): FormRule => ({
    base: 'deoxys',
    forms: [`deoxys-${form}`],
    games: [['frlg-fr', 'frlg-lg', 'e'][index], ...fromGen4],
    note: 'Gen III fixes Deoxys to Attack in FireRed, Defense in LeafGreen, Speed in Emerald, and Normal elsewhere. From Gen IV use the meteorites.',
  })),
  ...['kyogre', 'groudon'].map((base): FormRule => ({
    base,
    forms: [`${base}-primal`],
    games: [...oras, ...gen7, 'lza'],
    battle: true,
    reference: 'https://bulbapedia.bulbagarden.net/wiki/Primal_Reversion#Gameplay',
    note: 'Primal Reversion requires the corresponding orb and is supported only in ORAS, SM/USUM and Legends: Z-A Mega Dimension.',
  })),
  ...['dialga', 'palkia'].map((base): FormRule => ({
    base,
    forms: [`${base}-origin`],
    games: ['la', ...sv],
    note: 'Origin forms were introduced in Legends: Arceus; Scarlet/Violet supports them with held form items.',
  })),
  {
    base: 'giratina',
    forms: ['giratina-origin'],
    games: fromPlatinum,
    note: 'Origin Forme requires Platinum or later and its supported form item; Diamond/Pearl cannot retain it.',
  },
  {
    base: 'shaymin',
    forms: ['shaymin-sky'],
    games: fromPlatinum,
    note: 'The Gracidea enables Sky Forme from Platinum onward; preserve the base’s event gate and separate storage reversion.',
  },
  ...['tornadus', 'thundurus', 'landorus'].map((base): FormRule => ({
    base,
    forms: [`${base}-therian`],
    games: fromB2w2,
    overrides: external(b2w2),
    note: 'Therian forms start in B2W2 with external Dream Radar/Reveal Glass access; later games supply the Reveal Glass natively.',
  })),
  {
    base: 'enamorus',
    forms: ['enamorus-therian'],
    games: ['la', ...sv],
    note: 'Reveal Glass transforms Enamorus in Legends: Arceus and Scarlet/Violet; older Therian games do not support this species.',
  },
  {
    base: 'keldeo',
    forms: ['keldeo-resolute'],
    games: fromB2w2,
    note: 'Secret Sword changes Keldeo to Resolute from B2W2 onward; Black/White cannot retain the form.',
  },
  {
    base: 'zygarde',
    forms: ['zygarde-10'],
    games: [...gen7, ...swsh, 'lza'],
    note: '10% Forme was introduced in Sun/Moon and is supported in SM/USUM, Sword/Shield and Legends: Z-A.',
  },
  {
    base: 'zygarde',
    forms: ['zygarde-complete'],
    games: [...gen7, ...swsh, 'lza'],
    battle: true,
    note: 'Complete is the temporary transformation supported in SM/USUM, Sword/Shield and Legends: Z-A, not XY/ORAS.',
  },
  {
    base: 'hoopa',
    forms: ['hoopa-unbound'],
    games: [...oras, ...gen7, ...sv, 'lza'],
    note: 'Prison Bottle enables Unbound from ORAS; deposit/withdrawal reversion is game-specific.',
  },
  ...[
    ['kyurem-white', 643],
    ['kyurem-black', 644],
  ].map(([id, partner]): FormRule => ({
    base: 'kyurem',
    forms: [String(id)],
    games: [...b2w2, ...gen6, ...gen7, ...swsh, ...sv],
    partnerDex: Number(partner),
    fused: true,
    note: 'DNA Splicers need Kyurem plus the matching Reshiram/Zekrom; evaluate both acquisition routes rather than copying Kyurem alone.',
  })),
  ...[
    ['necrozma-dusk-mane', 791],
    ['necrozma-dawn-wings', 792],
  ].map(([id, partner]): FormRule => ({
    base: 'necrozma',
    forms: [String(id)],
    games: [...usum, ...swsh, ...sv],
    partnerDex: Number(partner),
    fused: true,
    note: 'The fusion needs Necrozma and the matching Solgaleo/Lunala; each component’s acquisition matters.',
  })),
  {
    base: 'necrozma',
    forms: ['necrozma-ultra'],
    games: usum,
    battle: true,
    note: 'Ultra Burst is limited to USUM; either version has a native matching fusion for the transformation.',
  },
  ...[
    ['calyrex-ice', 896],
    ['calyrex-shadow', 897],
  ].map(([id, partner]): FormRule => ({
    base: 'calyrex',
    forms: [String(id)],
    games: [...swsh, ...sv],
    partnerDex: Number(partner),
    fused: true,
    note: 'Reins of Unity require Calyrex and the matching horse; Scarlet/Violet still needs an imported Calyrex.',
  })),
  ...['zacian', 'zamazenta'].map((base): FormRule => ({
    base,
    forms: [`${base}-crowned`],
    games: [...swsh, ...sv],
    note: 'The Rusted Sword/Shield supplies the Crowned transformation; its presence does not make an imported base native.',
  })),
  {
    base: 'ogerpon',
    forms: ['ogerpon-wellspring', 'ogerpon-hearthflame', 'ogerpon-cornerstone'],
    games: sv,
    note: 'The Teal Mask story supplies Ogerpon and its other masks; held masks cannot be retained in HOME.',
  },
  {
    base: 'terapagos',
    forms: ['terapagos-terastal', 'terapagos-stellar'],
    games: sv,
    battle: true,
    note: 'Tera Shift and Terastallization produce battle-only forms in Scarlet/Violet.',
  },
  {
    base: 'greninja',
    forms: ['greninja-ash'],
    games: gen7,
    overrides: external(gen7),
    battle: true,
    note: 'Battle Bond Greninja originates in the external Sun/Moon demo. Ash transformation works only in SM/USUM, not the changed Scarlet/Violet Battle Bond.',
  },
  {
    base: 'eternatus',
    forms: ['eternatus-eternamax'],
    games: [],
    battle: true,
    note: 'Eternamax is an unobtainable boss. Eternabeam’s animation is not a usable player form.',
  },
  {
    base: 'zarude',
    forms: ['zarude-dada'],
    games: [...swsh, ...sv],
    overrides: external([...swsh, ...sv]),
    note: 'Dada is a distinct externally distributed Zarude, not a form obtainable from an ordinary Zarude.',
  },
  {
    base: 'pikachu',
    forms: [
      'pikachu-original',
      'pikachu-hoenn',
      'pikachu-sinnoh',
      'pikachu-unova',
      'pikachu-kalos',
      'pikachu-alola',
    ],
    games: [...gen7, ...swsh, ...sv],
    overrides: external([...gen7, ...swsh, ...sv]),
    reference: 'https://bulbapedia.bulbagarden.net/wiki/Pikachu_in_a_cap',
    note: 'These six caps depend on historical external distributions/imports; ordinary Pikachu cannot produce them.',
  },
  {
    base: 'pikachu',
    forms: ['pikachu-partner'],
    games: [...usum, ...swsh, ...sv],
    overrides: {
      ...external([...swsh, ...sv]),
      'usum-us': 'eventOnlyIn',
      'usum-um': 'eventOnlyIn',
    },
    reference: 'https://bulbapedia.bulbagarden.net/wiki/Pikachu_Valley',
    note: 'Partner Cap’s USUM gift is unlocked by a special QR event; later distributions/imports are external.',
  },
  {
    base: 'pikachu',
    forms: ['pikachu-world'],
    games: [...swsh, ...sv],
    overrides: external([...swsh, ...sv]),
    reference: 'https://bulbapedia.bulbagarden.net/wiki/Pikachu_in_a_cap',
    note: 'World Cap was introduced as a Sword/Shield distribution; no Gen VII compatibility.',
  },
]

export function curatedFormRule(pokemon: Pick<AvailabilityPokemon, 'id'>): FormRule | undefined {
  return curatedFormRules.find((rule) => rule.forms.includes(pokemon.id))
}

export function resolveCuratedFormAvailability(
  main: MainAvailability,
  pokemon: AvailabilityPokemon,
  gameId: string,
  siblings: AvailabilityPokemon[],
): LocationMethod | undefined {
  if (pokemon.id === 'deoxys' && ['frlg-fr', 'frlg-lg', 'e'].includes(gameId))
    return {
      status: 'unavailable',
      text: 'After capture, Deoxys becomes Attack in FireRed, Defense in LeafGreen, or Speed in Emerald; Normal Forme cannot be retained.',
      sourceUrl: 'https://bulbapedia.bulbagarden.net/wiki/Birth_Island',
    }
  if (pokemon.id === 'samurott-hisui' && gameId === 'lza')
    return {
      status: 'unavailable',
      text: 'Hisuian Samurott is explicitly unobtainable in Legends: Z-A; the main list’s blank cell is resolved by the species location table.',
      sourceUrl: 'https://bulbapedia.bulbagarden.net/wiki/Samurott_(Pok%C3%A9mon)#Game_locations',
    }
  const rule = curatedFormRule(pokemon)
  if (!rule) return undefined
  const sourceUrl =
    rule.reference ?? article(rule.base.split('-')[0].replace(/^./, (c) => c.toUpperCase()))
  const method = (status: AvailabilityStatus, note = rule.note): LocationMethod => ({
    status,
    text: note,
    sourceUrl,
  })
  if (pokemon.id === 'eternatus-eternamax') return method('unavailable')
  if (pokemon.id === 'zarude-dada' && gameId === 'go')
    return method(
      'unavailable',
      'Dada Zarude is a Sword/Shield distribution form, not a released GO form.',
    )
  if (pokemon.id === 'zarude-dada' && gameId === 'home') return method('transferOnlyIn')
  if (gameId === 'go' && ['pikachu-original', 'pikachu-world'].includes(pokemon.id))
    return {
      ...method(
        'obtainableIn',
        'Released GO cap costume. GO obtainableIn records historical release regardless of exportability.',
      ),
      sourceUrl: 'https://bulbapedia.bulbagarden.net/wiki/Pikachu_in_a_cap#Pokémon_GO',
    }
  if (gameId === 'go') return undefined
  if ((rule.battle || rule.fused) && ['home', 'bank'].includes(gameId))
    return method(
      'unavailable',
      'This temporary battle state or fusion cannot be deposited in Bank or HOME.',
    )
  if (gameId === 'bank' && ['giratina-origin', 'shaymin-sky', 'hoopa-unbound'].includes(pokemon.id))
    return method('unavailable', 'This form reverts when deposited in Pokémon Bank.')
  if (!main.gameIds.has(gameId)) return undefined
  const override = rule.overrides?.[gameId]
  if (override) return method(override)
  if (rule.games && !rule.games.includes(gameId))
    return method('unavailable', `This game does not support this form. ${rule.note}`)
  const base = siblings.find((entry) => entry.id === rule.base)
  const baseMethod = base && resolveMainAvailability(main, base)?.methods.get(gameId)
  if (!baseMethod || baseMethod.status === 'unknown')
    return method(
      'unknown',
      `Cannot establish ${rule.base} acquisition from the main table. ${rule.note}`,
    )
  if (!rule.partnerDex || baseMethod.status === 'unavailable')
    return {
      ...method(baseMethod.status),
      note: [`Base ${rule.base}: ${baseMethod.text}.`, baseMethod.note].filter(Boolean).join(' '),
    }
  const partner = main.rows
    .get(rule.partnerDex)
    ?.find((row) => !row.form)
    ?.methods.get(gameId)
  if (!partner || partner.status === 'unknown')
    return method(
      'unknown',
      `Fusion partner #${rule.partnerDex} has no conclusive source cell. ${rule.note}`,
    )
  const statuses = [baseMethod.status, partner.status]
  const status =
    (['unavailable', 'eventOnlyIn', 'transferOnlyIn'] as const).find((candidate) =>
      statuses.includes(candidate),
    ) ?? 'obtainableIn'
  return {
    ...method(status),
    note: [
      `Base: ${baseMethod.text}; fusion partner #${rule.partnerDex}: ${partner.text}.`,
      baseMethod.note,
      partner.note,
    ]
      .filter(Boolean)
      .join(' '),
  }
}

export function curatedFormStorageRule(
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
): { gameIds: string[]; note: string } | undefined {
  if (['cramorant', 'zeraora'].includes(pokemon.id))
    return {
      gameIds: [...new Set([...pokemon.storableIn, 'go'])],
      note: 'These released ordinary GO forms can remain in GO storage; this does not cover temporary battle forms.',
    }
  if (pokemon.id === 'eternatus-eternamax')
    return {
      gameIds: [],
      note: 'Eternamax is an unobtainable boss form and cannot be stored anywhere.',
    }
  if (pokemon.id === 'zarude-dada')
    return {
      gameIds: pokemon.storableIn.filter((game) => game !== 'go'),
      note: 'Dada Zarude has no GO release; preserve storage in compatible core games and HOME.',
    }
  if (['pikachu-original', 'pikachu-world'].includes(pokemon.id))
    return {
      gameIds: [...new Set([...pokemon.storableIn, 'go'])],
      note: 'Original Cap (2017-07-06) and World Cap (2020-10-06) were released in GO and can be stored there. See https://bulbapedia.bulbagarden.net/wiki/Pikachu_in_a_cap#Pokémon_GO.',
    }
  if (['unown-exclamation', 'unown-question'].includes(pokemon.id))
    return {
      gameIds: [
        ...new Set([
          ...gen3,
          ...pokemon.storableIn.filter((game) => !['gs-g', 'gs-s', 'c'].includes(game)),
        ]),
      ],
      note: 'Unown punctuation forms can be stored throughout Gen III, including RSE and Colosseum before their first native FRLG encounters; Gen II is excluded.',
    }
  const rule = curatedFormRule(pokemon)
  const storageExclusions: Record<string, string[]> = {
    'hoopa-unbound': [...oras, 'bank'],
    'shaymin-sky': [...gen3, ...gen4, ...gen5, ...gen6, 'bank'],
    'giratina-origin': ['home', 'bank'],
  }
  const formExclusions = storageExclusions[pokemon.id]
  if (formExclusions)
    return {
      gameIds: pokemon.storableIn.filter((game) => !formExclusions.includes(game)),
      note: 'Existing storage is preserved except for researched deposit/form-reversion exclusions.',
    }
  if (!rule?.battle && !rule?.fused) return undefined
  const excluded = new Set(
    rule.battle
      ? games.filter((game) => game.id !== 'go').map((game) => game.id)
      : ['home', 'bank'],
  )
  return {
    gameIds: pokemon.storableIn.filter((game) => !excluded.has(game)),
    note: rule.battle
      ? 'Temporary battle forms do not inherit base storage; GO storage is preserved independently.'
      : 'Fusion storage is preserved in games, but fused Pokémon cannot be deposited in Bank or HOME.',
  }
}

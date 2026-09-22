export type SourceOverride = {
  reason: string
  id?: string
  name?: string
  region?: string | null
  games?: string[]
  exclude?: boolean
}

// Exact source identities are intentional: display-name matching alone cannot distinguish these.
export const sourceOverrides: Record<string, SourceOverride> = {
  'pokeapi:tohjo-falls': {
    region: 'kanto',
    reason:
      'PokémonDB and Pokéarth place the Route 27 cave in Kanto; the API uses the Johto game-region bucket.',
  },
  'serebii:/pokearth/hoenn/navelrock.shtml': {
    region: 'kanto',
    reason: 'Same Navel Rock as the Kanto entry; Hoenn source page documents the Emerald visit.',
  },
  'serebii:/pokearth/hoenn/birthisland.shtml': {
    region: 'kanto',
    reason: 'Same Birth Island as the Kanto entry; Hoenn source page documents the Emerald visit.',
  },
  'pokemondb:/location/hoenn-birth-island': {
    region: 'kanto',
    reason: 'Same Birth Island as the Kanto entry, accessed in Emerald.',
  },
  'pokeapi:steamdrift-way': {
    name: 'Steamdrift Way',
    reason: 'The API English label repeats its parent Route 8; Pokéarth names the sublocation.',
  },
  'pokeapi:thrifty-megamart': {
    name: 'Thrifty Megamart (Abandoned Site)',
    reason:
      'Its abandoned-site encounter area identifies the Ula’ula store despite the incorrect Royal Avenue English label.',
  },
  'pokeapi:unova-victory-road': {
    id: 'unova-victory-road-bw',
    reason: 'Black/White and their sequels use distinct Victory Road locations.',
  },
  'pokeapi:unova-victory-road-2': {
    id: 'unova-victory-road-b2w2',
    reason: 'Distinct sequel Victory Road.',
  },
  'serebii:/pokearth/unova/victoryroad.shtml': {
    id: 'unova-victory-road-bw',
    reason: 'Original Black/White page; sequel page has a separate identity.',
  },
  'serebii:/pokearth/unova/victoryroadb2w2.shtml': {
    id: 'unova-victory-road-b2w2',
    reason: 'Sequel Victory Road.',
  },
  'pokemondb:/location/unova-victory-road': {
    exclude: true,
    reason:
      'Combines two distinct Victory Roads; version-specific records come from PokéAPI and Pokéarth.',
  },
  'pokeapi:mirage-island': {
    id: 'hoenn-mirage-island-rse',
    reason: 'Original Mirage Island differs from the ORAS Mirage Spot islands.',
  },
  'pokeapi:mirage-spot-island': {
    id: 'hoenn-mirage-island-oras',
    reason: 'ORAS Mirage Spot islands differ from original Mirage Island.',
  },
  'serebii:/pokearth/hoenn/mirageisland.shtml': {
    exclude: true,
    reason:
      'Edition navigation combines original Mirage Island and ORAS Mirage Spots; use distinct PokéAPI records.',
  },
  'pokemondb:/location/hoenn-mirage-island': {
    id: 'hoenn-mirage-island-rse',
    reason: 'This PokémonDB page covers only Ruby, Sapphire, and Emerald.',
  },
  'serebii:/pokearth/hoenn/magmahideout.shtml': {
    exclude: true,
    reason:
      'Edition links combine the Lilycove hideout with the distinct Jagged Pass hideout in Emerald; use the other Lilycove page and PokéAPI 486.',
  },
  'pokeapi:kanto-underground-path': {
    exclude: true,
    reason:
      'Aggregates two Underground Paths; cannot assign its one API ID to either numbered path safely.',
  },
}

export const aliases: Record<string, string> = {
  // Alternate names of the same locations; resolve before the Bulbapedia exception review.
  // https://bulbapedia.bulbagarden.net/wiki/Global_Terminal
  'sinnoh-gts': 'sinnoh-global-terminal',
  // https://bulbapedia.bulbagarden.net/wiki/Kalos_Route_1
  'kalos-vaniville-pathway': 'kalos-route-1',
  'alola-thrifty-megamart': 'alola-thrifty-megamart-abandoned-site',
  'johto-tin-tower': 'johto-bell-tower',
  'kanto-ss-anne': 'kanto-s-s-anne',
  'johto-ss-aqua': 'johto-s-s-aqua',
  'hoenn-ss-tidal': 'hoenn-s-s-tidal',
  'orre-cave-poke-spot': 'orre-cave-pokespot',
  'orre-oasis-poke-spot': 'orre-oasis-pokespot',
  'orre-rock-poke-spot': 'orre-rock-pokespot',
  // PokéAPI distinguishes sea routes in their English names; the catalogs use Route N.
  'kanto-sea-route-19': 'kanto-route-19',
  'kanto-sea-route-20': 'kanto-route-20',
  'kanto-sea-route-21': 'kanto-route-21',
  'johto-sea-route-40': 'johto-route-40',
  'johto-sea-route-41': 'johto-route-41',
  'sinnoh-sea-route-220': 'sinnoh-route-220',
  'sinnoh-sea-route-223': 'sinnoh-route-223',
  'sinnoh-sea-route-226': 'sinnoh-route-226',
  'sinnoh-sea-route-230': 'sinnoh-route-230',
  // Regional qualifiers in upstream names are already represented by our ID prefix.
  'kanto-kanto-power-plant': 'kanto-power-plant',
  'johto-johto-safari-zone': 'johto-safari-zone',
  'hoenn-hoenn-battle-frontier': 'hoenn-battle-frontier',
  'alola-alola-berry-fields': 'alola-berry-fields',
  'hoenn-evergrande-city': 'hoenn-ever-grande-city',
  'orre-pyrite-bldg': 'orre-pyrite-building',
  'sinnoh-new-moon-island': 'sinnoh-newmoon-island',
  'sinnoh-full-moon-island': 'sinnoh-fullmoon-island',
  'sinnoh-ruins-maniacs-cave': 'sinnoh-ruin-maniac-cave',
  'sinnoh-ruin-maniac-tunnel': 'sinnoh-maniac-tunnel',
  'sinnoh-ruins-maniacs-tunnel': 'sinnoh-maniac-tunnel',
  // Pokéarth overviews identify these alternate building and area names.
  'johto-lighthouse': 'johto-glitter-lighthouse',
  'johto-shining-lighthouse': 'johto-glitter-lighthouse',
  'johto-goldenrod-tunnel': 'johto-goldenrod-underground',
  'johto-goldenrod-radio-tower': 'johto-radio-tower',
  'johto-rocket-hideout': 'johto-team-rocket-hq',
  'sinnoh-t-g-eterna-bldg': 'sinnoh-eterna-galactic-building',
  'sinnoh-veilstone-galactic-building': 'sinnoh-galactic-hq',
  'sinnoh-grand-lake': 'sinnoh-grand-lake-hotel',
  'unova-liberty-island': 'unova-liberty-garden',
  'unova-undersea-ruins': 'unova-abyssal-ruins',
  'unova-high-link': 'unova-entralink',
  'kalos-team-flare-hq': 'kalos-team-flare-secret-hq',
  'kalos-zubat-roost': 'kalos-connecting-cave',
  'hisui-coastlands-base-camp': 'hisui-coastlands-camp',
  'hisui-heights-base-camp': 'hisui-heights-camp',
  'hisui-aipom-hills': 'hisui-aipom-hill',
  'hisui-heartwood': 'hisui-the-heartwood',
  'paldea-the-pokemon-league': 'paldea-pokemon-league',
  'paldea-great-crater-of-paldea': 'paldea-the-great-crater-of-paldea',
  'unova-pwt': 'unova-pokemon-world-tournament',
  // Lilycove's hideout changes team/name by version; Emerald's Jagged Pass hideout stays separate.
  'hoenn-aqua-magma-hideout': 'hoenn-team-aqua-magma-hideout',
  'hoenn-team-magma-aqua-hideout': 'hoenn-team-aqua-magma-hideout',
  'hoenn-team-aqua-hideout': 'hoenn-team-aqua-magma-hideout',
  'hoenn-team-magma-hideout': 'hoenn-team-aqua-magma-hideout',
  // PokémonDB's location H1s explicitly pair every title below with its route number.
  'kalos-avance-trail': 'kalos-route-2',
  'kalos-ouvert-way': 'kalos-route-3',
  'kalos-parterre-way': 'kalos-route-4',
  'kalos-versant-road': 'kalos-route-5',
  'kalos-palais-lane': 'kalos-route-6',
  'kalos-riviere-walk': 'kalos-route-7',
  'kalos-muraille-coast': 'kalos-route-8',
  'kalos-spikes-passage': 'kalos-route-9',
  'kalos-menhir-trail': 'kalos-route-10',
  'kalos-miroir-way': 'kalos-route-11',
  'kalos-fourrage-road': 'kalos-route-12',
  'kalos-lumiose-badlands': 'kalos-route-13',
  'kalos-laverre-nature-trail': 'kalos-route-14',
  'kalos-brun-way': 'kalos-route-15',
  'kalos-melancolie-path': 'kalos-route-16',
  'kalos-mamoswine-road': 'kalos-route-17',
  'kalos-vallee-etroite-way': 'kalos-route-18',
  'kalos-grande-vallee-way': 'kalos-route-19',
  'kalos-winding-woods': 'kalos-route-20',
  'kalos-derniere-way': 'kalos-route-21',
  'kalos-detourner-way': 'kalos-route-22',
}

export const primaryPokeApiIds: Record<string, number> = {
  'alola-thrifty-megamart-abandoned-site': 1044,
  'kanto-victory-road': 152,
  'sinnoh-hall-of-origin': 188,
  'sinnoh-global-terminal': 220,
  'alola-malie-city': 1045,
  // The numbered route record remains primary over its alternate-title API record.
  'kalos-route-1': 588,
  'kalos-route-2': 591,
  'kalos-route-3': 594,
  'kalos-route-4': 597,
  'kalos-route-5': 602,
  'kalos-route-6': 606,
  'kalos-route-7': 609,
  'kalos-route-8': 612,
  'kalos-route-9': 615,
  'kalos-route-10': 618,
  'kalos-route-11': 621,
  'kalos-route-12': 626,
  'kalos-route-13': 629,
  'kalos-route-14': 631,
  'kalos-route-15': 635,
  'kalos-route-16': 638,
  'kalos-route-17': 641,
  'kalos-route-18': 644,
  'kalos-route-19': 647,
  'kalos-route-20': 650,
  'kalos-route-21': 653,
  'kalos-route-22': 655,
  'kalos-connecting-cave': 672,
  'hoenn-team-aqua-magma-hideout': 692,
}

export const canonicalNames: Record<string, string> = {
  'alola-thrifty-megamart-abandoned-site': 'Thrifty Megamart (Abandoned Site)',
  'johto-bell-tower': 'Bell Tower',
  'kanto-s-s-anne': 'S.S. Anne',
  'johto-s-s-aqua': 'S.S. Aqua',
  'hoenn-s-s-tidal': 'S.S. Tidal',
  'kanto-route-19': 'Route 19',
  'kanto-route-20': 'Route 20',
  'kanto-route-21': 'Route 21',
  'johto-route-40': 'Route 40',
  'johto-route-41': 'Route 41',
  'sinnoh-route-220': 'Route 220',
  'sinnoh-route-223': 'Route 223',
  'sinnoh-route-226': 'Route 226',
  'sinnoh-route-230': 'Route 230',
  'kanto-power-plant': 'Power Plant',
  'johto-safari-zone': 'Safari Zone',
  'hoenn-battle-frontier': 'Battle Frontier',
  'alola-berry-fields': 'Berry Fields',
  'hoenn-ever-grande-city': 'Ever Grande City',
  'orre-pyrite-building': 'Pyrite Building',
  'sinnoh-newmoon-island': 'Newmoon Island',
  'sinnoh-fullmoon-island': 'Fullmoon Island',
  'sinnoh-ruin-maniac-cave': 'Ruin Maniac Cave',
  'sinnoh-maniac-tunnel': 'Maniac Tunnel',
  'johto-glitter-lighthouse': 'Glitter Lighthouse',
  'johto-goldenrod-underground': 'Goldenrod Underground',
  'johto-radio-tower': 'Radio Tower',
  'johto-team-rocket-hq': 'Team Rocket HQ',
  'sinnoh-eterna-galactic-building': 'Eterna Galactic Building',
  'sinnoh-galactic-hq': 'Galactic HQ',
  'sinnoh-grand-lake-hotel': 'Grand Lake Hotel',
  'unova-liberty-garden': 'Liberty Garden',
  'unova-abyssal-ruins': 'Abyssal Ruins',
  'unova-entralink': 'Entralink',
  'kalos-team-flare-secret-hq': 'Team Flare Secret HQ',
  'kalos-connecting-cave': 'Connecting Cave',
  'hisui-coastlands-camp': 'Coastlands Camp',
  'hisui-heights-camp': 'Heights Camp',
  'hisui-aipom-hill': 'Aipom Hill',
  'hisui-the-heartwood': 'The Heartwood',
  'paldea-pokemon-league': 'Pokémon League',
  'paldea-the-great-crater-of-paldea': 'The Great Crater of Paldea',
  'unova-pokemon-world-tournament': 'Pokémon World Tournament',
  'hoenn-team-aqua-magma-hideout': 'Team Aqua/Magma Hideout',
  'kalos-route-2': 'Route 2',
  'kalos-route-3': 'Route 3',
  'kalos-route-4': 'Route 4',
  'kalos-route-5': 'Route 5',
  'kalos-route-6': 'Route 6',
  'kalos-route-7': 'Route 7',
  'kalos-route-8': 'Route 8',
  'kalos-route-9': 'Route 9',
  'kalos-route-10': 'Route 10',
  'kalos-route-11': 'Route 11',
  'kalos-route-12': 'Route 12',
  'kalos-route-13': 'Route 13',
  'kalos-route-14': 'Route 14',
  'kalos-route-15': 'Route 15',
  'kalos-route-16': 'Route 16',
  'kalos-route-17': 'Route 17',
  'kalos-route-18': 'Route 18',
  'kalos-route-19': 'Route 19',
  'kalos-route-20': 'Route 20',
  'kalos-route-21': 'Route 21',
  'kalos-route-22': 'Route 22',
}

export const gameEvidence: Record<string, { games: string[]; urls: string[]; reason: string }> = {
  'kalos-lumiose-city': {
    games: ['lza'],
    urls: ['https://www.serebii.net/pokearth/lumiosecity/index.shtml'],
    reason: 'The Z-A catalog is the city itself; its individual districts are listed separately.',
  },
  'sinnoh-grand-underground': {
    games: ['bdsp-bd', 'bdsp-sp'],
    urls: ['https://www.serebii.net/brilliantdiamondshiningpearl/grandunderground.shtml'],
    reason:
      'The dedicated BDSP guide covers this parent area; the catalog lists individual hideaways.',
  },
  'sinnoh-ramanas-park': {
    games: ['bdsp-bd', 'bdsp-sp'],
    urls: ['https://www.serebii.net/brilliantdiamondshiningpearl/ramanaspark.shtml'],
    reason: 'Explicit BDSP location guide; distinct from the earlier Pal Park.',
  },
  'unova-cave-of-being': {
    games: ['b2w2-b2', 'b2w2-w2'],
    urls: ['https://www.serebii.net/black2white2/legendary.shtml'],
    reason: 'The lake guardians section explicitly describes visiting the cave in Black 2/White 2.',
  },
  'alola-poni-beach': {
    games: ['usum-us', 'usum-um'],
    urls: ['https://www.serebii.net/ultrasunultramoon/mantinesurf.shtml'],
    reason: 'Explicitly named as the Poni Island Mantine Surf beach in the Ultra editions.',
  },
  'hisui-prelude-beach': {
    games: ['la'],
    urls: ['https://www.serebii.net/pokearth/hisui/jubilifevillage.shtml'],
    reason: 'Separately named section of the Jubilife Village location page.',
  },
  'galar-steamdrift-way': {
    games: ['swsh-sw', 'swsh-sh'],
    urls: ['https://www.serebii.net/pokearth/galar/route8.shtml'],
    reason: 'Named Route 8 sublocation with its own Steamdrift Way map on the Sword/Shield page.',
  },
  'alola-battle-royal-dome': {
    games: ['sm-s', 'sm-m', 'usum-us', 'usum-um'],
    urls: ['https://www.serebii.net/pokearth/alola/royalavenue.shtml'],
    reason: 'Named building in Royal Avenue, shared by the original and Ultra editions.',
  },
}

// These named facilities are inside the Terarium/academy, not in Paldea. They are
// described on the shared Scarlet/Violet academy and biome pages instead of separate catalog pages.
for (const [name, page] of Object.entries({
  'canyon-plaza': 'canyonbiome',
  'coastal-plaza': 'coastalbiome',
  'polar-plaza': 'polarbiome',
  'savanna-plaza': 'savannabiome',
  'league-club-room': 'blueberryacademy',
})) {
  sourceOverrides[`pokeapi:${name}`] = {
    region: 'unova',
    reason: 'Named Blueberry Academy/Terarium facility in Unova.',
  }
  gameEvidence[`unova-${name}`] = {
    games: ['sv-s', 'sv-v'],
    urls: [`https://www.serebii.net/pokearth/terarium/${page}.shtml`],
    reason: 'Named facility within this Scarlet/Violet academy or biome page.',
  }
}

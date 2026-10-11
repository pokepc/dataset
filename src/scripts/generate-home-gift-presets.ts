/**
 * Generates the HOME gift checklist presets: one modern HOME preset per game whose Pokédex
 * completion HOME rewards with a gift (https://www.serebii.net/pokemonhome/giftpokemon.shtml).
 * Each preset lists the main entries of that game's Pokédexes, one box group per Pokédex, skipping
 * entries already listed by an earlier Pokédex and entries HOME cannot store. Re-running it
 * rewrites the presets, so curate the inputs here rather than the output. This is the v7 port of
 * the v8 script: names, descriptions and box names stay inline in the preset (schemaVersion 1).
 *
 * Left out: FireRed and LeafGreen's Celebi (that gift checks the game's own save, not HOME) and
 * Original Color Magearna (it needs the National Pokédex up to Eternatus, not one game's).
 */
import {
  loadAllGames,
  loadAllPokedexes,
  loadAllPokemon,
  readDatasetFile,
  writeDatasetFile,
} from '../lib/fs'
import { modernBoxPresetIndexSchema, modernBoxPresetSchema } from '../lib/schemas'

type ModernBoxPreset = Pkds.ModernBoxPreset

type GiftPresetInput = {
  game: string
  gift: string
  gameName: string
  // Pokédex ids in order, each with the short name its boxes take.
  dexes: Array<[dexId: string, boxName: string]>
}

// Legends: Z-A also asks for its Mega Evolution Pokédex, whose entries are Mega forms of species
// already in the other two and which HOME cannot store, so registering them is done in the game.
const giftPresets: GiftPresetInput[] = [
  { game: 'lgpe', gift: 'Shiny Meltan', gameName: "Let's Go", dexes: [['kanto-lgpe', 'Kanto']] },
  {
    game: 'swsh',
    gift: 'Shiny Keldeo',
    gameName: 'Sword and Shield',
    dexes: [
      ['galar', 'Galar'],
      ['galar-isle-armor', 'Isle of Armor'],
      ['galar-crown-tundra', 'Crown Tundra'],
    ],
  },
  {
    game: 'bdsp',
    gift: 'Shiny Manaphy',
    gameName: 'Brilliant Diamond and Shining Pearl',
    dexes: [['sinnoh', 'Sinnoh']],
  },
  {
    game: 'la',
    gift: 'Shiny Enamorus',
    gameName: 'Legends: Arceus',
    dexes: [['hisui', 'Hisui']],
  },
  {
    game: 'sv',
    gift: 'Shiny Meloetta',
    gameName: 'Scarlet and Violet',
    dexes: [
      ['paldea', 'Paldea'],
      ['paldea-kitakami', 'Kitakami'],
      ['paldea-blueberry', 'Blueberry'],
    ],
  },
  {
    game: 'lza',
    gift: 'Shiny Volcanion',
    gameName: 'Legends: Z-A',
    dexes: [
      ['kalos-lumiose', 'Lumiose'],
      ['kalos-hyperspace', 'Hyperspace'],
    ],
  },
]

const HOME = 'home'
const BOX_SIZE = 30
const PRESETS_INDEX = `boxpresets/modern/${HOME}.json`

const gamesById = new Map(loadAllGames().map((game) => [game.id, game]))
const pokedexesById = new Map(loadAllPokedexes().map((dex) => [dex.id, dex]))
const storableInHome = new Set(
  loadAllPokemon()
    .filter((pokemon) => pokemon.storableIn.includes(HOME))
    .map((pokemon) => pokemon.id),
)

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function buildGiftPreset(input: GiftPresetInput): ModernBoxPreset {
  const game = gamesById.get(input.game)
  if (!game) throw new Error(`Unknown game set ${input.game}`)

  const listed = new Set<string>()
  const boxes: ModernBoxPreset['boxes'] = []

  for (const [dexId, boxName] of input.dexes) {
    const dex = pokedexesById.get(dexId)
    if (!dex) throw new Error(`Unknown Pokédex ${dexId}`)
    const pokemon = dex.entries
      .filter((entry) => !entry.isForm && !listed.has(entry.pid))
      .map((entry) => entry.pid)
    const unstorable = pokemon.filter((id) => !storableInHome.has(id))
    if (unstorable.length > 0) {
      console.warn(`${input.game}: ${dexId} skips ${unstorable.join(', ')} (not storable in HOME)`)
    }
    const storable = pokemon.filter((id) => storableInHome.has(id))
    for (const id of storable) listed.add(id)

    const dexBoxes = chunk(storable, BOX_SIZE)
    dexBoxes.forEach((slots, index) => {
      boxes.push({ name: `${boxName} ${index + 1}`, slots })
    })
  }

  const dexNames = input.dexes.map(([, boxName]) => boxName)
  const dexList =
    dexNames.length === 1
      ? `the ${dexNames[0]} Pokédex`
      : `the ${dexNames.slice(0, -1).join(', ')} and ${dexNames.at(-1)} Pokédexes`
  const preset = modernBoxPresetSchema.parse({
    schemaVersion: 1,
    id: `gift-${input.game}`,
    gameSet: HOME,
    name: `${input.gift} Gift Checklist (${input.gameName})`,
    description:
      `A checklist of the ${listed.size} Pokémon in ${dexList} of ${input.gameName}, one box group ` +
      `per Pokédex, for trainers working toward the ${input.gift} that Pokémon HOME gives for ` +
      `completing them. HOME checks the Pokédexes, so filling these boxes does not guarantee the ` +
      `gift; forms, Gigantamax and Mega entries are left out.`,
    tags: ['grouped'],
    origin: { game: input.game, originMark: game.originMark },
    boxes,
  })
  console.log(`${preset.id}: ${listed.size} Pokémon in ${boxes.length} boxes`)
  return preset
}

const index = modernBoxPresetIndexSchema.parse(readDatasetFile(PRESETS_INDEX))

for (const input of giftPresets) {
  const preset = buildGiftPreset(input)
  writeDatasetFile(
    `${JSON.stringify(preset, null, 2)}\n`,
    `boxpresets/modern/${HOME}/${preset.id}.json`,
  )
  if (!index.includes(preset.id)) index.push(preset.id)
}

writeDatasetFile(`${JSON.stringify(index, null, 2)}\n`, PRESETS_INDEX)

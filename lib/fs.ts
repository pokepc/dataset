import fs from 'node:fs'
import path from 'node:path'
import { yolodb } from 'yolodb'
import { arrayUnique, MemoryCache } from './utils'

const DATASET_DIR = path.resolve(process.env.POKEPC_DATASET_DIR || path.join(process.cwd(), 'data'))
console.debug('Resolved POKEPC dataset directory:', DATASET_DIR)

const DEFAULT_CACHE_TTL = 1000 * 10 // 10 seconds
const memoryCache = new MemoryCache(DEFAULT_CACHE_TTL)

export function absDatasetFile(fileName: string) {
  return path.join(DATASET_DIR, fileName)
}

export function readDatasetFile<T>(filePath: string): T {
  const absFilePath = absDatasetFile(filePath)
  const data = fs.readFileSync(absFilePath, 'utf8')
  return JSON.parse(data)
}

export function writeDatasetFile(data: any, filePath: string, minified: boolean = false) {
  const absFilePath = absDatasetFile(filePath)
  let jsonData = typeof data === 'string' ? data : JSON.stringify(data, null, minified ? 0 : 2)
  fs.mkdirSync(path.dirname(absFilePath), { recursive: true })
  fs.writeFileSync(absFilePath, jsonData)
}

export const itemsFs = yolodb<Pkds.Item>(absDatasetFile('items.json'), 'id', [], {
  superjsonEnabled: false,
})

export const pokeballsFs = yolodb<Pkds.Pokeball>(absDatasetFile('pokeballs.json'), 'id', [], {
  superjsonEnabled: false,
})

export const abilitiesFs = yolodb<Pkds.Ability>(absDatasetFile('abilities.json'), 'id', [], {
  superjsonEnabled: false,
})

export const movesFs = yolodb<Pkds.Move>(absDatasetFile('moves.json'), 'id', [], {
  superjsonEnabled: false,
})

export const charactersFs = yolodb<Pkds.Character>(absDatasetFile('characters.json'), 'id', [], {
  superjsonEnabled: false,
})

export const ribbonsFs = yolodb<Pkds.Ribbon>(absDatasetFile('ribbons.json'), 'id', [], {
  superjsonEnabled: false,
})

export const marksFs = yolodb<Pkds.Mark>(absDatasetFile('marks.json'), 'id', [], {
  superjsonEnabled: false,
})

export const originMarksFs = yolodb<Pkds.OriginMark>(absDatasetFile('originmarks.json'), 'id', [], {
  superjsonEnabled: false,
})

export const typesFs = yolodb<Pkds.Type>(absDatasetFile('types.json'), 'id', [], {
  superjsonEnabled: false,
})

export const naturesFs = yolodb<Pkds.Nature>(absDatasetFile('natures.json'), 'id', [], {
  superjsonEnabled: false,
})

export const personalitiesFs = yolodb<Pkds.Personality>(
  absDatasetFile('personalities.json'),
  'id',
  [],
  {
    superjsonEnabled: false,
  },
)

export const regionsFs = yolodb<Pkds.Region>(absDatasetFile('regions.json'), 'id', [], {
  superjsonEnabled: false,
})

export const colorsFs = yolodb<Pkds.Color>(absDatasetFile('colors.json'), 'id', [], {
  superjsonEnabled: false,
})

export const languagesFs = yolodb<Pkds.Language>(absDatasetFile('languages.json'), 'id', [], {
  superjsonEnabled: false,
})

export const generationsFs = yolodb<Pkds.Generation>(absDatasetFile('generations.json'), 'id', [], {
  superjsonEnabled: false,
})

export function joinPokemonFilesFromIndex(index: string[]): Pkds.Pokemon[] {
  const pokemon: Pkds.Pokemon[] = []
  for (const item of index) {
    const filePath = absDatasetFile(`pokemon/${item}.json`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Pokemon ${item} not found at ${filePath}`)
    }
    const pkm = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    // const parsed = pokemonSchema.parse(pkm)
    pokemon.push(pkm)
  }

  return pokemon
}

export function joinGamesFilesFromIndex(index: string[]): Pkds.Game[] {
  const games: Pkds.Game[] = []
  for (const item of index) {
    const filePath = absDatasetFile(`games/${item}.json`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Game ${item} not found at ${filePath}`)
    }
    const game = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    // const parsed = gameSchema.parse(game)
    games.push(game)
  }

  return games
}

export function joinPokedexesFilesFromIndex(index: string[]): Pkds.Pokedex[] {
  const pokedexes: Pkds.Pokedex[] = []
  for (const item of index) {
    const filePath = absDatasetFile(`pokedexes/${item}.json`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Pokedex ${item} not found at ${filePath}`)
    }
    const pokedex = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    // const parsed = pokedexSchema.parse(pokedex)
    pokedexes.push(pokedex)
  }

  return pokedexes
}

export function joinBoxPresetFilesFromIndex(
  index: string[],
  variant: 'classic' | 'modern' = 'classic',
): Array<Pkds.LegacyBoxPresetByGameset> {
  const boxPresetGroups: Array<Pkds.LegacyBoxPresetByGameset> = []
  for (const item of index) {
    const filePath = absDatasetFile(`boxpresets/${variant}/${item}.json`)
    if (!fs.existsSync(filePath)) {
      console.error(`Box preset ${item} not found at ${filePath}`)
      continue
    }
    const boxPresets = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    // const parsed = legacyBoxPresetSchema.parse(boxPreset)
    boxPresetGroups.push({ gameset: item, presets: Object.values(boxPresets) })
  }

  return boxPresetGroups
}

export function readIndexFile(indexName: 'pokemon' | 'games' | 'pokedexes'): string[] {
  const indexFilePath = absDatasetFile(`indices/${indexName}.json`)
  if (!fs.existsSync(indexFilePath)) {
    throw new Error(`Index file ${indexName} not found at ${indexFilePath}`)
  }
  return JSON.parse(fs.readFileSync(indexFilePath, 'utf8'))
}

export function regeneratePokemonIndexFile(): string[] {
  const allPokemon = loadAllPokemon()
  const index = allPokemon.flatMap((pkm) => [pkm.id, ...pkm.forms.map((form) => form)])
  writeDatasetFile(arrayUnique(index), 'indices/pokemon.json', false)
  return index
}

export function loadAllPokemon(): Pkds.Pokemon[] {
  return memoryCache.cached('allPokemon', () => {
    const index = readIndexFile('pokemon')
    return joinPokemonFilesFromIndex(index)
  })
}

export function loadAllGameSets(): Pkds.Game[] {
  return loadAllGames().filter((game) => {
    if (game.type === 'set') {
      return true
    }
    if (game.type === 'game' && !game.gameSet) {
      return true
    }
    return false
  })
}

export function loadAllBoxPresets(
  variant: 'classic' | 'modern' = 'classic',
): Array<Pkds.LegacyBoxPresetByGameset> {
  return memoryCache.cached(`allBoxPresets-${variant}`, () => {
    const filenames = loadAllGameSets().map((game) => game.id)
    return joinBoxPresetFilesFromIndex(filenames, variant)
  })
}

export function loadAllGames(): Pkds.Game[] {
  return memoryCache.cached('allGames', () => {
    const index = readIndexFile('games')
    return joinGamesFilesFromIndex(index)
  })
}

export function loadAllPokedexes(): Pkds.Pokedex[] {
  return memoryCache.cached('allPokedexes', () => {
    const index = readIndexFile('pokedexes')
    return joinPokedexesFilesFromIndex(index)
  })
}

export function loadAllCharacters(): Pkds.Character[] {
  return charactersFs.all()
}

export function loadAllItems(): Pkds.Item[] {
  return itemsFs.all()
}

export function loadAllPokeballs(): Pkds.Pokeball[] {
  return pokeballsFs.all()
}

export function loadAllAbilities(): Pkds.Ability[] {
  return abilitiesFs.all()
}

export function loadAllMoves(): Pkds.Move[] {
  return movesFs.all()
}

export function loadAllRibbons(): Pkds.Ribbon[] {
  return ribbonsFs.all()
}

export function loadAllMarks(): Pkds.Mark[] {
  return marksFs.all()
}

export function loadAllOriginMarks(): Pkds.OriginMark[] {
  return originMarksFs.all()
}

export function loadAllTypes(): Pkds.Type[] {
  return typesFs.all()
}

export function loadAllNatures(): Pkds.Nature[] {
  return naturesFs.all()
}

export function loadAllPersonalities(): Pkds.Personality[] {
  return personalitiesFs.all()
}

export function loadAllRegions(): Pkds.Region[] {
  return regionsFs.all()
}

export function loadAllColors(): Pkds.Color[] {
  return colorsFs.all()
}

export function loadAllLanguages(): Pkds.Language[] {
  return languagesFs.all()
}

export function loadAllGenerations(): Pkds.Generation[] {
  return generationsFs.all()
}

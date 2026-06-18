import fs from 'node:fs'
import path from 'node:path'
import { pokemonSchema } from '../lib/schemas'
import { sortStringsInGivenOrder } from '../utils/utils-internal'

const FILE_DIR = 'pokemon'
const GAME_ID = 'champions'
const DRY_RUN = process.env.DRY_RUN === '1'

function findDatasetDir() {
  const candidates = [
    path.resolve(process.env.POKEPC_DATASET_DIR ?? 'data'),
    path.join(process.cwd(), 'data'),
  ].filter((candidate): candidate is string => typeof candidate === 'string')

  const datasetDir = candidates.find((candidate) =>
    fs.existsSync(path.resolve(candidate, 'indices/games.json')),
  )
  if (!datasetDir) {
    throw new Error('Could not find dataset directory. Set POKEPC_DATASET_DIR and try again.')
  }

  return path.resolve(datasetDir)
}

const DATASET_DIR = findDatasetDir()

function readDatasetFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATASET_DIR, filePath), 'utf8')) as T
}

function writeDatasetFile(data: unknown, filePath: string) {
  fs.writeFileSync(path.join(DATASET_DIR, filePath), JSON.stringify(data, null, 2))
}

function loadIndexedRecords<T>(indexName: 'games' | 'pokedexes' | 'pokemon', dataDir: string) {
  const index = readDatasetFile<string[]>(`indices/${indexName}.json`)
  return index.map((id) => readDatasetFile<T>(`${dataDir}/${id}.json`))
}

async function main() {
  const allGames = loadIndexedRecords<Pkds.Game>('games', 'games')
  const championsGame = allGames.find((game) => game.id === GAME_ID)
  if (!championsGame) {
    throw new Error(`Game ${GAME_ID} not found`)
  }

  const pokedexIds = new Set(championsGame.pokedexes)
  const championsPokedexes = loadIndexedRecords<Pkds.Pokedex>('pokedexes', 'pokedexes').filter(
    (pokedex) => pokedexIds.has(pokedex.id),
  )
  if (championsPokedexes.length !== pokedexIds.size) {
    const foundPokedexIds = new Set(championsPokedexes.map((pokedex) => pokedex.id))
    const missingPokedexIds = [...pokedexIds].filter((id) => !foundPokedexIds.has(id))
    throw new Error(`Pokedexes not found for ${GAME_ID}: ${missingPokedexIds.join(', ')}`)
  }

  const championsPokemonIds = new Set(
    championsPokedexes.flatMap((pokedex) => pokedex.entries.map((entry) => entry.pid)),
  )
  const gameIdOrder = allGames.filter((game) => game.type === 'game').map((game) => game.id)
  const allPokemon = loadIndexedRecords<Pkds.Pokemon>('pokemon', FILE_DIR)
  const allPokemonIds = new Set(allPokemon.map((pokemon) => pokemon.id))
  const missingPokemonIds = [...championsPokemonIds].filter((id) => !allPokemonIds.has(id))
  if (missingPokemonIds.length > 0) {
    throw new Error(`Pokemon not found for ${GAME_ID}: ${missingPokemonIds.join(', ')}`)
  }

  let updatedRecords = 0
  let excludedBattleOnlyForms = 0
  for (const pokemon of allPokemon) {
    if (!championsPokemonIds.has(pokemon.id)) {
      continue
    }

    if (pokemon.isForm && pokemon.isBattleOnlyForm) {
      const storableIn = sortStringsInGivenOrder(
        pokemon.storableIn.filter((gameId) => gameId !== GAME_ID),
        gameIdOrder,
      )
      if (JSON.stringify(storableIn) !== JSON.stringify(pokemon.storableIn)) {
        pokemon.storableIn = storableIn
        void pokemonSchema.parse(pokemon)
        if (!DRY_RUN) {
          writeDatasetFile(pokemon, `${FILE_DIR}/${pokemon.id}.json`)
        }
        updatedRecords += 1
      }
      excludedBattleOnlyForms += 1
      continue
    }

    const storableIn = sortStringsInGivenOrder(
      [...new Set([...pokemon.storableIn, GAME_ID])],
      gameIdOrder,
    )
    if (JSON.stringify(storableIn) === JSON.stringify(pokemon.storableIn)) {
      continue
    }

    pokemon.storableIn = storableIn
    void pokemonSchema.parse(pokemon)
    if (!DRY_RUN) {
      writeDatasetFile(pokemon, `${FILE_DIR}/${pokemon.id}.json`)
    }
    updatedRecords += 1
  }

  console.info(
    `${DRY_RUN ? 'Would update' : 'Updated'} storableIn for ${updatedRecords} Pokemon from ${championsPokedexes.length} ${GAME_ID} pokedexes. Excluded ${excludedBattleOnlyForms} battle-only forms.`,
  )
}

await main()

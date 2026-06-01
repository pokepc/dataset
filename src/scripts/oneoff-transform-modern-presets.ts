import { transformModernBoxPresets } from '../lib/box-preset-transform'
import fs from 'node:fs'
import path from 'node:path'

function getDatasetDir(): string {
  return path.resolve(process.env.POKEPC_DATASET_DIR ?? 'data')
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function loadValidPokemonIds(datasetDir: string): ReadonlySet<string> {
  const index = readJson<string[]>(path.join(datasetDir, 'indices', 'pokemon.json'))
  const pokemon = index.map((pokemonId) =>
    readJson<Pkds.Pokemon>(path.join(datasetDir, 'pokemon', `${pokemonId}.json`)),
  )

  return new Set(pokemon.flatMap((entry) => [entry.id, entry.nid]))
}

const datasetDir = getDatasetDir()
const result = transformModernBoxPresets({
  datasetDir,
  validPokemonIds: loadValidPokemonIds(datasetDir),
})

console.log(
  `[box-presets-modern] generated ${result.presetCount} presets for ${result.gameSets.length} game sets`,
)

if (result.diagnostics.length > 0) {
  console.log('[box-presets-modern] sanitizer diagnostics:', JSON.stringify(result.diagnostics))
}

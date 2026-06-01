import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

type PackageJson = {
  devDependencies?: Record<string, string>
  dependencies?: Record<string, string>
  version?: string
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')
const smokeRoot = path.join(repoRoot, '.local/pkg-smoke-test')
const smokeNodeModules = path.join(smokeRoot, 'node_modules')
const smokeDatasetDir = path.join(smokeNodeModules, '@pokepc/dataset')
const requireFromRepo = createRequire(path.join(repoRoot, 'package.json'))

function readRootPackageJson() {
  return JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as PackageJson
}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function copyDirectory(source: string, target: string) {
  cpSync(source, target, {
    recursive: true,
    dereference: true,
    filter: (sourcePath) => path.basename(sourcePath) !== '.DS_Store',
  })
}

function findPackageRoot(packageName: string) {
  let currentDir = path.dirname(requireFromRepo.resolve(packageName))

  while (currentDir !== path.dirname(currentDir)) {
    if (existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir
    }

    currentDir = path.dirname(currentDir)
  }

  throw new Error(`Could not find package root for ${packageName}`)
}

function copyInstalledPackage(packageName: string) {
  const packageRoot = findPackageRoot(packageName)
  const packageTarget = path.join(smokeNodeModules, ...packageName.split('/'))
  copyDirectory(packageRoot, packageTarget)
}

function copyDatasetPackage() {
  mkdirSync(smokeDatasetDir, { recursive: true })

  for (const fileName of ['package.json', 'LICENSE', 'README.md']) {
    const source = path.join(repoRoot, fileName)
    if (existsSync(source)) {
      copyFileSync(source, path.join(smokeDatasetDir, fileName))
    }
  }

  for (const directoryName of ['build', 'data']) {
    const source = path.join(repoRoot, directoryName)
    if (!existsSync(source)) {
      throw new Error(`Missing ${directoryName}. Run pnpm run build before copying package files.`)
    }

    copyDirectory(source, path.join(smokeDatasetDir, directoryName))
  }
}

function writeSmokeProject() {
  const rootPackageJson = readRootPackageJson()
  const typescriptVersion = rootPackageJson.devDependencies?.typescript ?? '*'
  const datasetVersion = rootPackageJson.version ?? '0.0.0'

  writeJson(path.join(smokeRoot, 'package.json'), {
    private: true,
    type: 'module',
    scripts: {
      typecheck: 'node ./node_modules/typescript/bin/tsc --noEmit',
      build: 'node ./node_modules/typescript/bin/tsc -p tsconfig.json',
      start: 'node ./dist/index.js',
    },
    dependencies: {
      '@pokepc/dataset': datasetVersion,
    },
    devDependencies: {
      typescript: typescriptVersion,
    },
  })

  writeJson(path.join(smokeRoot, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2024',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      verbatimModuleSyntax: true,
      rootDir: 'src',
      outDir: 'dist',
    },
    include: ['src/**/*.ts'],
  })

  mkdirSync(path.join(smokeRoot, 'src'), { recursive: true })
  writeFileSync(
    path.join(smokeRoot, 'src/index.ts'),
    `import { POKEPC_LATEST_GENERATION } from '@pokepc/dataset/lib/constants'
import { createSearchablePokemonList, searchPokemon } from '@pokepc/dataset/lib/search'
import { dexNumToGen, formatDexNum } from '@pokepc/dataset/lib/utils'
import { gameSchema, modernBoxPresetSchema, pokemonSchema } from '@pokepc/dataset/lib/schemas'
import type {} from '@pokepc/dataset/lib/types'
import pikachuData from '@pokepc/dataset/data/pokemon/pikachu' with { type: 'json' }
import bulbasaurData from '@pokepc/dataset/data/pokemon/bulbasaur' with { type: 'json' }
import swordShieldData from '@pokepc/dataset/data/games/swsh' with { type: 'json' }
import swordShieldPresetData from '@pokepc/dataset/data/boxpresets/modern/swsh/fully-sorted' with { type: 'json' }

const pikachu: Pkds.Pokemon = pokemonSchema.parse(pikachuData)
const bulbasaur: Pkds.Pokemon = pokemonSchema.parse(bulbasaurData)
const swordShield: Pkds.Game = gameSchema.parse(swordShieldData)
const swordShieldPreset: Pkds.ModernBoxPreset = modernBoxPresetSchema.parse(swordShieldPresetData)

const searchablePokemon = createSearchablePokemonList([pikachu, bulbasaur])
const electricSearch = searchPokemon(searchablePokemon, { q: 'pika', type: 'electric' }, false)
const occupiedPresetSlots = swordShieldPreset.boxes
  .flatMap((box) => box.slots)
  .filter((slot) => slot !== null).length

export const summary = {
  formattedDexNum: formatDexNum(pikachu.dexNum),
  latestGeneration: POKEPC_LATEST_GENERATION,
  occupiedPresetSlots,
  pikachuGeneration: dexNumToGen(pikachu.dexNum),
  searchResultIds: electricSearch.pokemon.map((pokemon) => pokemon.id),
  swordShieldBoxes: swordShield.maxBoxes,
}

if (summary.formattedDexNum !== '0025') {
  throw new Error('Expected Pikachu to format as dex number 0025')
}

if (summary.pikachuGeneration !== 1) {
  throw new Error('Expected Pikachu to resolve to generation 1')
}

if (!summary.searchResultIds.includes('pikachu')) {
  throw new Error('Expected electric search to include Pikachu')
}

if (summary.swordShieldBoxes !== 32) {
  throw new Error('Expected Sword and Shield to have 32 boxes')
}

if (summary.occupiedPresetSlots <= 0) {
  throw new Error('Expected the nested Sword and Shield preset to contain Pokemon slots')
}

if (summary.latestGeneration < swordShield.gen) {
  throw new Error('Expected latest generation to be at least the Sword and Shield generation')
}
`,
  )
}

rmSync(smokeRoot, { recursive: true, force: true })
mkdirSync(smokeNodeModules, { recursive: true })

run('pnpm', ['run', 'build'], repoRoot)
copyDatasetPackage()

for (const packageName of ['typescript', 'zod', 'yolodb']) {
  copyInstalledPackage(packageName)
}

writeSmokeProject()

run(process.execPath, ['./node_modules/typescript/bin/tsc', '--noEmit'], smokeRoot)
run(process.execPath, ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], smokeRoot)
run(process.execPath, ['./dist/index.js'], smokeRoot)

console.log(`Package smoke test passed in ${path.relative(repoRoot, smokeRoot)}`)

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function resolveDatasetDirectory(
  moduleUrl: string,
  configuredDirectory?: string,
  cwd = process.cwd(),
): string {
  if (configuredDirectory) {
    return validateDirectory(resolve(cwd, configuredDirectory))
  }

  let directory = dirname(fileURLToPath(moduleUrl))
  while (true) {
    const manifest = join(directory, 'package.json')
    if (
      existsSync(manifest) &&
      JSON.parse(readFileSync(manifest, 'utf8')).name === '@pokepc/dataset'
    ) {
      return validateDirectory(join(directory, 'data'))
    }
    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error('Could not locate the @pokepc/dataset package. Set POKEPC_DATASET_DIR.')
    }
    directory = parent
  }
}

function validateDirectory(directory: string): string {
  if (!existsSync(join(directory, 'types.json'))) {
    throw new Error(`Dataset directory is missing types.json: ${directory}`)
  }
  return directory
}

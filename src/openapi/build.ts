import fs from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const openApiDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(openApiDir, '../..')
const dataDir = path.join(projectRoot, 'data')
export const outDir = path.join(projectRoot, 'dist-pages')

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && path.extname(specifier) === '') {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})

function readPackageVersion() {
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string }
  return packageJson.version ?? '0.0.0'
}

function assertRequiredDataPaths(requiredDataPaths: string[]) {
  const missingPaths = requiredDataPaths.filter(
    (requiredPath) => !fs.existsSync(path.join(dataDir, requiredPath)),
  )

  if (missingPaths.length > 0) {
    throw new Error(`Missing documented data paths:\n${missingPaths.join('\n')}`)
  }
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

/**
 * Writes the merged data of every game set with mods under `<outDir>/games/<set>/`: one file per
 * Pokémon, one list per other moddable kind and the merged text per locale (decision-5).
 */
export async function writeMergedGameSets(sourceDir: string, targetDir: string): Promise<string[]> {
  const [{ listModdedGameSets, loadGameSetSource }, { mergeGameSet }] = await Promise.all([
    import('../lib/fs.ts'),
    import('../lib/merge.ts'),
  ])
  const sets = listModdedGameSets(sourceDir)
  for (const set of sets) {
    const setDir = path.join(targetDir, 'games', set)
    if (fs.existsSync(setDir)) throw new Error(`Merged output would overwrite ${setDir}`)
    const merged = mergeGameSet(loadGameSetSource(set, { dataDir: sourceDir }))
    for (const [kind, records] of Object.entries(merged.records)) {
      if (kind === 'pokemon') {
        for (const record of records)
          writeJsonFile(path.join(setDir, 'pokemon', `${record.id}.json`), record)
      } else {
        writeJsonFile(path.join(setDir, `${kind}.json`), records)
      }
    }
    for (const [locale, files] of Object.entries(merged.text)) {
      for (const [kind, file] of Object.entries(files ?? {})) {
        writeJsonFile(path.join(setDir, 'i18n', locale, `${kind}.json`), file)
      }
    }
  }
  return sets
}

function writeJsonFile(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  writeJson(filePath, data)
}

export async function buildPagesArtifact() {
  const [{ createStaticApiDocument }, { renderOpenApiIndexHtml }, { requiredDataPaths }] =
    await Promise.all([import('./document.ts'), import('./index-html.ts'), import('./manifest.ts')])

  assertRequiredDataPaths(requiredDataPaths)

  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  // v8 serves base data at the site root (no `/data/` prefix), then merged game sets.
  fs.cpSync(dataDir, outDir, {
    recursive: true,
    filter: (source) => !/(?:\.DS_Store|\.zip)$/.test(source),
  })
  await writeMergedGameSets(dataDir, outDir)

  const document = createStaticApiDocument({
    version: readPackageVersion(),
    serverUrl: '.',
  })

  writeJson(path.join(outDir, 'openapi.json'), document)
  fs.writeFileSync(path.join(outDir, 'index.html'), renderOpenApiIndexHtml())
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPagesArtifact()
}

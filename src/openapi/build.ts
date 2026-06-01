import fs from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const openApiDir = path.dirname(fileURLToPath(import.meta.url))
export const projectRoot = path.resolve(openApiDir, '../..')
export const dataDir = path.join(projectRoot, 'data')
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

export async function buildPagesArtifact() {
  const [{ createStaticApiDocument }, { renderOpenApiIndexHtml }, { requiredDataPaths }] =
    await Promise.all([import('./document.ts'), import('./index-html.ts'), import('./manifest.ts')])

  assertRequiredDataPaths(requiredDataPaths)

  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  fs.cpSync(dataDir, path.join(outDir, 'data'), { recursive: true })

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

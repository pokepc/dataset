import fs from 'node:fs'
import path from 'node:path'
import { renderOpenApiIndexHtml } from '../openapi/index-html.ts'
import { createServers, normalizeBaseUrl } from './manifest.ts'
import type { PagesVersion } from './manifest.ts'

export function assemblePages(
  versions: PagesVersion[],
  artifacts: Map<string, string>,
  outDir: string,
  baseUrl: string,
) {
  baseUrl = normalizeBaseUrl(baseUrl)
  // Validate every source before touching the destination or making a partial artifact.
  for (const version of versions) {
    const artifact = artifacts.get(version.sha)
    if (!artifact) throw new Error(`Missing build for ${version.ref} (${version.sha}).`)
    for (const file of ['index.html', 'openapi.json', 'data', 'data-next']) {
      if (!fs.existsSync(path.join(artifact, file)))
        throw new Error(`Missing ${file} in ${version.ref} build.`)
    }
    const spec = JSON.parse(fs.readFileSync(path.join(artifact, 'openapi.json'), 'utf8'))
    if (spec.info?.version !== version.version)
      throw new Error(`OpenAPI version mismatch for ${version.ref}.`)
    for (const reserved of [
      'latest',
      'versions.json',
      ...versions.filter((entry) => entry.path).map((entry) => entry.path),
    ]) {
      if (fs.existsSync(path.join(artifact, reserved)))
        throw new Error(`Source artifact uses reserved Pages path ${reserved}.`)
    }
  }
  fs.mkdirSync(outDir, { recursive: true })
  for (const version of versions) {
    const destination = path.join(outDir, version.path)
    fs.cpSync(artifacts.get(version.sha)!, destination, { recursive: true })
    const specPath = path.join(destination, 'openapi.json')
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
    spec.servers = createServers(versions, version.path, baseUrl)
    fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`)
    fs.writeFileSync(path.join(destination, 'index.html'), renderOpenApiIndexHtml())
  }
  fs.writeFileSync(
    path.join(outDir, 'versions.json'),
    `${JSON.stringify({ baseUrl, versions }, null, 2)}\n`,
  )
}

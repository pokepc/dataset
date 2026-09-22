import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildVersionedPages } from './build.ts'

const temporaryRoots: string[] = []
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

function git(root: string, ...args: string[]) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Pages test',
      GIT_AUTHOR_EMAIL: 'pages@example.invalid',
      GIT_COMMITTER_NAME: 'Pages test',
      GIT_COMMITTER_EMAIL: 'pages@example.invalid',
    },
  }).trim()
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-test-'))
  temporaryRoots.push(root)
  git(root, 'init', '--initial-branch=main')
  fs.writeFileSync(path.join(root, 'pages-versions.json'), JSON.stringify({ majors: [6, 7] }))
  function commit(version: string) {
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ version, homepage: 'https://example.com/dataset' }),
    )
    git(root, 'add', '.')
    git(root, '-c', 'commit.gpgsign=false', 'commit', '-m', version)
    return git(root, 'rev-parse', 'HEAD')
  }
  const v6 = commit('6.9.1')
  git(root, 'tag', '6.9.1')
  const v7 = commit('7.0.0')
  git(root, '-c', 'tag.gpgsign=false', 'tag', '-a', '7.0.0', '-m', 'release')
  git(root, 'tag', 'v7.0.0')
  const main = commit('7.1.0-dev.1')
  git(root, 'tag', '8.0.0-rc.1')
  return { root, v6, v7, main }
}

function sourceSpec(version: string) {
  return {
    openapi: '3.1.0',
    info: { title: 'Historical API', version },
    servers: [{ url: '.' }],
    paths: { [`/data/${version}.json`]: { get: { operationId: version } } },
    components: { schemas: { Historical: { const: version } } },
  }
}

function writeArtifact(checkout: string) {
  const { version } = JSON.parse(fs.readFileSync(path.join(checkout, 'package.json'), 'utf8')) as {
    version: string
  }
  const out = path.join(checkout, 'dist-pages')
  for (const directory of ['data', 'data-next']) {
    fs.mkdirSync(path.join(out, directory), { recursive: true })
    fs.writeFileSync(path.join(out, directory, 'version.json'), JSON.stringify({ version }))
  }
  fs.writeFileSync(path.join(out, 'openapi.json'), JSON.stringify(sourceSpec(version)))
  fs.writeFileSync(path.join(out, 'index.html'), 'historical shell that overrides servers')
}

function readJson(root: string, name: string) {
  return JSON.parse(fs.readFileSync(path.join(root, 'dist-pages', name), 'utf8'))
}

describe('aggregate Pages build', () => {
  it('resolves annotated/lightweight tags, isolates data and schemas, and builds shared SHAs once', () => {
    const { root, main, v6, v7 } = fixture()
    const checkouts: string[] = []
    const versions = buildVersionedPages({
      root,
      repository: root,
      baseUrl: 'http://localhost:8080/dataset',
      buildSource: (checkout) => {
        checkouts.push(checkout)
        writeArtifact(checkout)
      },
    })
    expect(versions.map(({ path, sha }) => ({ path, sha }))).toEqual([
      { path: '', sha: main },
      { path: 'latest/', sha: v7 },
      { path: 'v6/', sha: v6 },
      { path: 'v7/', sha: v7 },
    ])
    expect(checkouts).toHaveLength(3)
    expect(checkouts.every((checkout) => !fs.existsSync(checkout))).toBe(true)
    const urls = versions.map((entry) => `http://localhost:8080/dataset/${entry.path}`)
    for (const entry of versions) {
      const spec = readJson(root, `${entry.path}openapi.json`)
      expect(spec.servers[0].url).toBe(`http://localhost:8080/dataset/${entry.path}`)
      expect(spec.servers.map((server: { url: string }) => server.url).sort()).toEqual(
        [...urls].sort(),
      )
      expect(spec.servers).toHaveLength(4)
      expect(spec.servers[0].description).toBe(entry.description)
      expect({ ...spec, servers: [{ url: '.' }] }).toEqual(sourceSpec(entry.version))
      for (const directory of ['data', 'data-next'])
        expect(readJson(root, `${entry.path}${directory}/version.json`)).toEqual({
          version: entry.version,
        })
      expect(
        fs.readFileSync(path.join(root, 'dist-pages', entry.path, 'index.html'), 'utf8'),
      ).not.toContain('historical shell')
    }
    expect(readJson(root, 'versions.json')).toEqual({
      baseUrl: 'http://localhost:8080/dataset/',
      versions,
    })
    expect(git(root, 'status', '--porcelain', '--untracked-files=no')).toBe('')
  })

  it('leaves existing output intact and cleans detached sources when a required build fails', () => {
    const { root } = fixture()
    fs.mkdirSync(path.join(root, 'dist-pages'))
    fs.writeFileSync(path.join(root, 'dist-pages', 'sentinel'), 'previous successful build')
    const checkouts: string[] = []
    expect(() =>
      buildVersionedPages({
        root,
        repository: root,
        buildSource: (checkout, entry) => {
          checkouts.push(checkout)
          if (entry.version === '6.9.1') throw new Error('historical build failed')
          writeArtifact(checkout)
        },
      }),
    ).toThrow('historical build failed')
    expect(fs.readdirSync(path.join(root, 'dist-pages'))).toEqual(['sentinel'])
    expect(fs.readFileSync(path.join(root, 'dist-pages', 'sentinel'), 'utf8')).toBe(
      'previous successful build',
    )
    expect(checkouts.every((checkout) => !fs.existsSync(checkout))).toBe(true)
  })

  it('pins the root snapshot independently of a newer remote HEAD', () => {
    const { root, v7 } = fixture()
    const versions = buildVersionedPages({
      root,
      repository: root,
      rootSha: v7,
      buildSource: writeArtifact,
    })
    expect(versions[0].sha).toBe(v7)
    expect(readJson(root, 'openapi.json').info.version).toBe('7.0.0')
  })

  it('rejects mismatched tagged package versions before invoking any builder', () => {
    const { root, v6 } = fixture()
    git(root, 'tag', '6.10.0', v6)
    let builds = 0
    expect(() =>
      buildVersionedPages({
        root,
        repository: root,
        buildSource: () => {
          builds++
        },
      }),
    ).toThrow('Tag 6.10.0 does not match package version 6.9.1')
    expect(builds).toBe(0)
    expect(fs.existsSync(path.join(root, 'dist-pages'))).toBe(false)
  })
})

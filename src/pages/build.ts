import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { assemblePages } from './assemble.ts'
import {
  assertPackageVersion,
  createManifest,
  normalizeBaseUrl,
  parseStableTag,
  readMajors,
} from './manifest.ts'
import type { PagesVersion } from './manifest.ts'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim()
}

function buildSource(checkout: string) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(checkout, 'package.json'), 'utf8'))
  if (
    !/^pnpm@\d+\./.test(packageJson.packageManager ?? '') ||
    !packageJson.scripts?.['build:pages']
  ) {
    throw new Error(
      `Source ${checkout} must declare a pnpm package manager and build:pages script.`,
    )
  }
  git(checkout, 'submodule', 'update', '--init', '--recursive')
  for (const args of [['install', '--frozen-lockfile'], ['build:pages']]) {
    execFileSync('pnpm', args, {
      cwd: checkout,
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' },
    })
  }
}

export function buildVersionedPages(
  options: {
    root?: string
    repository?: string
    rootSha?: string
    baseUrl?: string
    buildSource?: (checkout: string, version: PagesVersion) => void
  } = {},
) {
  const root = options.root ?? projectRoot
  if (options.rootSha && !/^[a-f0-9]{40}$/.test(options.rootSha)) {
    throw new Error('The root source must be pinned to a full Git commit SHA.')
  }
  const majors = readMajors(
    JSON.parse(fs.readFileSync(path.join(root, 'pages-versions.json'), 'utf8')),
  )
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? packageJson.homepage)
  const repository = options.repository ?? git(root, 'remote', 'get-url', 'origin')
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dataset-pages-'))
  try {
    const source = path.join(temporary, 'repository')
    // A separate repository keeps tag fetching and detached worktree metadata out of the user's checkout.
    git(
      root,
      'clone',
      '--quiet',
      '--no-checkout',
      '--no-local',
      '--filter=blob:none',
      '--',
      repository,
      source,
    )
    git(source, 'fetch', '--tags', 'origin')
    const ref = git(source, 'symbolic-ref', '--short', 'HEAD')
    const sha = options.rootSha ?? git(source, 'rev-parse', 'HEAD')
    const version = JSON.parse(git(source, 'show', `${sha}:package.json`)).version as string
    const tags = git(source, 'tag', '--list')
      .split('\n')
      .filter((tag) => parseStableTag(tag))
      .map((tag) => ({ tag, sha: git(source, 'rev-parse', `refs/tags/${tag}^{commit}`) }))
    const versions = createManifest(majors, tags, { ref, sha, version })
    for (const entry of versions.filter((entry) => entry.path)) {
      const taggedVersion = JSON.parse(git(source, 'show', `${entry.sha}:package.json`)).version
      assertPackageVersion(entry.ref, taggedVersion)
    }
    const artifacts = new Map<string, string>()
    for (const entry of versions) {
      console.log(`${entry.path || '/'}: ${entry.ref} (${entry.sha})`)
      if (artifacts.has(entry.sha)) continue
      const checkout = path.join(temporary, entry.sha)
      git(source, 'worktree', 'add', '--quiet', '--detach', checkout, entry.sha)
      const build = options.buildSource ?? buildSource
      build(checkout, entry)
      artifacts.set(entry.sha, path.join(checkout, 'dist-pages'))
    }
    const staging = path.join(temporary, 'site')
    assemblePages(versions, artifacts, staging, baseUrl)
    const output = path.join(root, 'dist-pages')
    fs.rmSync(output, { recursive: true, force: true })
    fs.cpSync(staging, output, { recursive: true })
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Dataset Pages versions\n\n| URL | Source | Commit |\n| --- | --- | --- |\n${versions.map((entry) => `| ${new URL(entry.path, baseUrl)} | ${entry.ref} | ${entry.sha} |`).join('\n')}\n`,
      )
    }
    return versions
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { 'base-url': { type: 'string' }, 'root-sha': { type: 'string' } },
  })
  buildVersionedPages({ baseUrl: values['base-url'], rootSha: values['root-sha'] })
}

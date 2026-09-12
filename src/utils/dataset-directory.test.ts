import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveDatasetDirectory } from './dataset-directory'

const directories: string[] = []

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'pokepc-dataset-root-'))
  directories.push(directory)
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: '@pokepc/dataset' }))
  mkdirSync(join(directory, 'data'))
  writeFileSync(join(directory, 'data/types.json'), '[]')
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('dataset directory', () => {
  it.each(['src/lib/fs.ts', 'build/lib/fs.mjs', 'build/chunk.mjs'])(
    'resolves %s against its package instead of another checkout in cwd',
    (modulePath) => {
      const directory = fixture()
      const otherCheckout = fixture()
      expect(
        resolveDatasetDirectory(
          pathToFileURL(join(directory, modulePath)).href,
          undefined,
          otherCheckout,
        ),
      ).toBe(join(directory, 'data'))
    },
  )

  it('supports absolute and cwd-relative overrides for disposable datasets', () => {
    const directory = fixture()
    const override = fixture()
    const moduleUrl = pathToFileURL(join(directory, 'build/lib/fs.mjs')).href
    expect(resolveDatasetDirectory(moduleUrl, join(override, 'data'))).toBe(join(override, 'data'))
    expect(resolveDatasetDirectory(moduleUrl, 'data', override)).toBe(join(override, 'data'))
  })

  it('fails for an invalid override without falling back to real data', () => {
    const directory = fixture()
    expect(() =>
      resolveDatasetDirectory(
        pathToFileURL(join(directory, 'src/lib/fs.ts')).href,
        'missing',
        directory,
      ),
    ).toThrow('missing types.json')
  })
})

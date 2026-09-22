import { describe, expect, it } from 'vitest'
import {
  assertPackageVersion,
  createManifest,
  normalizeBaseUrl,
  parseStableTag,
  readMajors,
  selectLatestTag,
} from './manifest.ts'

describe('Pages release selection', () => {
  it('compares SemVer numerically and excludes prereleases and malformed tags', () => {
    const tags = [
      '6.9.9',
      'v6.10.0',
      '6.10.0+build.1',
      '7.0.0-rc.1',
      '06.99.0',
      'release-8.0.0',
    ].map((tag) => ({ tag, sha: 'same' }))
    expect(selectLatestTag(tags)).toEqual({ tag: '6.10.0+build.1', sha: 'same' })
    expect(selectLatestTag([...tags, { tag: '7.0.0', sha: 'new' }], 6).sha).toBe('same')
    expect(parseStableTag('v6.10.0')?.version).toBe('6.10.0')
  })

  it('rejects equal-precedence tags pointing to different commits', () => {
    for (const alias of ['v7.0.0', '7.0.0+build.2']) {
      expect(() =>
        selectLatestTag([
          { tag: '7.0.0', sha: 'a' },
          { tag: alias, sha: 'b' },
        ]),
      ).toThrow(/Ambiguous/)
    }
  })

  it('fails for an absent retained major instead of silently omitting it', () => {
    expect(() =>
      createManifest([6, 7], [{ tag: '7.0.0', sha: 'a' }], {
        ref: 'main',
        sha: 'b',
        version: '8.0.0',
      }),
    ).toThrow(/major 6/)
  })

  it('validates retained major configuration', () => {
    expect(readMajors({ majors: [7, 6] })).toEqual([6, 7])
    expect(readMajors({ majors: [] })).toEqual([])
    for (const config of [
      null,
      {},
      { majors: [5] },
      { majors: [6, 6] },
      { majors: ['6'] },
      { majors: [6.5] },
    ]) {
      expect(() => readMajors(config)).toThrow(/unique integer majors/)
    }
  })

  it('normalizes tag spelling but requires exact package version including metadata', () => {
    expect(() => assertPackageVersion('v7.0.0+build.1', '7.0.0+build.1')).not.toThrow()
    expect(() => assertPackageVersion('7.0.0', '7.0.1')).toThrow(/does not match/)
    expect(() => assertPackageVersion('7.0.0+build.1', '7.0.0')).toThrow(/does not match/)
  })

  it('preserves project prefixes and rejects unsuitable site URLs', () => {
    expect(normalizeBaseUrl('http://localhost:8080/dataset')).toBe('http://localhost:8080/dataset/')
    for (const value of [
      'file:///tmp/site',
      'https://user:pass@example.com/',
      'https://example.com/?a=b',
      'https://example.com/#x',
    ]) {
      expect(() => normalizeBaseUrl(value)).toThrow()
    }
  })
})

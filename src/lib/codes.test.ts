import { describe, expect, it } from 'vitest'
import { findCodeMapProblems, findReleasedCodeChanges, syncCodeMap } from './codes'

const map = (...ids: string[]): Pkds.CodeMapEntry[] => ids.map((id, code) => ({ id, code }))

describe('findCodeMapProblems', () => {
  it('accepts a dense map that covers every live id', () => {
    expect(findCodeMapProblems(map('a', 'b', 'c'), ['a', 'b', 'c'])).toEqual([])
  })

  it('accepts retired entries that left the dataset, with a live replacement', () => {
    const entries = [
      ...map('a', 'b'),
      { id: 'old', code: 2, retired: true as const, replacedBy: 'a' },
    ]
    expect(findCodeMapProblems(entries, ['a', 'b'])).toEqual([])
  })

  it('reports gaps and out-of-order codes, which mean an entry was removed', () => {
    const entries = [
      { id: 'a', code: 0 },
      { id: 'c', code: 2 },
    ]
    expect(findCodeMapProblems(entries, ['a', 'c'])).toEqual([
      'c: code 2 at position 1; codes must be 0..n-1 in order',
    ])
  })

  it('reports live ids without a code and coded ids that left the dataset', () => {
    expect(findCodeMapProblems(map('a', 'gone'), ['a', 'new'])).toEqual([
      'gone: not in the dataset; mark it retired instead of removing it',
      'new: in the dataset without a code; run pnpm codes:sync',
    ])
  })

  it('reports duplicated ids, live retired ids and broken replacements', () => {
    const entries: Pkds.CodeMapEntry[] = [
      { id: 'a', code: 0 },
      { id: 'a', code: 1 },
      { id: 'b', code: 2, retired: true },
      { id: 'old', code: 3, retired: true, replacedBy: 'missing' },
      { id: 'c', code: 4, replacedBy: 'a' },
    ]
    expect(findCodeMapProblems(entries, ['a', 'b', 'c'])).toEqual([
      'a: listed more than once',
      'b: retired but still in the dataset',
      'old: replaced by missing, which is not in the dataset',
      'c: replacedBy is only allowed on retired entries',
    ])
  })
})

describe('findReleasedCodeChanges', () => {
  const released = map('a', 'b', 'c')

  it('allows appending codes and retiring ids', () => {
    const current: Pkds.CodeMapEntry[] = [
      ...map('a', 'b'),
      { id: 'c', code: 2, retired: true },
      { id: 'd', code: 3 },
    ]
    expect(findReleasedCodeChanges(released, current)).toEqual([])
  })

  it('reports a released code that now points at another id', () => {
    expect(findReleasedCodeChanges(released, map('a', 'c', 'b'))).toEqual([
      'code 1 changed from b to c',
      'code 2 changed from c to b',
    ])
  })

  it('reports a released code that disappeared', () => {
    expect(findReleasedCodeChanges(released, map('a', 'b'))).toEqual(['code 2 (c) was removed'])
  })

  it('reports a retired code that became live again', () => {
    const withRetired: Pkds.CodeMapEntry[] = [...map('a', 'b'), { id: 'c', code: 2, retired: true }]
    expect(findReleasedCodeChanges(withRetired, map('a', 'b', 'c'))).toEqual([
      'code 2 (c) was retired and cannot become live again',
    ])
  })
})

describe('syncCodeMap', () => {
  it('appends new ids after existing codes without renumbering them', () => {
    expect(syncCodeMap(map('b', 'a'), ['a', 'b', 'c'])).toEqual(map('b', 'a', 'c'))
  })

  it('retires ids that left the dataset and keeps their code', () => {
    expect(syncCodeMap(map('a', 'gone'), ['a'])).toEqual([
      { id: 'a', code: 0 },
      { id: 'gone', code: 1, retired: true },
    ])
  })

  it('keeps retired entries untouched', () => {
    const entries: Pkds.CodeMapEntry[] = [
      ...map('a'),
      { id: 'old', code: 1, retired: true, replacedBy: 'a' },
    ]
    expect(syncCodeMap(entries, ['a'])).toEqual(entries)
  })

  it('creates a map from nothing in live order', () => {
    expect(syncCodeMap([], ['x', 'y'])).toEqual(map('x', 'y'))
  })
})

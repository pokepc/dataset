import { describe, expect, it } from 'vitest'
import {
  type ApplyFieldOperationParams,
  type FieldOperation,
  MOVE_POSITION_VALUES,
  OPERATION_VALUES,
  applyFieldOperation,
  isJsonObject,
  parseFieldPath,
} from './data-migrations'

function params(over: Partial<ApplyFieldOperationParams> = {}): ApplyFieldOperationParams {
  return {
    parsedDefaultValue: null,
    renameToPath: null,
    addAfterSibling: null,
    movePivotKey: '',
    movePosition: 'before',
    ...over,
  }
}

describe('parseFieldPath', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(parseFieldPath('')).toBeNull()
    expect(parseFieldPath('   ')).toBeNull()
    expect(parseFieldPath(' . . ')).toBeNull()
  })

  it('returns null when a segment has invalid characters', () => {
    expect(parseFieldPath('a.b^c')).toBeNull()
    expect(parseFieldPath('a.b c')).toBeNull()
    expect(parseFieldPath('a["b"]')).toBeNull()
  })

  it('parses dot paths with trimming and allows underscores and hyphens', () => {
    expect(parseFieldPath('a.b.c')).toEqual(['a', 'b', 'c'])
    expect(parseFieldPath(' foo . bar-baz ')).toEqual(['foo', 'bar-baz'])
    expect(parseFieldPath('snake_case')).toEqual(['snake_case'])
  })
})

describe('isJsonObject', () => {
  it('accepts plain objects and rejects arrays, null, and primitives', () => {
    expect(isJsonObject({})).toBe(true)
    expect(isJsonObject({ a: 1 })).toBe(true)
    expect(isJsonObject([])).toBe(false)
    expect(isJsonObject(null)).toBe(false)
    expect(isJsonObject(undefined)).toBe(false)
    expect(isJsonObject(0)).toBe(false)
    expect(isJsonObject('x')).toBe(false)
  })
})

describe('applyFieldOperation — add', () => {
  it('adds a root key at the end when addAfterSibling is null', () => {
    const record = { a: 1, b: 2 }
    const ok = applyFieldOperation(record, 'add', ['z'], params({ parsedDefaultValue: 9 }))
    expect(ok).toBe(true)
    expect(record).toEqual({ a: 1, b: 2, z: 9 })
    expect(Object.keys(record)).toEqual(['a', 'b', 'z'])
  })

  it('inserts after an existing sibling when addAfterSibling is set', () => {
    const record: Record<string, unknown> = { a: 1, b: 2, c: 3 }
    const ok = applyFieldOperation(record, 'add', ['x'], {
      ...params({ parsedDefaultValue: 0 }),
      addAfterSibling: 'b',
    })
    expect(ok).toBe(true)
    expect(Object.keys(record)).toEqual(['a', 'b', 'x', 'c'])
    expect(record.x).toBe(0)
  })

  it('appends at end when addAfterSibling is not present on the parent', () => {
    const record = { a: 1, b: 2 }
    const ok = applyFieldOperation(record, 'add', ['x'], {
      ...params({ parsedDefaultValue: true }),
      addAfterSibling: 'missing',
    })
    expect(ok).toBe(true)
    expect(Object.keys(record)).toEqual(['a', 'b', 'x'])
  })

  it('creates missing intermediate objects and adds nested keys', () => {
    const record: Record<string, unknown> = {}
    const ok = applyFieldOperation(record, 'add', ['forms', 'tag'], {
      ...params({ parsedDefaultValue: 't' }),
      addAfterSibling: null,
    })
    expect(ok).toBe(true)
    expect(record).toEqual({ forms: { tag: 't' } })
  })

  it('walks existing object segments when adding a nested key', () => {
    const record = { forms: { a: 1 } }
    const ok = applyFieldOperation(record, 'add', ['forms', 'b'], {
      ...params({ parsedDefaultValue: 2 }),
      addAfterSibling: null,
    })
    expect(ok).toBe(true)
    expect(record).toEqual({ forms: { a: 1, b: 2 } })
  })

  it('clones default value (deep copy)', () => {
    const record: Record<string, unknown> = {}
    const inner = { n: 1 }
    applyFieldOperation(record, 'add', ['obj'], params({ parsedDefaultValue: inner }))
    expect(record.obj).toEqual(inner)
    expect(record.obj).not.toBe(inner)
    ;(record.obj as { n: number }).n = 2
    expect(inner.n).toBe(1)
  })

  it('returns false when the leaf key already exists (including null)', () => {
    const withNull = { x: null as null }
    expect(applyFieldOperation(withNull, 'add', ['x'], params({ parsedDefaultValue: 1 }))).toBe(
      false,
    )

    const withVal = { x: 1 }
    expect(applyFieldOperation(withVal, 'add', ['x'], params({ parsedDefaultValue: 2 }))).toBe(
      false,
    )
  })

  it('returns false when an intermediate segment is not an object (number)', () => {
    const record = { a: 1 }
    expect(applyFieldOperation(record, 'add', ['a', 'b'], params({ parsedDefaultValue: 1 }))).toBe(
      false,
    )
  })

  it('returns false when an intermediate segment is an array', () => {
    const record = { a: [1, 2] }
    expect(applyFieldOperation(record, 'add', ['a', 'b'], params({ parsedDefaultValue: 1 }))).toBe(
      false,
    )
  })

  it('returns false when an intermediate segment is null', () => {
    const record = { a: null }
    expect(applyFieldOperation(record, 'add', ['a', 'b'], params({ parsedDefaultValue: 1 }))).toBe(
      false,
    )
  })
})

describe('applyFieldOperation — remove', () => {
  it('removes a nested path', () => {
    const record = { forms: { x: 1, y: 2 } }
    expect(applyFieldOperation(record, 'remove', ['forms', 'x'], params())).toBe(true)
    expect(record).toEqual({ forms: { y: 2 } })
  })

  it('returns false when intermediate is not an object', () => {
    const record = { a: 1 }
    expect(applyFieldOperation(record, 'remove', ['a', 'b'], params())).toBe(false)
  })

  it('returns false when the leaf key is missing', () => {
    const record = { a: { b: 1 } }
    expect(applyFieldOperation(record, 'remove', ['a', 'c'], params())).toBe(false)
  })
})

describe('applyFieldOperation — rename', () => {
  it('moves value to a new path and removes the source', () => {
    const record = { old: { x: 1 }, other: 2 }
    const ok = applyFieldOperation(record, 'rename', ['old', 'x'], {
      ...params(),
      renameToPath: ['newPath', 'y'],
    })
    expect(ok).toBe(true)
    expect(record).toEqual({ old: {}, other: 2, newPath: { y: 1 } })
  })

  it('walks existing object segments on the destination path', () => {
    const record = { src: { v: 1 }, dest: { keep: true } }
    applyFieldOperation(record, 'rename', ['src', 'v'], {
      ...params(),
      renameToPath: ['dest', 'newKey'],
    })
    expect(record).toEqual({ src: {}, dest: { keep: true, newKey: 1 } })
  })

  it('hits blocked destination path when a segment is a non-object leaf', () => {
    const record = { src: { v: 1 }, block: 9 }
    applyFieldOperation(record, 'rename', ['src', 'v'], {
      ...params(),
      renameToPath: ['block', 'x'],
    })
    expect(record).toEqual({ src: {}, block: 9 })
  })

  it('returns false when renameToPath is null', () => {
    const record = { a: 1 }
    expect(applyFieldOperation(record, 'rename', ['a'], params({ renameToPath: null }))).toBe(false)
  })

  it('treats empty rename destination path as a no-copy rename (still removes source)', () => {
    const record = { a: 1, b: 2 }
    applyFieldOperation(record, 'rename', ['a'], params({ renameToPath: [] }))
    expect(record).toEqual({ b: 2 })
  })

  it('returns false when source path is missing', () => {
    const record = { a: 1 }
    expect(applyFieldOperation(record, 'rename', ['b'], params({ renameToPath: ['c'] }))).toBe(
      false,
    )
  })

  it('when destination exists, does not copy but still removes source (current behavior)', () => {
    const record = { a: 1, b: 2 }
    applyFieldOperation(record, 'rename', ['a'], params({ renameToPath: ['b'] }))
    expect(record).toEqual({ b: 2 })
  })
})

describe('applyFieldOperation — move', () => {
  it('moves a key after the pivot', () => {
    const record = { a: 1, b: 2, c: 3 }
    const ok = applyFieldOperation(record, 'move', ['a'], {
      ...params(),
      movePivotKey: 'c',
      movePosition: 'after',
    })
    expect(ok).toBe(true)
    expect(Object.keys(record)).toEqual(['b', 'c', 'a'])
  })

  it('moves a key before the pivot', () => {
    const record = { a: 1, b: 2, c: 3 }
    const ok = applyFieldOperation(record, 'move', ['c'], {
      ...params(),
      movePivotKey: 'a',
      movePosition: 'before',
    })
    expect(ok).toBe(true)
    expect(Object.keys(record)).toEqual(['c', 'a', 'b'])
  })

  it('returns false when order is already satisfied (before)', () => {
    const record = { a: 1, b: 2, c: 3 }
    const ok = applyFieldOperation(record, 'move', ['b'], {
      ...params(),
      movePivotKey: 'c',
      movePosition: 'before',
    })
    expect(ok).toBe(false)
    expect(Object.keys(record)).toEqual(['a', 'b', 'c'])
  })

  it('returns false when order is already satisfied (after)', () => {
    const record = { a: 1, b: 2, c: 3 }
    const ok = applyFieldOperation(record, 'move', ['b'], {
      ...params(),
      movePivotKey: 'a',
      movePosition: 'after',
    })
    expect(ok).toBe(false)
  })

  it('returns false when source or pivot key is missing', () => {
    const record = { a: 1, b: 2 }
    expect(
      applyFieldOperation(record, 'move', ['z'], {
        ...params(),
        movePivotKey: 'a',
        movePosition: 'before',
      }),
    ).toBe(false)
    expect(
      applyFieldOperation(record, 'move', ['a'], {
        ...params(),
        movePivotKey: 'z',
        movePosition: 'before',
      }),
    ).toBe(false)
  })

  it('returns false when source and pivot are the same key', () => {
    const record = { a: 1 }
    expect(
      applyFieldOperation(record, 'move', ['a'], {
        ...params(),
        movePivotKey: 'a',
        movePosition: 'after',
      }),
    ).toBe(false)
  })

  it('returns false when parent path is broken (non-object in the middle)', () => {
    const record = { forms: null }
    expect(
      applyFieldOperation(record, 'move', ['forms', 'x'], {
        ...params(),
        movePivotKey: 'y',
        movePosition: 'after',
      }),
    ).toBe(false)
  })

  it('reorders within a nested parent', () => {
    const record = { forms: { x: 1, y: 2, z: 3 } }
    applyFieldOperation(record, 'move', ['forms', 'z'], {
      ...params(),
      movePivotKey: 'x',
      movePosition: 'before',
    })
    expect(Object.keys(record.forms as object)).toEqual(['z', 'x', 'y'])
  })
})

describe('constants', () => {
  it('exports expected operation and move position literals', () => {
    expect(OPERATION_VALUES).toEqual(['add', 'remove', 'rename', 'move'])
    expect(MOVE_POSITION_VALUES).toEqual(['before', 'after'])
  })
})

describe('applyFieldOperation — fallback', () => {
  it('returns false for an unknown operation value', () => {
    const record = { a: 1 }
    const ok = applyFieldOperation(record, 'typo' as FieldOperation, ['a'], params())
    expect(ok).toBe(false)
  })
})

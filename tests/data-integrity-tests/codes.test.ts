import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { codeMapKinds, findCodeMapProblems, findReleasedCodeChanges } from '../../src/lib/codes'
import { loadCodeMap, loadCodeMapLiveIds } from '../../src/lib/fs'
import { codeMapSchema } from '../../src/lib/schemas'
import { validate } from '../_utils'

const require = createRequire(import.meta.url)

/**
 * The code map of the last published release, installed as the `@pokepc/dataset-released` npm
 * alias (see docs/codes.md). Null until a release that contains code maps is pinned there.
 */
function loadReleasedCodeMap(kind: string): Pkds.CodeMapEntry[] | null {
  try {
    return require(`@pokepc/dataset-released/data/codes/${kind}`) as Pkds.CodeMapEntry[]
  } catch {
    return null
  }
}

describe.each(codeMapKinds)('Validate codes/%s.json', (kind) => {
  const entries = loadCodeMap(kind)

  it('matches the code map schema', () => {
    const validation = validate(codeMapSchema, entries)
    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }
    expect(validation.success).toBe(true)
  })

  it('covers every id in the dataset with dense, unique codes', () => {
    expect(findCodeMapProblems(entries, loadCodeMapLiveIds(kind))).toEqual([])
  })

  const released = loadReleasedCodeMap(kind)

  it.skipIf(released === null)('keeps every code of the previous release', () => {
    expect(findReleasedCodeChanges(released ?? [], entries)).toEqual([])
  })
})

describe('Retired Pokémon ids', () => {
  it('keep the removed ability forms, each replaced by its base form', () => {
    const retired = loadCodeMap('pokemon')
      .filter((entry) => entry.retired)
      .map(({ id, replacedBy }) => [id, replacedBy])

    expect(retired).toEqual(
      expect.arrayContaining([
        ['greninja--battle-bond', 'greninja'],
        ['zygarde--power-construct', 'zygarde'],
        ['zygarde-10--power-construct', 'zygarde-10'],
        ['rockruff--own-tempo', 'rockruff'],
      ]),
    )
  })
})

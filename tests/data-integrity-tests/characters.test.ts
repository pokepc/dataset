import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllCharacters, loadText } from '../../src/lib/fs'
import { characterSchema } from '../../src/lib/schemas'
import { validate } from '../_utils'

describe('Validate characters.json data', () => {
  // Read the characters data directly from the file
  const recordList = loadAllCharacters()
  const text = loadText('characters', 'eng')

  it('should be valid', () => {
    const listSchema = z.array(characterSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('should have no duplicate ids', () => {
    const ids = recordList.map((record) => record.id)
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
    expect(duplicateIds, 'Duplicate character IDs').toEqual([])
  })

  it('should have valid English names', () => {
    for (const record of recordList) {
      const name = text[record.id]?.name
      expect(name, record.id).toBeDefined()
      expect(name!.trim()).toBe(name)
      expect(name!.length).toBeGreaterThan(0)
    }
  })
})

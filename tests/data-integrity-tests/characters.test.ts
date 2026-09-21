import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { charactersFs } from '../../src/lib/fs'
import { characterSchema } from '../../src/lib/schemas'
import { validate } from '../_utils'

describe('Validate characters.json data', () => {
  // Read the characters data directly from the file
  const recordList = charactersFs.all()

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

  it('should have valid names', () => {
    for (const record of recordList) {
      expect(record.name).toBeDefined()
      expect(record.name.trim()).toBe(record.name)
      expect(record.name.length).toBeGreaterThan(0)
    }
  })
})

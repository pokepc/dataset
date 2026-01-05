import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { charactersFs } from '../lib/fs'
import { characterSchema } from '../lib/schemas'
import { validate } from './_utils'

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
    const uniqueIds: string[] = []
    for (const id of ids) {
      if (uniqueIds.includes(id)) {
        console.error(`Duplicate character id: ${id}`)
      }
      uniqueIds.push(id)
    }
    expect(uniqueIds.length).toBe(ids.length)
  })

  it('should have valid names', () => {
    for (const record of recordList) {
      expect(record.name).toBeDefined()
      expect(record.name.trim()).toBe(record.name)
      expect(record.name.length).toBeGreaterThan(0)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllMarks } from '../src/lib/fs'
import { markSchema } from '../src/lib/schemas'
import { validate } from './_utils'

describe('Validate marks.json data', () => {
  const recordList = loadAllMarks()

  it('should be valid', () => {
    const listSchema = z.array(markSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })
})

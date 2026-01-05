import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { loadAllRibbons } from '../lib/fs'
import { ribbonSchema } from '../lib/schemas'
import { validate } from './_utils'

describe('Validate ribbons.json data', () => {
  const recordList = loadAllRibbons()

  it('should be valid', () => {
    const listSchema = z.array(ribbonSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })
})

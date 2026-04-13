import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllAbilities } from '../lib/fs'
import { abilitySchema } from '../lib/schemas'
import { validate } from './_utils'

describe('Validate abilities.json data', () => {
  const recordList = loadAllAbilities()

  it('should be valid', () => {
    const listSchema = z.array(abilitySchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })
})

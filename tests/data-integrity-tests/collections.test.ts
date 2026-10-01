import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { absDatasetFile, readDatasetFile, readIndexFile } from '../../src/lib/fs'
import {
  collectionRecordSchemas,
  entityRecordSchemas,
  indexSchema,
  pokemonMugshotsSchema,
  type CollectionKind,
  type EntityKind,
} from '../../src/lib/schemas'
import { validate } from '../_utils'

const collectionKinds = Object.keys(collectionRecordSchemas) as CollectionKind[]
const entityKinds = Object.keys(entityRecordSchemas) as EntityKind[]

describe.each(collectionKinds)('%s.json', (kind) => {
  const records = readDatasetFile<Array<{ id: unknown }>>(`${kind}.json`)

  it('matches the v8 record schema', () => {
    const validation = validate(z.array(collectionRecordSchemas[kind]), records)
    if (!validation.success) console.error(validation.errorsSummary.join('\n'))
    expect(validation.success).toBe(true)
  })

  it('has unique ids', () => {
    const ids = records.map((record) => record.id)
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([])
  })
})

describe.each(entityKinds)('%s/', (kind) => {
  it('has exactly one file per indexed id', () => {
    const index = readIndexFile(kind)
    expect(validate(indexSchema, index).success).toBe(true)
    const files = fs
      .readdirSync(absDatasetFile(kind))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
    expect([...files].sort()).toEqual([...index].sort())
  })
})

describe('metadata', () => {
  it('pokemon-mugshots.json matches its schema and references Pokémon', () => {
    const mugshots = readDatasetFile<Record<string, unknown>>('metadata/pokemon-mugshots.json')
    expect(validate(pokemonMugshotsSchema, mugshots).success).toBe(true)
    const ids = new Set(readIndexFile('pokemon'))
    expect(Object.keys(mugshots).filter((id) => !ids.has(id))).toEqual([])
  })
})

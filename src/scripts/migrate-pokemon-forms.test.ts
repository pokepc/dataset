import { describe, expect, it } from 'vitest'
import { formMethods, migrateFormRecord } from './migrate-pokemon-forms'

describe('offline form migration', () => {
  const source =
    '{\n  "id": "giratina-origin",\n  "formItem": "griseouscore",\n  "unrelated": ["preserve me"],\n  "names": { "eng": "Giratina" }\n}\n'

  it('preserves unrelated data and removes the migrated legacy item idempotently', async () => {
    const migrated = await migrateFormRecord(source, formMethods['giratina-origin'])
    expect(migrated).toContain('  "unrelated": ["preserve me"],\n')
    expect(JSON.parse(migrated)).toEqual({
      id: 'giratina-origin',
      unrelated: ['preserve me'],
      names: { eng: 'Giratina' },
      formMethods: formMethods['giratina-origin'],
    })
    expect(await migrateFormRecord(migrated, formMethods['giratina-origin'])).toBe(migrated)
  })

  it('refuses to discard unmatched requirements or overwrite reviewed methods', async () => {
    await expect(
      migrateFormRecord(
        source.replace('griseouscore', 'differentitem'),
        formMethods['giratina-origin'],
      ),
    ).rejects.toThrow('Unmigrated formItem')
    const migrated = await migrateFormRecord(source, formMethods['giratina-origin'])
    await expect(migrateFormRecord(migrated, formMethods.giratina)).rejects.toThrow(
      'Refusing to overwrite',
    )
    await expect(migrateFormRecord(source, [])).rejects.toThrow('must not be empty')
  })
})

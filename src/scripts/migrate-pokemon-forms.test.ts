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
    await expect(migrateFormRecord(migrated, formMethods['palkia-origin'])).rejects.toThrow(
      'Refusing to overwrite',
    )
    await expect(migrateFormRecord(source, [])).rejects.toThrow('Unmigrated formItem')
  })

  it('removes reviewed standalone returns without touching other fields', async () => {
    const legacy = {
      id: 'alcremie',
      unrelated: ['preserve me'],
      formMethods: [
        {
          from: ['alcremie-gmax'],
          games: ['swsh-sw', 'swsh-sh'],
          trigger: 'automatic',
          conditions: [
            { key: 'elapsed_time', amount: 3, unit: 'turns' },
            { key: 'original_form', forms: ['alcremie'] },
          ],
        },
        {
          from: ['alcremie-gmax'],
          games: ['swsh-sw', 'swsh-sh'],
          trigger: 'automatic',
          conditions: [
            { key: 'battle_event', events: ['switch_out', 'battle_end', 'faint'] },
            { key: 'original_form', forms: ['alcremie'] },
          ],
        },
      ],
      names: { eng: 'Alcremie' },
    }
    const migrated = await migrateFormRecord(JSON.stringify(legacy, null, 2), [])
    expect(JSON.parse(migrated)).toEqual({
      id: 'alcremie',
      unrelated: ['preserve me'],
      names: { eng: 'Alcremie' },
    })
    expect(await migrateFormRecord(migrated, [])).toBe(migrated)
    const edited = JSON.stringify(legacy, null, 2).replace('"amount": 3', '"amount": 4')
    await expect(migrateFormRecord(edited, [])).rejects.toThrow('Refusing to overwrite')
  })

  it('upgrades reviewed forward methods with compact reversion and refuses later edits', async () => {
    const methods = formMethods['alcremie-gmax']
    const legacy = {
      id: 'alcremie-gmax',
      formMethods: methods.map(({ revert: _, ...method }) => method),
      names: { eng: 'Alcremie' },
    }
    const migrated = await migrateFormRecord(JSON.stringify(legacy, null, 2), methods)
    expect(JSON.parse(migrated).formMethods[0].revert).toEqual([
      { afterTurns: 3 },
      'switch_out',
      'battle_end',
      'faint',
    ])
    expect(await migrateFormRecord(migrated, methods)).toBe(migrated)
  })
})

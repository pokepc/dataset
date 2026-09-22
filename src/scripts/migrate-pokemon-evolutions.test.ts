import { describe, expect, it } from 'vitest'
import { migrateEvolutionRecord, matchingEvolutionRows } from './migrate-pokemon-evolutions'
import type { EvolutionMethod } from '../lib/evolution-schemas'

describe('offline evolution migration', () => {
  it('replaces legacy fields without reformatting or changing unrelated fields', async () => {
    const original =
      '{\n  "id": "gastrodon-east",\n  "evolvesFrom": "shellos",\n  "evoFromLevel": 30,\n  "names": {\n    "eng": "Gastrodon"\n  }\n}\n'
    const method: EvolutionMethod = {
      from: ['shellos-east'],
      trigger: 'level_up',
      minLevel: 30,
      conditions: [],
    }
    const updated = await migrateEvolutionRecord(original, [method])
    expect(updated).toContain('  "names": {\n    "eng": "Gastrodon"\n  }')
    expect(JSON.parse(updated)).toEqual({
      id: 'gastrodon-east',
      names: { eng: 'Gastrodon' },
      evoMethods: [method],
    })
    expect(await migrateEvolutionRecord(updated, [method])).toBe(updated)
    await expect(migrateEvolutionRecord(updated, [{ ...method, minLevel: 31 }])).rejects.toThrow(
      'overwrite',
    )
  })

  it('renames existing methods without changing their per-method predecessors or requirements', async () => {
    const methods: EvolutionMethod[] = [
      {
        from: ['source-form-a'],
        trigger: 'level_up',
        minLevel: 20,
        conditions: [],
      },
      { from: ['source-form-b'], trigger: 'trade', conditions: [] },
    ]
    const original =
      JSON.stringify(
        { id: 'result', evolutionMethods: methods, evolvesFrom: 'source-form-a', evoFromLevel: 20 },
        null,
        2,
      ) + '\n'
    const updated = await migrateEvolutionRecord(original, methods)
    expect(JSON.parse(updated)).toEqual({ id: 'result', evoMethods: methods })
    expect(await migrateEvolutionRecord(updated, methods)).toBe(updated)
  })

  it('prefers exact result forms and does not invent evolution for an unlinked special form', () => {
    const rows = [
      { id: '1', evolved_species_id: '901', evolved_pokemon_form_id: '' },
      { id: '2', evolved_species_id: '901', evolved_pokemon_form_id: '901' },
    ]
    const pokemon = {
      id: 'ursaluna',
      dexNum: 901,
      evolvesFrom: 'ursaring',
      refs: { pkApiFormId: '901' },
    } as Pkds.Pokemon & { evolvesFrom?: string }
    expect(matchingEvolutionRows(pokemon, rows).map((row) => row.id)).toEqual(['2'])
    expect(
      matchingEvolutionRows({ ...pokemon, id: 'ursaluna-bloodmoon', evolvesFrom: undefined }, rows),
    ).toEqual([])
  })
})

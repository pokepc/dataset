import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadAllPokedexes, loadAllPokemon } from '../lib/fs'
import { pokedexSchema } from '../lib/schemas'
import { validate } from './_utils'

const pokemonById = Object.fromEntries(loadAllPokemon().map((pokemon) => [pokemon.id, pokemon]))

function groupEntriesByPid(entries: Pkds.PokedexEntry[]) {
  const byPid = new Map<string, Pkds.PokedexEntry[]>()
  for (const e of entries) {
    const list = byPid.get(e.pid) ?? []
    list.push(e)
    byPid.set(e.pid, list)
  }
  return byPid
}

function assertPidSlotRules(entries: Pkds.PokedexEntry[], dexId: string) {
  const byPid = groupEntriesByPid(entries)
  for (const [pid, group] of byPid) {
    if (group.length === 1) continue
    if (group.length !== 2) {
      throw new Error(`${dexId}: pid "${pid}" appears ${group.length} times (max 2 with meta + form slot)`)
    }
    const [a, b] = group
    const aIsVariant = a.meta != null && a.isForm === false
    const bIsVariant = b.meta != null && b.isForm === false
    const aIsFormSlot = a.isForm === true && a.meta == null
    const bIsFormSlot = b.isForm === true && b.meta == null
    const ok = (aIsVariant && bIsFormSlot) || (bIsVariant && aIsFormSlot)
    if (!ok) {
      throw new Error(
        `${dexId}: duplicate pid "${pid}" must be one { meta, isForm:false } and one { isForm:true, no meta }`,
      )
    }
    if (String(a.dexNum) !== String(b.dexNum)) {
      throw new Error(`${dexId}: duplicate pid "${pid}" entries must share dexNum`)
    }
  }
}

describe('Validate pokedexes.json data', () => {
  const recordList = loadAllPokedexes()

  it('should be valid', () => {
    const listSchema = z.array(pokedexSchema)
    const validation = validate(listSchema, recordList)

    if (!validation.success) {
      console.error(validation.errorsSummary.join('\n'))
    }

    expect(validation.success).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('should have no duplicate ids', () => {
    const ids = recordList.map((record) => record.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it.each(recordList)('should have valid pokemon ids and pid slot rules for %s', (record) => {
    assertPidSlotRules(record.entries, record.id)
    const uniquePids = new Set(record.entries.map((e) => e.pid))
    for (const id of uniquePids) {
      expect(pokemonById[id]?.id).toBe(id)
    }
  })

  it('dataset includes at least one duplicate-pid pair (meta variant + form slot)', () => {
    let pairs = 0
    for (const record of recordList) {
      for (const g of groupEntriesByPid(record.entries).values()) {
        if (g.length === 2) pairs++
      }
    }
    expect(pairs).toBeGreaterThan(0)
  })
})

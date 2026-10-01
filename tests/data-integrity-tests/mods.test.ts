import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import {
  DATASET_DIR,
  listModdedGameSets,
  loadAllGameSets,
  loadGameSetSource,
} from '../../src/lib/fs'
import { localeCodes } from '../../src/lib/languages'
import { mergeGameSet } from '../../src/lib/merge'
import {
  moddableKinds,
  moddableOverrideSchemas,
  moddableTextOverrideFileSchemas,
  rosterSchema,
  type ModdableKind,
} from '../../src/lib/schemas'
import { validate } from '../_utils'

const sets = listModdedGameSets()
const gameSetIds = new Set(loadAllGameSets().map((game) => game.id))

describe('mods', () => {
  it('exist for Champions', () => {
    expect(sets).toContain('champions')
  })

  it('only exist for game set ids', () => {
    expect(sets.filter((set) => !gameSetIds.has(set))).toEqual([])
  })
})

describe.each(sets)('mods/%s', (set) => {
  const modDir = path.join(DATASET_DIR, 'mods', set)
  const source = loadGameSetSource(set)
  const roster = source.mods?.roster ?? {}
  const baseById = Object.fromEntries(
    moddableKinds.map((kind) => [
      kind,
      new Map((source.base[kind] ?? []).map((record) => [record.id, record as object])),
    ]),
  ) as Record<ModdableKind, Map<string, Record<string, unknown>>>
  const inSet = (kind: ModdableKind, id: string) =>
    roster[kind] ? roster[kind]!.includes(id) : baseById[kind].has(id)

  it('has a valid roster of base ids', () => {
    expect(validate(rosterSchema, roster).success).toBe(true)
    for (const kind of moddableKinds) {
      expect(
        (roster[kind] ?? []).filter((id) => !baseById[kind].has(id)),
        kind,
      ).toEqual([])
    }
  })

  it('only contains known files', () => {
    const allowed = new Set([
      'roster.json',
      'pokemon',
      'i18n',
      ...moddableKinds.filter((kind) => kind !== 'pokemon').map((kind) => `${kind}.json`),
    ])
    expect(fs.readdirSync(modDir).filter((name) => !allowed.has(name))).toEqual([])
    const i18nDir = path.join(modDir, 'i18n')
    if (fs.existsSync(i18nDir)) {
      expect(
        fs
          .readdirSync(i18nDir)
          .filter((name) => !(localeCodes as readonly string[]).includes(name)),
      ).toEqual([])
    }
  })

  it.each(moddableKinds)('has valid, minimal %s overrides inside the set', (kind) => {
    const problems: string[] = []
    for (const override of (source.mods?.overrides?.[kind] ?? []) as Array<
      Record<string, unknown> & { id: string; $unset?: string[] }
    >) {
      const result = moddableOverrideSchemas[kind].safeParse(override)
      if (!result.success) problems.push(`${override.id}: ${result.error.issues[0]?.message}`)
      const base = baseById[kind].get(override.id)
      if (!base || !inSet(kind, override.id)) {
        problems.push(`${override.id}: not in the set`)
        continue
      }
      for (const [key, value] of Object.entries(override)) {
        if (key === 'id' || key === '$unset') continue
        if (isDeepStrictEqual(base[key], value))
          problems.push(`${override.id}.${key}: same as base`)
      }
      for (const key of override.$unset ?? [])
        if (!(key in base)) problems.push(`${override.id}: unsets missing ${key}`)
    }
    expect(problems).toEqual([])
  })

  it('has valid mod text inside the set', () => {
    const problems: string[] = []
    for (const [locale, files] of Object.entries(source.mods?.text ?? {})) {
      for (const [kind, file] of Object.entries(files ?? {}) as [ModdableKind, object][]) {
        const validation = validate(moddableTextOverrideFileSchemas[kind], file)
        if (!validation.success) problems.push(`${locale}/${kind}: ${validation.errorsSummary[0]}`)
        for (const id of Object.keys(file))
          if (!inSet(kind, id)) problems.push(`${locale}/${kind}/${id}: not in the set`)
      }
    }
    expect(problems).toEqual([])
  })

  it('merges into valid records that follow the roster', () => {
    const merged = mergeGameSet(source)
    for (const kind of moddableKinds) {
      const expected = roster[kind] ?? [...baseById[kind].keys()]
      expect(merged.records[kind]?.map((record) => record.id).sort(), kind).toEqual(
        [...expected].sort(),
      )
    }
  })
})

describe('merged Champions', () => {
  const merged = mergeGameSet(loadGameSetSource('champions'))
  const moves = new Set(merged.records.moves?.map((move) => move.id))

  it('contains only Champions Pokémon, moves, abilities and items', () => {
    expect(merged.records.pokemon?.length).toBeGreaterThan(400)
    expect(merged.records.pokemon?.length).toBeLessThan(1000)
    expect(merged.records.moves?.length).toBeLessThan(935)
    expect(merged.records.abilities?.length).toBeLessThan(317)
    expect(merged.records.items?.length).toBeLessThan(491)
  })

  it('gives learnsets of Champions moves only', () => {
    const stray = (merged.records.pokemon ?? []).flatMap((pokemon) =>
      (pokemon.learnset ?? [])
        .filter((move) => !moves.has(move))
        .map((move) => `${pokemon.id}: ${move}`),
    )
    expect(stray).toEqual([])
    expect(merged.records.pokemon?.some((pokemon) => pokemon.learnset?.length)).toBe(true)
  })

  it('uses in-game descriptions and Champions form labels in English', () => {
    const english = merged.text.eng
    expect(english?.moves?.ember?.desc).toBeTruthy()
    expect(english?.pokemon?.['venusaur-mega']?.formName).toBe('Mega Venusaur')
  })

  it('applies overrides and removals', () => {
    const greninja = merged.records.pokemon?.find((pokemon) => pokemon.id === 'greninja')
    expect(greninja).not.toHaveProperty('abilitySpecial')
    const pound = merged.records.moves?.find((move) => move.id === 'pound')
    expect(pound?.pp).toBe(20)
  })
})

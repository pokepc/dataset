import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { move, pokemon } from './__fixtures__/records'
import { listModdedGameSets, loadGameSetSource, writeJsonFile } from './fs'
import {
  applyOverride,
  applyTextOverride,
  GameSetMergeError,
  mergeGameSet,
  type GameSetSource,
} from './merge'
import type { Move, Pokemon } from './types'

const pikachu = pokemon as Pokemon
const raichu = { ...pikachu, id: 'raichu', nid: '0026', dexNum: 26, forms: [] } as Pokemon
const pound = move as Move
const growth = { ...pound, id: 'growth', psName: 'Growth', category: 'status', power: 0 } as Move

function source(): GameSetSource {
  return {
    base: { pokemon: [pikachu, raichu], moves: [pound, growth] },
    text: {
      eng: {
        pokemon: {
          pikachu: { name: 'Pikachu', genus: 'Mouse Pokémon' },
          raichu: { name: 'Raichu' },
        },
        moves: { pound: { name: 'Pound', desc: 'Showdown text' }, growth: { name: 'Growth' } },
      },
      deu: { pokemon: { pikachu: { name: 'Pikachu' } } },
    },
  }
}

describe('applyOverride', () => {
  it('replaces properties, arrays and objects and removes $unset properties', () => {
    const merged = applyOverride(pikachu, {
      id: 'pikachu',
      baseSpeed: 110,
      forms: [],
      refs: { ...pikachu.refs, serebii: 'x' },
      $unset: ['abilityHidden'],
    })
    expect(merged.baseSpeed).toBe(110)
    expect(merged.forms).toEqual([])
    expect(merged.refs.serebii).toBe('x')
    expect(merged).not.toHaveProperty('abilityHidden')
    expect(merged).not.toHaveProperty('$unset')
    expect(pikachu.abilityHidden).toBe('lightningrod')
  })

  it('drops text entries left without fields', () => {
    expect(applyTextOverride({ desc: 'x' }, { $unset: ['desc'] })).toBeUndefined()
    expect(applyTextOverride(undefined, { desc: 'y' })).toEqual({ desc: 'y' })
  })
})

describe('mergeGameSet', () => {
  it('returns base data when the set has no mods', () => {
    const merged = mergeGameSet(source())
    expect(merged.records.pokemon).toEqual([pikachu, raichu])
    expect(merged.text.eng?.moves?.pound).toEqual({ name: 'Pound', desc: 'Showdown text' })
  })

  it('applies overrides and removals', () => {
    const merged = mergeGameSet({
      ...source(),
      mods: {
        overrides: {
          moves: [{ id: 'pound', pp: 20, usable: false }],
          pokemon: [{ id: 'pikachu', learnset: ['pound'], $unset: ['abilityHidden'] }],
        },
      },
    })
    expect(merged.records.moves?.[0]).toMatchObject({ id: 'pound', pp: 20, usable: false })
    expect(merged.records.moves?.[1]).toBe(growth)
    expect(merged.records.pokemon?.[0]?.learnset).toEqual(['pound'])
    expect(merged.records.pokemon?.[0]).not.toHaveProperty('abilityHidden')
  })

  it('limits kinds to the roster, in base order, and keeps unlisted kinds whole', () => {
    const merged = mergeGameSet({
      ...source(),
      mods: { roster: { pokemon: ['raichu'] } },
    })
    expect(merged.records.pokemon?.map((p) => p.id)).toEqual(['raichu'])
    expect(merged.records.moves?.map((m) => m.id)).toEqual(['pound', 'growth'])
    expect(merged.text.eng?.pokemon).toEqual({ raichu: { name: 'Raichu' } })
    // deu only had Pikachu, which the set excludes.
    expect(merged.text.deu).toBeUndefined()
  })

  it('orders rostered records by base order and excludes kinds with an empty roster', () => {
    const merged = mergeGameSet({
      ...source(),
      mods: { roster: { pokemon: ['raichu', 'pikachu'], moves: [] } },
    })
    expect(merged.records.pokemon?.map((p) => p.id)).toEqual(['pikachu', 'raichu'])
    expect(merged.records.moves).toEqual([])
    expect(merged.text.eng?.moves).toBeUndefined()
  })

  it('applies mod text and keeps missing translations missing', () => {
    const merged = mergeGameSet({
      ...source(),
      mods: {
        text: {
          eng: { moves: { pound: { desc: 'Champions text' } } },
          'pt-br': { moves: { pound: { desc: 'Texto' } } },
          deu: { pokemon: { pikachu: { $unset: ['name'] } } },
        },
      },
    })
    expect(merged.text.eng?.moves?.pound).toEqual({ name: 'Pound', desc: 'Champions text' })
    expect(merged.text['pt-br']).toEqual({ moves: { pound: { desc: 'Texto' } } })
    // No fallback: raichu has no German text and pikachu's only German field was removed.
    expect(merged.text.deu).toBeUndefined()
    expect(Object.keys(merged.text)).toEqual(['eng', 'pt-br'])
  })

  it('rejects mods that reference ids outside the set', () => {
    expect(() => mergeGameSet({ ...source(), mods: { roster: { pokemon: ['mew'] } } })).toThrow(
      GameSetMergeError,
    )
    expect(() =>
      mergeGameSet({
        ...source(),
        mods: {
          roster: { pokemon: ['raichu'] },
          overrides: { pokemon: [{ id: 'pikachu', gen: 2 }] },
        },
      }),
    ).toThrow(/outside the set: pikachu/)
    expect(() =>
      mergeGameSet({
        ...source(),
        mods: { roster: { moves: ['pound'] }, text: { eng: { moves: { growth: { desc: 'x' } } } } },
      }),
    ).toThrow(/outside the set: growth/)
    expect(() =>
      mergeGameSet({
        ...source(),
        mods: {
          overrides: {
            moves: [
              { id: 'pound', pp: 1 },
              { id: 'pound', pp: 2 },
            ],
          },
        },
      }),
    ).toThrow(/Duplicate/)
  })

  it('validates merged records', () => {
    expect(() =>
      mergeGameSet({ ...source(), mods: { overrides: { moves: [{ id: 'pound', pp: -5 }] } } }),
    ).toThrow(/Merged moves "pound" is invalid/)
    expect(() =>
      mergeGameSet(
        { ...source(), mods: { overrides: { moves: [{ id: 'pound', pp: -5 }] } } },
        { validate: false },
      ),
    ).not.toThrow()
  })

  it('rejects unknown locales and mods for kinds without base records', () => {
    expect(() => mergeGameSet({ ...source(), text: { jap: {} } as GameSetSource['text'] })).toThrow(
      /Unknown locale codes: jap/,
    )
    expect(() =>
      mergeGameSet({
        base: { moves: [pound] },
        mods: { overrides: { items: [{ id: 'cheriberry', gen: 4 }] } },
      }),
    ).toThrow(/no base items/)
  })
})

describe('loadGameSetSource', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('reads base, text and mods from a v8 data directory', () => {
    dir = mkdtempSync(join(tmpdir(), 'pokepc-v8-'))
    writeJsonFile(join(dir, 'indices/pokemon.json'), ['pikachu', 'raichu'])
    writeJsonFile(join(dir, 'pokemon/pikachu.json'), pikachu)
    writeJsonFile(join(dir, 'pokemon/raichu.json'), raichu)
    writeJsonFile(join(dir, 'moves.json'), [pound, growth])
    writeJsonFile(join(dir, 'i18n/eng/moves.json'), { pound: { name: 'Pound' } })
    writeJsonFile(join(dir, 'mods/champions/roster.json'), { pokemon: ['pikachu'] })
    writeJsonFile(join(dir, 'mods/champions/pokemon/pikachu.json'), { id: 'pikachu', baseHp: 40 })
    writeJsonFile(join(dir, 'mods/champions/moves.json'), [{ id: 'pound', pp: 20 }])
    writeJsonFile(join(dir, 'mods/champions/i18n/eng/moves.json'), { pound: { desc: 'Text' } })

    expect(listModdedGameSets(dir)).toEqual(['champions'])
    const loaded = loadGameSetSource('champions', { dataDir: dir, kinds: ['pokemon', 'moves'] })
    const merged = mergeGameSet(loaded)
    expect(merged.records.pokemon).toEqual([{ ...pikachu, baseHp: 40 }])
    expect(merged.records.moves?.[0]?.pp).toBe(20)
    expect(merged.text).toEqual({ eng: { moves: { pound: { name: 'Pound', desc: 'Text' } } } })

    const unmodded = loadGameSetSource('sv', { dataDir: dir, kinds: ['moves'] })
    expect(unmodded.mods).toBeUndefined()
    expect(mergeGameSet(unmodded).records.moves).toEqual([pound, growth])
  })

  it('rejects per-entity overrides whose id does not match the file', () => {
    dir = mkdtempSync(join(tmpdir(), 'pokepc-v8-'))
    writeJsonFile(join(dir, 'indices/pokemon.json'), ['pikachu'])
    writeJsonFile(join(dir, 'pokemon/pikachu.json'), pikachu)
    writeJsonFile(join(dir, 'mods/champions/pokemon/pikachu.json'), { id: 'raichu', baseHp: 40 })
    expect(() => loadGameSetSource('champions', { dataDir: dir, kinds: ['pokemon'] })).toThrow(
      /does not match/,
    )
  })
})

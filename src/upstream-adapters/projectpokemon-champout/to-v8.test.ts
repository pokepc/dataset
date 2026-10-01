import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { move as baseMove, pokemon as basePokemon } from '../../lib/__fixtures__/records'
import { loadGameSetSource, readJsonFile, writeJsonFile } from '../../lib/fs'
import { mergeGameSet } from '../../lib/merge'
import type { Ability, Item, Move, Pokemon } from '../../lib/types'
import type { AbilityRecord, ItemRecord, MoveRecord, PokemonRecord } from './schemas'
import { championsToV8, diffMergedChampions, type ChampionsDump, type ModdableBase } from './to-v8'
import { toChampionsDump } from './update'
import { readModdableBase, writeChampionsV8 } from './v8-files'

const pikachu = { ...basePokemon, championsId: undefined } as unknown as Pokemon
delete (pikachu as Partial<Pokemon>).championsId
const pikachuF = {
  ...pikachu,
  id: 'pikachu-f',
  isForm: true,
  isFemaleForm: true,
  baseSpecies: 'pikachu',
  forms: [],
} as Pokemon
const greninja = {
  ...pikachu,
  id: 'greninja',
  nid: '0658',
  type1: 'water',
  type2: 'dark',
  ability1: 'torrent',
  abilityHidden: 'protean',
  abilitySpecial: 'battlebond',
  forms: [],
} as Pokemon
const pound = { ...baseMove } as Move
delete pound.target
delete pound.classification
delete pound.contact
delete pound.championsId
delete pound.pokeApiId
const guillotine = { ...pound, id: 'guillotine', psName: 'Guillotine', power: 0 } as Move
const stench: Ability = { id: 'stench', psName: 'Stench', gen: 3, tags: ['status-trigger'] }
const cheriBerry: Item = { id: 'cheriberry', psName: 'Cheri Berry', gen: 3, category: 'berry' }

function base(): ModdableBase {
  return {
    pokemon: [pikachu, pikachuF, greninja],
    moves: [pound, guillotine],
    abilities: [stench],
    items: [cheriBerry],
    'battle-states': [],
    text: {
      eng: {
        pokemon: {
          pikachu: { name: 'Pikachu' },
          'pikachu-f': { name: 'Pikachu (Female)', formName: 'Female' },
        },
        moves: { pound: { name: 'Pound', desc: 'Showdown text.' } },
      },
    },
  }
}

const dumpPokemon = (record: Pokemon, overrides: Partial<PokemonRecord> = {}): PokemonRecord => ({
  id: record.id,
  nid: record.nid,
  name: 'x',
  pokeApiId: Number(record.refs.pkApiId),
  pokeApiFormId: Number(record.refs.pkApiFormId),
  showdownId: record.refs.showdown,
  ...(record.baseSpecies ? { baseSpecies: record.baseSpecies } : {}),
  championsId: record.id === 'greninja' ? '0658000' : record.isForm ? '0025001' : '0025000',
  type1: record.type1 as PokemonRecord['type1'],
  type2: (record.type2 ?? null) as PokemonRecord['type2'],
  abilities: [record.ability1, record.ability2, record.abilityHidden, record.abilitySpecial].filter(
    (ability): ability is string => ability !== undefined,
  ),
  baseHp: record.baseHp,
  baseAtk: record.baseAtk,
  baseDef: record.baseDef,
  baseSpAtk: record.baseSpAtk,
  baseSpDef: record.baseSpDef,
  baseSpeed: record.baseSpeed,
  height: record.height,
  weight: record.weight,
  isForm: record.isForm,
  isBattleOnly: record.isBattleOnlyForm,
  isCosmetic: record.isCosmeticForm,
  isFemale: record.isFemaleForm,
  ...overrides,
})

const dumpMove = (record: Move, overrides: Partial<MoveRecord> = {}): MoveRecord => ({
  id: record.id,
  championsId: record.id === 'pound' ? '1' : '12',
  pokeApiId: record.id === 'pound' ? 1 : 12,
  slug: record.id,
  name: record.psName,
  description: '',
  type: record.type as MoveRecord['type'],
  category: record.category,
  power: record.power,
  pp: record.pp,
  accuracy: record.accuracy,
  priority: record.priority,
  target: 'single_target',
  classification: [],
  contact: true,
  usable: true,
  ...overrides,
})

function dump(): ChampionsDump {
  const ability: AbilityRecord = {
    id: 'stench',
    championsId: '1',
    pokeApiId: 1,
    slug: 'stench',
    name: 'Stench',
    description: 'In-game text.',
  }
  const item: ItemRecord = {
    id: 'cheriberry',
    championsId: '149',
    pokeApiId: null,
    slug: 'cheri-berry',
    name: 'Cheri Berry',
    description: 'Cures paralysis.',
    pluralName: 'Cheri Berries',
    categories: ['berry', 'recovery'],
  }
  return {
    pokemon: [
      dumpPokemon(pikachu, { baseSpeed: 110 }),
      dumpPokemon(pikachuF),
      dumpPokemon(greninja, { abilities: ['torrent', 'protean'] }),
    ],
    pokemonMoves: [{ id: 'pikachu', moves: ['pound'] }],
    moves: [dumpMove(pound, { pp: 20 }), dumpMove(guillotine, { power: 1, usable: false })],
    abilities: [ability],
    items: [item],
    battleStates: [
      {
        id: '1',
        slug: 'harsh-sunlight',
        name: 'Harsh Sunlight',
        description: 'Boosts Fire.',
        state: 'harsh_sunlight',
      },
    ],
    i18n: {
      eng: {
        pokemon: [
          { id: 'pikachu', championsId: '0025000', name: 'Pikachu' },
          { id: 'pikachu-f', championsId: '0025001', name: 'Pikachu', formName: 'Female Pikachu' },
        ],
        moves: [
          {
            id: 'pound',
            slug: 'pound',
            slugLoc: 'pound',
            name: 'Pound',
            description: 'Champions text.',
          },
          {
            id: 'guillotine',
            slug: 'guillotine',
            slugLoc: 'guillotine',
            name: 'Guillotine',
            description: '',
          },
        ],
        abilities: [{ ...ability, slugLoc: 'stench' }],
        items: [{ ...item, slugLoc: 'cheri-berry' }],
        battleStates: [
          {
            id: '1',
            slug: 'harsh-sunlight',
            slugLoc: 'harsh-sunlight',
            name: 'Harsh Sunlight',
            description: 'Boosts Fire.',
          },
        ],
      },
      deu: {
        pokemon: [{ id: 'pikachu', championsId: '0025000', name: 'Pikachu' }],
        moves: [{ id: 'pound', slug: 'pound', slugLoc: 'klaps', name: 'Klaps', description: '' }],
      },
    },
  }
}

describe('championsToV8', () => {
  it('lists every dump entity in the roster, in base order', () => {
    const { mods } = championsToV8(dump(), base())
    expect(mods.roster).toEqual({
      pokemon: ['pikachu', 'pikachu-f', 'greninja'],
      moves: ['pound', 'guillotine'],
      abilities: ['stench'],
      items: ['cheriberry'],
    })
  })

  it('adds game-independent facts to base', () => {
    const result = championsToV8(dump(), base())
    expect(result.base.pokemon[0]?.championsId).toBe('0025000')
    expect(result.base.moves[0]).toMatchObject({
      championsId: '1',
      pokeApiId: 1,
      target: 'single_target',
      classification: [],
      contact: true,
    })
    expect(result.base.items[0]).toMatchObject({ championsId: '149', pokeApiId: null })
    expect(result.base['battle-states']).toEqual([
      { id: 'harsh-sunlight', championsId: '1', state: 'harsh_sunlight' },
    ])
    expect(result.base.text.deu?.moves?.pound).toEqual({ name: 'Klaps' })
    expect(result.base.text.eng?.items?.cheriberry).toEqual({
      name: 'Cheri Berry',
      pluralName: 'Cheri Berries',
    })
    expect(result.base.text.eng?.['battle-states']?.['harsh-sunlight']).toEqual({
      name: 'Harsh Sunlight',
      desc: 'Boosts Fire.',
    })
  })

  it('keeps only differences in overrides', () => {
    const { mods } = championsToV8(dump(), base())
    expect(mods.overrides.pokemon).toEqual([
      { id: 'pikachu', baseSpeed: 110, learnset: ['pound'] },
      { id: 'greninja', $unset: ['abilitySpecial'] },
    ])
    // Power 1 is Champions' encoding of variable damage, not an override.
    expect(mods.overrides.moves).toEqual([
      { id: 'pound', pp: 20 },
      { id: 'guillotine', usable: false },
    ])
    expect(mods.overrides.items).toEqual([
      { id: 'cheriberry', battleCategories: ['berry', 'recovery'] },
    ])
  })

  it('puts set wording in mod text and names forms by species', () => {
    const { base: updated, mods } = championsToV8(dump(), base())
    expect(mods.text.eng?.moves).toEqual({ pound: { desc: 'Champions text.' } })
    expect(mods.text.eng?.abilities).toEqual({ stench: { desc: 'In-game text.' } })
    expect(mods.text.eng?.pokemon).toEqual({ 'pikachu-f': { formName: 'Female Pikachu' } })
    expect(updated.text.eng?.pokemon?.['pikachu-f']).toEqual({
      name: 'Pikachu (Female)',
      speciesName: 'Pikachu',
      formName: 'Female',
    })
    expect(mods.text.deu).toBeUndefined()
  })

  it('rejects dump entities that base does not have', () => {
    const withMew = dump()
    withMew.pokemon.push(dumpPokemon({ ...pikachu, id: 'mew' } as Pokemon))
    expect(() => championsToV8(withMew, base())).toThrow(/"mew" has no base record/)
  })

  it('rejects ability lists that do not map onto base slots', () => {
    const swapped = dump()
    swapped.pokemon[2] = dumpPokemon(greninja, { abilities: ['protean', 'torrent'] })
    expect(() => championsToV8(swapped, base())).toThrow(
      /Cannot map Champions abilities of greninja/,
    )
  })
})

describe('writeChampionsV8', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  function writeBase(dataDir: string) {
    const data = base()
    writeJsonFile(
      join(dataDir, 'indices/pokemon.json'),
      data.pokemon.map((p) => p.id),
    )
    for (const p of data.pokemon) writeJsonFile(join(dataDir, 'pokemon', `${p.id}.json`), p)
    for (const kind of ['moves', 'abilities', 'items'] as const) {
      writeJsonFile(join(dataDir, `${kind}.json`), data[kind])
    }
    for (const [locale, files] of Object.entries(data.text)) {
      for (const [kind, file] of Object.entries(files ?? {})) {
        writeJsonFile(join(dataDir, 'i18n', locale, `${kind}.json`), file)
      }
    }
  }

  it('writes data that merges back to the dump, and nothing on a second run', () => {
    dir = mkdtempSync(join(tmpdir(), 'champions-v8-'))
    writeBase(dir)
    writeJsonFile(join(dir, 'mods/champions/pokemon/mew.json'), { id: 'mew', baseHp: 1 })

    const first = writeChampionsV8(dir, championsToV8(dump(), readModdableBase(dir)))
    expect(first.deleted).toEqual(['mods/champions/pokemon/mew.json'])
    expect(first.written).toContain('mods/champions/roster.json')
    expect(readJsonFile(join(dir, 'battle-states.json'))).toHaveLength(1)

    const merged = mergeGameSet(loadGameSetSource('champions', { dataDir: dir }))
    expect(diffMergedChampions(dump(), merged)).toEqual([])

    const second = writeChampionsV8(dir, championsToV8(dump(), readModdableBase(dir)))
    expect(second).toEqual({ written: [], deleted: [] })
  })
})

describe('toChampionsDump', () => {
  it('keys text by v8 locale code without inventing missing locales', () => {
    const data = {
      ...dump(),
      i18n: Object.fromEntries(
        ['usa', 'esp', 'latam', 'deu', 'ita', 'fra', 'kor', 'jpn', 'sch', 'tch'].map((code) => [
          code,
          { moves: [], abilities: [], items: [], battleStates: [], pokemon: [] },
        ]),
      ),
      warnings: [],
    } as unknown as Parameters<typeof toChampionsDump>[0]
    expect(Object.keys(toChampionsDump(data).i18n).sort()).toEqual([
      'chs',
      'cht',
      'deu',
      'eng',
      'es-es',
      'es-la',
      'fra',
      'ita',
      'jpn',
      'kor',
    ])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAllPokedexes: vi.fn(),
  loadAllPokemon: vi.fn(),
  loadAllRegions: vi.fn(),
  readDatasetFile: vi.fn(),
  writeDatasetFile: vi.fn(),
  createSearchablePokemonList: vi.fn(),
}))

vi.mock('@pokepc/dataset/lib/fs', () => ({
  loadAllPokedexes: mocks.loadAllPokedexes,
  loadAllPokemon: mocks.loadAllPokemon,
  loadAllRegions: mocks.loadAllRegions,
  readDatasetFile: mocks.readDatasetFile,
  writeDatasetFile: mocks.writeDatasetFile,
}))

vi.mock('@pokepc/dataset/lib/search', () => ({
  createSearchablePokemonList: mocks.createSearchablePokemonList,
}))

import {
  loadPokedexEditorData,
  loadPokedexesIndexData,
  savePokedexFromForm,
} from './pokedex-logic.server'

function createPokedex(
  overrides: Partial<Pkds.Pokedex> & Pick<Pkds.Pokedex, 'id' | 'name' | 'gen'>,
): Pkds.Pokedex {
  return {
    id: overrides.id,
    name: overrides.name,
    gen: overrides.gen,
    shortDesc: overrides.shortDesc,
    desc: overrides.desc ?? null,
    region: overrides.region ?? null,
    isNational: overrides.isNational ?? false,
    baseDex: overrides.baseDex ?? null,
    pkApiId: overrides.pkApiId ?? null,
    entries: overrides.entries ?? [],
  } as Pkds.Pokedex
}

function createPokemon(
  overrides: Partial<Pkds.Pokemon> & Pick<Pkds.Pokemon, 'id' | 'debutIn'>,
): Pkds.Pokemon {
  return {
    id: overrides.id,
    nid: overrides.nid ?? overrides.id,
    dexNum: overrides.dexNum ?? 1,
    gen: overrides.gen ?? 1,
    names: overrides.names ?? { eng: overrides.id },
    speciesNames: overrides.speciesNames ?? {},
    formNames: overrides.formNames ?? {},
    debutIn: overrides.debutIn,
    obtainableIn: overrides.obtainableIn ?? [],
    storableIn: overrides.storableIn ?? [],
    transferOnlyIn: overrides.transferOnlyIn ?? [],
    eventOnlyIn: overrides.eventOnlyIn ?? [],
    shinyLockedIn: overrides.shinyLockedIn,
    forms: overrides.forms ?? [],
    baseForms: overrides.baseForms ?? [],
    hasGenderDifferences: overrides.hasGenderDifferences ?? false,
    isFemaleForm: overrides.isFemaleForm ?? false,
    isBattleOnlyForm: overrides.isBattleOnlyForm ?? false,
  } as Pkds.Pokemon
}

describe('pokedex-logic.server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSearchablePokemonList.mockImplementation((pokemon: Pkds.Pokemon[]) =>
      pokemon.map((item) => ({
        ...item,
        name: item.names.eng ?? item.id,
        searchableText: `${item.id} search`,
      })),
    )
  })

  it('loadPokedexesIndexData maps pokedexes into list cards', () => {
    mocks.loadAllPokedexes.mockReturnValue([
      createPokedex({
        id: 'kanto',
        name: 'Kanto Dex',
        gen: 1,
        entries: [{ pid: 'pikachu' }] as any,
      }),
      createPokedex({ id: 'national', name: 'National Dex', gen: 9, entries: [] }),
    ])

    expect(loadPokedexesIndexData()).toEqual({
      pokedexes: [
        { id: 'kanto', label: 'Kanto Dex', gen: 1, entryCount: 1 },
        { id: 'national', label: 'National Dex', gen: 9, entryCount: 0 },
      ],
    })
  })

  it('loadPokedexEditorData returns dex data and selector options', () => {
    mocks.loadAllPokedexes.mockReturnValue([
      createPokedex({
        id: 'kanto',
        name: 'Kanto Dex',
        gen: 1,
        region: 'kanto',
        entries: [{ pid: 'pikachu', dexNum: 25, isForm: false }] as any,
      }),
      createPokedex({ id: 'national', name: 'National Dex', gen: 9 }),
    ])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({ id: 'pikachu', nid: '25', dexNum: 25, debutIn: 'red' }),
    ])
    mocks.loadAllRegions.mockReturnValue([{ id: 'kanto', name: 'Kanto' }])

    const result = loadPokedexEditorData('kanto')

    expect(result.initialDraft.id).toBe('kanto')
    expect(result.pokemonOptions).toEqual([
      {
        id: 'pikachu',
        label: 'pikachu',
        image: 'https://static.pokepc.net/images/pokemon/home3d-icon/regular/25.webp',
        dexNum: 25,
        searchableText: 'pikachu search',
      },
    ])
    expect(result.regionOptions).toEqual([{ id: 'kanto', label: 'Kanto' }])
    expect(result.baseDexOptions).toEqual([{ id: 'national', label: 'National Dex' }])
  })

  it('savePokedexFromForm rejects unknown pokemon ids', async () => {
    const existing = createPokedex({
      id: 'kanto',
      name: 'Kanto Dex',
      gen: 1,
      entries: [{ pid: 'pikachu', dexNum: 25, isForm: false }] as any,
    })
    mocks.loadAllPokedexes.mockReturnValue([existing])
    mocks.loadAllPokemon.mockReturnValue([createPokemon({ id: 'pikachu', debutIn: 'red' })])
    mocks.loadAllRegions.mockReturnValue([{ id: 'kanto', name: 'Kanto' }])

    const formData = new FormData()
    formData.set('intent', 'save-pokedex')
    formData.set('pokedexId', 'kanto')
    formData.set(
      'draft',
      JSON.stringify({
        id: 'kanto',
        name: 'Kanto Dex',
        shortDesc: '',
        desc: '',
        gen: '1',
        region: 'kanto',
        isNational: false,
        baseDex: '',
        pkApiId: '',
        entries: [
          {
            clientId: 'row-1',
            pid: 'missing',
            dexNum: '1',
            isForm: false,
            transferOnly: 'unset',
            isNonCanonical: 'unset',
          },
        ],
      }),
    )

    const result = await savePokedexFromForm(
      new Request('http://localhost/pokedexes/kanto', { method: 'POST', body: formData }),
      { id: 'kanto' },
    )

    expect(result).toEqual({
      success: false,
      error: 'Pokedex data is invalid. Please fix the highlighted fields.',
    })
  })

  it('savePokedexFromForm preserves order and hidden entry fields when saving', async () => {
    const existing = createPokedex({
      id: 'kanto',
      name: 'Kanto Dex',
      gen: 1,
      region: 'kanto',
      entries: [
        {
          pid: 'pikachu',
          dexNum: 25,
          isForm: false,
          originDex: 'national',
          meta: { names: { eng: 'Pikachu' } },
        },
        {
          pid: 'raichu',
          dexNum: 26,
          isForm: false,
        },
      ] as any,
    })
    mocks.loadAllPokedexes.mockReturnValue([
      existing,
      createPokedex({ id: 'national', name: 'National Dex', gen: 9 }),
    ])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({ id: 'pikachu', debutIn: 'red' }),
      createPokemon({ id: 'raichu', debutIn: 'red' }),
    ])
    mocks.loadAllRegions.mockReturnValue([{ id: 'kanto', name: 'Kanto' }])
    mocks.readDatasetFile.mockReturnValue(existing)

    const formData = new FormData()
    formData.set('intent', 'save-pokedex')
    formData.set('pokedexId', 'kanto')
    formData.set(
      'draft',
      JSON.stringify({
        id: 'kanto',
        name: 'Kanto Dex',
        shortDesc: '',
        desc: '',
        gen: '1',
        region: 'kanto',
        isNational: false,
        baseDex: '',
        pkApiId: '',
        entries: [
          {
            clientId: 'row-2',
            pid: 'raichu',
            dexNum: '26',
            isForm: false,
            transferOnly: 'unset',
            isNonCanonical: 'unset',
          },
          {
            clientId: 'row-1',
            pid: 'pikachu',
            dexNum: '25',
            isForm: false,
            transferOnly: 'true',
            isNonCanonical: 'unset',
            originDex: 'national',
            meta: { names: { eng: 'Pikachu' } },
          },
        ],
      }),
    )

    const result = await savePokedexFromForm(
      new Request('http://localhost/pokedexes/kanto', { method: 'POST', body: formData }),
      { id: 'kanto' },
    )

    expect(result).toEqual({
      success: true,
      pokedex: {
        ...existing,
        shortDesc: undefined,
        desc: null,
        entries: [
          {
            pid: 'raichu',
            dexNum: 26,
            isForm: false,
            transferOnly: undefined,
            isNonCanonical: undefined,
            originDex: undefined,
            meta: undefined,
          },
          {
            pid: 'pikachu',
            dexNum: 25,
            isForm: false,
            transferOnly: true,
            isNonCanonical: undefined,
            originDex: 'national',
            meta: { names: { eng: 'Pikachu' } },
          },
        ],
      },
    })
    expect(mocks.writeDatasetFile).toHaveBeenCalledWith(
      {
        ...existing,
        shortDesc: undefined,
        desc: null,
        entries: [
          {
            pid: 'raichu',
            dexNum: 26,
            isForm: false,
            transferOnly: undefined,
            isNonCanonical: undefined,
            originDex: undefined,
            meta: undefined,
          },
          {
            pid: 'pikachu',
            dexNum: 25,
            isForm: false,
            transferOnly: true,
            isNonCanonical: undefined,
            originDex: 'national',
            meta: { names: { eng: 'Pikachu' } },
          },
        ],
      },
      'pokedexes/kanto.json',
      false,
    )
  })
})

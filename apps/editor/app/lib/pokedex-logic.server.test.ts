import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAllPokedexes: vi.fn(),
  loadAllPokemon: vi.fn(),
  loadAllRegions: vi.fn(),
  readDatasetFile: vi.fn(),
  writeDatasetFile: vi.fn(),
  updateTextFile: vi.fn(),
  /** English text per kind, as in i18n/eng/<kind>.json. */
  text: {} as Record<string, Record<string, Record<string, unknown>>>,
}))

vi.mock('@pokepc/dataset/lib/fs', () => ({
  loadAllPokedexes: mocks.loadAllPokedexes,
  loadAllPokemon: mocks.loadAllPokemon,
  loadAllRegions: mocks.loadAllRegions,
  loadText: (kind: string) => mocks.text[kind] ?? {},
  readDatasetFile: mocks.readDatasetFile,
  writeDatasetFile: mocks.writeDatasetFile,
}))

vi.mock('@/lib/dataset-text.server', () => ({
  englishName: (kind: string, id: string) => (mocks.text[kind]?.[id]?.name as string) ?? id,
  loadSearchablePokemon: (pokemon: Pkds.Pokemon[]) =>
    pokemon.map((item) => ({ ...item, name: item.id, searchableText: `${item.id} search` })),
  updateTextFile: mocks.updateTextFile,
}))

import {
  loadPokedexEditorData,
  loadPokedexesIndexData,
  savePokedexFromForm,
} from './pokedex-logic.server'

function createPokedex(
  overrides: Partial<Pkds.Pokedex> & Pick<Pkds.Pokedex, 'id' | 'gen'>,
): Pkds.Pokedex {
  return {
    id: overrides.id,
    gen: overrides.gen,
    region: overrides.region ?? null,
    isNational: overrides.isNational ?? false,
    baseDex: overrides.baseDex ?? null,
    pkApiId: overrides.pkApiId ?? null,
    entries: overrides.entries ?? [],
  }
}

function createPokemon(
  overrides: Partial<Pkds.Pokemon> & Pick<Pkds.Pokemon, 'id' | 'debutIn'>,
): Pkds.Pokemon {
  return {
    id: overrides.id,
    nid: overrides.nid ?? overrides.id,
    dexNum: overrides.dexNum ?? 1,
    gen: overrides.gen ?? 1,
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

function saveRequest(draft: Record<string, unknown>) {
  const formData = new FormData()
  formData.set('intent', 'save-pokedex')
  formData.set('pokedexId', 'kanto')
  formData.set('draft', JSON.stringify(draft))
  return new Request('http://localhost/pokedexes/kanto', { method: 'POST', body: formData })
}

const draftHeader = {
  id: 'kanto',
  name: 'Kanto Dex',
  shortDesc: '',
  desc: '',
  gen: '1',
  region: 'kanto',
  isNational: false,
  baseDex: '',
  pkApiId: '',
}

describe('pokedex-logic.server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.text = {
      pokedexes: { kanto: { name: 'Kanto Dex' }, national: { name: 'National Dex' } },
      regions: { kanto: { name: 'Kanto' } },
    }
    mocks.loadAllRegions.mockReturnValue([{ id: 'kanto' }])
  })

  it('loadPokedexesIndexData maps pokedexes into list cards with English names', () => {
    mocks.loadAllPokedexes.mockReturnValue([
      createPokedex({ id: 'kanto', gen: 1, entries: [{ pid: 'pikachu' }] as any }),
      createPokedex({ id: 'national', gen: 9, entries: [] }),
    ])

    expect(loadPokedexesIndexData().pokedexes).toEqual([
      { id: 'kanto', label: 'Kanto Dex', gen: 1, entryCount: 1 },
      { id: 'national', label: 'National Dex', gen: 9, entryCount: 0 },
    ])
  })

  it('loadPokedexEditorData joins the Pokédex with its text and builds options', () => {
    mocks.text.pokedexes!.kanto = { name: 'Kanto Dex', desc: 'Original 151.' }
    mocks.loadAllPokedexes.mockReturnValue([
      createPokedex({ id: 'kanto', gen: 1, region: 'kanto' }),
      createPokedex({ id: 'national', gen: 9 }),
    ])
    mocks.loadAllPokemon.mockReturnValue([createPokemon({ id: 'pikachu', debutIn: 'red' })])

    const result = loadPokedexEditorData('kanto')

    expect(result.pokedex).toMatchObject({ id: 'kanto', name: 'Kanto Dex', desc: 'Original 151.' })
    expect(result.initialDraft).toMatchObject({ name: 'Kanto Dex', desc: 'Original 151.' })
    expect(result.pokemonOptions.map((option) => option.id)).toEqual(['pikachu'])
    expect(result.regionOptions).toEqual([{ id: 'kanto', label: 'Kanto' }])
    expect(result.baseDexOptions).toEqual([{ id: 'national', label: 'National Dex' }])
  })

  it('savePokedexFromForm rejects unknown pokemon ids', async () => {
    mocks.loadAllPokedexes.mockReturnValue([
      createPokedex({
        id: 'kanto',
        gen: 1,
        entries: [{ pid: 'pikachu', dexNum: 25, isForm: false }],
      }),
    ])
    mocks.loadAllPokemon.mockReturnValue([createPokemon({ id: 'pikachu', debutIn: 'red' })])

    const result = await savePokedexFromForm(
      saveRequest({
        ...draftHeader,
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
      { id: 'kanto' },
    )

    expect(result).toEqual({
      success: false,
      error: 'Pokedex data is invalid. Please fix the highlighted fields.',
    })
    expect(mocks.writeDatasetFile).not.toHaveBeenCalled()
    expect(mocks.updateTextFile).not.toHaveBeenCalled()
  })

  it('savePokedexFromForm writes the record and its text, preserving order and entry text', async () => {
    const entryText = { pikachuplush: { name: 'Pikachu Plush' } }
    mocks.text.pokedexes!.kanto = { name: 'Kanto Dex', entries: entryText }
    const existing = createPokedex({
      id: 'kanto',
      gen: 1,
      region: 'kanto',
      entries: [
        {
          pid: 'pikachu',
          dexNum: 25,
          isForm: false,
          originDex: 'national',
          meta: { id: 'pikachuplush' },
        },
        { pid: 'raichu', dexNum: 26, isForm: false },
      ],
    })
    mocks.loadAllPokedexes.mockReturnValue([existing, createPokedex({ id: 'national', gen: 9 })])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({ id: 'pikachu', debutIn: 'red' }),
      createPokemon({ id: 'raichu', debutIn: 'red' }),
    ])
    mocks.readDatasetFile.mockReturnValue(structuredClone(existing))

    const result = await savePokedexFromForm(
      saveRequest({
        ...draftHeader,
        name: 'Kanto Pokédex',
        desc: 'Original 151.',
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
            meta: { id: 'pikachuplush' },
          },
        ],
      }),
      { id: 'kanto' },
    )

    const expectedRecord = {
      ...existing,
      entries: [
        { pid: 'raichu', dexNum: 26, isForm: false },
        {
          pid: 'pikachu',
          dexNum: 25,
          isForm: false,
          transferOnly: true,
          originDex: 'national',
          meta: { id: 'pikachuplush' },
        },
      ],
    }
    expect(result.success).toBe(true)
    expect(result.success && result.pokedex).toMatchObject({
      ...expectedRecord,
      name: 'Kanto Pokédex',
      desc: 'Original 151.',
    })
    const [record, path] = mocks.writeDatasetFile.mock.calls[0]!
    expect(path).toBe('pokedexes/kanto.json')
    expect(JSON.parse(JSON.stringify(record))).toEqual(expectedRecord)
    expect(mocks.updateTextFile).toHaveBeenCalledWith('i18n/eng/pokedexes.json', 'kanto', {
      name: 'Kanto Pokédex',
      desc: 'Original 151.',
      entries: entryText,
    })
  })
})

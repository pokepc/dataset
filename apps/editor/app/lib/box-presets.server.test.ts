import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAllGames: vi.fn(),
  loadAllGameSets: vi.fn(),
  loadAllPokemon: vi.fn(),
  readDatasetFile: vi.fn(),
  writeDatasetFile: vi.fn(),
  createSearchablePokemonList: vi.fn(),
}))

vi.mock('@pokepc/dataset/lib/fs', () => ({
  loadAllGames: mocks.loadAllGames,
  loadAllGameSets: mocks.loadAllGameSets,
  loadAllPokemon: mocks.loadAllPokemon,
  readDatasetFile: mocks.readDatasetFile,
  writeDatasetFile: mocks.writeDatasetFile,
}))

vi.mock('@pokepc/dataset/lib/search', () => ({
  createSearchablePokemonList: mocks.createSearchablePokemonList,
}))

import { boxPresetToDraft, type BoxPresetDraft } from './box-presets'
import {
  loadAvailableStorablePokemonForGameSet,
  loadBoxPresetEditorData,
  loadBoxPresetIndexData,
  saveBoxPresetFromForm,
} from './box-presets.server'

function createGame(overrides: Partial<Pkds.Game> & Pick<Pkds.Game, 'id' | 'name'>): Pkds.Game {
  return {
    id: overrides.id,
    name: overrides.name,
    nameSlug: overrides.nameSlug ?? overrides.id,
    codename: overrides.codename ?? null,
    gen: overrides.gen ?? 1,
    type: overrides.type ?? 'set',
    series: overrides.series ?? 'main',
    gameSet: overrides.gameSet ?? null,
    gameSuperSet: overrides.gameSuperSet ?? null,
    releaseDate: overrides.releaseDate ?? '1996-02-27',
    region: overrides.region ?? null,
    originMark: overrides.originMark ?? null,
    pokedexes: overrides.pokedexes ?? [],
    maxBoxes: overrides.maxBoxes ?? 8,
    maxBoxSize: overrides.maxBoxSize ?? 30,
    maxPartySize: overrides.maxPartySize ?? 6,
    maxBattleTeams: overrides.maxBattleTeams ?? 0,
    platforms: overrides.platforms ?? ['gb'],
    features: overrides.features ?? ({} as Pkds.GameFeatures),
    onlineFeatures: overrides.onlineFeatures,
  } as Pkds.Game
}

function createPokemon(overrides: Partial<Pkds.Pokemon> & Pick<Pkds.Pokemon, 'id'>): Pkds.Pokemon {
  return {
    id: overrides.id,
    nid: overrides.nid ?? overrides.id,
    imgNid: overrides.imgNid,
    dexNum: overrides.dexNum ?? 1,
    names: overrides.names ?? { eng: overrides.id },
    storableIn: overrides.storableIn ?? [],
  } as Pkds.Pokemon
}

function createClassicPreset(
  overrides: Partial<Pkds.LegacyBoxPreset> &
    Pick<Pkds.LegacyBoxPreset, 'id' | 'name'> & { fullId?: string },
): Pkds.LegacyBoxPreset {
  return {
    id: overrides.id,
    fullId: overrides.fullId,
    name: overrides.name,
    version: overrides.version ?? 1,
    gameSet: overrides.gameSet ?? 'rb',
    description: overrides.description ?? 'Preset description',
    boxes: overrides.boxes ?? [{ pokemon: ['bulbasaur', null] }],
    legacyId: overrides.legacyId,
    isHidden: overrides.isHidden,
  } as Pkds.LegacyBoxPreset
}

function createModernPreset(
  overrides: Partial<Pkds.ModernBoxPreset> & Pick<Pkds.ModernBoxPreset, 'id' | 'name'>,
): Pkds.ModernBoxPreset {
  return {
    schemaVersion: 1,
    id: overrides.id,
    name: overrides.name,
    gameSet: overrides.gameSet ?? 'home',
    description: overrides.description ?? 'Modern description',
    source: overrides.source,
    tags: overrides.tags,
    boxes: overrides.boxes ?? [{ name: 'Modern Box', slots: ['mew', null] }],
  }
}

function requestWithDraft(draft: BoxPresetDraft) {
  const formData = new FormData()
  formData.set('intent', 'save-box-preset')
  formData.set('draft', JSON.stringify(draft))
  return new Request('http://localhost/box-presets/classic/rb/sample', {
    method: 'POST',
    body: formData,
  })
}

describe('box-presets.server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadAllGameSets.mockReturnValue([
      createGame({ id: 'rb', name: 'Red / Blue' }),
      createGame({ id: 'home', name: 'HOME' }),
    ])
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'rb', name: 'Red / Blue' }),
      createGame({ id: 'red', name: 'Red', type: 'game', gameSet: 'rb' }),
      createGame({ id: 'blue', name: 'Blue', type: 'game', gameSet: 'rb' }),
      createGame({ id: 'home', name: 'HOME' }),
    ])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({ id: 'bulbasaur', nid: '1', dexNum: 1, storableIn: ['rb'] }),
      createPokemon({ id: 'ivysaur', nid: '2', dexNum: 2, storableIn: ['red'] }),
      createPokemon({ id: 'mew', nid: '151', dexNum: 151, storableIn: ['home'] }),
    ])
    mocks.createSearchablePokemonList.mockImplementation((pokemon: Pkds.Pokemon[]) =>
      pokemon.map((item) => ({
        ...item,
        name: item.names.eng ?? item.id,
        searchableText: `${item.id} search`,
      })),
    )
  })

  it('discovers both classic and modern variant categories', () => {
    mocks.readDatasetFile.mockImplementation((path: string) => {
      if (path === 'boxpresets/classic/rb.json') {
        return {
          sample: createClassicPreset({ id: 'sample', name: 'Sample' }),
        }
      }
      if (path === 'boxpresets/modern/home.json') {
        return ['modern']
      }
      if (path === 'boxpresets/modern/home/modern.json') {
        return createModernPreset({ id: 'modern', name: 'Modern' })
      }
      throw new Error('missing')
    })

    const result = loadBoxPresetIndexData()

    expect(result.variants.map((variant) => variant.id)).toEqual(['classic', 'modern'])
    expect(result.variants[0]?.presetCount).toBe(1)
    expect(result.variants[1]?.presetCount).toBe(1)
  })

  it('loads selected classic preset editor data', () => {
    mocks.readDatasetFile.mockReturnValue({
      sample: createClassicPreset({ id: 'sample', name: 'Sample' }),
      sibling: createClassicPreset({ id: 'sibling', name: 'Sibling' }),
    })

    const result = loadBoxPresetEditorData({
      variant: 'classic',
      gameSet: 'rb',
      presetId: 'sample',
    })

    expect(result.variant).toBe('classic')
    expect(result.preset.id).toBe('sample')
    expect(result.initialDraft.boxes[0]?.cells).toHaveLength(30)
    expect(result.initialDraft.boxes[0]?.cells.slice(0, 3)).toEqual(['bulbasaur', null, null])
    expect(result.siblingPresets.map((preset) => preset.id)).toEqual(['sample', 'sibling'])
    expect(result.availablePokemon.map((pokemon) => pokemon.id)).toEqual(['bulbasaur', 'ivysaur'])
  })

  it('loads selected modern preset editor data from the modern preset path', () => {
    mocks.readDatasetFile.mockImplementation((path: string) => {
      if (path === 'boxpresets/modern/home.json') return ['modern']
      if (path === 'boxpresets/modern/home/modern.json') {
        return createModernPreset({
          id: 'modern',
          name: 'Modern',
          boxes: [{ name: 'Modern Box', slots: ['mew', { pokemon: 'mew', shiny: true }] }],
        })
      }
      throw new Error('missing')
    })

    const result = loadBoxPresetEditorData({
      variant: 'modern',
      gameSet: 'home',
      presetId: 'modern',
    })

    expect(result.variant).toBe('modern')
    expect(result.preset.id).toBe('modern')
    expect(result.initialDraft.boxes[0]?.cells).toHaveLength(30)
    expect(result.initialDraft.boxes[0]?.cells.slice(0, 3)).toEqual([
      'mew',
      { pokemonId: 'mew', shiny: true },
      null,
    ])
    expect(result.availablePokemon.map((pokemon) => pokemon.id)).toEqual(['mew'])
  })

  it('saves selected classic preset without dropping siblings', async () => {
    const existing = {
      sample: createClassicPreset({
        id: 'sample',
        fullId: 'rb-sample',
        name: 'Sample',
      }),
      sibling: createClassicPreset({ id: 'sibling', name: 'Sibling' }),
    }
    const draft = boxPresetToDraft(
      'classic',
      createClassicPreset({
        id: 'sample',
        name: 'Sample',
        boxes: [{ pokemon: ['ivysaur', null] }],
      }),
    )
    mocks.readDatasetFile.mockReturnValue(existing)

    const result = await saveBoxPresetFromForm(requestWithDraft(draft), {
      variant: 'classic',
      gameSet: 'rb',
      presetId: 'sample',
    })

    expect(result.success).toBe(true)
    expect(mocks.writeDatasetFile).toHaveBeenCalledWith(
      {
        sample: {
          id: 'sample',
          fullId: 'rb-sample',
          legacyId: undefined,
          name: 'Sample',
          version: 1,
          gameSet: 'rb',
          description: 'Preset description',
          boxes: [{ title: undefined, pokemon: ['ivysaur'] }],
          isHidden: undefined,
        },
        sibling: existing.sibling,
      },
      'boxpresets/classic/rb.json',
      false,
    )
    expect(result.success && result.draft.boxes[0]?.cells).toHaveLength(30)
  })

  it('saves selected modern preset through the modern preset path', async () => {
    const draft = boxPresetToDraft(
      'modern',
      createModernPreset({
        id: 'modern',
        name: 'Modern',
        gameSet: 'home',
        boxes: [{ name: 'Modern Box', slots: ['mew', null] }],
      }),
    )
    mocks.readDatasetFile.mockImplementation((path: string) => {
      if (path === 'boxpresets/modern/home.json') return ['modern']
      if (path === 'boxpresets/modern/home/modern.json') {
        return createModernPreset({ id: 'modern', name: 'Modern' })
      }
      throw new Error('missing')
    })

    const result = await saveBoxPresetFromForm(requestWithDraft(draft), {
      variant: 'modern',
      gameSet: 'home',
      presetId: 'modern',
    })

    expect(result.success).toBe(true)
    expect(mocks.writeDatasetFile).toHaveBeenCalledWith(
      {
        schemaVersion: 1,
        id: 'modern',
        gameSet: 'home',
        name: 'Modern',
        description: 'Modern description',
        source: undefined,
        tags: undefined,
        boxes: [{ name: 'Modern Box', slots: ['mew'] }],
      },
      'boxpresets/modern/home/modern.json',
      false,
    )
    expect(result.success && result.draft.boxes[0]?.cells).toHaveLength(30)
  })

  it('rejects invalid variant, game set, and preset ids', async () => {
    const draft = boxPresetToDraft('classic', createClassicPreset({ id: 'sample', name: 'Sample' }))

    await expect(
      saveBoxPresetFromForm(requestWithDraft(draft), {
        variant: 'legacy',
        gameSet: 'rb',
        presetId: 'sample',
      }),
    ).resolves.toEqual({ success: false, error: 'Invalid box preset variant.' })

    await expect(
      saveBoxPresetFromForm(requestWithDraft(draft), {
        variant: 'classic',
        gameSet: 'missing',
        presetId: 'sample',
      }),
    ).resolves.toEqual({ success: false, error: 'Game set not found.' })
  })

  it('rejects schema-invalid drafts', async () => {
    const invalidDraft = boxPresetToDraft(
      'classic',
      createClassicPreset({ id: 'sample', name: 'Sample' }),
    )
    invalidDraft.boxes = [{ cells: [{ pokemonId: 'Invalid ID' }] }]
    mocks.readDatasetFile.mockReturnValue({
      sample: createClassicPreset({ id: 'sample', name: 'Sample' }),
    })

    const result = await saveBoxPresetFromForm(requestWithDraft(invalidDraft), {
      variant: 'classic',
      gameSet: 'rb',
      presetId: 'sample',
    })

    expect(result).toEqual({
      success: false,
      error: 'Box preset data does not match the schema.',
    })
  })

  it('derives available storable Pokemon from game set and member games', () => {
    const result = loadAvailableStorablePokemonForGameSet(
      'rb',
      boxPresetToDraft(
        'classic',
        createClassicPreset({
          id: 'sample',
          name: 'Sample',
          boxes: [{ pokemon: ['bulbasaur', 'bulbasaur', null] }],
        }),
      ),
    )

    expect(result.map((pokemon) => [pokemon.id, pokemon.placedCount])).toEqual([
      ['bulbasaur', 2],
      ['ivysaur', 0],
    ])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAllGames: vi.fn(),
  loadAllGameSets: vi.fn(),
  loadAllPokemon: vi.fn(),
  readDatasetFile: vi.fn(),
  writeDatasetFile: vi.fn(),
  updateTextFile: vi.fn(),
}))

vi.mock('@pokepc/dataset/lib/fs', () => ({
  absDatasetFile: (path: string) => `/dataset/${path}`,
  loadAllGames: mocks.loadAllGames,
  loadAllGameSets: mocks.loadAllGameSets,
  loadAllPokemon: mocks.loadAllPokemon,
  readDatasetFile: mocks.readDatasetFile,
  writeDatasetFile: mocks.writeDatasetFile,
}))

const gameNames: Record<string, string> = { rb: 'Red / Blue', home: 'HOME' }

vi.mock('@/lib/dataset-text.server', () => ({
  englishName: (_kind: string, id: string) => gameNames[id] ?? id,
  loadSearchablePokemon: (pokemon: Pkds.Pokemon[]) =>
    pokemon.map((item) => ({ ...item, name: item.id, searchableText: `${item.id} search` })),
  updateTextFile: mocks.updateTextFile,
}))

import {
  boxPresetToDraft,
  joinClassicBoxPreset,
  joinModernBoxPreset,
  type BoxPresetDraft,
} from './box-presets'
import {
  loadAvailableStorablePokemonForGameSet,
  loadBoxPresetEditorData,
  loadBoxPresetIndexData,
  saveBoxPresetFromForm,
} from './box-presets.server'

const CLASSIC_RB = 'boxpresets/classic/rb.json'
const CLASSIC_RB_TEXT = 'i18n/eng/boxpresets/classic/rb.json'
const MODERN_HOME_INDEX = 'boxpresets/modern/home.json'
const MODERN_HOME_PRESET = 'boxpresets/modern/home/modern.json'
const MODERN_HOME_TEXT = 'i18n/eng/boxpresets/modern/home.json'

function createGame(overrides: Partial<Pkds.Game> & Pick<Pkds.Game, 'id'>): Pkds.Game {
  return {
    id: overrides.id,
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
    storableIn: overrides.storableIn ?? [],
  } as Pkds.Pokemon
}

function createClassicPreset(
  overrides: Partial<Pkds.ClassicBoxPreset> & Pick<Pkds.ClassicBoxPreset, 'id'>,
): Pkds.ClassicBoxPreset {
  return {
    id: overrides.id,
    fullId: overrides.fullId,
    version: overrides.version ?? 1,
    gameSet: overrides.gameSet ?? 'rb',
    boxes: overrides.boxes ?? [{ pokemon: ['bulbasaur', null] }],
    legacyId: overrides.legacyId,
    isHidden: overrides.isHidden,
  }
}

function createModernPreset(
  overrides: Partial<Pkds.ModernBoxPreset> & Pick<Pkds.ModernBoxPreset, 'id'>,
): Pkds.ModernBoxPreset {
  return {
    schemaVersion: 2,
    id: overrides.id,
    gameSet: overrides.gameSet ?? 'home',
    source: overrides.source,
    tags: overrides.tags,
    boxes: overrides.boxes ?? [{ slots: ['mew', null] }],
  }
}

const classicText = (name: string) => ({ name, description: 'Preset description' })
const modernText = { name: 'Modern', description: 'Modern description', boxes: ['Modern Box'] }

/** Serves fixture files by path, like the dataset directory would. */
function serveFiles(files: Record<string, unknown>) {
  mocks.readDatasetFile.mockImplementation((path: string) => {
    if (path in files) return structuredClone(files[path])
    throw new Error(`missing ${path}`)
  })
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
    mocks.loadAllGameSets.mockReturnValue([createGame({ id: 'rb' }), createGame({ id: 'home' })])
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'rb' }),
      createGame({ id: 'red', type: 'game', gameSet: 'rb' }),
      createGame({ id: 'blue', type: 'game', gameSet: 'rb' }),
      createGame({ id: 'home' }),
    ])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({ id: 'bulbasaur', nid: '1', dexNum: 1, storableIn: ['rb'] }),
      createPokemon({ id: 'ivysaur', nid: '2', dexNum: 2, storableIn: ['red'] }),
      createPokemon({ id: 'mew', nid: '151', dexNum: 151, storableIn: ['home'] }),
    ])
  })

  it('discovers both classic and modern variant categories with English labels', () => {
    serveFiles({
      [CLASSIC_RB]: { sample: createClassicPreset({ id: 'sample' }) },
      [CLASSIC_RB_TEXT]: { sample: classicText('Sample') },
      [MODERN_HOME_INDEX]: ['modern'],
      [MODERN_HOME_PRESET]: createModernPreset({ id: 'modern' }),
      [MODERN_HOME_TEXT]: { modern: modernText },
    })

    const result = loadBoxPresetIndexData()

    expect(result.variants.map((variant) => variant.id)).toEqual(['classic', 'modern'])
    expect(result.variants[0]?.presetCount).toBe(1)
    expect(result.variants[0]?.gameSets[0]?.label).toBe('Red / Blue')
    expect(result.variants[0]?.gameSets[0]?.presets[0]?.label).toBe('Sample')
    expect(result.variants[1]?.gameSets[1]?.presets[0]?.label).toBe('Modern')
  })

  it('loads selected classic preset editor data joined with its text', () => {
    serveFiles({
      [CLASSIC_RB]: {
        sample: createClassicPreset({ id: 'sample' }),
        sibling: createClassicPreset({ id: 'sibling' }),
      },
      [CLASSIC_RB_TEXT]: { sample: { ...classicText('Sample'), boxes: ['Starters'] } },
    })

    const result = loadBoxPresetEditorData({
      variant: 'classic',
      gameSet: 'rb',
      presetId: 'sample',
    })

    expect(result.variant).toBe('classic')
    expect(result.preset).toMatchObject({ id: 'sample', name: 'Sample' })
    expect(result.initialDraft.boxes[0]?.name).toBe('Starters')
    expect(result.initialDraft.boxes[0]?.cells).toHaveLength(30)
    expect(result.initialDraft.boxes[0]?.cells.slice(0, 3)).toEqual(['bulbasaur', null, null])
    // A preset without text falls back to its id rather than failing.
    expect(result.siblingPresets.map((preset) => [preset.id, preset.label])).toEqual([
      ['sample', 'Sample'],
      ['sibling', 'sibling'],
    ])
    expect(result.availablePokemon.map((pokemon) => pokemon.id)).toEqual(['bulbasaur', 'ivysaur'])
  })

  it('loads selected modern preset editor data from the modern preset path', () => {
    serveFiles({
      [MODERN_HOME_INDEX]: ['modern'],
      [MODERN_HOME_PRESET]: createModernPreset({
        id: 'modern',
        boxes: [{ slots: ['mew', { pokemon: 'mew', shiny: true }] }],
      }),
      [MODERN_HOME_TEXT]: { modern: modernText },
    })

    const result = loadBoxPresetEditorData({
      variant: 'modern',
      gameSet: 'home',
      presetId: 'modern',
    })

    expect(result.variant).toBe('modern')
    expect(result.preset).toMatchObject({ id: 'modern', name: 'Modern' })
    expect(result.initialDraft.boxes[0]?.name).toBe('Modern Box')
    expect(result.initialDraft.boxes[0]?.cells.slice(0, 3)).toEqual([
      'mew',
      { pokemonId: 'mew', shiny: true },
      null,
    ])
    expect(result.availablePokemon.map((pokemon) => pokemon.id)).toEqual(['mew'])
  })

  it('saves the classic record and its text without dropping siblings', async () => {
    const sibling = createClassicPreset({ id: 'sibling' })
    serveFiles({
      [CLASSIC_RB]: {
        sample: createClassicPreset({ id: 'sample', fullId: 'rb-sample' }),
        sibling,
      },
      [CLASSIC_RB_TEXT]: { sample: classicText('Sample'), sibling: classicText('Sibling') },
    })
    const draft = boxPresetToDraft(
      'classic',
      joinClassicBoxPreset(
        createClassicPreset({ id: 'sample', boxes: [{ pokemon: ['ivysaur', null] }] }),
        { name: 'Renamed', description: 'Preset description' },
      ),
    )

    const result = await saveBoxPresetFromForm(requestWithDraft(draft), {
      variant: 'classic',
      gameSet: 'rb',
      presetId: 'sample',
    })

    expect(result.success).toBe(true)
    expect(mocks.writeDatasetFile).toHaveBeenCalledTimes(1)
    const [records, path] = mocks.writeDatasetFile.mock.calls[0]!
    expect(path).toBe(CLASSIC_RB)
    expect(JSON.parse(JSON.stringify(records))).toEqual({
      sample: {
        id: 'sample',
        fullId: 'rb-sample',
        version: 1,
        gameSet: 'rb',
        boxes: [{ pokemon: ['ivysaur'] }],
      },
      sibling: JSON.parse(JSON.stringify(sibling)),
    })
    expect(mocks.updateTextFile).toHaveBeenCalledWith(CLASSIC_RB_TEXT, 'sample', {
      name: 'Renamed',
      description: 'Preset description',
    })
    expect(result.success && result.preset).toMatchObject({ id: 'sample', name: 'Renamed' })
    expect(result.success && result.draft.boxes[0]?.cells).toHaveLength(30)
  })

  it('saves the modern record and its text through the modern preset paths', async () => {
    serveFiles({
      [MODERN_HOME_INDEX]: ['modern'],
      [MODERN_HOME_PRESET]: createModernPreset({ id: 'modern' }),
      [MODERN_HOME_TEXT]: { modern: modernText },
    })
    const draft = boxPresetToDraft(
      'modern',
      joinModernBoxPreset(createModernPreset({ id: 'modern' }), modernText),
    )

    const result = await saveBoxPresetFromForm(requestWithDraft(draft), {
      variant: 'modern',
      gameSet: 'home',
      presetId: 'modern',
    })

    expect(result.success).toBe(true)
    const [record, path] = mocks.writeDatasetFile.mock.calls[0]!
    expect(path).toBe(MODERN_HOME_PRESET)
    expect(JSON.parse(JSON.stringify(record))).toEqual({
      schemaVersion: 2,
      id: 'modern',
      gameSet: 'home',
      boxes: [{ slots: ['mew'] }],
    })
    expect(mocks.updateTextFile).toHaveBeenCalledWith(MODERN_HOME_TEXT, 'modern', modernText)
  })

  it('rejects invalid variant, game set, and preset ids', async () => {
    const draft = boxPresetToDraft(
      'classic',
      joinClassicBoxPreset(createClassicPreset({ id: 'sample' }), classicText('Sample')),
    )

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

  it('rejects schema-invalid drafts without writing anything', async () => {
    const invalidDraft = boxPresetToDraft(
      'classic',
      joinClassicBoxPreset(createClassicPreset({ id: 'sample' }), classicText('Sample')),
    )
    invalidDraft.boxes = [{ cells: [{ pokemonId: 'Invalid ID' }] }]
    serveFiles({
      [CLASSIC_RB]: { sample: createClassicPreset({ id: 'sample' }) },
      [CLASSIC_RB_TEXT]: { sample: classicText('Sample') },
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
    expect(mocks.writeDatasetFile).not.toHaveBeenCalled()
    expect(mocks.updateTextFile).not.toHaveBeenCalled()
  })

  it('derives available storable Pokemon from game set and member games', () => {
    const result = loadAvailableStorablePokemonForGameSet(
      'rb',
      boxPresetToDraft(
        'classic',
        joinClassicBoxPreset(
          createClassicPreset({
            id: 'sample',
            boxes: [{ pokemon: ['bulbasaur', 'bulbasaur', null] }],
          }),
          classicText('Sample'),
        ),
      ),
    )

    expect(result.map((pokemon) => [pokemon.id, pokemon.placedCount])).toEqual([
      ['bulbasaur', 2],
      ['ivysaur', 0],
    ])
  })
})

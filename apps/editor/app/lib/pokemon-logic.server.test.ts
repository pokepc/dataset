import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAllGames: vi.fn(),
  loadAllPokemon: vi.fn(),
  readDatasetFile: vi.fn(),
  writeDatasetFile: vi.fn(),
  createSearchablePokemonList: vi.fn(),
  parseAvailability: vi.fn(),
}))

vi.mock('@pokepc/dataset/lib/fs', () => ({
  loadAllGames: mocks.loadAllGames,
  loadAllPokemon: mocks.loadAllPokemon,
  readDatasetFile: mocks.readDatasetFile,
  writeDatasetFile: mocks.writeDatasetFile,
}))

vi.mock('@pokepc/dataset/lib/search', () => ({
  createSearchablePokemonList: mocks.createSearchablePokemonList,
}))

vi.mock('@pokepc/dataset/lib/schemas', () => ({
  pokemonSchema: {
    pick: () => ({
      parse: mocks.parseAvailability,
    }),
  },
}))

import { loadPokemonEditorData, savePokemonAvailabilityFromForm } from './pokemon-logic.server'

function createGame(overrides: Partial<Pkds.Game> & Pick<Pkds.Game, 'id'>): Pkds.Game {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    gen: overrides.gen ?? 1,
    type: overrides.type ?? 'game',
    gameSet: overrides.gameSet,
  } as Pkds.Game
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
    forms: overrides.forms,
    baseSpecies: overrides.baseSpecies,
    hasGenderDifferences: overrides.hasGenderDifferences ?? false,
    isFemaleForm: overrides.isFemaleForm ?? false,
    isBattleOnlyForm: overrides.isBattleOnlyForm ?? false,
  } as Pkds.Pokemon
}

describe('pokemon-logic.server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseAvailability.mockImplementation((value) => value)
    mocks.createSearchablePokemonList.mockImplementation((pokemon: Pkds.Pokemon[]) =>
      pokemon.map((item) => ({
        ...item,
        name: item.names.eng ?? item.id,
        searchableText: `${item.id} search`,
      })),
    )
  })

  it('loadPokemonEditorData filters pokemon by dex range and maps game option modes', () => {
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'gen1', type: 'set' }),
      createGame({ id: 'red', type: 'game', gameSet: 'gen1' }),
      createGame({ id: 'go', type: 'game' }),
      createGame({ id: 'national', type: 'superset' }),
    ])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({ id: 'bulbasaur', nid: '1', dexNum: 1, debutIn: 'gen1' }),
      createPokemon({ id: 'farfuture', nid: '2000', dexNum: 2000, debutIn: 'go' }),
    ])

    const result = loadPokemonEditorData()

    expect(result.pokemon.map((item) => item.id)).toEqual(['bulbasaur'])
    expect(result.gameOptions).toEqual([
      {
        id: 'gen1',
        label: 'gen1',
        image: 'https://static.pokepc.net/images/games/gametiles/gen1.webp?v=poke30',
        modes: ['gamesets'],
      },
      {
        id: 'red',
        label: 'red',
        image: 'https://static.pokepc.net/images/games/gametiles/red.webp?v=poke30',
        modes: ['games'],
      },
      {
        id: 'go',
        label: 'go',
        image: 'https://static.pokepc.net/images/games/gametiles/go.webp?v=poke30',
        modes: ['games', 'gamesets'],
      },
    ])
    expect(result.gameIdOrder).toEqual(['red', 'go'])
  })

  it('savePokemonAvailabilityFromForm normalizes payloads and writes updated pokemon', () => {
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'gen1', type: 'set' }),
      createGame({ id: 'gen2', type: 'set' }),
      createGame({ id: 'red', type: 'game', gameSet: 'gen1' }),
      createGame({ id: 'gold', type: 'game', gameSet: 'gen2' }),
    ])

    const currentPokemon = createPokemon({
      id: 'pikachu',
      nid: '25',
      dexNum: 25,
      debutIn: 'gen1',
      obtainableIn: ['red'],
      storableIn: ['red'],
      shinyLockedIn: ['red'],
    })

    mocks.readDatasetFile.mockReturnValue(structuredClone(currentPokemon))

    const formData = new FormData()
    formData.set('intent', 'save-availability')
    formData.set('pokemonId', 'pikachu')
    formData.set(
      'availability',
      JSON.stringify({
        debutIn: 'gen2',
        obtainableIn: ['gold', 'gold', 'unknown'],
        storableIn: ['gold', 'red', 'red'],
        transferOnlyIn: ['red', 1],
        eventOnlyIn: [],
        shinyLockedIn: [],
      }),
    )

    const result = savePokemonAvailabilityFromForm(formData)

    expect(result).toEqual({
      success: true,
      pokemonId: 'pikachu',
      availability: {
        debutIn: 'gen2',
        obtainableIn: ['gold'],
        storableIn: ['red', 'gold'],
        transferOnlyIn: ['red'],
        eventOnlyIn: [],
        shinyLockedIn: [],
      },
    })
    expect(mocks.writeDatasetFile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pikachu',
        debutIn: 'gen2',
        obtainableIn: ['gold'],
        storableIn: ['red', 'gold'],
        transferOnlyIn: ['red'],
        eventOnlyIn: [],
        shinyLockedIn: undefined,
      }),
      'pokemon/pikachu.json',
      false,
    )
  })

  it('savePokemonAvailabilityFromForm rejects invalid payload JSON', () => {
    const formData = new FormData()
    formData.set('intent', 'save-availability')
    formData.set('pokemonId', 'pikachu')
    formData.set('availability', '{not-json}')

    const result = savePokemonAvailabilityFromForm(formData)

    expect(result).toEqual({
      success: false,
      error: 'Invalid availability payload.',
    })
    expect(mocks.readDatasetFile).not.toHaveBeenCalled()
    expect(mocks.writeDatasetFile).not.toHaveBeenCalled()
  })
})

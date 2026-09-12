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

import {
  loadGameAvailabilityEditorData,
  loadGamesIndexData,
  saveGameAvailabilityFromForm,
} from './games-logic.server'

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

describe('games-logic.server', () => {
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

  it('loadGamesIndexData maps dataset games into card data', () => {
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'red', name: 'Pokemon Red', gen: 1 }),
      createGame({ id: 'blue', name: 'Pokemon Blue', gen: 1 }),
    ])

    const result = loadGamesIndexData()

    expect(result.games).toEqual([
      {
        id: 'red',
        gen: 1,
        label: 'Pokemon Red',
        image: 'https://static.pokepc.net/images/games/gametiles/red.webp?v=poke30',
      },
      {
        id: 'blue',
        gen: 1,
        label: 'Pokemon Blue',
        image: 'https://static.pokepc.net/images/games/gametiles/blue.webp?v=poke30',
      },
    ])
  })

  it('loadGameAvailabilityEditorData derives availability and helper lists for a game', () => {
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'gen1', name: 'Gen 1', gen: 1, type: 'set' }),
      createGame({ id: 'red', name: 'Pokemon Red', gen: 1, type: 'game', gameSet: 'gen1' }),
      createGame({ id: 'gold', name: 'Pokemon Gold', gen: 2, type: 'game' }),
    ])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({
        id: 'pikachu',
        nid: '25',
        dexNum: 25,
        gen: 1,
        debutIn: 'red',
        obtainableIn: ['red'],
        storableIn: ['red'],
        hasGenderDifferences: true,
        forms: ['pikachu-f'],
      }),
      createPokemon({
        id: 'pikachu-f',
        nid: '25-f',
        dexNum: 25,
        gen: 1,
        debutIn: 'red',
        obtainableIn: [],
        storableIn: [],
        baseSpecies: 'pikachu',
        hasGenderDifferences: true,
        isFemaleForm: true,
      }),
      createPokemon({
        id: 'mew',
        nid: '151',
        dexNum: 151,
        gen: 1,
        debutIn: 'gen1',
        obtainableIn: [],
        storableIn: [],
        eventOnlyIn: ['red'],
        shinyLockedIn: ['red'],
      }),
      createPokemon({
        id: 'zygarde',
        nid: '718',
        dexNum: 718,
        gen: 6,
        debutIn: 'gold',
        obtainableIn: ['gold'],
        storableIn: ['gold'],
        isBattleOnlyForm: true,
      }),
    ])

    const result = loadGameAvailabilityEditorData('red')

    expect(result.game).toEqual({
      id: 'red',
      label: 'Pokemon Red',
      image: 'https://static.pokepc.net/images/games/gametiles/red.webp?v=poke30',
      gen: 1,
    })
    expect(result.allowedPokemonIdsForGame).toEqual(['pikachu', 'pikachu-f', 'mew'])
    expect(result.battleOnlyPokemonIdsForGame).toEqual([])
    expect(result.femaleFormByPokemonId).toEqual({ pikachu: 'pikachu-f' })
    expect(result.initialAvailability).toEqual({
      debutedPokemon: ['pikachu', 'pikachu-f'],
      obtainablePokemon: ['pikachu'],
      storablePokemon: ['pikachu'],
      transferOnlyPokemon: [],
      shinyLockedPokemon: ['mew'],
      eventOnlyPokemon: ['mew'],
    })
    expect(result.availabilityByGameId.red).toEqual(result.initialAvailability)
    expect(result.pokemonOptions).toEqual([
      {
        id: 'pikachu',
        label: 'pikachu',
        image: 'https://static.pokepc.net/images/pokemon/home3d-icon/regular/25.webp',
        dexNum: 25,
        searchableText: 'pikachu search',
      },
      {
        id: 'pikachu-f',
        label: 'pikachu-f',
        image: 'https://static.pokepc.net/images/pokemon/home3d-icon/regular/25-f.webp',
        dexNum: 25,
        searchableText: 'pikachu-f search',
      },
      {
        id: 'mew',
        label: 'mew',
        image: 'https://static.pokepc.net/images/pokemon/home3d-icon/regular/151.webp',
        dexNum: 151,
        searchableText: 'mew search',
      },
      {
        id: 'zygarde',
        label: 'zygarde',
        image: 'https://static.pokepc.net/images/pokemon/home3d-icon/regular/718.webp',
        dexNum: 718,
        searchableText: 'zygarde search',
      },
    ])
  })

  it('loadGameAvailabilityEditorData does not cap allowed Pokemon by gen when game gen is 0 or lower', () => {
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'home', name: 'Pokemon HOME', gen: 0, type: 'game' }),
      createGame({ id: 'red', name: 'Pokemon Red', gen: 1, type: 'game' }),
    ])
    mocks.loadAllPokemon.mockReturnValue([
      createPokemon({
        id: 'pikachu',
        nid: '25',
        dexNum: 25,
        gen: 1,
        debutIn: 'red',
        obtainableIn: ['red'],
        storableIn: ['red', 'home'],
      }),
      createPokemon({
        id: 'gengar-mega',
        nid: '94-mega',
        dexNum: 94,
        gen: 6,
        debutIn: 'xy',
        obtainableIn: ['home'],
        storableIn: [],
        isBattleOnlyForm: true,
      }),
      createPokemon({
        id: 'ironjugulis',
        nid: '993',
        dexNum: 993,
        gen: 9,
        debutIn: 'sv',
        obtainableIn: ['home'],
        storableIn: ['home'],
      }),
    ])

    const result = loadGameAvailabilityEditorData('home')

    expect(result.allowedPokemonIdsForGame).toEqual(['pikachu', 'gengar-mega', 'ironjugulis'])
    expect(result.battleOnlyPokemonIdsForGame).toEqual(['gengar-mega'])
  })

  it('saveGameAvailabilityFromForm writes normalized changes back to affected pokemon', async () => {
    mocks.loadAllGames.mockReturnValue([
      createGame({ id: 'gen1', gen: 1, type: 'set' }),
      createGame({ id: 'gen2', gen: 2, type: 'set' }),
      createGame({ id: 'red', gen: 1, type: 'game', gameSet: 'gen1' }),
    ])

    const pokemonRecords = {
      alpha: createPokemon({
        id: 'alpha',
        debutIn: 'gen1',
        obtainableIn: ['gen1'],
        storableIn: ['gen1'],
        shinyLockedIn: ['gen1'],
      }),
      beta: createPokemon({
        id: 'beta',
        debutIn: 'gen1',
        transferOnlyIn: ['gen2'],
      }),
    }

    mocks.loadAllPokemon.mockReturnValue(Object.values(pokemonRecords))
    mocks.readDatasetFile.mockImplementation((path: string) => {
      const pokemonId = path.replace('pokemon/', '').replace('.json', '')
      return structuredClone(pokemonRecords[pokemonId as keyof typeof pokemonRecords])
    })

    const writes: Array<{ path: string; data: Pkds.Pokemon }> = []
    mocks.writeDatasetFile.mockImplementation((data: Pkds.Pokemon, path: string) => {
      writes.push({ data, path })
    })

    const draft = {
      debutedPokemon: [],
      obtainablePokemon: ['beta'],
      storablePokemon: ['beta'],
      transferOnlyPokemon: [],
      shinyLockedPokemon: [],
      eventOnlyPokemon: [],
    }

    const formData = new FormData()
    formData.set('intent', 'save-game-availability')
    formData.set('gameId', 'gen1')
    formData.set('draft', JSON.stringify(draft))
    formData.set(
      'baseline',
      JSON.stringify({
        debutedPokemon: ['alpha', 'beta'],
        obtainablePokemon: ['alpha'],
        storablePokemon: ['alpha'],
        transferOnlyPokemon: [],
        shinyLockedPokemon: ['alpha'],
        eventOnlyPokemon: [],
      }),
    )

    const result = await saveGameAvailabilityFromForm(
      new Request('http://localhost/games/gen1', { method: 'POST', body: formData }),
      { id: 'gen1' },
    )

    expect(result).toEqual({
      success: true,
      availability: draft,
      updatedPokemonCount: 2,
    })
    expect(writes).toHaveLength(2)
    expect(writes).toContainEqual({
      path: 'pokemon/alpha.json',
      data: expect.objectContaining({
        id: 'alpha',
        debutIn: 'gen2',
        obtainableIn: [],
        storableIn: [],
        shinyLockedIn: undefined,
      }),
    })
    expect(writes).toContainEqual({
      path: 'pokemon/beta.json',
      data: expect.objectContaining({
        id: 'beta',
        debutIn: 'gen2',
        obtainableIn: ['gen1'],
        storableIn: ['gen1'],
        transferOnlyIn: ['gen2'],
      }),
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAllPokemon: vi.fn(),
  loadAllGames: vi.fn(),
  loadAvailabilitySource: vi.fn(),
}))
vi.mock('@pokepc/dataset/lib/fs', () => ({
  absDatasetFile: () => '/tmp/editor-fixture/data',
  loadAllPokemon: mocks.loadAllPokemon,
  loadAllGames: mocks.loadAllGames,
}))
vi.mock('@pokepc/dataset/lib/availability-sources', () => ({
  loadAvailabilitySource: mocks.loadAvailabilitySource,
}))

import { loadPokemonAvailabilitySource } from './availability-sources.server'

const female = { id: 'sneasel-hisui-f', dexNum: 215 }
const male = { id: 'sneasel-hisui', dexNum: 215 }
const other = { id: 'pikachu', dexNum: 25 }
const games = [{ id: 'la', type: 'game' }]

describe('availability source requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadAllPokemon.mockReturnValue([female, male, other])
    mocks.loadAllGames.mockReturnValue(games)
  })

  it('rejects unknown source and Pokemon identifiers before requesting an upstream', async () => {
    for (const query of [
      'source=unknown&pokemonId=pikachu',
      'source=bulbapedia&pokemonId=../../secrets',
      'source=pokeapi',
    ]) {
      expect(
        await loadPokemonAvailabilitySource(
          new Request(`http://localhost/availability-sources?${query}`),
        ),
      ).toMatchObject({ ok: false })
    }
    expect(mocks.loadAvailabilitySource).not.toHaveBeenCalled()
  })

  it('passes exact selected form, sibling context, refresh and request cancellation', async () => {
    const request = new Request(
      'http://localhost/availability-sources?source=bulbapedia&pokemonId=sneasel-hisui-f&refresh=1',
    )
    const result = { sourceId: 'bulbapedia', pokemonId: female.id, rows: [] }
    mocks.loadAvailabilitySource.mockResolvedValue(result)
    expect(await loadPokemonAvailabilitySource(request)).toEqual({ ok: true, result })
    expect(mocks.loadAvailabilitySource).toHaveBeenCalledWith(
      'bulbapedia',
      female,
      games,
      expect.objectContaining({
        signal: request.signal,
        refresh: true,
        siblings: [female, male],
      }),
    )
  })

  it('returns a recoverable source error without losing its cause', async () => {
    mocks.loadAvailabilitySource.mockRejectedValue(new Error('Serebii returned HTTP 503'))
    expect(
      await loadPokemonAvailabilitySource(
        new Request('http://localhost/availability-sources?source=serebii&pokemonId=pikachu'),
      ),
    ).toEqual({
      ok: false,
      error: 'Serebii returned HTTP 503',
    })
  })

  it('does not turn cancellation into a source failure', async () => {
    const controller = new AbortController()
    const request = new Request(
      'http://localhost/availability-sources?source=pokeapi&pokemonId=pikachu',
      { signal: controller.signal },
    )
    mocks.loadAvailabilitySource.mockImplementation(() => {
      controller.abort()
      throw new Error('Request cancelled')
    })
    await expect(loadPokemonAvailabilitySource(request)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

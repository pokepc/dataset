import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import red from '../../data/games/rb-r.json'
import { gameSchema } from '../lib/schemas'
import {
  addGameReferences,
  createGameReferenceMapper,
  fetchVersionGroups,
} from './oneoff-add-pokeapi-game-ids'
import * as client from '../upstream-adapters/pokeapi/client'

const group = (id: number, name: string, versions: [number, string][]) => ({
  id,
  name,
  versions: versions.map(([id, name]) => ({
    name,
    url: `https://pokeapi.co/api/v2/version/${id}/`,
  })),
})
const groups = [
  group(1, 'red-blue', [
    [1, 'red'],
    [2, 'blue'],
  ]),
  group(2, 'yellow', [[3, 'yellow']]),
  group(13, 'xd', [[20, 'xd']]),
  group(14, 'black-2-white-2', [
    [21, 'black-2'],
    [22, 'white-2'],
  ]),
  group(15, 'x-y', [
    [23, 'x'],
    [24, 'y'],
  ]),
  group(19, 'lets-go-pikachu-lets-go-eevee', [
    [31, 'lets-go-pikachu'],
    [32, 'lets-go-eevee'],
  ]),
  group(21, 'the-isle-of-armor', [
    [35, 'the-isle-of-armor-sword'],
    [50, 'the-isle-of-armor-shield'],
  ]),
  group(31, 'mega-dimension', [[48, 'mega-dimension']]),
  group(32, 'champions', [[49, 'champions']]),
]
const map = createGameReferenceMapper(groups)

afterEach(() => vi.restoreAllMocks())

describe('PokéAPI game reference mapping', () => {
  it.each([
    ['rb-r', 'red', 'game', 1, 1],
    ['rb-b', 'blue', 'game', 2, 1],
    ['rb', 'red-blue', 'set', null, 1],
    ['y', 'yellow', 'game', 3, 2],
    ['xy-y', 'y', 'game', 24, 15],
    ['xd', 'xd-gale-of-darkness', 'game', 20, 13],
    ['b2w2', 'black2-white2', 'set', null, 14],
    ['b2w2-b2', 'black2', 'game', 21, 14],
    ['b2w2-w2', 'white2', 'game', 22, 14],
    ['lgpe', 'letsgo-pikachu-letsgo-eevee', 'set', null, 19],
    ['lgpe-lgp', 'letsgo-pikachu', 'game', 31, 19],
    ['lgpe-lge', 'letsgo-eevee', 'game', 32, 19],
    ['swsh-islearmor', 'the-isle-of-armor', 'dlc', null, 21],
    ['lza-megadimension', 'legends-za-megadimension', 'dlc', 48, 31],
    ['champions', 'champions', 'game', 49, 32],
    ['rby', 'red-blue-yellow', 'superset', null, null],
    ['go', 'go', 'game', null, null],
    ['home', 'home', 'game', null, null],
    ['wiwa-wi', 'winds', 'game', null, null],
  ] as const)('maps %s without guessing numeric IDs', (id, nameSlug, type, version, group) => {
    expect(map({ id, nameSlug, type })).toEqual({
      pokeApiGameVersionId: version,
      pokeApiGameVersionGroupId: group,
    })
  })

  it('keeps international Red/Blue distinct from Japanese releases', () => {
    const mapper = createGameReferenceMapper([
      groups[0],
      group(28, 'red-green-japan', [
        [44, 'red-japan'],
        [45, 'green-japan'],
      ]),
      group(29, 'blue-japan', [[46, 'blue-japan']]),
    ])
    expect(mapper({ id: 'rb-b', nameSlug: 'blue', type: 'game' }).pokeApiGameVersionId).toBe(2)
  })

  it('rejects ambiguous or malformed upstream data', () => {
    expect(() => createGameReferenceMapper([])).toThrow('No PokéAPI')
    expect(() => createGameReferenceMapper([groups[0], groups[0]])).toThrow('Duplicate')
    expect(() =>
      createGameReferenceMapper([groups[0], group(999, 'duplicate', [[1, 'red']])]),
    ).toThrow('Duplicate')
    expect(() =>
      createGameReferenceMapper([
        { ...groups[0], versions: [{ name: 'red', url: 'https://pokeapi.co/api/v2/pokemon/1/' }] },
      ]),
    ).toThrow('Invalid')
  })
})

describe('version-group fetching', () => {
  it('uses the existing cached client and validates resource identities', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetch = vi.spyOn(client, 'fetchPokeApiJson').mockImplementation(async (url) => {
      if (url instanceof URL)
        return {
          count: 1,
          results: [{ name: 'red-blue', url: 'https://pokeapi.co/api/v2/version-group/1/' }],
        }
      return groups[0]
    })
    expect(await fetchVersionGroups({ forceRefresh: true })).toEqual([groups[0]])
    expect(fetch).toHaveBeenLastCalledWith('version-group/1', { forceRefresh: true })
  })

  it('rejects incomplete indexes and mismatched group identities', async () => {
    const index = {
      count: 2,
      results: [{ name: 'red-blue', url: 'https://pokeapi.co/api/v2/version-group/1/' }],
    }
    const fetch = vi.spyOn(client, 'fetchPokeApiJson').mockResolvedValue(index)
    await expect(fetchVersionGroups()).rejects.toThrow('incomplete')
    fetch
      .mockReset()
      .mockResolvedValueOnce({ ...index, count: 1 })
      .mockResolvedValueOnce(groups[1])
    await expect(fetchVersionGroups()).rejects.toThrow('identity mismatch')
  })
})

async function withGames(
  run: (directory: string, files: string[], originals: string[]) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), 'pokepc-game-ids-'))
  try {
    await mkdir(join(directory, 'indices'))
    await mkdir(join(directory, 'games'))
    const old: Record<string, unknown> = { ...red, unrelated: { keep: true } }
    delete old.pokeApiGameVersionId
    delete old.pokeApiGameVersionGroupId
    const records = [old, { ...old, id: 'rb-b', name: 'Blue', nameSlug: 'blue' }]
    const files = records.map((record) => join(directory, 'games', `${record.id}.json`))
    const originals = records.map((record) => JSON.stringify(record))
    await writeFile(join(directory, 'indices/games.json'), JSON.stringify(['rb-r', 'rb-b']))
    for (const [index, file] of files.entries()) await writeFile(file, originals[index])
    await run(directory, files, originals)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('one-off game ID migration', () => {
  it('previews without writes, preserves other properties, formats, and is idempotent', async () => {
    await withGames(async (directory, files, originals) => {
      expect((await addGameReferences(directory, groups)).changed).toBe(2)
      expect(await Promise.all(files.map((file) => readFile(file, 'utf8')))).toEqual(originals)
      expect((await addGameReferences(directory, groups, true)).changed).toBe(2)
      const text = await readFile(files[0], 'utf8')
      expect(text).toMatch(/^\{\n  "id": "rb-r"/)
      expect(JSON.parse(text)).toEqual({
        ...JSON.parse(originals[0]),
        pokeApiGameVersionId: 1,
        pokeApiGameVersionGroupId: 1,
      })
      expect((await addGameReferences(directory, groups, true)).changed).toBe(0)
    })
  })

  it('validates the whole batch before writing and refuses existing ID conflicts', async () => {
    await withGames(async (directory, files, originals) => {
      const conflict = JSON.stringify({ ...JSON.parse(originals[1]), pokeApiGameVersionId: 999 })
      await writeFile(files[1], conflict)
      await expect(addGameReferences(directory, groups, true)).rejects.toThrow(
        'Conflicting pokeApiGameVersionId',
      )
      expect(await readFile(files[0], 'utf8')).toBe(originals[0])
      expect(await readFile(files[1], 'utf8')).toBe(conflict)
    })
  })

  it.each([0, -1, 1.5, '1', undefined])('rejects invalid game reference IDs: %s', (value) => {
    const schema = gameSchema.pick({ pokeApiGameVersionId: true, pokeApiGameVersionGroupId: true })
    expect(
      schema.safeParse({ pokeApiGameVersionId: value, pokeApiGameVersionGroupId: null }).success,
    ).toBe(false)
    expect(
      schema.safeParse({ pokeApiGameVersionId: null, pokeApiGameVersionGroupId: value }).success,
    ).toBe(false)
  })
})

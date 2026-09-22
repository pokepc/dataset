import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { main } from './cli'
import { patchPokemonFile } from './patch'
import * as availability from './availability'
import * as source from './fetch'
import pikachu from '../../../data/pokemon/pikachu.json'
import { format } from 'oxfmt'
import { mainPage, goPage } from './test-fixtures'

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url))
const games: availability.AvailabilityGame[] = [
  { id: 'rb-r', name: 'Red', gen: 1, type: 'game', gameSet: 'rb', gameSuperSet: null },
  { id: 'rb-b', name: 'Blue', gen: 1, type: 'game', gameSet: 'rb', gameSuperSet: null },
  { id: 'go', name: 'GO', gen: 7, type: 'game', gameSet: null, gameSuperSet: null },
  { id: 'home', name: 'HOME', gen: 8, type: 'game', gameSet: null, gameSuperSet: null },
]
const pokemon = {
  ...pikachu,
  obtainableIn: ['rb-b', 'home'],
  transferOnlyIn: ['rb-r'],
  eventOnlyIn: [],
  storableIn: ['rb-r', 'rb-b', 'home'],
  customField: { keep: true },
}

function reportFor(record: availability.AvailabilityPokemon): availability.AvailabilityReport {
  return {
    pokemon: record,
    gameOrder: games.map((game) => game.id),
    warnings: ['Fixture warning; storableIn is preserved.'],
    rows: games.map((game) => ({
      game,
      status: game.id === 'rb-b' ? 'unavailable' : 'obtainableIn',
      basis: game.id === 'home' ? 'dataset' : 'source',
      methods: [],
      storable: record.storableIn.includes(game.id),
    })),
  }
}

beforeEach(() => {
  vi.spyOn(source, 'fetchAvailabilityPage').mockImplementation(async (page) => `<h1>${page}</h1>`)
  vi.spyOn(availability, 'parseAvailabilityTables').mockImplementation((pages) => {
    if (!pages.main?.includes('<h1>main</h1>') || !pages.go?.includes('<h1>go</h1>'))
      throw new Error('Invalid tables')
    return {} as availability.AvailabilityTables
  })
  vi.spyOn(availability, 'createAvailabilityReport').mockImplementation((_tables, record) =>
    reportFor(record),
  )
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function withDataset(
  run: (directory: string, file: string, saved: string[]) => Promise<void>,
) {
  const directory = mkdtempSync(join(tmpdir(), 'pokepc-availability-cli-'))
  try {
    for (const name of ['indices', 'games', 'pokemon']) mkdirSync(join(directory, name))
    writeFileSync(join(directory, 'indices/pokemon.json'), JSON.stringify(['pikachu']))
    writeFileSync(
      join(directory, 'indices/games.json'),
      JSON.stringify(games.map((game) => game.id)),
    )
    for (const game of games)
      writeFileSync(join(directory, 'games', `${game.id}.json`), JSON.stringify(game))
    const file = join(directory, 'pokemon/pikachu.json')
    writeFileSync(file, JSON.stringify(pokemon))
    const saved = ['main', 'go'].map((page) => {
      const path = join(directory, `${page}.html`)
      writeFileSync(path, `<h1>${page}</h1>`)
      return path
    })
    await run(directory, file, saved)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const offline = (saved: string[]) => ['--html', saved[0], '--go-html', saved[1]]

describe('availability CLI', () => {
  it('prints parseable offline JSON using the real parser from any working directory', async () => {
    await withDataset(async (directory, _file, saved) => {
      writeFileSync(saved[0], mainPage())
      writeFileSync(saved[1], goPage())
      const result = spawnSync(process.execPath, [cli, '25', '--json', ...offline(saved)], {
        cwd: directory,
        encoding: 'utf8',
      })
      expect(result.status, result.stderr).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json.id).toBe('pikachu')
      expect(json.nid).toBe('0025')
      expect(json.obtainableIn).toContain('rb-r')
      expect(json.obtainableIn).toContain('go')
      expect(json.storableIn).toEqual(pikachu.storableIn)
      expect(result.stderr).toContain(availability.availabilityUrls.main)
      expect(result.stderr).toContain(availability.availabilityUrls.go)
    })
  })

  it('loads both lists once and preserves JSON stdout with source diagnostics on stderr', async () => {
    await withDataset(async (directory, file) => {
      const original = readFileSync(file, 'utf8')
      await main(['25', '--json'], directory)
      expect(source.fetchAvailabilityPage).toHaveBeenCalledTimes(2)
      expect(vi.mocked(source.fetchAvailabilityPage).mock.calls.map(([page]) => page)).toEqual([
        'main',
        'go',
      ])
      expect(availability.parseAvailabilityTables).toHaveBeenCalledExactlyOnceWith({
        main: '<h1>main</h1>',
        go: '<h1>go</h1>',
      })
      expect(availability.createAvailabilityReport).toHaveBeenCalledExactlyOnceWith(
        {},
        pokemon,
        games,
        [pokemon],
      )
      expect(console.log).toHaveBeenCalledOnce()
      expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual({
        id: 'pikachu',
        nid: '0025',
        obtainableIn: ['rb-r', 'go', 'home'],
        transferOnlyIn: [],
        eventOnlyIn: [],
        storableIn: pokemon.storableIn,
      })
      expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain(
        availability.availabilityUrls.go,
      )
      expect(readFileSync(file, 'utf8')).toBe(original)
    })
  })

  it('bypasses fetching and caching with both saved pages even when refresh is requested', async () => {
    await withDataset(async (directory, _file, saved) => {
      await main(['pikachu', '--json', '--refresh-sources', ...offline(saved)], directory)
      expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
      expect(availability.parseAvailabilityTables).toHaveBeenCalledExactlyOnceWith({
        main: '<h1>main</h1>',
        go: '<h1>go</h1>',
      })
    })
  })

  it('passes explicit refresh to both page fetches', async () => {
    await withDataset(async (directory) => {
      await main(['pikachu', '--refresh-sources'], directory)
      expect(source.fetchAvailabilityPage).toHaveBeenCalledWith('main', undefined, {
        forceRefresh: true,
      })
      expect(source.fetchAvailabilityPage).toHaveBeenCalledWith('go', undefined, {
        forceRefresh: true,
      })
    })
  })

  it.each([
    ['--html', 'main.html'],
    ['--go-html', 'go.html'],
  ])('rejects an unpaired saved page: %j', async (...flags) => {
    await expect(main(['pikachu', ...flags], '/nonexistent')).rejects.toThrow(
      'must be supplied together',
    )
    expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
  })

  it.each(
    [
      [],
      ['pikachu', 'raichu'],
      ['pikachu', '--unknown'],
      ['pikachu', '--with-ai'],
      ['pikachu', '--ai-harder'],
      ['pikachu', '--no-cross-check'],
      ['not-a-pokemon'],
    ].map((args) => ({ args })),
  )('rejects invalid or removed arguments %j', ({ args }) => {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).not.toBe('')
  })

  it('shows help without loading data or sources', async () => {
    await main(['--help'], '/nonexistent')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No AI or API key'))
    expect(source.fetchAvailabilityPage).not.toHaveBeenCalled()
  })
})

describe('patching availability', () => {
  it.each([{ extra: [] }, { extra: ['--json'] }])(
    'patches and formats only availability while preserving unrelated data: %j',
    async ({ extra }) => {
      await withDataset(async (directory, file, saved) => {
        await main(['0025', '--patch', ...offline(saved), ...extra], directory)
        const written = readFileSync(file, 'utf8')
        expect(JSON.parse(written)).toEqual({
          ...pokemon,
          obtainableIn: ['rb-r', 'go', 'home'],
          transferOnlyIn: [],
        })
        const config = JSON.parse(
          readFileSync(new URL('../../../.oxfmtrc.json', import.meta.url), 'utf8'),
        )
        expect((await format(file, written, config)).code).toBe(written)
        expect(readdirSync(join(directory, 'pokemon'))).toEqual(['pikachu.json'])
        const summary = vi.mocked(console.log).mock.calls.flat().join('\n')
        expect(summary).toContain('Patched and formatted:')
        expect(summary).toContain('Added: Red (rb-r), GO (go)')
        expect(summary).toContain('Removed: Blue (rb-b)')
        expect(summary).toContain('storableIn: unchanged')
        vi.mocked(console.log).mockClear()
        await main(['pikachu', '--patch', ...offline(saved)], directory)
        expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toContain('Already up to date:')
        expect(readFileSync(file, 'utf8')).toBe(written)
      })
    },
  )

  it('prints a terminal table without writing when --patch is absent', async () => {
    await withDataset(async (directory, file, saved) => {
      const original = readFileSync(file, 'utf8')
      await main(['pikachu', ...offline(saved)], directory)
      expect(readFileSync(file, 'utf8')).toBe(original)
      expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toContain('┌')
    })
  })

  it('preserves storage membership and ordering', async () => {
    await withDataset(async (directory, file, saved) => {
      writeFileSync(file, JSON.stringify({ ...pokemon, storableIn: ['home', 'rb-b', 'rb-r'] }))
      await main(['pikachu', '--patch', ...offline(saved)], directory)
      expect(JSON.parse(readFileSync(file, 'utf8')).storableIn).toEqual(['home', 'rb-b', 'rb-r'])
    })
  })

  it('does not print a candidate or modify the file when either saved source is malformed', async () => {
    await withDataset(async (directory, file, saved) => {
      const original = readFileSync(file, 'utf8')
      writeFileSync(saved[1], '<h1>Challenge page</h1>')
      await expect(main(['pikachu', '--patch', ...offline(saved)], directory)).rejects.toThrow(
        'Invalid tables',
      )
      expect(readFileSync(file, 'utf8')).toBe(original)
      expect(console.log).not.toHaveBeenCalled()
    })
  })

  it('does not overwrite availability edited after the lookup began', async () => {
    await withDataset(async (_directory, file) => {
      const report = reportFor(pokemon)
      writeFileSync(file, JSON.stringify({ ...pokemon, obtainableIn: ['rb-b'] }))
      const current = readFileSync(file, 'utf8')
      await expect(patchPokemonFile(file, report)).rejects.toThrow('changed during lookup')
      expect(readFileSync(file, 'utf8')).toBe(current)
    })
  })

  it('rejects a destination with a different identity', async () => {
    await withDataset(async (_directory, file) => {
      writeFileSync(file, JSON.stringify({ ...pokemon, nid: 'wrong' }))
      await expect(patchPokemonFile(file, reportFor(pokemon))).rejects.toThrow('does not match')
    })
  })
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DATASET_DIR, readJsonFile } from '../lib/fs'
import { writeMergedGameSets } from './build.ts'

const temporaryDirs: string[] = []
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('merged game set output', () => {
  it('writes /games/{set}/ only for sets with mods, following their rosters', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-merged-'))
    temporaryDirs.push(out)

    expect(await writeMergedGameSets(DATASET_DIR, out)).toEqual(['champions'])
    expect(fs.readdirSync(path.join(out, 'games'))).toEqual(['champions'])

    const roster = readJsonFile<{ pokemon: string[]; moves: string[] }>(
      path.join(DATASET_DIR, 'mods/champions/roster.json'),
    )
    const pokemonFiles = fs.readdirSync(path.join(out, 'games/champions/pokemon'))
    expect(pokemonFiles.map((file) => file.replace(/\.json$/, '')).sort()).toEqual(
      [...roster.pokemon].sort(),
    )
    const moves = readJsonFile<Array<{ id: string; pp: number }>>(
      path.join(out, 'games/champions/moves.json'),
    )
    expect(moves.map((move) => move.id).sort()).toEqual([...roster.moves].sort())
    expect(moves.find((move) => move.id === 'pound')?.pp).toBe(20)
    const text = readJsonFile<Record<string, { desc?: string }>>(
      path.join(out, 'games/champions/i18n/eng/moves.json'),
    )
    expect(text.ember?.desc).toBeTruthy()
  })
})

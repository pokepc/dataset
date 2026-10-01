import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const root = vi.hoisted(() => ({ dir: '' }))

vi.mock('@pokepc/dataset/lib/fs', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const abs = (file: string) => path.join(root.dir, file)
  return {
    absDatasetFile: abs,
    readDatasetFile: (file: string) => JSON.parse(fs.readFileSync(abs(file), 'utf8')),
    writeDatasetFile: (data: unknown, file: string) => {
      fs.mkdirSync(path.dirname(abs(file)), { recursive: true })
      fs.writeFileSync(abs(file), JSON.stringify(data, null, 2))
    },
    loadAllPokemon: () => [],
    loadText: (kind: string) => {
      const file = abs(`i18n/eng/${kind}.json`)
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
    },
  }
})

import { englishName, updateTextFile } from './dataset-text.server'

describe('dataset-text.server', () => {
  beforeEach(() => {
    root.dir = mkdtempSync(join(tmpdir(), 'editor-text-'))
  })
  afterEach(() => rmSync(root.dir, { recursive: true, force: true }))

  it('updates one entry while keeping sibling entries and their order', () => {
    const file = 'i18n/eng/pokedexes.json'
    updateTextFile(file, 'kanto', { name: 'Kanto' })
    updateTextFile(file, 'johto', { name: 'Johto' })
    updateTextFile(file, 'kanto', { name: 'Kanto Pokédex' })
    const read = () => JSON.parse(readFileSync(join(root.dir, file), 'utf8'))
    expect(Object.entries(read())).toEqual([
      ['kanto', { name: 'Kanto Pokédex' }],
      ['johto', { name: 'Johto' }],
    ])
    updateTextFile(file, 'kanto', undefined)
    expect(read()).toEqual({ johto: { name: 'Johto' } })
  })

  it('reads English names, falling back to the id', () => {
    writeFileSync(join(root.dir, 'placeholder'), '')
    updateTextFile('i18n/eng/games.json', 'rb', { name: 'Red / Blue' })
    expect(englishName('games', 'rb')).toBe('Red / Blue')
    expect(englishName('games', 'gs')).toBe('gs')
  })
})

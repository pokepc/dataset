import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { transformClassicBoxPreset, transformModernBoxPresets } from './box-preset-transform'

const validPokemonIds = new Set(['bulbasaur', 'ivysaur', 'venusaur', 'charizard'])

function makeDatasetDir(): string {
  const datasetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokepc-modern-presets-'))
  fs.mkdirSync(path.join(datasetDir, 'boxpresets', 'classic'), { recursive: true })
  return datasetDir
}

function writeClassicPresetFile(datasetDir: string) {
  fs.writeFileSync(
    path.join(datasetDir, 'boxpresets', 'classic', 'home.json'),
    JSON.stringify(
      {
        'grouped-region': {
          id: 'grouped-region',
          name: 'National: Grouped by Regions',
          version: 2,
          gameSet: 'home',
          description: 'Boxes are organized by region.',
          boxes: [
            {
              title: 'Kanto 1',
              pokemon: ['bulbasaur', 'ivysaur', 'greninja--battle-bond', null],
            },
          ],
        },
        minimal: {
          id: 'minimal',
          name: 'Minimal',
          version: 1,
          gameSet: 'home',
          description: 'Small preset.',
          boxes: [{ pokemon: ['venusaur'] }],
        },
        hidden: {
          id: 'hidden',
          name: 'Hidden',
          version: 1,
          gameSet: 'home',
          description: 'Hidden preset.',
          boxes: [{ pokemon: ['charizard'] }],
          isHidden: true,
        },
      },
      null,
      2,
    ),
  )
}

function readModernFile(datasetDir: string, relativePath: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(datasetDir, 'boxpresets', 'modern', relativePath), 'utf8'),
  )
}

describe('modern box preset transform', () => {
  let datasetDir: string | undefined

  afterEach(() => {
    if (datasetDir) {
      fs.rmSync(datasetDir, { recursive: true, force: true })
      datasetDir = undefined
    }
  })

  it('converts classic presets into an index and per-preset files', () => {
    datasetDir = makeDatasetDir()
    writeClassicPresetFile(datasetDir)

    const result = transformModernBoxPresets({ datasetDir, validPokemonIds })

    expect(result).toMatchObject({
      gameSets: ['home'],
      presetCount: 2,
    })
    expect(readModernFile(datasetDir, 'home.json')).toEqual(['grouped-region', 'minimal'])
    expect(
      fs.existsSync(path.join(datasetDir, 'boxpresets', 'modern', 'home', 'hidden.json')),
    ).toBe(false)
    expect(readModernFile(datasetDir, 'home/grouped-region.json')).toMatchObject({
      schemaVersion: 1,
      id: 'grouped-region',
      gameSet: 'home',
      source: {
        kind: 'classic',
        gameSet: 'home',
        presetId: 'grouped-region',
        version: 2,
      },
      tags: ['national', 'grouped'],
      boxes: [
        {
          name: 'Kanto 1',
          slots: ['bulbasaur', 'ivysaur', null, null],
        },
      ],
    })
  })

  it('produces deterministic output on repeated runs', () => {
    datasetDir = makeDatasetDir()
    writeClassicPresetFile(datasetDir)

    transformModernBoxPresets({ datasetDir, validPokemonIds })
    const first = fs.readFileSync(
      path.join(datasetDir, 'boxpresets', 'modern', 'home', 'grouped-region.json'),
      'utf8',
    )
    transformModernBoxPresets({ datasetDir, validPokemonIds })
    const second = fs.readFileSync(
      path.join(datasetDir, 'boxpresets', 'modern', 'home', 'grouped-region.json'),
      'utf8',
    )

    expect(second).toBe(first)
  })

  it('fails unknown pokemon ids that remain after sanitizing', () => {
    expect(() =>
      transformClassicBoxPreset(
        'home',
        {
          id: 'bad',
          name: 'Bad',
          version: 1,
          gameSet: 'home',
          description: 'Bad preset.',
          boxes: [{ pokemon: ['missingno'] }],
        },
        validPokemonIds,
      ),
    ).toThrow('Unknown Modern preset pokemon id "missingno"')
  })
})

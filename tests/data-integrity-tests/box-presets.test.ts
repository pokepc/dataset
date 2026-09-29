import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadAllGames } from '../../src/lib/fs'
import { modernBoxPresetIndexSchema, modernBoxPresetSchema } from '../../src/lib/schemas'

const presetsDir = path.resolve(import.meta.dirname, '../../data/boxpresets/modern')
const gamesById = new Map(loadAllGames().map((game) => [game.id, game]))

const presets = fs
  .readdirSync(presetsDir)
  .filter((file) => file.endsWith('.json'))
  .flatMap((file) => {
    const gameSet = file.replace(/\.json$/, '')
    const ids = modernBoxPresetIndexSchema.parse(
      JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf8')),
    )
    return ids.map((id) => {
      const preset = modernBoxPresetSchema.parse(
        JSON.parse(fs.readFileSync(path.join(presetsDir, gameSet, `${id}.json`), 'utf8')),
      )
      return { key: `${gameSet}/${id}`, gameSet, preset }
    })
  })

/** Presets of boxed games, where a preset is applied box by box and has to fit. */
const boxedPresets = presets.flatMap(({ key, gameSet, preset }) => {
  const game = gamesById.get(gameSet)
  if (!game?.maxBoxes || game.maxBoxes <= 1 || !game.maxBoxSize) return []
  const widestBox = Math.max(0, ...preset.boxes.map((box) => box.slots.length))
  const fits = preset.boxes.length <= game.maxBoxes && widestBox <= game.maxBoxSize
  return [
    {
      key,
      gameSet,
      fits,
      detail: `${preset.boxes.length}/${game.maxBoxes} boxes, ${widestBox}/${game.maxBoxSize} slots`,
    },
  ]
})

describe('prepared box preset capacity', () => {
  it('finds boxed-game presets to check', () => {
    expect(boxedPresets.length).toBeGreaterThan(50)
  })

  it.each(boxedPresets)('$key fits its game ($detail)', ({ fits }) => {
    expect(fits).toBe(true)
  })

  // These sets lost their overflowing presets (pokepc TASK-262) and must keep one that fits.
  it.each(['b2w2', 'bw', 'c', 'dp', 'gs', 'hgss', 'oras', 'pt', 'sm', 'usum', 'xy'])(
    '%s still offers a preset',
    (gameSet) => {
      expect(boxedPresets.some((entry) => entry.gameSet === gameSet)).toBe(true)
    },
  )
})

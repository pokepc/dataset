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

/**
 * Classic presets that already overflowed their game when they were copied. They cannot be
 * applied, and are kept only until stored preparedPresetId usage is checked before retiring
 * them (pokepc TASK-262). This list may only shrink: remove an entry when its preset is fixed or
 * retired, and never add one.
 */
const overflowingPendingRetirement = new Set([
  'b2w2/fully-sorted',
  'b2w2/fully-sorted-minimal',
  'b2w2/sorted-species',
  'b2w2/sorted-species-minimal',
  'bw/fully-sorted',
  'bw/fully-sorted-minimal',
  'bw/sorted-species',
  'bw/sorted-species-minimal',
  'c/sorted-species',
  'dp/fully-sorted',
  'dp/fully-sorted-minimal',
  'dp/sorted-species',
  'dp/sorted-species-minimal',
  'gs/sorted-species',
  'hgss/fully-sorted',
  'hgss/fully-sorted-minimal',
  'hgss/sorted-species',
  'hgss/sorted-species-minimal',
  'oras/sorted-species',
  'oras/sorted-species-minimal',
  'pt/fully-sorted',
  'pt/fully-sorted-minimal',
  'pt/sorted-species',
  'pt/sorted-species-minimal',
  'sm/fully-sorted',
  'sm/fully-sorted-minimal',
  'sm/sorted-species',
  'sm/sorted-species-minimal',
  'usum/fully-sorted',
  'usum/fully-sorted-minimal',
  'usum/sorted-species',
  'usum/sorted-species-minimal',
  'xy/sorted-species',
  'xy/sorted-species-minimal',
])

describe('prepared box preset capacity', () => {
  it('finds boxed-game presets to check', () => {
    expect(boxedPresets.length).toBeGreaterThan(50)
  })

  it.each(boxedPresets.filter(({ key }) => !overflowingPendingRetirement.has(key)))(
    '$key fits its game ($detail)',
    ({ fits }) => {
      expect(fits).toBe(true)
    },
  )

  it('keeps the pending-retirement list exact', () => {
    const overflowing = boxedPresets.filter(({ fits }) => !fits).map(({ key }) => key)
    expect(overflowing.sort()).toEqual([...overflowingPendingRetirement].sort())
  })

  it.each(['dp', 'pt', 'hgss', 'bw', 'b2w2', 'sm', 'usum'])(
    '%s offers a preset that fits',
    (gameSet) => {
      expect(boxedPresets.some((entry) => entry.gameSet === gameSet && entry.fits)).toBe(true)
    },
  )
})

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

const originMarkIds = new Set(
  (
    JSON.parse(
      fs.readFileSync(path.resolve(presetsDir, '../../originmarks.json'), 'utf8'),
    ) as Array<{
      id: string
    }>
  ).map((mark) => mark.id),
)
const presetsWithOrigin = presets.filter(({ preset }) => preset.origin)

describe('prepared box preset origin', () => {
  it.each(presetsWithOrigin)('$key names an existing game and its origin mark', ({ preset }) => {
    const origin = preset.origin!
    const game = gamesById.get(origin.game)
    expect(game, `game ${origin.game}`).toBeDefined()
    expect(originMarkIds.has(origin.originMark)).toBe(true)
    expect(origin.originMark).toBe(game?.originMark)
  })
})

const homeGiftPresets = presets.filter(
  ({ gameSet, preset }) => gameSet === 'home' && preset.id.startsWith('gift-'),
)

describe('HOME gift checklist presets', () => {
  it('offers one per gift game', () => {
    expect(homeGiftPresets.map(({ preset }) => preset.origin?.game).sort()).toEqual(
      ['bdsp', 'la', 'lgpe', 'lza', 'sv', 'swsh'].sort(),
    )
  })

  it.each(homeGiftPresets)('$key fits the Free plan and reads as a checklist', ({ preset }) => {
    const ids = preset.boxes.flatMap((box) => box.slots).filter((slot) => slot !== null)
    expect(ids.length).toBeLessThanOrEqual(2000)
    expect(new Set(ids).size).toBe(ids.length)
    expect(preset.description).toMatch(/does not guarantee/)
    expect(preset.boxes.every((box) => box.name)).toBe(true)
  })
})

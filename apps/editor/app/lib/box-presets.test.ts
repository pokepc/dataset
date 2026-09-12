import { describe, expect, it } from 'vitest'
import {
  applyBoxPresetDrop,
  boxPresetDraftToPersisted,
  boxPresetToDraft,
  canInsertEmptyBoxSlotAfter,
  canInsertEmptyBoxSlotAfterAcrossBoxes,
  cleanBoxPokemonId,
  compactBoxPresetBoxSlots,
  countChangedCells,
  ensureBoxCellCount,
  fillBoxPresetDraftCells,
  hasCompactableBoxSlots,
  getRepeatedBoxPokemonCellKeys,
  hasBoxPresetDraftChanges,
  hasUnsupportedBoxPokemonId,
  insertEmptyBoxSlotAfter,
  insertEmptyBoxSlotAfterAcrossBoxes,
  moveBoxPresetBox,
  moveBoxPresetBoxCell,
  normalizeBoxPresetDraft,
  removeBoxPresetBoxCell,
  summarizeBoxPresetDraft,
  updateBoxPresetBoxName,
  updateBoxPresetMetadata,
  type BoxPresetCellValue,
  type BoxPresetDragItem,
  type BoxPresetDraft,
} from './box-presets'

function createDraft(overrides?: Partial<BoxPresetDraft>): BoxPresetDraft {
  return {
    variant: 'classic',
    id: 'sample',
    name: 'Sample Preset',
    gameSet: 'rb',
    description: 'Sample preset',
    boxes: [
      {
        name: 'Box 1',
        cells: ['bulbasaur', 'ivysaur', null],
      },
      {
        name: 'Box 2',
        cells: [{ pokemonId: 'charizard', gmax: true, shinyLocked: true }, null],
      },
    ],
    metadata: {
      kind: 'classic',
      version: 1,
    },
    ...overrides,
  } as BoxPresetDraft
}

function cellItem(
  pokemon: NonNullable<BoxPresetCellValue>,
  boxIndex: number,
  cellIndex: number,
): BoxPresetDragItem {
  const pokemonId = typeof pokemon === 'string' ? pokemon : pokemon.pokemonId
  return {
    source: 'cell',
    pokemonId,
    pokemon,
    previewSize: { width: 48, height: 48 },
    sourceCell: { kind: 'cell', boxIndex, cellIndex },
  }
}

function drawerItem(pokemonId: string): BoxPresetDragItem {
  return {
    source: 'drawer',
    pokemonId,
    pokemon: pokemonId,
    previewSize: { width: 48, height: 48 },
  }
}

describe('box-presets', () => {
  it('normalizes drafts without expanding boxes to visual padding size', () => {
    const draft = normalizeBoxPresetDraft(createDraft())

    expect(draft.boxes[0]?.cells).toHaveLength(3)
    expect(ensureBoxCellCount(draft.boxes[0]!)).toHaveLength(30)
    expect(draft.boxes[0]?.cells).toHaveLength(3)
  })

  it('fills short boxes with editable empty cells up to game capacity', () => {
    const draft = fillBoxPresetDraftCells(createDraft(), 5)

    expect(draft.boxes[0]?.cells).toEqual(['bulbasaur', 'ivysaur', null, null, null])
    expect(draft.boxes[1]?.cells).toEqual([
      { pokemonId: 'charizard', gmax: true, shinyLocked: true },
      null,
      null,
      null,
      null,
    ])
  })

  it('converts classic presets to the shared editor draft shape', () => {
    const draft = boxPresetToDraft('classic', {
      id: 'sample',
      legacyId: 'legacy',
      name: 'Sample',
      version: 2,
      gameSet: 'rb',
      description: 'Classic description',
      boxes: [{ title: 'Box 1', pokemon: ['bulbasaur', { pid: 'charizard', gmax: true }] }],
      isHidden: true,
    })

    expect(draft).toMatchObject({
      variant: 'classic',
      gameSet: 'rb',
      boxes: [{ name: 'Box 1', cells: ['bulbasaur', { pokemonId: 'charizard', gmax: true }] }],
      metadata: { kind: 'classic', version: 2, legacyId: 'legacy', isHidden: true },
    })
  })

  it('converts modern presets to the shared editor draft shape', () => {
    const draft = boxPresetToDraft('modern', {
      schemaVersion: 1,
      id: 'modern',
      gameSet: 'home',
      name: 'Modern',
      description: 'Modern description',
      source: { kind: 'classic', gameSet: 'rb', presetId: 'sample', version: 1 },
      tags: ['recommended', 'forms'],
      boxes: [{ name: 'Modern Box', slots: ['mew', { pokemon: 'pikachu', shiny: true }] }],
    })

    expect(draft).toMatchObject({
      variant: 'modern',
      gameSet: 'home',
      boxes: [{ name: 'Modern Box', cells: ['mew', { pokemonId: 'pikachu', shiny: true }] }],
      metadata: {
        kind: 'modern',
        schemaVersion: 1,
        source: { kind: 'classic', gameSet: 'rb', presetId: 'sample', version: 1 },
        tags: ['recommended', 'forms'],
      },
    })
  })

  it('converts classic drafts back to legacy box preset records', () => {
    expect(boxPresetDraftToPersisted(createDraft())).toMatchObject({
      id: 'sample',
      version: 1,
      gameSet: 'rb',
      boxes: [
        { title: 'Box 1', pokemon: ['bulbasaur', 'ivysaur'] },
        { title: 'Box 2', pokemon: [{ pid: 'charizard', gmax: true, shinyLocked: true }] },
      ],
    })
  })

  it('preserves interior empty cells while trimming trailing empty cells on save', () => {
    const draft = createDraft({
      boxes: [{ name: 'Sparse Box', cells: ['bulbasaur', null, 'ivysaur', null, null] }],
    })

    expect(boxPresetDraftToPersisted(draft)).toMatchObject({
      boxes: [{ title: 'Sparse Box', pokemon: ['bulbasaur', null, 'ivysaur'] }],
    })
  })

  it('limits box titles to 16 characters', () => {
    const draft = updateBoxPresetBoxName(createDraft(), 0, '1234567890abcdefXYZ')

    expect(draft.boxes[0]?.name).toBe('1234567890abcdef')
  })

  it('moves boxes to the top or bottom of the preset', () => {
    const draft = createDraft({
      boxes: [
        { name: 'Box 1', cells: ['bulbasaur'] },
        { name: 'Box 2', cells: ['ivysaur'] },
        { name: 'Box 3', cells: ['venusaur'] },
      ],
    })

    const movedToTop = moveBoxPresetBox(draft, 2, 'first')
    const movedToBottom = moveBoxPresetBox(draft, 0, 'last')

    expect(movedToTop.boxes.map((box) => box.name)).toEqual(['Box 3', 'Box 1', 'Box 2'])
    expect(movedToBottom.boxes.map((box) => box.name)).toEqual(['Box 2', 'Box 3', 'Box 1'])
  })

  it('compacts box slots by moving empty gaps to the end', () => {
    const draft = createDraft({
      boxes: [
        {
          name: 'Sparse Box',
          cells: [null, 'bulbasaur', null, { pokemonId: 'charizard', gmax: true }, 'ivysaur', null],
        },
      ],
    })

    const compacted = compactBoxPresetBoxSlots(draft, 0)

    expect(compacted.boxes[0]?.cells).toEqual([
      'bulbasaur',
      { pokemonId: 'charizard', gmax: true },
      'ivysaur',
      null,
      null,
      null,
    ])
    expect(draft.boxes[0]?.cells[0]).toBeNull()
  })

  it('detects whether a box has empty gaps before Pokemon slots', () => {
    expect(hasCompactableBoxSlots({ cells: ['bulbasaur', null, 'ivysaur'] })).toBe(true)
    expect(hasCompactableBoxSlots({ cells: ['bulbasaur', 'ivysaur', null] })).toBe(false)
    expect(hasCompactableBoxSlots({ cells: [null, null] })).toBe(false)
  })

  it('moves a box cell to the first slot by displacing intervening cells', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', null, 'ivysaur', 'charizard', null] }],
    })

    const moved = moveBoxPresetBoxCell(draft, { kind: 'cell', boxIndex: 0, cellIndex: 3 }, 'first')

    expect(moved.boxes[0]?.cells).toEqual(['charizard', 'bulbasaur', null, 'ivysaur', null])
  })

  it('moves a box cell to the last slot by displacing intervening cells', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', null, 'ivysaur', 'charizard', null] }],
    })

    const moved = moveBoxPresetBoxCell(draft, { kind: 'cell', boxIndex: 0, cellIndex: 0 }, 'last')

    expect(moved.boxes[0]?.cells).toEqual([null, 'ivysaur', 'charizard', null, 'bulbasaur'])
  })

  it('moves a box cell up or down by removing and reinserting it', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', null, 'ivysaur', 'charizard', null] }],
    })

    const movedUp = moveBoxPresetBoxCell(draft, { kind: 'cell', boxIndex: 0, cellIndex: 2 }, 'up')
    const movedDown = moveBoxPresetBoxCell(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 2 },
      'down',
    )

    expect(movedUp.boxes[0]?.cells).toEqual(['bulbasaur', 'ivysaur', null, 'charizard', null])
    expect(movedDown.boxes[0]?.cells).toEqual(['bulbasaur', null, 'charizard', 'ivysaur', null])
  })

  it('removes a box cell without rearranging the remaining slots', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', 'ivysaur', 'charizard'] }],
    })

    const removed = removeBoxPresetBoxCell(draft, { kind: 'cell', boxIndex: 0, cellIndex: 1 })

    expect(removed.boxes[0]?.cells).toEqual(['bulbasaur', null, 'charizard'])
  })

  it('inserts an empty slot after a box cell when the box can grow', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', 'ivysaur', null, 'charizard'] }],
    })

    const updated = insertEmptyBoxSlotAfter(draft, { kind: 'cell', boxIndex: 0, cellIndex: 0 }, 5)

    expect(updated.boxes[0]?.cells).toEqual(['bulbasaur', null, 'ivysaur', null, 'charizard'])
  })

  it('moves a later empty slot after the selected box cell at full capacity', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', 'ivysaur', null, 'charizard', 'venusaur'] }],
    })

    const updated = insertEmptyBoxSlotAfter(draft, { kind: 'cell', boxIndex: 0, cellIndex: 0 }, 5)

    expect(updated.boxes[0]?.cells).toEqual(['bulbasaur', null, 'ivysaur', 'charizard', 'venusaur'])
  })

  it('adds another empty slot after an existing empty slot when later room exists', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', null, 'ivysaur', null, 'charizard'] }],
    })

    const updated = insertEmptyBoxSlotAfter(draft, { kind: 'cell', boxIndex: 0, cellIndex: 0 }, 5)

    expect(updated.boxes[0]?.cells).toEqual(['bulbasaur', null, null, 'ivysaur', 'charizard'])
  })

  it('detects whether an empty slot can be inserted after a box cell', () => {
    expect(canInsertEmptyBoxSlotAfter({ cells: ['bulbasaur', 'ivysaur'] }, 1, 3)).toBe(true)
    expect(canInsertEmptyBoxSlotAfter({ cells: ['bulbasaur', null, 'ivysaur', null] }, 0, 4)).toBe(
      true,
    )
    expect(canInsertEmptyBoxSlotAfter({ cells: ['bulbasaur', null, 'ivysaur'] }, 0, 3)).toBe(false)
    expect(canInsertEmptyBoxSlotAfter({ cells: ['bulbasaur', null, null] }, 0, 3)).toBe(false)
    expect(canInsertEmptyBoxSlotAfter({ cells: ['bulbasaur', 'ivysaur', null] }, 2, 3)).toBe(false)
    expect(canInsertEmptyBoxSlotAfter({ cells: ['bulbasaur', 'ivysaur', 'venusaur'] }, 0, 3)).toBe(
      false,
    )
  })

  it('inserts an empty slot after a box cell and pushes cells into later boxes', () => {
    const draft = createDraft({
      boxes: [
        { cells: ['bulbasaur', 'ivysaur', 'venusaur'] },
        { cells: ['charmander', 'charmeleon', 'charizard'] },
        { cells: ['squirtle'] },
      ],
    })

    const updated = insertEmptyBoxSlotAfterAcrossBoxes(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 1 },
      3,
    )

    expect(updated.boxes.map((box) => box.cells)).toEqual([
      ['bulbasaur', 'ivysaur', null],
      ['venusaur', 'charmander', 'charmeleon'],
      ['charizard', 'squirtle'],
    ])
  })

  it('stops pushing across boxes when it reaches a later empty slot', () => {
    const draft = createDraft({
      boxes: [
        { cells: ['bulbasaur', 'ivysaur', 'venusaur'] },
        { cells: ['charmander', null, 'charizard'] },
        { cells: ['squirtle'] },
      ],
    })

    const updated = insertEmptyBoxSlotAfterAcrossBoxes(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 0 },
      3,
    )

    expect(updated.boxes.map((box) => box.cells)).toEqual([
      ['bulbasaur', null, 'ivysaur'],
      ['venusaur', 'charmander', 'charizard'],
      ['squirtle'],
    ])
  })

  it('pushes down another empty slot after an existing empty slot', () => {
    const draft = createDraft({
      boxes: [{ cells: ['bulbasaur', null, 'ivysaur'] }, { cells: ['charmander', 'charmeleon'] }],
    })

    const updated = insertEmptyBoxSlotAfterAcrossBoxes(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 0 },
      3,
    )

    expect(updated.boxes.map((box) => box.cells)).toEqual([
      ['bulbasaur', null, null],
      ['ivysaur', 'charmander', 'charmeleon'],
    ])
  })

  it('detects whether an empty slot can be pushed down across boxes', () => {
    const draftWithLaterRoom = createDraft({
      boxes: [{ cells: ['bulbasaur', 'ivysaur'] }, { cells: ['charmander'] }],
    })
    const draftWithLaterEmptySlot = createDraft({
      boxes: [{ cells: ['bulbasaur', 'ivysaur'] }, { cells: ['charmander', null] }],
    })
    const draftWithExistingEmptyAndLaterRoom = createDraft({
      boxes: [{ cells: ['bulbasaur', null, 'ivysaur'] }, { cells: ['charmander'] }],
    })
    const draftWithExistingEmptyAndNoLaterRoom = createDraft({
      boxes: [{ cells: ['bulbasaur', null] }],
    })
    const fullDraft = createDraft({
      boxes: [{ cells: ['bulbasaur', 'ivysaur'] }, { cells: ['charmander', 'charmeleon'] }],
    })

    expect(
      canInsertEmptyBoxSlotAfterAcrossBoxes(
        draftWithLaterRoom,
        { kind: 'cell', boxIndex: 0, cellIndex: 0 },
        2,
      ),
    ).toBe(true)
    expect(
      canInsertEmptyBoxSlotAfterAcrossBoxes(
        draftWithLaterEmptySlot,
        { kind: 'cell', boxIndex: 0, cellIndex: 0 },
        2,
      ),
    ).toBe(true)
    expect(
      canInsertEmptyBoxSlotAfterAcrossBoxes(
        draftWithExistingEmptyAndLaterRoom,
        { kind: 'cell', boxIndex: 0, cellIndex: 0 },
        3,
      ),
    ).toBe(true)
    expect(
      canInsertEmptyBoxSlotAfterAcrossBoxes(
        draftWithExistingEmptyAndNoLaterRoom,
        { kind: 'cell', boxIndex: 0, cellIndex: 0 },
        2,
      ),
    ).toBe(false)
    expect(
      canInsertEmptyBoxSlotAfterAcrossBoxes(
        fullDraft,
        { kind: 'cell', boxIndex: 0, cellIndex: 0 },
        2,
      ),
    ).toBe(false)
  })

  it('converts modern drafts back to modern box preset records', () => {
    const draft = createDraft({
      variant: 'modern',
      id: 'modern',
      gameSet: 'home',
      metadata: {
        kind: 'modern',
        schemaVersion: 1,
        tags: ['recommended'],
      },
    })

    expect(boxPresetDraftToPersisted(draft)).toMatchObject({
      schemaVersion: 1,
      id: 'modern',
      gameSet: 'home',
      boxes: [
        { name: 'Box 1', slots: ['bulbasaur', 'ivysaur'] },
        {
          name: 'Box 2',
          slots: [{ pokemon: 'charizard', gmax: true, shinyLocked: true }],
        },
      ],
      tags: ['recommended'],
    })
  })

  it('swaps occupied cells', () => {
    const draft = createDraft()
    const result = applyBoxPresetDrop(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 0 },
      { kind: 'cell', boxIndex: 0, cellIndex: 1 },
      cellItem('bulbasaur', 0, 0),
    )

    expect(result.changed).toBe(true)
    expect(result.changedBoxIndices).toEqual([0])
    expect(result.draft.boxes[0]?.cells).toEqual(['ivysaur', 'bulbasaur', null])
  })

  it('moves an occupied cell into an empty stored cell', () => {
    const draft = createDraft()
    const result = applyBoxPresetDrop(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 0 },
      { kind: 'cell', boxIndex: 0, cellIndex: 2 },
      cellItem('bulbasaur', 0, 0),
    )

    expect(result.changed).toBe(true)
    expect(result.draft.boxes[0]?.cells).toEqual([null, 'ivysaur', 'bulbasaur'])
  })

  it('removes an occupied cell through the trash target', () => {
    const draft = createDraft()
    const result = applyBoxPresetDrop(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 1 },
      { kind: 'trash' },
      cellItem('ivysaur', 0, 1),
    )

    expect(result.changed).toBe(true)
    expect(result.draft.boxes[0]?.cells).toEqual(['bulbasaur', null, null])
  })

  it('inserts a drawer Pokemon into an empty stored cell', () => {
    const draft = createDraft()
    const result = applyBoxPresetDrop(
      draft,
      { kind: 'drawer', pokemonId: 'pikachu' },
      { kind: 'cell', boxIndex: 0, cellIndex: 2 },
      drawerItem('pikachu'),
    )

    expect(result.changed).toBe(true)
    expect(result.draft.boxes[0]?.cells).toEqual(['bulbasaur', 'ivysaur', 'pikachu'])
  })

  it('rejects drawer insertion into occupied cells', () => {
    const draft = createDraft()
    const result = applyBoxPresetDrop(
      draft,
      { kind: 'drawer', pokemonId: 'pikachu' },
      { kind: 'cell', boxIndex: 0, cellIndex: 0 },
      drawerItem('pikachu'),
    )

    expect(result.changed).toBe(false)
    expect(result.reason).toContain('empty cells')
    expect(result.draft).toBe(draft)
  })

  it('rejects visual-only padded targets without expanding stored cells', () => {
    const draft = createDraft()
    const result = applyBoxPresetDrop(
      draft,
      { kind: 'cell', boxIndex: 0, cellIndex: 0 },
      { kind: 'cell', boxIndex: 0, cellIndex: 29 },
      cellItem('bulbasaur', 0, 0),
    )

    expect(result.changed).toBe(false)
    expect(result.reason).toContain('visual padding')
    expect(result.draft.boxes[0]?.cells).toHaveLength(3)
  })

  it('preserves object-shaped cell values when moved or swapped', () => {
    const draft = createDraft()
    const sourcePokemon = draft.boxes[1]!.cells[0]!
    const result = applyBoxPresetDrop(
      draft,
      { kind: 'cell', boxIndex: 1, cellIndex: 0 },
      { kind: 'cell', boxIndex: 0, cellIndex: 2 },
      cellItem(sourcePokemon!, 1, 0),
    )

    expect(result.changed).toBe(true)
    expect(result.draft.boxes[0]?.cells[2]).toEqual({
      pokemonId: 'charizard',
      gmax: true,
      shinyLocked: true,
    })
    expect(result.draft.boxes[1]?.cells[0]).toBeNull()
  })

  it('summarizes placed, empty, and duplicate Pokemon counts', () => {
    const summary = summarizeBoxPresetDraft(
      createDraft({
        boxes: [{ cells: ['pikachu', 'pikachu', null] }, { cells: ['eevee'] }],
      }),
    )

    expect(summary).toEqual({
      boxCount: 2,
      storedCellCount: 4,
      placedPokemonCount: 3,
      emptyCellCount: 1,
      duplicatePokemonIds: ['pikachu'],
    })
  })

  it('marks only later repeated Pokemon cells in box order', () => {
    const draft = createDraft({
      boxes: [
        { cells: ['bulbasaur', 'ivysaur', 'bulbasaur'] },
        { cells: ['charizard', 'ivysaur', null] },
      ],
    })

    expect(Array.from(getRepeatedBoxPokemonCellKeys(draft))).toEqual(['0:2', '1:1'])
  })

  it('uses cleaned Pokemon ids when detecting repeated cells', () => {
    const draft = createDraft({
      boxes: [{ cells: ['rockruff', 'rockruff--own-tempo', 'zygarde-10--power-construct'] }],
    })

    expect(Array.from(getRepeatedBoxPokemonCellKeys(draft))).toEqual(['0:1'])
  })

  it('counts changed stored cells only', () => {
    const before = createDraft()
    const after = createDraft({
      boxes: [{ cells: ['ivysaur', 'bulbasaur', null] }, before.boxes[1]!],
    })

    expect(countChangedCells(before, after)).toBe(2)
  })

  it('detects preset metadata changes as draft changes without changed cells', () => {
    const before = createDraft()
    const after = updateBoxPresetMetadata(before, { description: 'Updated description' })

    expect(countChangedCells(before, after)).toBe(0)
    expect(hasBoxPresetDraftChanges(before, after)).toBe(true)
  })

  it('detects box title changes as draft changes without changed cells', () => {
    const before = createDraft()
    const after = updateBoxPresetBoxName(before, 0, 'Edited Box')

    expect(countChangedCells(before, after)).toBe(0)
    expect(hasBoxPresetDraftChanges(before, after)).toBe(true)
  })

  it('cleans unsupported legacy ids for lookup', () => {
    expect(cleanBoxPokemonId('zygarde--power-construct')).toBe('zygarde')
    expect(cleanBoxPokemonId({ pokemonId: 'pikachu', shiny: true })).toBe('pikachu')
    expect(cleanBoxPokemonId(null)).toBeNull()
  })

  it('detects unsupported double-dash Pokemon ids for UI warnings', () => {
    expect(hasUnsupportedBoxPokemonId('zygarde--power-construct')).toBe(true)
    expect(hasUnsupportedBoxPokemonId({ pokemonId: 'rockruff--own-tempo' })).toBe(true)
    expect(hasUnsupportedBoxPokemonId('zygarde-10')).toBe(false)
    expect(hasUnsupportedBoxPokemonId(null)).toBe(false)
  })
})

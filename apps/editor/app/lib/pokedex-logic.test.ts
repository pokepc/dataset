import { describe, expect, it } from 'vitest'
import {
  addMissingFormsToEntries,
  applyPokemonIsFormFlagsToEntries,
  applyNationalDexNumsToEntries,
  addPokemonToBatchAddQueue,
  appendPokedexEntry,
  appendPokedexEntries,
  BATCH_ADD_MODE_BELOW,
  createPokedexEntryDraft,
  createBatchAddDraft,
  createBatchAddEntryDrafts,
  cycleTriStateBooleanValue,
  getBatchAddPreviewEntries,
  hasPokedexDraftValidationErrors,
  insertPokedexEntryBelow,
  insertPokedexEntriesBelow,
  normalizePokedexDraft,
  removePokedexEntry,
  removePokemonFromBatchAddQueue,
  reorderPokedexEntries,
  syncBatchAddDraftDefaults,
  toPokedexDraft,
  TRI_STATE_FALSE,
  TRI_STATE_TRUE,
  TRI_STATE_UNSET,
  validateBatchAddDraft,
  validatePokedexDraft,
} from './pokedex-logic'

describe('pokedex-logic', () => {
  it('toPokedexDraft maps nullable and optional fields to editable strings', () => {
    const draft = toPokedexDraft({
      id: 'national',
      name: 'National Pokedex',
      shortDesc: undefined,
      desc: null,
      gen: 9,
      region: null,
      isNational: true,
      baseDex: null,
      pkApiId: null,
      entries: [
        {
          pid: 'pikachu',
          dexNum: 25,
          isForm: false,
          transferOnly: true,
          isNonCanonical: undefined,
          originDex: 'kanto',
          meta: { names: { eng: 'Pikachu' } },
        },
      ],
    } as Pkds.Pokedex)

    expect(draft.shortDesc).toBe('')
    expect(draft.desc).toBe('')
    expect(draft.region).toBe('')
    expect(draft.baseDex).toBe('')
    expect(draft.pkApiId).toBe('')
    expect(draft.entries[0]).toMatchObject({
      pid: 'pikachu',
      dexNum: '25',
      transferOnly: TRI_STATE_TRUE,
      isNonCanonical: TRI_STATE_UNSET,
      originDex: 'kanto',
    })
  })

  it('cycleTriStateBooleanValue loops unset -> true -> false -> unset', () => {
    expect(cycleTriStateBooleanValue(TRI_STATE_UNSET)).toBe(TRI_STATE_TRUE)
    expect(cycleTriStateBooleanValue(TRI_STATE_TRUE)).toBe(TRI_STATE_FALSE)
    expect(cycleTriStateBooleanValue(TRI_STATE_FALSE)).toBe(TRI_STATE_UNSET)
  })

  it('insertPokedexEntryBelow inserts directly after the target row', () => {
    const entries = [
      createPokedexEntryDraft('one', { pid: 'bulbasaur' }),
      createPokedexEntryDraft('two', { pid: 'ivysaur' }),
    ]
    const nextEntries = insertPokedexEntryBelow(
      entries,
      'one',
      createPokedexEntryDraft('three', { pid: 'venusaur' }),
    )

    expect(nextEntries.map((entry) => entry.clientId)).toEqual(['one', 'three', 'two'])
  })

  it('appendPokedexEntry adds a row at the bottom', () => {
    const entries = [createPokedexEntryDraft('one', { pid: 'bulbasaur' })]

    expect(
      appendPokedexEntry(entries, createPokedexEntryDraft('two', { pid: 'ivysaur' })).map(
        (entry) => entry.clientId,
      ),
    ).toEqual(['one', 'two'])
  })

  it('addMissingFormsToEntries inserts missing forms after each original row in dataset order', () => {
    let nextId = 0
    const entries = [
      createPokedexEntryDraft('one', { pid: 'pikachu', dexNum: 25 }),
      createPokedexEntryDraft('two', { pid: 'raichu', dexNum: 26 }),
      createPokedexEntryDraft('three', { pid: 'eevee', dexNum: 133 }),
      createPokedexEntryDraft('four', { pid: 'pikachu-belle', dexNum: 25, isForm: true }),
    ]

    const nextEntries = addMissingFormsToEntries(
      entries,
      {
        pikachu: ['pikachu-belle', 'pikachu-rock-star', 'pikachu-pop-star'],
        eevee: ['eevee-gmax'],
      },
      () => `generated-${++nextId}`,
    )

    expect(nextEntries).toEqual([
      {
        clientId: 'one',
        pid: 'pikachu',
        dexNum: '25',
        isForm: false,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'generated-1',
        pid: 'pikachu-rock-star',
        dexNum: '25',
        isForm: true,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'generated-2',
        pid: 'pikachu-pop-star',
        dexNum: '25',
        isForm: true,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'two',
        pid: 'raichu',
        dexNum: '26',
        isForm: false,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'three',
        pid: 'eevee',
        dexNum: '133',
        isForm: false,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'generated-3',
        pid: 'eevee-gmax',
        dexNum: '133',
        isForm: true,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'four',
        pid: 'pikachu-belle',
        dexNum: '25',
        isForm: true,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
    ])
  })

  it('applyNationalDexNumsToEntries copies national dex numbers from pokemon data', () => {
    const entries = [
      createPokedexEntryDraft('one', { pid: 'pikachu', dexNum: 111 }),
      createPokedexEntryDraft('two', { pid: 'raichu', dexNum: 222 }),
      createPokedexEntryDraft('three', { pid: 'missing', dexNum: 333 }),
    ]

    expect(
      applyNationalDexNumsToEntries(entries, {
        pikachu: 25,
        raichu: '26',
      }),
    ).toEqual([
      {
        clientId: 'one',
        pid: 'pikachu',
        dexNum: '25',
        isForm: false,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'two',
        pid: 'raichu',
        dexNum: '26',
        isForm: false,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'three',
        pid: 'missing',
        dexNum: '333',
        isForm: false,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
    ])
  })

  it('applyPokemonIsFormFlagsToEntries copies isForm flags from pokemon data', () => {
    const entries = [
      createPokedexEntryDraft('one', { pid: 'pikachu', isForm: true }),
      createPokedexEntryDraft('two', { pid: 'pikachu-belle', isForm: false }),
      createPokedexEntryDraft('three', { pid: 'missing', isForm: true }),
    ]

    expect(
      applyPokemonIsFormFlagsToEntries(entries, {
        pikachu: false,
        'pikachu-belle': true,
      }),
    ).toEqual([
      {
        clientId: 'one',
        pid: 'pikachu',
        dexNum: '',
        isForm: false,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'two',
        pid: 'pikachu-belle',
        dexNum: '',
        isForm: true,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'three',
        pid: 'missing',
        dexNum: '',
        isForm: true,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_UNSET,
        originDex: undefined,
        meta: undefined,
      },
    ])
  })

  it('getBatchAddPreviewEntries increments non-form dex numbers by one', () => {
    const previewEntries = getBatchAddPreviewEntries(
      createBatchAddDraft({
        queuedPokemonIds: ['bulbasaur', 'ivysaur', 'venusaur'],
        startingDexNum: '10',
        isForm: false,
        transferOnly: TRI_STATE_TRUE,
        isNonCanonical: TRI_STATE_FALSE,
      }),
    )

    expect(previewEntries).toEqual([
      {
        pid: 'bulbasaur',
        dexNum: 10,
        isForm: false,
        transferOnly: TRI_STATE_TRUE,
        isNonCanonical: TRI_STATE_FALSE,
      },
      {
        pid: 'ivysaur',
        dexNum: 11,
        isForm: false,
        transferOnly: TRI_STATE_TRUE,
        isNonCanonical: TRI_STATE_FALSE,
      },
      {
        pid: 'venusaur',
        dexNum: 12,
        isForm: false,
        transferOnly: TRI_STATE_TRUE,
        isNonCanonical: TRI_STATE_FALSE,
      },
    ])
  })

  it('getBatchAddPreviewEntries keeps the same dex number for form batches', () => {
    const previewEntries = getBatchAddPreviewEntries(
      createBatchAddDraft({
        queuedPokemonIds: ['pikachu', 'pikachu-rock-star', 'pikachu-belle'],
        startingDexNum: '25',
        isForm: true,
        transferOnly: TRI_STATE_UNSET,
        isNonCanonical: TRI_STATE_FALSE,
      }),
    )

    expect(previewEntries.map((entry) => entry.dexNum)).toEqual([25, 25, 25])
  })

  it('appendPokedexEntries appends a whole batch in order', () => {
    const entries = [createPokedexEntryDraft('one', { pid: 'bulbasaur' })]
    const nextEntries = [
      createPokedexEntryDraft('two', { pid: 'ivysaur' }),
      createPokedexEntryDraft('three', { pid: 'venusaur' }),
    ]

    expect(appendPokedexEntries(entries, nextEntries).map((entry) => entry.clientId)).toEqual([
      'one',
      'two',
      'three',
    ])
  })

  it('insertPokedexEntriesBelow inserts a whole batch directly after the anchor row', () => {
    const entries = [
      createPokedexEntryDraft('one', { pid: 'bulbasaur' }),
      createPokedexEntryDraft('two', { pid: 'charmander' }),
      createPokedexEntryDraft('three', { pid: 'squirtle' }),
    ]
    const nextEntries = [
      createPokedexEntryDraft('four', { pid: 'ivysaur' }),
      createPokedexEntryDraft('five', { pid: 'venusaur' }),
    ]

    expect(
      insertPokedexEntriesBelow(entries, 'one', nextEntries).map((entry) => entry.clientId),
    ).toEqual(['one', 'four', 'five', 'two', 'three'])
  })

  it('removePokedexEntry deletes only the requested row', () => {
    const entries = [
      createPokedexEntryDraft('one', { pid: 'bulbasaur' }),
      createPokedexEntryDraft('two', { pid: 'ivysaur' }),
      createPokedexEntryDraft('three', { pid: 'venusaur' }),
    ]

    expect(removePokedexEntry(entries, 'two').map((entry) => entry.clientId)).toEqual([
      'one',
      'three',
    ])
  })

  it('reorderPokedexEntries swaps the dragged row with the drop target row', () => {
    const entries = [
      createPokedexEntryDraft('one', { pid: 'bulbasaur' }),
      createPokedexEntryDraft('two', { pid: 'ivysaur' }),
      createPokedexEntryDraft('three', { pid: 'venusaur' }),
    ]

    expect(reorderPokedexEntries(entries, 0, 2).map((entry) => entry.clientId)).toEqual([
      'three',
      'two',
      'one',
    ])
  })

  it('syncBatchAddDraftDefaults derives the below-anchor starting dex number until manually edited', () => {
    const entries = [
      createPokedexEntryDraft('one', { pid: 'bulbasaur', dexNum: 3 }),
      createPokedexEntryDraft('two', { pid: 'ivysaur', dexNum: 9 }),
    ]

    const syncedDraft = syncBatchAddDraftDefaults(
      createBatchAddDraft({
        open: true,
        insertMode: BATCH_ADD_MODE_BELOW,
        anchorClientId: 'two',
      }),
      entries,
    )

    expect(syncedDraft.anchorClientId).toBe('two')
    expect(syncedDraft.startingDexNum).toBe('10')
  })

  it('createBatchAddEntryDrafts applies batch defaults to every inserted row', () => {
    let nextId = 0
    const nextEntries = createBatchAddEntryDrafts(
      createBatchAddDraft({
        queuedPokemonIds: ['pikachu', 'raichu'],
        startingDexNum: '25',
        isForm: true,
        transferOnly: TRI_STATE_FALSE,
        isNonCanonical: TRI_STATE_TRUE,
      }),
      () => `generated-${++nextId}`,
    )

    expect(nextEntries).toEqual([
      {
        clientId: 'generated-1',
        pid: 'pikachu',
        dexNum: '25',
        isForm: true,
        transferOnly: TRI_STATE_FALSE,
        isNonCanonical: TRI_STATE_TRUE,
        originDex: undefined,
        meta: undefined,
      },
      {
        clientId: 'generated-2',
        pid: 'raichu',
        dexNum: '25',
        isForm: true,
        transferOnly: TRI_STATE_FALSE,
        isNonCanonical: TRI_STATE_TRUE,
        originDex: undefined,
        meta: undefined,
      },
    ])
  })

  it('validateBatchAddDraft rejects empty queues and invalid numeric settings', () => {
    const validation = validateBatchAddDraft(
      createBatchAddDraft({
        open: true,
        insertMode: BATCH_ADD_MODE_BELOW,
        anchorClientId: '',
        queuedPokemonIds: [],
        startingDexNum: '-1',
      }),
      [],
    )

    expect(validation).toEqual({
      anchorClientId: 'Choose a row to insert below.',
      queuedPokemonIds: 'Add at least one Pokemon to the batch.',
      startingDexNum: 'Starting Dex Num must be an integer between 0 and 99999.',
    })
  })

  it('batch queue helpers prevent duplicates and allow removal', () => {
    const queuedDraft = addPokemonToBatchAddQueue(
      createBatchAddDraft({
        queuedPokemonIds: ['bulbasaur'],
      }),
      'bulbasaur',
    )

    expect(queuedDraft.queuedPokemonIds).toEqual(['bulbasaur'])
    expect(removePokemonFromBatchAddQueue(queuedDraft, 'bulbasaur').queuedPokemonIds).toEqual([])
  })

  it('normalizePokedexDraft converts blanks to nullable and optional fields', () => {
    const normalized = normalizePokedexDraft({
      id: 'national',
      name: ' National Pokedex ',
      shortDesc: '',
      desc: '',
      gen: '9',
      region: '',
      isNational: true,
      baseDex: '',
      pkApiId: '',
      entries: [
        {
          clientId: 'row-1',
          pid: ' pikachu ',
          dexNum: '25',
          isForm: false,
          transferOnly: TRI_STATE_UNSET,
          isNonCanonical: TRI_STATE_FALSE,
          originDex: 'kanto',
          meta: { names: { eng: 'Pikachu' } } as Pkds.PokedexEntry['meta'],
        },
      ],
    })

    expect(normalized).toEqual({
      id: 'national',
      name: 'National Pokedex',
      shortDesc: undefined,
      desc: null,
      gen: 9,
      region: null,
      isNational: true,
      baseDex: null,
      pkApiId: null,
      entries: [
        {
          pid: 'pikachu',
          dexNum: 25,
          isForm: false,
          transferOnly: undefined,
          isNonCanonical: false,
          originDex: 'kanto',
          meta: { names: { eng: 'Pikachu' } },
        },
      ],
    })
  })

  it('validatePokedexDraft returns deterministic general and row errors', () => {
    const validation = validatePokedexDraft(
      {
        id: 'national',
        name: '',
        shortDesc: '',
        desc: '',
        gen: '99',
        region: 'missing-region',
        isNational: true,
        baseDex: 'missing-dex',
        pkApiId: '',
        entries: [
          {
            clientId: 'row-1',
            pid: 'missing',
            dexNum: '-1',
            isForm: false,
            transferOnly: TRI_STATE_UNSET,
            isNonCanonical: TRI_STATE_UNSET,
          },
        ],
      },
      new Set(['pikachu']),
      new Set(['kanto']),
      new Set(['national-kanto']),
    )

    expect(validation.generalErrors).toEqual({
      name: 'Name is required.',
      gen: 'Generation must be an integer between 0 and 10.',
      region: 'Region must be a valid region id or left empty.',
      baseDex: 'Base Dex must be a valid Pokedex id or left empty.',
    })
    expect(validation.entryErrors['row-1']).toEqual({
      pid: 'Pokemon id is invalid.',
      dexNum: 'Dex number must be an integer between 0 and 99999.',
    })
    expect(hasPokedexDraftValidationErrors(validation)).toBe(true)
  })
})

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gameLocales } from '../../lib-next/languages'
import { I18N_CODE } from './mappings'
import {
  buildData,
  buildItems,
  collectBuildWarnings,
  createLabelMap,
  DEFAULT_DATASET_ROOT,
  I18N_FILE_NAMES,
  mapItemCategoryCodes,
  mapMoveClassificationCodes,
  mapMoveTargetCode,
  parseBattleStateTexts,
  sanitizeString,
  slugify,
  slugifyLocalized,
  uniquifySlugLoc,
  writeBuiltData,
} from './parser'
import type { TextEntry } from './parser'
import {
  abilitySchema,
  battleStateSchema,
  i18nSchema,
  itemI18nSchema,
  itemSchema,
  moveSchema,
} from './schemas'

describe('parser helpers', () => {
  it('creates stable ascii slugs', () => {
    expect(slugify('Pok\u00e9mon\u2019s Atk/Def Swapped')).toBe('pokemons-atk-def-swapped')
    expect(slugify('Ball & Bomb')).toBe('ball-and-bomb')
  })

  it('creates transliterated localized slugs', () => {
    expect(slugifyLocalized('Pok\u00e9mon \u00c9clair & Cr\u00e8me', 'fallback')).toBe(
      'pokemon-eclair-and-creme',
    )
    expect(slugifyLocalized('\u4f60\u597d', 'fallback')).toBe('ni-hao')
    expect(slugifyLocalized('\uc548\ub155\ud558\uc138\uc694', 'fallback')).toBe('annyeonghaseyo')
    expect(slugifyLocalized('\u26a1', 'fallback')).toBe('fallback')
  })

  it('deduplicates localized slugs deterministically', () => {
    expect(
      uniquifySlugLoc([
        { id: '1', slugLoc: 'duplicate' },
        { id: '2', slugLoc: 'duplicate' },
        { id: '3', slugLoc: 'unique' },
      ]),
    ).toEqual([
      { id: '1', slugLoc: 'duplicate-1' },
      { id: '2', slugLoc: 'duplicate-2' },
      { id: '3', slugLoc: 'unique' },
    ])
  })

  it('sanitizes confusable and invisible string characters', () => {
    expect(sanitizeString('King\u2019s Rock 50\u202f% \u201cquoted\u201d A\u200bB\u00a0C')).toBe(
      'King\'s Rock 50% "quoted" AB C',
    )
  })

  it('creates label maps and rejects duplicate labels', () => {
    const entries: TextEntry[] = [
      textEntry(0, 'LABEL_001', 'One'),
      textEntry(1, 'LABEL_002', 'Two'),
    ]

    expect(createLabelMap(entries).get('LABEL_002')?.OriginalText).toBe('Two')
    expect(() => createLabelMap([...entries, textEntry(2, 'LABEL_002', 'Duplicate')])).toThrow(
      /Duplicate label LABEL_002/,
    )
  })

  it('pairs battle state names and descriptions', () => {
    expect(
      parseBattleStateTexts([
        textEntry(0, 'BTR_STATE_SYN_01_02', 'Weather description'),
        textEntry(1, 'BTR_STATE_SYN_01_03', 'Harsh Sunlight'),
        textEntry(2, 'BTR_STATE_SYN_16_04', 'Ignored alternate text'),
      ]),
    ).toEqual([
      {
        id: '1',
        stateCode: 1,
        name: 'Harsh Sunlight',
        description: 'Weather description',
      },
    ])
  })

  it('rejects incomplete battle state pairs', () => {
    expect(() =>
      parseBattleStateTexts([textEntry(0, 'BTR_STATE_SYN_01_02', 'Only description')]),
    ).toThrow(/Incomplete battle state pair/)
  })

  it('maps explicit source codes and rejects unknown codes', () => {
    expect(mapMoveTargetCode(11)).toBe('opponents_side')
    expect(mapMoveTargetCode(12)).toBe('users_side')
    expect(mapMoveTargetCode(13)).toBe('varies')
    expect(mapMoveTargetCode(14)).toBe('all_allies')
    expect(mapMoveClassificationCodes([0, 1, 12])).toEqual(['punching', 'healing'])
    expect(mapItemCategoryCodes([6, 4, 0, 10])).toEqual(['berry', 'recovery', 'other'])
    expect(() => mapMoveTargetCode(99)).toThrow(/Unknown move target code 99/)
  })
})

describe('data generation', () => {
  it('generates the expected canonical and i18n records', () => {
    const warningCount = { value: 0 }
    const data = buildData(DEFAULT_DATASET_ROOT, {
      onWarning: () => {
        warningCount.value += 1
      },
    })

    expect(data.moves).toHaveLength(835)
    expect(data.abilities).toHaveLength(194)
    expect(data.items).toHaveLength(117)
    expect(data.battleStates).toHaveLength(66)
    expect(Object.keys(data.i18n).sort()).toEqual([...I18N_CODE].sort())
    expect(data.warnings).toEqual([])
    expect(warningCount.value).toBe(0)
    expect(JSON.stringify(data)).not.toMatch(/[\u00a0\u200b\u2018\u2019\u201c\u201d\u202f]/u)

    expect(data.moves.find((move) => move.id === '863')).toMatchObject({
      name: 'Revival Blessing',
      description:
        "Revives a Pok\u00e9mon in the user's party that has fainted and\nrestores 1/2 of that Pok\u00e9mon's max HP.",
      type: 'normal',
      category: 'status',
      target: 'users_side',
      isUsable: false,
    })
    expect(data.moves.find((move) => move.id === '892')).toMatchObject({
      name: 'Double Shock',
      description:
        'The user loses the Electric type. This move fails unless it is used\nby an Electric type.',
      type: 'electric',
      category: 'physical',
      target: 'single_target',
      isDirect: true,
      isUsable: false,
    })

    for (const move of data.moves) {
      moveSchema.parse(move)
    }

    for (const ability of data.abilities) {
      abilitySchema.parse(ability)
    }

    for (const item of data.items) {
      itemSchema.parse(item)
    }

    for (const battleState of data.battleStates) {
      battleStateSchema.parse(battleState)
    }

    for (const lang of I18N_CODE) {
      const langData = data.i18n[lang]

      expect(langData.moves).toHaveLength(data.moves.length)
      expect(langData.abilities).toHaveLength(data.abilities.length)
      expect(langData.items).toHaveLength(data.items.length)
      expect(langData.battleStates).toHaveLength(data.battleStates.length)

      for (const move of langData.moves) {
        expect(move.slugLoc).toBeTruthy()
        i18nSchema.parse(move)
      }

      for (const ability of langData.abilities) {
        expect(ability.slugLoc).toBeTruthy()
        i18nSchema.parse(ability)
      }

      for (const item of langData.items) {
        expect(item.slugLoc).toBeTruthy()
        itemI18nSchema.parse(item)
      }

      for (const battleState of langData.battleStates) {
        expect(battleState.slugLoc).toBeTruthy()
        i18nSchema.parse(battleState)
      }
    }
  })

  it('writes every game locale for every i18n file', () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'champscript-output-'))

    try {
      writeBuiltData(buildData(DEFAULT_DATASET_ROOT), outputRoot)
      const expectedLocales = gameLocales.map((locale) => locale.toLowerCase())

      for (const locale of expectedLocales) {
        for (const fileName of I18N_FILE_NAMES) {
          expect(existsSync(join(outputRoot, 'i18n', locale, fileName))).toBe(true)
        }
      }

      for (const fileName of I18N_FILE_NAMES) {
        expect(readFileSync(join(outputRoot, 'i18n', 'pt-br', fileName), 'utf8')).toBe(
          readFileSync(join(outputRoot, 'i18n', 'eng', fileName), 'utf8'),
        )
      }
    } finally {
      rmSync(outputRoot, { recursive: true, force: true })
    }
  })

  it('fails when required item names are missing', () => {
    const datasetRoot = mkdtempSync(join(tmpdir(), 'champscript-parser-'))

    try {
      writeJson(join(datasetRoot, 'masterdata/item.json'), [
        {
          id: '149',
          category_a: '6',
          category_b: '0',
          category_c: '0',
          ms_lbl: 'ITEMNAME_149',
          ms_lbl_info: 'ITEMINFO_SYN_149',
        },
      ])
      writeJson(join(datasetRoot, 'rom-txt/usa/itemname.json'), textDataset([]))
      writeJson(
        join(datasetRoot, 'rom-txt/usa/itemname_plural.json'),
        textDataset([textEntry(0, 'ITEMNAME_149', 'Cheri Berries')]),
      )
      writeJson(
        join(datasetRoot, 'rom-txt/usa/iteminfo_syn.json'),
        textDataset([textEntry(0, 'ITEMINFO_SYN_149', 'Cures paralysis.')]),
      )

      expect(() => buildItems(datasetRoot, 'usa')).toThrow(/Missing label ITEMNAME_149/)
    } finally {
      rmSync(datasetRoot, { recursive: true, force: true })
    }
  })

  it('warns when text labels have no transformed master row', () => {
    const datasetRoot = mkdtempSync(join(tmpdir(), 'champscript-parser-'))

    try {
      writeJson(join(datasetRoot, 'masterdata/waza.json'), [])

      for (const lang of I18N_CODE) {
        writeJson(
          join(datasetRoot, 'rom-txt', lang, 'wazaname.json'),
          textDataset([textEntry(0, 'WAZANAME_999', 'Missing Move')]),
        )
      }

      expect(collectBuildWarnings(datasetRoot)).toContainEqual({
        kind: 'orphan-text-labels',
        domain: 'moves',
        lang: 'usa',
        sourceFile: 'rom-txt/usa/wazaname.json',
        referenceFile: 'masterdata/waza.json',
        labels: [
          {
            index: 0,
            labelName: 'WAZANAME_999',
            text: 'Missing Move',
          },
        ],
      })
    } finally {
      rmSync(datasetRoot, { recursive: true, force: true })
    }
  })
})

function textEntry(index: number, labelName: string, originalText: string): TextEntry {
  return {
    Index: index,
    LabelName: labelName,
    OriginalText: originalText,
  }
}

function textDataset(entries: TextEntry[]): { mSDataSet: TextEntry[] } {
  return {
    mSDataSet: entries,
  }
}

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

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
  pokemonI18nSchema,
  pokemonMovesSchema,
  pokemonSchema,
} from '../../lib-next/schemas'

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
    expect(data.abilities).toHaveLength(203) // 202 from the dump + 1 preliminary
    expect(data.items).toHaveLength(148)
    expect(data.battleStates).toHaveLength(66)
    expect(data.pokemon).toHaveLength(441)
    expect(data.pokemonMoves).toHaveLength(236)
    expect(Object.keys(data.i18n).sort()).toEqual([...I18N_CODE].sort())
    expect(data.warnings).toEqual([])
    expect(warningCount.value).toBe(0)
    expect(JSON.stringify(data)).not.toMatch(/[\u00a0\u200b\u2018\u2019\u201c\u201d\u202f]/u)

    expect(data.moves.find((move) => move.id === 'revivalblessing')).toMatchObject({
      championsId: '863',
      name: 'Revival Blessing',
      description:
        "Revives a Pok\u00e9mon in the user's party that has fainted and\nrestores 1/2 of that Pok\u00e9mon's max HP.",
      type: 'normal',
      category: 'status',
      target: 'opponents_side',
      usable: false,
    })
    expect(data.moves.find((move) => move.id === 'doubleshock')).toMatchObject({
      championsId: '892',
      name: 'Double Shock',
      description:
        'The user loses the Electric type. This move fails unless it is used\nby an Electric type.',
      type: 'electric',
      category: 'physical',
      target: 'single_target',
      contact: true,
      usable: false,
    })

    for (const move of data.moves) {
      moveSchema.parse(move)
      expect(move).not.toHaveProperty('typeCode')
      expect(move).not.toHaveProperty('categoryCode')
      expect(move).not.toHaveProperty('targetCode')
      expect(move).not.toHaveProperty('classificationCodes')
      expect(move).not.toHaveProperty('isDirect')
      expect(move).not.toHaveProperty('isUsable')
    }

    for (const ability of data.abilities) {
      abilitySchema.parse(ability)
    }

    for (const item of data.items) {
      itemSchema.parse(item)
      expect(item).not.toHaveProperty('categoryCodes')
    }

    for (const battleState of data.battleStates) {
      battleStateSchema.parse(battleState)
      expect(battleState).not.toHaveProperty('stateCode')
    }

    for (const pokemonRecord of data.pokemon) {
      pokemonSchema.parse(pokemonRecord)
    }
    pokemonMovesSchema.parse(data.pokemonMoves)

    expect(data.moves.find((record) => record.id === 'pound')).toMatchObject({
      id: 'pound',
      championsId: '1',
      slug: 'pound',
    })
    expect(data.moves.find((record) => record.id === 'karatechop')).toMatchObject({
      id: 'karatechop',
      championsId: '2',
      slug: 'karate-chop',
    })
    expect(data.abilities.find((record) => record.id === 'speedboost')).toMatchObject({
      id: 'speedboost',
      championsId: '3',
      slug: 'speed-boost',
    })
    expect(data.abilities.find((record) => record.id === 'voltabsorb')).toMatchObject({
      id: 'voltabsorb',
      championsId: '10',
      slug: 'volt-absorb',
    })
    // Announced but not in the dump yet, so it carries no Champions id.
    expect(data.abilities.find((record) => record.id === 'auraguard')).toMatchObject({
      id: 'auraguard',
      championsId: 'preliminary-auraguard',
      slug: 'aura-guard',
      name: 'Aura Guard',
    })
    expect(data.items.find((record) => record.id === 'cheriberry')).toMatchObject({
      id: 'cheriberry',
      championsId: '149',
      slug: 'cheri-berry',
    })
    expect(data.items.find((record) => record.id === 'charizarditex')).toMatchObject({
      id: 'charizarditex',
      championsId: '660',
      slug: 'charizardite-x',
    })

    const venusaurMoves = data.pokemonMoves.find((record) => record.id === 'venusaur')
    expect(venusaurMoves?.moves).toEqual([...(venusaurMoves?.moves ?? [])].sort())
    expect(venusaurMoves?.moves).toContain('solarbeam')
    expect(venusaurMoves?.moves).toContain('swordsdance')
    expect(data.pokemonMoves.find((record) => record.id === 'venusaur-f')).toBeUndefined()
    expect(
      data.pokemonMoves.find((record) => record.id === 'alcremie-ruby-cream-berry'),
    ).toBeUndefined()
    expect(data.pokemonMoves.find((record) => record.id === 'venusaur-mega')).toBeUndefined()
    expect(data.pokemonMoves.find((record) => record.id === 'blastoise-mega')).toBeUndefined()
    expect(data.pokemonMoves.find((record) => record.id === 'meowstic-mega')).toBeUndefined()
    expect(data.pokemonMoves.find((record) => record.id === 'meowstic-f')).toBeDefined()

    const localPokemonIds = new Set<string>(
      JSON.parse(readFileSync(join(process.cwd(), 'data/indices/pokemon.json'), 'utf8')),
    )
    const mappedLocalPokemonIds = data.pokemon.map((record) => record.id)
    const learnsetMappedLocalPokemonIds = mappedLocalPokemonIds.filter((pokemonId) => {
      const localPokemon = JSON.parse(
        readFileSync(join(process.cwd(), 'data/pokemon', `${pokemonId}.json`), 'utf8'),
      ) as { isCosmeticForm: boolean; isBattleOnlyForm: boolean }

      return !localPokemon.isCosmeticForm && !localPokemon.isBattleOnlyForm
    })
    const mappedChampionsIds = new Set(data.pokemon.map((record) => record.championsId))
    const pokemonMoveIds = data.pokemonMoves.map((record) => record.id)
    const personalIds = JSON.parse(
      readFileSync(join(DEFAULT_DATASET_ROOT, 'masterdata/personal.json'), 'utf8'),
    ).map((record: { id: string }) => record.id)

    expect(new Set(mappedLocalPokemonIds).size).toBe(mappedLocalPokemonIds.length)
    expect(new Set(pokemonMoveIds).size).toBe(pokemonMoveIds.length)
    expect([...pokemonMoveIds].sort()).toEqual([...learnsetMappedLocalPokemonIds].sort())
    for (const pokemonMoves of data.pokemonMoves) {
      expect(pokemonMoves.moves).toEqual([...pokemonMoves.moves].sort())
    }
    for (const pokemonId of mappedLocalPokemonIds) {
      expect(localPokemonIds.has(pokemonId)).toBe(true)
    }
    for (const championsId of personalIds) {
      expect(mappedChampionsIds.has(championsId)).toBe(championsId !== '0678003')
    }

    expect(data.pokemon.find((record) => record.id === 'blastoise-mega')).toMatchObject({
      nid: '0009-mega',
      pokeApiId: 10036,
      pokeApiFormId: 10136,
      showdownId: 'blastoisemega',
      baseSpecies: 'blastoise',
      championsId: '0009001',
      type1: 'water',
      type2: null,
      abilities: ['megalauncher'],
      baseHp: 79,
      baseAtk: 103,
      baseDef: 120,
      baseSpAtk: 135,
      baseSpDef: 115,
      baseSpeed: 78,
      height: 160,
      weight: 10110,
      isForm: true,
      isBattleOnly: true,
      isCosmetic: false,
      isFemale: false,
      name: 'Blastoise',
      formName: 'Mega Blastoise',
    })
    const venusaur = data.pokemon.find((record) => record.id === 'venusaur')
    expect(venusaur).toMatchObject({
      nid: '0003',
      pokeApiId: 3,
      pokeApiFormId: 3,
      showdownId: 'venusaur',
      championsId: '0003000',
      type1: 'grass',
      type2: 'poison',
      abilities: ['overgrow', 'chlorophyll'],
      baseHp: 80,
      baseAtk: 82,
      baseDef: 83,
      baseSpAtk: 100,
      baseSpDef: 100,
      baseSpeed: 80,
      height: 200,
      weight: 10000,
      isForm: false,
      isBattleOnly: false,
      isCosmetic: false,
      isFemale: false,
    })
    expect(venusaur).not.toHaveProperty('baseSpecies')
    expect(venusaur).not.toHaveProperty('formName')
    expect(data.pokemon.find((record) => record.id === 'venusaur-f')).toMatchObject({
      nid: '0003-f',
      pokeApiId: 3,
      pokeApiFormId: 3,
      showdownId: 'venusaur',
      baseSpecies: 'venusaur',
      championsId: '0003000',
      isForm: true,
      isCosmetic: true,
      isFemale: true,
    })
    expect(
      data.pokemon
        .filter((record) => record.championsId === '0869001')
        .map((record) => record.id)
        .sort(),
    ).toEqual([
      'alcremie-ruby-cream-berry',
      'alcremie-ruby-cream-clover',
      'alcremie-ruby-cream-flower',
      'alcremie-ruby-cream-love',
      'alcremie-ruby-cream-ribbon',
      'alcremie-ruby-cream-star',
      'alcremie-ruby-cream-strawberry',
    ])
    expect(data.pokemon.find((record) => record.id === 'basculegion-f')).toMatchObject({
      championsId: '0902001',
    })
    expect(data.pokemon.find((record) => record.id === 'maushold-three')).toMatchObject({
      championsId: '0925000',
    })
    expect(data.pokemon.find((record) => record.id === 'maushold')).toMatchObject({
      championsId: '0925001',
    })
    expect(data.pokemon.some((record) => record.championsId === '0678003')).toBe(false)

    for (const lang of I18N_CODE) {
      const langData = data.i18n[lang]

      expect(langData.moves).toHaveLength(data.moves.length)
      expect(langData.abilities).toHaveLength(data.abilities.length)
      expect(langData.items).toHaveLength(data.items.length)
      expect(langData.battleStates).toHaveLength(data.battleStates.length)
      expect(langData.pokemon).toHaveLength(data.pokemon.length)

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

      for (const pokemonRecord of langData.pokemon) {
        pokemonI18nSchema.parse(pokemonRecord)
      }

      expect('movesMap' in langData).toBe(false)
      expect('abilitiesMap' in langData).toBe(false)
      expect('itemsMap' in langData).toBe(false)
    }

    expect(data.i18n.esp.pokemon.find((record) => record.id === 'blastoise-mega')).toMatchObject({
      name: 'Blastoise',
      formName: 'Mega-Blastoise',
    })
    expect(data.i18n.esp.pokemon.find((record) => record.id === 'venusaur')).not.toHaveProperty(
      'formName',
    )
    expect(data.i18n.esp.moves.find((record) => record.id === 'karatechop')).toMatchObject({
      slug: 'karate-chop',
    })
    expect(data.i18n.esp.moves.find((record) => record.id === '2')).toBeUndefined()
    expect(data.i18n.esp.abilities.find((record) => record.id === 'speedboost')).toMatchObject({
      slug: 'speed-boost',
    })
    // A preliminary ability reaches every language, keeping its English name.
    expect(data.i18n.esp.abilities.find((record) => record.id === 'auraguard')).toMatchObject({
      slug: 'aura-guard',
      slugLoc: 'aura-guard',
      name: 'Aura Guard',
      description: 'Reduce a la mitad el daño recibido por los movimientos de contacto.',
    })
    expect(data.i18n.esp.items.find((record) => record.id === 'cheriberry')).toMatchObject({
      slug: 'cheri-berry',
    })
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

      expect(existsSync(join(outputRoot, 'pokemon.json'))).toBe(true)
      expect(existsSync(join(outputRoot, 'pokemon-moves.json'))).toBe(true)
      expect(existsSync(join(outputRoot, 'pokemon-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'moves-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'abilities-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'items-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'i18n', 'eng', 'moves-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'i18n', 'eng', 'abilities-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'i18n', 'eng', 'items-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'i18n', 'eng', 'pokemon-map.json'))).toBe(false)
      expect(existsSync(join(outputRoot, 'i18n', 'eng', 'pokemon-moves.json'))).toBe(false)
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

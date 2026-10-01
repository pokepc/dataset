import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  absDatasetFile,
  loadAllLanguages,
  loadAllPokedexes,
  loadAllPokemon,
  readDatasetFile,
  readIndexFile,
} from '../../src/lib/fs'
import { localeCodes, type LocaleCode } from '../../src/lib/languages'
import {
  boxPresetTextFileSchema,
  classicBoxPresetFileSchema,
  textFileSchemas,
  type TextKind,
} from '../../src/lib/schemas'
import { validate } from '../_utils'

const i18nDir = absDatasetFile('i18n')
const locales = fs.readdirSync(i18nDir).filter((name) => !name.startsWith('.'))
const textKinds = Object.keys(textFileSchemas) as TextKind[]

/** Base ids per text kind, in base order. */
function baseIds(kind: TextKind): string[] {
  if (kind === 'pokemon' || kind === 'games' || kind === 'pokedexes') return readIndexFile(kind)
  return readDatasetFile<Array<{ id: string }>>(`${kind}.json`).map((record) => record.id)
}

const idsByKind = Object.fromEntries(textKinds.map((kind) => [kind, baseIds(kind)])) as Record<
  TextKind,
  string[]
>

const textFiles = locales.flatMap((locale) =>
  textKinds
    .filter((kind) => fs.existsSync(path.join(i18nDir, locale, `${kind}.json`)))
    .map((kind) => ({
      locale,
      kind,
      text: readDatasetFile<Record<string, Record<string, unknown>>>(`i18n/${locale}/${kind}.json`),
    })),
)

function englishText<K extends TextKind>(kind: K) {
  return readDatasetFile<Record<string, Record<string, unknown>>>(`i18n/eng/${kind}.json`)
}

describe('locale directories', () => {
  it('use only v8 locale codes', () => {
    expect(
      locales.filter((locale) => !(localeCodes as readonly string[]).includes(locale)),
    ).toEqual([])
  })

  it('match one language record each', () => {
    const codes = loadAllLanguages().map((language) => language.code)
    expect([...codes].sort()).toEqual([...localeCodes].sort())
  })

  it('only contain text files of known kinds, box presets and Pokémon prose', () => {
    const known = new Set([
      ...textKinds.map((kind) => `${kind}.json`),
      'boxpresets',
      'pokemon-prose',
    ])
    for (const locale of locales) {
      const unknown = fs.readdirSync(path.join(i18nDir, locale)).filter((name) => !known.has(name))
      expect(unknown, locale).toEqual([])
    }
  })
})

describe.each(textFiles)('i18n/$locale/$kind.json', ({ locale, kind, text }) => {
  it('matches the text schema', () => {
    const validation = validate(textFileSchemas[kind], text)
    if (!validation.success) console.error(validation.errorsSummary.join('\n'))
    expect(validation.success).toBe(true)
  })

  it('only has text for base ids, in base order', () => {
    const order = idsByKind[kind]
    const keys = Object.keys(text)
    expect(
      keys.filter((id) => !order.includes(id)),
      `${locale}/${kind}`,
    ).toEqual([])
    expect(keys).toEqual(order.filter((id) => id in text))
  })

  it('has no empty entries', () => {
    expect(Object.entries(text).filter(([, entry]) => Object.keys(entry).length === 0)).toEqual([])
  })
})

describe('English text', () => {
  // Kinds whose v7 records required a name.
  it.each([
    'abilities',
    'battle-states',
    'characters',
    'colors',
    'games',
    'items',
    'locations',
    'marks',
    'moves',
    'natures',
    'originmarks',
    'pokeballs',
    'pokedexes',
    'pokemon',
    'regions',
    'ribbons',
    'types',
  ] as const)('names every %s record', (kind) => {
    const text = englishText(kind)
    expect(idsByKind[kind].filter((id) => !text[id]?.name)).toEqual([])
  })

  it('describes every personality', () => {
    const text = englishText('personalities')
    expect(idsByKind.personalities.filter((id) => !text[id]?.shortDesc)).toEqual([])
  })
})

describe('method notes', () => {
  const pokemon = loadAllPokemon()
  const notesByLocale = Object.fromEntries(
    localeCodes.map((locale) => [
      locale,
      fs.existsSync(path.join(i18nDir, locale, 'pokemon.json'))
        ? readDatasetFile<Record<string, { evoNotes?: object; formNotes?: object }>>(
            `i18n/${locale}/pokemon.json`,
          )
        : {},
    ]),
  ) as Record<LocaleCode, Record<string, { evoNotes?: object; formNotes?: object }>>

  it('only annotate existing evolution methods, form methods and revert details', () => {
    const problems: string[] = []
    for (const record of pokemon) {
      const evoKeys = new Set((record.evoMethods ?? []).map((_, index) => String(index)))
      const formKeys = new Set(
        (record.formMethods ?? []).flatMap((method, index) => [
          String(index),
          ...(method.revert ?? []).flatMap((revert, revertIndex) =>
            typeof revert === 'object' && !('afterTurns' in revert)
              ? [`${index}.revert.${revertIndex}`]
              : [],
          ),
        ]),
      )
      for (const [locale, text] of Object.entries(notesByLocale)) {
        for (const key of Object.keys(text[record.id]?.evoNotes ?? {}))
          if (!evoKeys.has(key)) problems.push(`${locale} ${record.id} evoNotes.${key}`)
        for (const key of Object.keys(text[record.id]?.formNotes ?? {}))
          if (!formKeys.has(key)) problems.push(`${locale} ${record.id} formNotes.${key}`)
      }
    }
    expect(problems).toEqual([])
  })

  // Moved from the method schemas, which cannot see the locale files.
  it('explain every special method without conditions in English', () => {
    const english = notesByLocale.eng as Record<
      string,
      { evoNotes?: Record<string, string>; formNotes?: Record<string, string> }
    >
    const problems: string[] = []
    for (const record of pokemon) {
      record.evoMethods?.forEach((method, index) => {
        if (
          method.trigger === 'special' &&
          method.conditions.length === 0 &&
          !english[record.id]?.evoNotes?.[index]
        )
          problems.push(`${record.id} evoMethods.${index}`)
      })
      record.formMethods?.forEach((method, index) => {
        if (
          method.trigger === 'special' &&
          method.conditions.length === 0 &&
          !english[record.id]?.formNotes?.[index]
        )
          problems.push(`${record.id} formMethods.${index}`)
        method.revert?.forEach((revert, revertIndex) => {
          const key = `${index}.revert.${revertIndex}`
          if (
            typeof revert === 'object' &&
            'trigger' in revert &&
            revert.trigger === 'special' &&
            revert.conditions.length === 0 &&
            !english[record.id]?.formNotes?.[key]
          )
            problems.push(`${record.id} formMethods.${key}`)
        })
      })
    }
    expect(problems).toEqual([])
  })
})

describe('Pokédex entry text', () => {
  it('names every entry with meta, keyed by a unique meta.id', () => {
    const text = englishText('pokedexes') as Record<
      string,
      { entries?: Record<string, { name?: string }> }
    >
    const problems: string[] = []
    for (const dex of loadAllPokedexes()) {
      const metaIds = dex.entries.flatMap((entry) => (entry.meta ? [entry.meta.id] : []))
      if (new Set(metaIds).size !== metaIds.length) problems.push(`${dex.id}: duplicate meta.id`)
      for (const id of metaIds)
        if (!text[dex.id]?.entries?.[id]?.name) problems.push(`${dex.id}: ${id}`)
      for (const id of Object.keys(text[dex.id]?.entries ?? {}))
        if (!metaIds.includes(id)) problems.push(`${dex.id}: stray entry text ${id}`)
    }
    expect(problems).toEqual([])
  })
})

describe('box preset text', () => {
  const variants = ['classic', 'modern'] as const
  const sets = (variant: (typeof variants)[number]) =>
    fs
      .readdirSync(absDatasetFile(`boxpresets/${variant}`))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))

  function presets(variant: (typeof variants)[number], set: string) {
    if (variant === 'classic') {
      const file = classicBoxPresetFileSchema.parse(
        readDatasetFile(`boxpresets/classic/${set}.json`),
      )
      return Object.entries(file).map(([id, preset]) => ({ id, boxCount: preset.boxes.length }))
    }
    return readDatasetFile<string[]>(`boxpresets/modern/${set}.json`).map((id) => ({
      id,
      boxCount: readDatasetFile<{ boxes: unknown[] }>(`boxpresets/modern/${set}/${id}.json`).boxes
        .length,
    }))
  }

  it.each(variants)('%s presets each have an English name and aligned box titles', (variant) => {
    const problems: string[] = []
    for (const set of sets(variant)) {
      const textPath = `i18n/eng/boxpresets/${variant}/${set}.json`
      const text = boxPresetTextFileSchema.parse(readDatasetFile(textPath))
      const list = presets(variant, set)
      for (const { id, boxCount } of list) {
        if (!text[id]?.name) problems.push(`${variant}/${set}/${id}: no name`)
        const titles = text[id]?.boxes
        if (titles && titles.length !== boxCount)
          problems.push(`${variant}/${set}/${id}: ${titles.length} titles for ${boxCount} boxes`)
      }
      const ids = new Set(list.map((preset) => preset.id))
      for (const id of Object.keys(text))
        if (!ids.has(id)) problems.push(`${variant}/${set}: stray ${id}`)
    }
    expect(problems).toEqual([])
  })
})

describe('Pokémon prose', () => {
  it('only exists for Pokémon in the dataset', () => {
    const ids = new Set(readIndexFile('pokemon'))
    const stray = locales.flatMap((locale) => {
      const dir = path.join(i18nDir, locale, 'pokemon-prose')
      if (!fs.existsSync(dir)) return []
      return fs
        .readdirSync(dir)
        .filter((file) => !file.endsWith('.md') || !ids.has(file.slice(0, -'.md'.length)))
        .map((file) => `${locale}/${file}`)
    })
    expect(stray).toEqual([])
  })
})

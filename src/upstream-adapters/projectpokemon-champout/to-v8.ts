/**
 * Converts Champions game-dump records (the parser's full-record shape) into v8 base updates and
 * `mods/champions/` (doc-2, "Champions"). Base gains only game-independent facts it lacks
 * (upstream ids, move mechanics, battle states, names in missing locales); everything that
 * differs in Champions becomes an override or mod text.
 */
import { isDeepStrictEqual } from 'node:util'
import type { LocaleCode } from '../../lib-next/languages'
import type { MergedGameSet, ModdableTextOverrides, RecordOverrides } from '../../lib-next/merge'
import { moddableKinds, type ModdableKind } from '../../lib-next/schemas'
import type {
  Ability,
  BattleState,
  Item,
  Move,
  Pokemon,
  RecordOverride,
  Roster,
  TextFile,
} from '../../lib-next/types'
import type {
  AbilityRecord,
  BattleStateRecord,
  I18nRecord,
  ItemI18nRecord,
  ItemRecord,
  MoveRecord,
  PokemonI18nRecord,
  PokemonMovesRecord,
  PokemonRecord,
} from './schemas'

export const CHAMPIONS_SET = 'champions'

export type ChampionsLocaleText = {
  pokemon?: PokemonI18nRecord[]
  moves?: I18nRecord[]
  abilities?: I18nRecord[]
  items?: ItemI18nRecord[]
  battleStates?: I18nRecord[]
}

/** Parser output, with text keyed by v8 locale code. */
export type ChampionsDump = {
  pokemon: PokemonRecord[]
  pokemonMoves: PokemonMovesRecord[]
  moves: MoveRecord[]
  abilities: AbilityRecord[]
  items: ItemRecord[]
  battleStates: BattleStateRecord[]
  i18n: Partial<Record<LocaleCode, ChampionsLocaleText>>
}

export type BaseText = Partial<Record<LocaleCode, Partial<{ [K in ModdableKind]: TextFile<K> }>>>

/** The base data Champions touches: moddable kinds and their text. */
export type ModdableBase = {
  pokemon: Pokemon[]
  moves: Move[]
  abilities: Ability[]
  items: Item[]
  'battle-states': BattleState[]
  text: BaseText
}

export type ChampionsMods = {
  roster: Roster
  overrides: Partial<RecordOverrides>
  text: Partial<Record<LocaleCode, Partial<ModdableTextOverrides>>>
}

export type ChampionsV8 = { base: ModdableBase; mods: ChampionsMods }

type Json = Record<string, unknown>

/**
 * Champions stores 1 as the power of moves whose damage is variable or fixed (OHKO, Low Kick,
 * Seismic Toss…); the dataset uses 0. Not an override.
 */
function sameMovePower(base: number, champions: number) {
  return base === champions || (base === 0 && champions === 1)
}

const ABILITY_SLOTS = ['ability1', 'ability2', 'abilityHidden', 'abilitySpecial'] as const

/**
 * Overrides for a Pokémon whose Champions ability list differs from its base slots. Champions
 * lists abilities without slots, so only a subsequence of the base slots can be mapped (missing
 * slots are unset); anything else needs a curated base change.
 */
function abilityOverride(base: Pokemon, abilities: readonly string[]): Json {
  const slots = ABILITY_SLOTS.filter((slot) => base[slot] !== undefined)
  if (
    isDeepStrictEqual(
      slots.map((slot) => base[slot]),
      abilities,
    )
  )
    return {}
  const unset: string[] = []
  let next = 0
  for (const slot of slots) {
    if (base[slot] === abilities[next]) next++
    else unset.push(slot)
  }
  if (next !== abilities.length) {
    throw new Error(
      `Cannot map Champions abilities of ${base.id} (${abilities.join(', ')}) onto base slots ` +
        `(${slots.map((slot) => base[slot]).join(', ')}); update the base record first`,
    )
  }
  return { $unset: unset }
}

function pokemonOverride(base: Pokemon, dump: PokemonRecord, learnset?: string[]): Json {
  const override: Json = {}
  const unset: string[] = []
  const compare = (field: keyof Pokemon, value: unknown) => {
    if (!isDeepStrictEqual(base[field], value)) override[field] = value
  }
  compare('type1', dump.type1)
  if (dump.type2 === null) {
    if (base.type2 !== undefined) unset.push('type2')
  } else compare('type2', dump.type2)
  compare('baseHp', dump.baseHp)
  compare('baseAtk', dump.baseAtk)
  compare('baseDef', dump.baseDef)
  compare('baseSpAtk', dump.baseSpAtk)
  compare('baseSpDef', dump.baseSpDef)
  compare('baseSpeed', dump.baseSpeed)
  compare('height', dump.height)
  compare('weight', dump.weight)
  compare('isForm', dump.isForm)
  compare('isBattleOnlyForm', dump.isBattleOnly)
  compare('isCosmeticForm', dump.isCosmetic)
  compare('isFemaleForm', dump.isFemale)
  unset.push(...((abilityOverride(base, dump.abilities).$unset as string[] | undefined) ?? []))
  if (learnset) override.learnset = learnset
  if (unset.length > 0) override.$unset = unset
  return override
}

function moveOverride(base: Move, dump: MoveRecord): Json {
  const override: Json = {}
  for (const field of ['type', 'category', 'pp', 'accuracy', 'priority'] as const) {
    if (base[field] !== dump[field]) override[field] = dump[field]
  }
  if (!sameMovePower(base.power, dump.power)) override.power = dump.power
  // Mechanics that base already has but Champions changes.
  if (base.target !== undefined && base.target !== dump.target) override.target = dump.target
  if (base.contact !== undefined && base.contact !== dump.contact) override.contact = dump.contact
  if (
    base.classification !== undefined &&
    !isDeepStrictEqual(base.classification, dump.classification)
  ) {
    override.classification = dump.classification
  }
  if (!dump.usable) override.usable = false
  return override
}

function upstreamIds(record: { championsId: string; pokeApiId?: number | null }) {
  return {
    championsId: record.championsId,
    ...(record.pokeApiId !== undefined ? { pokeApiId: record.pokeApiId } : {}),
  }
}

function byId<T extends { id: string }>(records: readonly T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]))
}

function requireBase<T>(map: Map<string, T>, kind: string, id: string): T {
  const record = map.get(id)
  if (!record) {
    throw new Error(`Champions ${kind} "${id}" has no base record; add it to base first`)
  }
  return record
}

function withOverride<K extends ModdableKind>(
  list: RecordOverride<K>[],
  id: string,
  override: Json,
) {
  if (Object.keys(override).length > 0) list.push({ id, ...override } as RecordOverride<K>)
}

/** Converts a Champions dump into updated base data and the full `mods/champions/` content. */
export function championsToV8(dump: ChampionsDump, input: ModdableBase): ChampionsV8 {
  const base: ModdableBase = structuredClone(input)
  const overrides: Required<Pick<RecordOverrides, 'pokemon' | 'moves' | 'items'>> = {
    pokemon: [],
    moves: [],
    items: [],
  }

  // ---- Pokémon
  const basePokemon = byId(base.pokemon)
  const learnsets = new Map(dump.pokemonMoves.map((row) => [row.id, row.moves]))
  for (const record of dump.pokemon) {
    const pokemon = requireBase(basePokemon, 'Pokémon', record.id)
    pokemon.championsId = record.championsId
    withOverride(
      overrides.pokemon,
      record.id,
      pokemonOverride(pokemon, record, learnsets.get(record.id)),
    )
  }
  const dumpPokemon = byId(dump.pokemon)
  for (const id of learnsets.keys()) requireBase(dumpPokemon, 'learnset owner', id)

  // ---- Moves: upstream ids and mechanics base lacks go to base.
  const baseMoves = byId(base.moves)
  for (const record of dump.moves) {
    const move = requireBase(baseMoves, 'move', record.id)
    Object.assign(move, upstreamIds(record))
    move.target ??= record.target
    move.classification ??= record.classification
    move.contact ??= record.contact
    withOverride(overrides.moves, record.id, moveOverride(move, record))
  }

  const baseAbilities = byId(base.abilities)
  for (const record of dump.abilities) {
    Object.assign(requireBase(baseAbilities, 'ability', record.id), upstreamIds(record))
  }

  const baseItems = byId(base.items)
  for (const record of dump.items) {
    const item = requireBase(baseItems, 'item', record.id)
    Object.assign(item, upstreamIds(record))
    if (
      record.categories.length > 0 &&
      !isDeepStrictEqual(item.battleCategories, record.categories)
    ) {
      withOverride(overrides.items, record.id, { battleCategories: record.categories })
    }
  }

  // ---- Battle states exist only in Champions, so they are base records keyed by slug.
  const states = byId(base['battle-states'])
  const stateIdByChampionsId = new Map<string, string>()
  for (const record of dump.battleStates) {
    states.set(record.slug, { id: record.slug, championsId: record.id, state: record.state })
    stateIdByChampionsId.set(record.id, record.slug)
  }
  base['battle-states'] = [...states.values()]

  const text = convertText(dump, base, stateIdByChampionsId)

  return {
    base: { ...base, text: text.base },
    mods: {
      roster: {
        pokemon: inBaseOrder(base.pokemon, dump.pokemon),
        moves: inBaseOrder(base.moves, dump.moves),
        abilities: inBaseOrder(base.abilities, dump.abilities),
        items: inBaseOrder(base.items, dump.items),
      },
      overrides: {
        pokemon: sortByBase(base.pokemon, overrides.pokemon),
        moves: sortByBase(base.moves, overrides.moves),
        items: sortByBase(base.items, overrides.items),
      },
      text: text.mods,
    },
  }
}

function inBaseOrder(base: readonly { id: string }[], subset: readonly { id: string }[]) {
  const ids = new Set(subset.map((record) => record.id))
  return base.filter((record) => ids.has(record.id)).map((record) => record.id)
}

function sortByBase<T extends { id: string }>(base: readonly { id: string }[], records: T[]): T[] {
  const order = new Map(base.map((record, index) => [record.id, index]))
  return [...records].sort((a, b) => order.get(a.id)! - order.get(b.id)!)
}

function convertText(
  dump: ChampionsDump,
  base: ModdableBase,
  stateIdByChampionsId: Map<string, string>,
) {
  const baseText: BaseText = structuredClone(base.text)
  const modText: ChampionsMods['text'] = {}
  const pokemonById = byId(base.pokemon)

  for (const [locale, files] of Object.entries(dump.i18n) as [LocaleCode, ChampionsLocaleText][]) {
    const localeBase = (baseText[locale] ??= {}) as Record<string, Record<string, Json>>
    const localeMods = (modText[locale] ??= {}) as Record<string, Record<string, Json>>

    /** Base gets text it lacks; text that differs from base is mod text. */
    const put = (kind: ModdableKind, id: string, field: string, value: string | undefined) => {
      if (value === undefined || value === '') return
      const entry = ((localeBase[kind] ??= {})[id] ??= {})
      if (entry[field] === undefined) entry[field] = value
      else if (entry[field] !== value) ((localeMods[kind] ??= {})[id] ??= {})[field] = value
    }
    const putMod = (kind: ModdableKind, id: string, field: string, value: string | undefined) => {
      if (value === undefined || value === '') return
      const baseValue = localeBase[kind]?.[id]?.[field]
      if (baseValue !== value) ((localeMods[kind] ??= {})[id] ??= {})[field] = value
    }

    for (const record of files.pokemon ?? []) {
      const pokemon = requireBase(pokemonById, 'Pokémon', record.id)
      // Champions names forms by species; the base `name` of a form is its full name.
      put('pokemon', record.id, pokemon.isForm ? 'speciesName' : 'name', record.name)
      // Form labels follow Champions' own wording ("Mega Venusaur" rather than "Mega Form").
      if (record.formName !== undefined) {
        const baseValue = localeBase.pokemon?.[record.id]?.formName
        if (baseValue !== record.formName) {
          ;((localeMods.pokemon ??= {})[record.id] ??= {}).formName = record.formName
        }
      }
    }
    for (const kind of ['moves', 'abilities'] as const) {
      for (const record of files[kind] ?? []) {
        put(kind, record.id, 'name', record.name)
        putMod(kind, record.id, 'desc', record.description)
      }
    }
    for (const record of files.items ?? []) {
      put('items', record.id, 'name', record.name)
      put('items', record.id, 'pluralName', record.pluralName)
      putMod('items', record.id, 'desc', record.description)
    }
    for (const record of files.battleStates ?? []) {
      const id = stateIdByChampionsId.get(record.id)
      if (!id) throw new Error(`${locale} battle state text ${record.id} has no battle state`)
      const entry: Json = {}
      if (record.name) entry.name = record.name
      if (record.description) entry.desc = record.description
      ;(localeBase['battle-states'] ??= {})[id] = entry
    }
  }

  return { base: orderText(baseText, base), mods: orderText(modText, base) }
}

const TEXT_FIELD_ORDER = [
  'name',
  'speciesName',
  'formName',
  'pluralName',
  'title',
  'genus',
  'conditions',
  'shortDesc',
  'desc',
  'formsDesc',
  'evoNotes',
  'formNotes',
  '$unset',
]

/** Orders text by base record order and fields canonically, dropping empty locales. */
function orderText<T extends Partial<Record<LocaleCode, Partial<Record<ModdableKind, unknown>>>>>(
  text: T,
  base: ModdableBase,
): T {
  const ordered: Record<string, Record<string, Record<string, Json>>> = {}
  for (const [locale, files] of Object.entries(text)) {
    for (const kind of moddableKinds) {
      const file = (files as Record<string, Record<string, Json>> | undefined)?.[kind]
      if (!file || Object.keys(file).length === 0) continue
      const out: Record<string, Json> = {}
      const ids = [...base[kind].map((record) => record.id), ...Object.keys(file)]
      for (const id of new Set(ids)) {
        const entry = file[id]
        if (!entry || Object.keys(entry).length === 0) continue
        out[id] = Object.fromEntries(
          Object.entries(entry).sort(
            ([a], [b]) => TEXT_FIELD_ORDER.indexOf(a) - TEXT_FIELD_ORDER.indexOf(b),
          ),
        )
      }
      ;(ordered[locale] ??= {})[kind] = out
    }
  }
  return ordered as T
}

/**
 * Differences between a Champions dump and the merged `champions` game set, ignoring the
 * documented representation changes (variable move power, Pokémon upstream ids kept in `refs`,
 * battle states keyed by slug, dropped slugs). Empty when the merge reproduces the dump.
 */
export function diffMergedChampions(dump: ChampionsDump, merged: MergedGameSet): string[] {
  const problems: string[] = []
  const check = (path: string, expected: unknown, actual: unknown) => {
    if (!isDeepStrictEqual(expected, actual)) {
      problems.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
  }
  const sameIds = (kind: string, expected: readonly { id: string }[], actual?: { id: string }[]) =>
    check(
      `${kind} roster`,
      expected.map((record) => record.id).sort(),
      (actual ?? []).map((record) => record.id).sort(),
    )

  const pokemon = byId(merged.records.pokemon ?? [])
  sameIds('pokemon', dump.pokemon, merged.records.pokemon)
  const learnsets = new Map(dump.pokemonMoves.map((row) => [row.id, row.moves]))
  for (const d of dump.pokemon) {
    const m = pokemon.get(d.id)
    if (!m) continue
    const path = `pokemon/${d.id}`
    check(`${path} nid`, d.nid, m.nid)
    check(`${path} championsId`, d.championsId, m.championsId)
    check(`${path} pokeApiId`, String(d.pokeApiId), m.refs.pkApiId)
    if (d.pokeApiFormId !== undefined) {
      check(`${path} pokeApiFormId`, String(d.pokeApiFormId), m.refs.pkApiFormId)
    }
    check(`${path} showdownId`, d.showdownId, m.refs.showdown)
    check(`${path} baseSpecies`, d.baseSpecies, m.baseSpecies)
    check(`${path} types`, [d.type1, d.type2 ?? undefined], [m.type1, m.type2])
    check(
      `${path} abilities`,
      d.abilities,
      ABILITY_SLOTS.map((slot) => m[slot]).filter((ability) => ability !== undefined),
    )
    check(
      `${path} stats`,
      [d.baseHp, d.baseAtk, d.baseDef, d.baseSpAtk, d.baseSpDef, d.baseSpeed, d.height, d.weight],
      [m.baseHp, m.baseAtk, m.baseDef, m.baseSpAtk, m.baseSpDef, m.baseSpeed, m.height, m.weight],
    )
    check(
      `${path} flags`,
      [d.isForm, d.isBattleOnly, d.isCosmetic, d.isFemale],
      [m.isForm, m.isBattleOnlyForm, m.isCosmeticForm, m.isFemaleForm],
    )
    check(`${path} learnset`, learnsets.get(d.id), m.learnset)
  }

  const moves = byId(merged.records.moves ?? [])
  sameIds('moves', dump.moves, merged.records.moves)
  for (const d of dump.moves) {
    const m = moves.get(d.id)
    if (!m) continue
    const path = `moves/${d.id}`
    if (!sameMovePower(m.power, d.power)) check(`${path} power`, d.power, m.power)
    check(
      `${path} mechanics`,
      [d.type, d.category, d.pp, d.accuracy, d.priority, d.target, d.classification, d.contact],
      [m.type, m.category, m.pp, m.accuracy, m.priority, m.target, m.classification, m.contact],
    )
    check(`${path} usable`, d.usable, m.usable !== false)
    check(`${path} ids`, [d.championsId, d.pokeApiId], [m.championsId, m.pokeApiId])
  }

  const abilities = byId(merged.records.abilities ?? [])
  sameIds('abilities', dump.abilities, merged.records.abilities)
  for (const d of dump.abilities) {
    const m = abilities.get(d.id)
    if (m)
      check(`abilities/${d.id} ids`, [d.championsId, d.pokeApiId], [m.championsId, m.pokeApiId])
  }

  const items = byId(merged.records.items ?? [])
  sameIds('items', dump.items, merged.records.items)
  for (const d of dump.items) {
    const m = items.get(d.id)
    if (!m) continue
    check(`items/${d.id} ids`, [d.championsId, d.pokeApiId], [m.championsId, m.pokeApiId])
    check(`items/${d.id} categories`, d.categories, m.battleCategories ?? [])
  }

  const states = byId(merged.records['battle-states'] ?? [])
  for (const d of dump.battleStates) {
    check(
      `battle-states/${d.slug}`,
      { championsId: d.id, state: d.state },
      {
        championsId: states.get(d.slug)?.championsId,
        state: states.get(d.slug)?.state,
      },
    )
  }
  const stateSlugs = new Map(dump.battleStates.map((state) => [state.id, state.slug]))

  for (const [locale, files] of Object.entries(dump.i18n) as [LocaleCode, ChampionsLocaleText][]) {
    const text = (merged.text[locale] ?? {}) as Record<string, Record<string, Json> | undefined>
    const field = (kind: string, id: string, name: string) => text[kind]?.[id]?.[name]
    const checkText = (kind: string, id: string, name: string, expected: string | undefined) => {
      if (expected === undefined || expected === '') return
      check(`${locale}/${kind}/${id} ${name}`, expected, field(kind, id, name))
    }
    for (const d of files.pokemon ?? []) {
      const isForm = pokemon.get(d.id)?.isForm
      checkText('pokemon', d.id, isForm ? 'speciesName' : 'name', d.name)
      if (d.formName !== undefined)
        check(`${locale}/pokemon/${d.id} formName`, d.formName, field('pokemon', d.id, 'formName'))
    }
    for (const kind of ['moves', 'abilities', 'items'] as const) {
      for (const d of (files[kind] ?? []) as (I18nRecord & { pluralName?: string })[]) {
        checkText(kind, d.id, 'name', d.name)
        checkText(kind, d.id, 'desc', d.description)
        checkText(kind, d.id, 'pluralName', d.pluralName)
      }
    }
    for (const d of files.battleStates ?? []) {
      const id = stateSlugs.get(d.id) ?? d.id
      checkText('battle-states', id, 'name', d.name)
      checkText('battle-states', id, 'desc', d.description)
    }
  }
  return problems
}

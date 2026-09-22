import { stripVTControlCharacters, styleText } from 'node:util'
import { sortStringsInGivenOrder } from '../../utils/utils-internal.ts'
import { resolveFormAvailabilityRule } from './form-availability-rules.ts'
import { curatedFormStorageRule } from './curated-form-availability.ts'
import {
  formAvailabilityInheritance,
  formAvailabilityRestriction,
  formStorageRule,
} from './form-availability-inheritance.ts'
import {
  parseMainAvailability,
  resolveMainAvailability,
  type MainAvailability,
} from './main-availability.ts'
import {
  parseGoAvailability,
  resolveGoAvailability,
  type GoAvailability,
} from './go-availability.ts'

export const availabilityUrls = {
  main: 'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability',
  go: 'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO',
} as const
export const availabilityFields = ['obtainableIn', 'transferOnlyIn', 'eventOnlyIn'] as const
type AvailabilityField = (typeof availabilityFields)[number]
export type AvailabilityStatus = AvailabilityField | 'unavailable' | 'unknown'
export type AvailabilityPokemon = Pick<
  Pkds.Pokemon,
  | 'id'
  | 'nid'
  | 'dexNum'
  | 'gen'
  | 'isDefault'
  | 'isFemaleForm'
  | 'isBattleOnlyForm'
  | 'isRegional'
  | 'region'
  | 'refs'
  | AvailabilityField
  | 'storableIn'
> & {
  formId?: Pkds.Pokemon['formId']
  baseSpecies?: Pkds.Pokemon['baseSpecies']
  baseForms?: Pkds.Pokemon['baseForms']
  debutIn?: Pkds.Pokemon['debutIn']
  isMega?: boolean
  isGmax?: boolean
  isCosmeticForm?: boolean
  names: Partial<Pkds.Pokemon['names']>
  formNames: Partial<Pkds.Pokemon['formNames']>
}
export type AvailabilityGame = Pick<
  Pkds.Game,
  'id' | 'name' | 'gen' | 'type' | 'gameSet' | 'gameSuperSet'
>
export type AvailabilityJson = Pick<
  AvailabilityPokemon,
  'id' | 'nid' | AvailabilityField | 'storableIn'
>
export type LocationMethod = {
  text: string
  status: AvailabilityStatus
  note?: string
  /** Undefined uses the table URL; null denotes an explicit rule without a web citation. */
  sourceUrl?: string | null
}
export type AvailabilityRow = {
  game: AvailabilityGame
  status: AvailabilityStatus
  basis: 'source' | 'rule' | 'dataset' | 'unknown'
  methods: LocationMethod[]
  storable: boolean
  /** Saved base data copied outside the source tables; this is not upstream evidence. */
  inheritedFrom?: string
}
export type AvailabilityReport = {
  pokemon: AvailabilityPokemon
  gameOrder: string[]
  rows: AvailabilityRow[]
  warnings: string[]
  storageRule?: { gameIds: string[]; note: string }
}
export type AvailabilityTables = {
  main?: MainAvailability
  go?: GoAvailability
  gameIds: Set<string>
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function resolvePokemon(input: string, pokemon: AvailabilityPokemon[]): AvailabilityPokemon {
  const id = input.trim().toLowerCase()
  const nid = id.replace(/^\d{1,4}(?=-|$)/, (digits) => digits.padStart(4, '0'))
  const result = pokemon.find((entry) => entry.id === id || entry.nid === nid)
  if (!result) throw new Error(`Unknown Pokémon id or nid: ${input}`)
  return result
}

/** Parse once per source snapshot, then reuse for every dataset record. */
export function parseAvailabilityTables(html: { main?: string; go?: string }): AvailabilityTables {
  if (html.main === undefined && html.go === undefined)
    throw new Error('No availability source supplied')
  const main = html.main === undefined ? undefined : parseMainAvailability(html.main)
  const go = html.go === undefined ? undefined : parseGoAvailability(html.go)
  return { main, go, gameIds: new Set([...(main?.gameIds ?? []), ...(go ? ['go'] : [])]) }
}

export function createAvailabilityReport(
  tables: AvailabilityTables,
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  siblings: AvailabilityPokemon[] = [pokemon],
): AvailabilityReport {
  const cosmeticFemale = pokemon.isFemaleForm && pokemon.isCosmeticForm === true
  const parent = cosmeticFemale
    ? siblings.find((entry) => entry.id === pokemon.id.replace(/-f$/, ''))
    : undefined
  const inheritance = formAvailabilityInheritance(pokemon)
  const base = inheritance && siblings.find((entry) => entry.id === inheritance.baseId)
  const sourceBase = inheritance && siblings.find((entry) => entry.id === inheritance.sourceId)
  const main = tables.main && resolveMainAvailability(tables.main, sourceBase ?? parent ?? pokemon)
  const storageRule = tables.main
    ? (curatedFormStorageRule(pokemon, games) ?? formStorageRule(pokemon, base, games))
    : undefined
  const storableIn = storageRule?.gameIds ?? pokemon.storableIn
  const warnings = [
    storageRule?.note ??
      'storableIn is preserved; these availability lists do not establish box compatibility or form reversion.',
    ...(tables.go?.warnings ?? []),
  ]
  if (inheritance && (!base || !sourceBase))
    warnings.push(
      `Inheritance for ${pokemon.id} needs sibling records ${[...new Set([inheritance.baseId, inheritance.sourceId])].join(', ')}; missing base data is not inferred.`,
    )
  const rows = games
    .filter((game) => game.type === 'game')
    .map((game): AvailabilityRow => {
      let method: LocationMethod | undefined
      let basis: AvailabilityRow['basis'] = 'source'
      const formRule =
        tables.main &&
        (formAvailabilityRestriction(pokemon, game) ??
          resolveFormAvailabilityRule(tables.main, pokemon, game.id, siblings))
      if (formRule) {
        method = formRule
        basis = 'rule'
      } else if (tables.gameIds.has(game.id)) {
        if (cosmeticFemale && game.gen === 1) {
          method = {
            text: 'Cosmetic female forms do not exist before Generation II.',
            status: 'unavailable',
          }
          basis = 'rule'
        } else if (game.id === 'go' && tables.go) {
          method = resolveGoAvailability(tables.go, pokemon, siblings)
          if (!method && sourceBase) {
            method = resolveGoAvailability(tables.go, sourceBase, siblings)
            if (method) {
              basis = 'rule'
              method = {
                ...method,
                note: [method.note, `Form inherits ${sourceBase.id}; no exact GO form entry.`]
                  .filter(Boolean)
                  .join(' '),
              }
            }
          }
        } else {
          method = main?.methods.get(game.id)
          if ((sourceBase || parent) && method) {
            basis = 'rule'
            method = {
              ...method,
              note: [
                method.note,
                sourceBase
                  ? `Form inherits ${sourceBase.id}.`
                  : `Cosmetic female form inherits ${parent!.id}.`,
              ]
                .filter(Boolean)
                .join(' '),
            }
          }
        }
      }
      if (!method || method.status === 'unknown') {
        // Copy the agreed base's saved classifications only outside the lists. A blank or
        // missing source cell keeps the selected form's data and remains visibly unverified.
        if (tables.main && base && !tables.gameIds.has(game.id) && game.id !== 'go') {
          const current = availabilityFields.find((field) => base[field].includes(game.id))
          return {
            game,
            status: current ?? 'unavailable',
            basis: 'dataset',
            inheritedFrom: base.id,
            methods: [
              {
                text: `Saved availability inherited from ${base.id}; no upstream coverage.`,
                status: current ?? 'unavailable',
                sourceUrl: null,
              },
            ],
            storable: storableIn.includes(game.id),
          }
        }
        const current = availabilityFields.find((field) => pokemon[field].includes(game.id))
        return {
          game,
          status: current ?? 'unknown',
          basis: current ? 'dataset' : 'unknown',
          methods: method ? [method] : [],
          storable: storableIn.includes(game.id),
        }
      }
      return {
        game,
        status: method.status,
        basis,
        methods: [method],
        storable: storableIn.includes(game.id),
      }
    })
    .map((row): AvailabilityRow => {
      if (row.game.id !== 'champions' || row.status !== 'obtainableIn') return row
      // Local recruits cannot leave Champions. Removing that route does not prove visitor
      // eligibility; only a separately established transfer route can classify the Pokémon.
      const text =
        'Champions recruits cannot be exported, so obtainableIn is excluded. Visitor availability remains unverified.'
      warnings.push(text)
      return {
        ...row,
        status: 'unknown',
        basis: 'unknown',
        inheritedFrom: undefined,
        methods: [
          {
            status: 'unknown',
            text,
            sourceUrl: 'https://champions.pokemon.com/en-gb/pokemon/',
          },
        ],
      }
    })
  const unresolved = rows.filter((row) => row.basis === 'dataset' || row.basis === 'unknown')
  if (tables.main && !main && unresolved.some((row) => tables.main!.gameIds.has(row.game.id)))
    warnings.push(
      `No exact main-series form row or conclusive rule for ${pokemon.id}; unresolved main-series acquisition retained.`,
    )
  if (unresolved.length)
    warnings.push(
      `Acquisition unverified; saved values ${base ? `inherited from ${base.id} outside source games, otherwise retained` : 'retained'} for: ${unresolved.map((row) => row.game.id).join(', ')}.`,
    )
  return {
    pokemon,
    gameOrder: games.map((game) => game.id),
    rows,
    warnings,
    ...(storageRule ? { storageRule } : {}),
  }
}

/** Established cells and explicit inheritance replace data; retained values obey export restrictions. */
export function availabilityJson(report: AvailabilityReport): AvailabilityJson {
  const { pokemon, rows } = report
  const result = {
    id: pokemon.id,
    nid: pokemon.nid,
    obtainableIn: [...pokemon.obtainableIn],
    transferOnlyIn: [...pokemon.transferOnlyIn],
    eventOnlyIn: [...pokemon.eventOnlyIn],
    storableIn: [...(report.storageRule?.gameIds ?? pokemon.storableIn)],
  }
  for (const row of rows) {
    if (row.basis !== 'source' && row.basis !== 'rule' && !row.inheritedFrom) continue
    for (const field of availabilityFields) {
      result[field] = result[field].filter((id) => id !== row.game.id)
      if (row.status === field) result[field].push(row.game.id)
    }
  }
  // Applies even to retained data or a report limited to other games. See
  // docs/pokemon-availability.md: Champions is not an exportable acquisition source.
  result.obtainableIn = result.obtainableIn.filter((id) => id !== 'champions')
  for (const field of availabilityFields) {
    const ids = [...new Set(result[field])]
    result[field] = sortStringsInGivenOrder(ids, [...report.gameOrder, ...ids])
  }
  return result
}

export function availabilityChanges(report: AvailabilityReport) {
  const candidate = availabilityJson(report)
  return [...availabilityFields, 'storableIn' as const].map((field) => {
    const before = new Set(report.pokemon[field])
    const after = new Set(candidate[field])
    return {
      field,
      added: [...after].filter((id) => !before.has(id)),
      removed: [...before].filter((id) => !after.has(id)),
    }
  })
}

export function formatAvailabilityChanges(report: AvailabilityReport): string {
  const colors = {
    obtainableIn: 'green',
    transferOnlyIn: 'cyan',
    eventOnlyIn: 'magenta',
    storableIn: 'yellow',
  } as const
  const games = new Map(report.rows.map((row) => [row.game.id, row.game.name]))
  const describe = (ids: string[]) =>
    ids.map((id) => (games.has(id) ? `${games.get(id)} (${id})` : id)).join(', ')
  return availabilityChanges(report)
    .map(({ field, added, removed }) => {
      const label = styleText(['bold', colors[field]], `${field}:`)
      return !added.length && !removed.length
        ? `${label} unchanged`
        : `${label}\n  Added: ${describe(added) || 'none'}\n  Removed: ${describe(removed) || 'none'}`
    })
    .join('\n')
}

export function formatAvailabilityProposal(report: AvailabilityReport): string {
  const changes = availabilityChanges(report)
  const added = changes.reduce((count, change) => count + change.added.length, 0)
  const removed = changes.reduce((count, change) => count + change.removed.length, 0)
  return `Proposed changes: ${added || removed ? `${added} additions, ${removed} removals` : 'none'}\n${formatAvailabilityChanges(report)}`
}

function wrapCell(text: string, width: number): string[] {
  const clean = stripVTControlCharacters(text).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
  return clean.split('\n').flatMap((paragraph) => {
    const lines: string[] = []
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && Array.from(`${line} ${word}`).length <= width) {
        line += ` ${word}`
        continue
      }
      if (line) lines.push(line)
      const characters = Array.from(word)
      while (characters.length > width) lines.push(characters.splice(0, width).join(''))
      line = characters.join('')
    }
    lines.push(line)
    return lines
  })
}

export function formatAvailabilityTable(
  report: AvailabilityReport,
  columns = process.stdout.columns || 120,
): string {
  const width = Math.max(60, Math.min(160, columns))
  const gameWidth = Math.min(26, Math.floor(width / 4))
  const widths = [gameWidth, 13, 7, width - gameWidth - 13 - 7 - 13]
  const border = (left: string, middle: string, right: string) =>
    left + widths.map((size) => '─'.repeat(size + 2)).join(middle) + right
  const renderRow = (cells: string[]) => {
    const wrapped = cells.map((cell, index) => wrapCell(cell, widths[index]))
    return Array.from(
      { length: Math.max(...wrapped.map((cell) => cell.length)) },
      (_, line) =>
        '│ ' +
        wrapped
          .map((cell, index) => {
            const value = cell[line] ?? ''
            return value + ' '.repeat(widths[index] - Array.from(value).length)
          })
          .join(' │ ') +
        ' │',
    )
  }
  const statuses: Record<AvailabilityStatus, string> = {
    obtainableIn: 'Obtainable',
    transferOnlyIn: 'Transfer only',
    eventOnlyIn: 'Event only',
    unavailable: 'Unavailable',
    unknown: 'Unknown',
  }
  const lines = [
    border('┌', '┬', '┐'),
    ...renderRow(['Game (ID)', 'Acquisition', 'Basis', 'Source evidence']),
  ]
  for (const row of report.rows) {
    const methods = row.methods
      .map((method) => `${method.text}${method.note ? ` (${method.note})` : ''}`)
      .join('\n')
    lines.push(
      border('├', '┼', '┤'),
      ...renderRow([
        `${row.game.name} (${row.game.id})`,
        statuses[row.status],
        row.basis,
        methods || 'No matching source row; unverified',
      ]),
    )
  }
  lines.push(border('└', '┴', '┘'))
  return lines.join('\n')
}

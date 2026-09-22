import { load, type CheerioAPI } from 'cheerio'
import type { AvailabilityPokemon, AvailabilityStatus, LocationMethod } from './availability.ts'

type Element = Exclude<Parameters<typeof load>[0], string | Buffer | unknown[]>

const gameColumns = [
  ['Red', 'rb-r', 1],
  ['Green', 'rb-b', 1],
  ['Blue (Japanese)', null, 1],
  ['Yellow', 'y', 1],
  ['Gold', 'gs-g', 2],
  ['Silver', 'gs-s', 2],
  ['Crystal', 'c', 2],
  ['Ruby', 'rs-r', 3],
  ['Sapphire', 'rs-s', 3],
  ['FireRed', 'frlg-fr', 3],
  ['LeafGreen', 'frlg-lg', 3],
  ['Emerald', 'e', 3],
  ['Colosseum', 'col', 3],
  ['XD', 'xd', 3],
  ['Diamond', 'dp-d', 4],
  ['Pearl', 'dp-p', 4],
  ['Platinum', 'pt', 4],
  ['HeartGold', 'hgss-hg', 4],
  ['SoulSilver', 'hgss-ss', 4],
  ['Black', 'bw-b', 5],
  ['White', 'bw-w', 5],
  ['Black 2', 'b2w2-b2', 5],
  ['White 2', 'b2w2-w2', 5],
  ['X', 'xy-x', 6],
  ['Y', 'xy-y', 6],
  ['Omega Ruby', 'oras-or', 6],
  ['Alpha Sapphire', 'oras-as', 6],
  ['Sun', 'sm-s', 7],
  ['Moon', 'sm-m', 7],
  ['Ultra Sun', 'usum-us', 7],
  ['Ultra Moon', 'usum-um', 7],
  ["Let's Go, Pikachu!", 'lgpe-lgp', 7],
  ["Let's Go, Eevee!", 'lgpe-lge', 7],
  ['Sword', 'swsh-sw', 8],
  ['Shield', 'swsh-sh', 8],
  ['Brilliant Diamond', 'bdsp-bd', 8],
  ['Shining Pearl', 'bdsp-sp', 8],
  ['Legends: Arceus', 'la', 8],
  ['Scarlet', 'sv-s', 9],
  ['Violet', 'sv-v', 9],
  ['Legends: Z-A', 'lza', 9],
] as const
type Column = (typeof gameColumns)[number]
export type MainAvailability = {
  gameIds: Set<string>
  rows: Map<number, { form: string; methods: Map<string, LocationMethod> }[]>
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()
const formKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b(?:form|forme|breed)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
const symbols: Record<string, AvailabilityStatus> = {
  C: 'obtainableIn',
  S: 'obtainableIn',
  R: 'obtainableIn',
  E: 'obtainableIn',
  B: 'obtainableIn',
  CD: 'obtainableIn',
  D: 'obtainableIn',
  DA: 'obtainableIn',
  ET: 'obtainableIn',
  TE: 'transferOnlyIn',
  CC: 'obtainableIn',
  DS: 'obtainableIn',
  FS: 'obtainableIn',
  EV: 'eventOnlyIn',
  PW: 'transferOnlyIn',
  DR: 'transferOnlyIn',
  DW: 'transferOnlyIn',
  Ev: 'transferOnlyIn',
  T: 'transferOnlyIn',
  '—': 'unavailable',
}

/** Keep case: EV is an event-unlocked catch; Ev is a distribution/import. */
export function classifyAvailabilitySymbol(
  code: string,
  legend: Map<string, string>,
): LocationMethod {
  if (!code) return { text: 'Empty source cell', status: 'unknown' }
  // E, B, ET and D are the legend's evolution, breeding, trade-evolution and DLC suffixes.
  const pattern = /^(Ev|EV|PW|DR|DW|DS|FS|DA|TE|ET|CD|CC|C|S|R|E|B|D|T|—)(ET|E|B)?(D)?$/
  let match = pattern.exec(code)
  const communicationPrefix = !match && code.startsWith('CC')
  if (communicationPrefix) match = pattern.exec(code.slice(2))
  if (!match || (match[1] === '—' && code !== '—'))
    throw new Error(`Unknown availability symbol: ${code}`)
  const base = match[1]
  if (!legend.has(base) || (communicationPrefix && !legend.has('CC')))
    throw new Error(`Availability symbol missing from legend: ${code}`)
  const notes = [
    communicationPrefix ? legend.get('CC') : undefined,
    legend.get(base),
    match[2] ? legend.get(match[2]) : undefined,
    match[3] ? 'D suffix: requires paid DLC.' : undefined,
  ]
  return { text: code, status: symbols[base], note: notes.filter(Boolean).join(' ') }
}

function tableRows($: CheerioAPI, table: Element): Element[] {
  return $(table)
    .children('tbody,thead,tfoot')
    .children('tr')
    .add($(table).children('tr'))
    .toArray()
}

/** Expand spans before reading positions; nested tables never contribute rows. */
function grid($: CheerioAPI, table: Element): Element[][] {
  const output: Element[][] = []
  tableRows($, table).forEach((row, y) => {
    output[y] ??= []
    let x = 0
    for (const cell of $(row).children('th,td').toArray()) {
      while (output[y][x]) x++
      const width = Number($(cell).attr('colspan') ?? 1)
      const height = Number($(cell).attr('rowspan') ?? 1)
      if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 100))
        throw new Error('Invalid availability table span')
      for (let dy = 0; dy < height; dy++) {
        output[y + dy] ??= []
        for (let dx = 0; dx < width; dx++) {
          if (output[y + dy][x + dx]) throw new Error('Overlapping availability table cells')
          output[y + dy][x + dx] = cell
        }
      }
      x += width
    }
  })
  return output
}

function color($: CheerioAPI, cell: Element): string {
  const colors = [
    ...new Set(
      ($(cell).attr('style') ?? '').match(/#[0-9a-f]{6}\b/gi)?.map((s) => s.toLowerCase()),
    ),
  ].filter((s) => s !== '#ffffff')
  if (colors.length !== 1) throw new Error('Missing or ambiguous game color in availability table')
  return colors[0]
}

export function parseMainAvailability(html: string): MainAvailability {
  const $ = load(html)
  const title = clean($('#firstHeading').text())
  if (title && title !== 'List of Pokémon by availability')
    throw new Error(`Unexpected availability page title: ${title}`)
  const orderParagraph = $('p').filter((_, p) => $(p).text().includes('Games are ordered'))
  if (orderParagraph.length !== 1)
    throw new Error('Bulbapedia game-order description was not found')
  const orderHtml = (orderParagraph.html() ?? '').split('Games are ordered')[1]
  const order = load(orderHtml, null, false)
  const labels = order('a')
    .toArray()
    .flatMap((a) => {
      const label = clean(order(a).text())
      if (label === 'Blue') {
        if (/Japanese/i.test(order(a).attr('href') ?? '')) return ['Blue (Japanese)']
        // The English Blue link is an explanation of Green, not another column.
        return []
      }
      return [label]
    })
  if (JSON.stringify(labels) !== JSON.stringify(gameColumns.map(([label]) => label)))
    throw new Error(
      'Bulbapedia game order changed; update the explicit game mapping before importing',
    )

  const header = (table: Element) =>
    $(table)
      .find('tr')
      .first()
      .children('th,td')
      .toArray()
      .map((cell) => clean($(cell).text()))
      .join(' ')
  const legendTable = $('table')
    .toArray()
    .find((t) => header(t) === 'Symbol Meaning')
  if (!legendTable) throw new Error('Bulbapedia availability legend was not found')
  const legend = new Map<string, string>()
  for (const row of tableRows($, legendTable)) {
    const cells = $(row).children('td')
    if (cells.length === 2) legend.set(clean(cells.eq(0).text()), clean(cells.eq(1).text()))
  }
  if (
    legend.size !== Object.keys(symbols).length ||
    Object.keys(symbols).some((key) => !legend.has(key))
  )
    throw new Error(
      'Bulbapedia availability legend changed; review symbol mappings before importing',
    )

  const tables = $('table')
    .toArray()
    .filter((t) => header(t) === '# Icon Name Game')
  if (!tables.length) throw new Error('Bulbapedia availability tables were not found')
  const palette = new Map<string, Column>()
  const result: MainAvailability = {
    gameIds: new Set(gameColumns.flatMap(([, id]) => (id ? [id] : []))),
    rows: new Map(),
  }
  for (const [tableIndex, table] of tables.entries()) {
    const rows = grid($, table)
    if (rows.length < 3) throw new Error('Availability table has no Pokémon rows')
    const first = rows[2]
    if (tableIndex === 0) {
      if (first.length !== gameColumns.length + 3)
        throw new Error('Full availability table has an unexpected column count')
      first.slice(3).forEach((cell, index) => {
        const key = color($, cell)
        if (palette.has(key)) throw new Error('Duplicate game colors in availability table')
        palette.set(key, gameColumns[index])
      })
    }
    const columns = first.slice(3).map((cell) => {
      const column = palette.get(color($, cell))
      if (!column) throw new Error('Unrecognized game column in availability table')
      return column
    })
    const positions = columns.map((column) => gameColumns.indexOf(column))
    if (positions.some((position, i) => i > 0 && position <= positions[i - 1]))
      throw new Error('Availability table columns do not follow the declared game order')
    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
    for (const [index, column] of columns.entries()) {
      const expected = ['col', 'xd'].includes(column[1] ?? '')
        ? 'GCN'
        : `Generation ${roman[column[2]]}`
      if (clean($(rows[1][index + 3]).text()) !== expected)
        throw new Error('Availability generation header does not match its game columns')
    }
    for (const row of rows.slice(2)) {
      if (row.length !== columns.length + 3)
        throw new Error('Availability row has an unexpected column count')
      const number = clean($(row[0]).text())
      if (!/^\d{4}$/.test(number)) throw new Error(`Invalid availability Pokédex number: ${number}`)
      const dex = Number(number)
      let form = clean($(row[2]).find('small').text()).replace(/^\(|\)$/g, '')
      // Several rows distinguish forms only through the icon filename.
      const icon = decodeURIComponent($(row[1]).find('img').attr('src') ?? '')
      const iconForm =
        /-(West|East|Red|Blue|White|Summer|Autumn|Winter|Eternal|Male|Female|Midnight|Dusk|Original|Amped|Low_Key|Roaming)\.png$/.exec(
          icon,
        )?.[1]
      if (!form && iconForm)
        form =
          (
            {
              Red: 'Red-Striped',
              Blue: 'Blue-Striped',
              White: 'White-Striped',
              Male: 'm',
              Female: 'f',
            } as Record<string, string>
          )[iconForm] ?? iconForm
      const methods = new Map<string, LocationMethod>()
      row.slice(3).forEach((cell, index) => {
        const column = columns[index]
        if (palette.get(color($, cell)) !== column)
          throw new Error(`Misaligned availability cell for #${number}`)
        const clone = $(cell).clone()
        const notes = clone
          .find('[title]')
          .toArray()
          .map((el) => $(el).attr('title'))
          .filter(Boolean)
        clone.find('.explain,sup').remove()
        const method = classifyAvailabilitySymbol(clean(clone.text()), legend)
        if (notes.length) method.note = [method.note, ...notes].filter(Boolean).join(' ')
        if (column[1]) methods.set(column[1], method)
      })
      // The table omits earlier generations and games whose roster excludes this species.
      for (const id of result.gameIds)
        if (!methods.has(id))
          methods.set(id, {
            text: 'Not included in this species’ game columns',
            status: 'unavailable',
          })
      const siblings = result.rows.get(dex) ?? []
      if (siblings.some((entry) => formKey(entry.form) === formKey(form)))
        throw new Error(`Duplicate availability row for #${number} ${form}`)
      siblings.push({ form, methods })
      result.rows.set(dex, siblings)
    }
  }
  return result
}

export function resolveMainAvailability(parsed: MainAvailability, pokemon: AvailabilityPokemon) {
  const rows = parsed.rows.get(Number(pokemon.dexNum)) ?? []
  // Unqualified species rows cannot distinguish non-default alternate forms.
  if (/^\d{4}$/.test(pokemon.nid) && rows.some((row) => !row.form))
    return rows.find((row) => !row.form)
  const aliases = [pokemon.formNames.eng ?? '', pokemon.formId ?? ''].map(formKey).filter(Boolean)
  const regional = {
    alola: 'alolan',
    galar: 'galarian',
    hisui: 'hisuian',
    paldea: 'paldean',
  } as Record<string, string>
  if (pokemon.isRegional && pokemon.formId && regional[pokemon.formId])
    aliases.push(regional[pokemon.formId])
  if (pokemon.formId === 'white-striped') aliases.push('hisuian')
  return rows.find((row) => row.form && aliases.includes(formKey(row.form)))
}

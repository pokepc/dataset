import { load } from 'cheerio'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { AvailabilityGame, AvailabilityPokemon } from '../bulbapedia/availability.ts'

export type SerebiiEvidence = { url: string; gameIds: string[]; html: string }
type Target = Pick<SerebiiEvidence, 'url' | 'gameIds'>
type Options = { signal?: AbortSignal; cacheDir?: string; forceRefresh?: boolean }

// Explicit coverage avoids treating HOME, GO, side games, or later generations as
// evidence from whichever page happens to share their generation number.
const pages = [
  { path: 'pokedex', maxDex: 151, games: ['rb-r', 'rb-b', 'y'] },
  { path: 'pokedex-gs', maxDex: 251, games: ['gs-g', 'gs-s', 'c'] },
  { path: 'pokedex-rs', maxDex: 386, games: ['rs-r', 'rs-s', 'e', 'frlg-fr', 'frlg-lg'] },
  { path: 'pokedex-dp', maxDex: 493, games: ['dp-d', 'dp-p', 'pt', 'hgss-hg', 'hgss-ss'] },
  { path: 'pokedex-bw', maxDex: 649, games: ['bw-b', 'bw-w', 'b2w2-b2', 'b2w2-w2'] },
  { path: 'pokedex-xy', maxDex: 721, games: ['xy-x', 'xy-y', 'oras-or', 'oras-as'] },
  { path: 'pokedex-sm', maxDex: 807, games: ['sm-s', 'sm-m', 'usum-us', 'usum-um'] },
  { path: 'pokedex-sm', maxDex: 809, games: ['lgpe-lgp', 'lgpe-lge'] },
  {
    path: 'pokedex-swsh',
    maxDex: 905,
    games: ['swsh-sw', 'swsh-sh', 'bdsp-bd', 'bdsp-sp', 'la'],
  },
  { path: 'pokedex-sv', maxDex: 1025, games: ['sv-s', 'sv-v'] },
]

// The dataset stores punctuation-free slugs for these species; Serebii retains it.
const slugAliases: Record<string, string> = {
  farfetchd: "farfetch'd",
  mrmime: 'mr.mime',
  hooh: 'ho-oh',
  mimejr: 'mimejr.',
  porygonz: 'porygon-z',
  typenull: 'type:null',
  jangmoo: 'jangmo-o',
  hakamoo: 'hakamo-o',
  kommoo: 'kommo-o',
  sirfetchd: "sirfetch'd",
  mrrime: 'mr.rime',
  wochien: 'wo-chien',
  chienpao: 'chien-pao',
  tinglu: 'ting-lu',
  chiyu: 'chi-yu',
}

function pageUrl(pokemon: AvailabilityPokemon, gameId: string): string | undefined {
  const page = pages.find((entry) => entry.games.includes(gameId))
  const dexNum = Number(pokemon.dexNum)
  if (!page || !Number.isInteger(dexNum) || dexNum < 1 || dexNum > page.maxDex) return undefined
  // The shared Gen VII directory covers Let's Go's Kanto species plus Meltan/Melmetal.
  if (gameId.startsWith('lgpe-') && dexNum > 151 && dexNum < 808) return undefined
  const modern = page.path === 'pokedex-swsh' || page.path === 'pokedex-sv'
  const reference = pokemon.refs.serebii.trim().toLowerCase()
  if (modern && !/^[a-z0-9-]+$/.test(reference)) {
    throw new Error(`Invalid Serebii species reference for ${pokemon.id}`)
  }
  const suffix = modern
    ? `${slugAliases[reference] ?? reference}/`
    : `${String(dexNum).padStart(3, '0')}.shtml`
  return `https://www.serebii.net/${page.path}/${suffix}`
}

export function serebiiTargets(
  pokemon: AvailabilityPokemon,
  games: AvailabilityGame[],
  targetGameIds: string[],
): Target[] {
  const requested = new Set(targetGameIds)
  const targets = new Map<string, Target>()
  for (const game of games) {
    if (game.type !== 'game' || !requested.has(game.id)) continue
    const url = pageUrl(pokemon, game.id)
    if (!url) continue
    const target = targets.get(url) ?? { url, gameIds: [] }
    if (!target.gameIds.includes(game.id)) target.gameIds.push(game.id)
    targets.set(url, target)
  }
  return [...targets.values()]
}

const maxPageBytes = 2_000_000
const maxEvidenceLength = 60_000
const compactText = (value: string) => value.replace(/\s+/g, ' ').trim()
const normalizedName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

function extractEvidence(html: string, pokemon: AvailabilityPokemon): string {
  const $ = load(html)
  const title = compactText($('title').text())
  const dexNumber = title.match(/#(\d{1,4})\b/)?.[1]
  if (
    Number(dexNumber) !== Number(pokemon.dexNum) ||
    !normalizedName(title).includes(normalizedName(pokemon.refs.serebii)) ||
    !/serebii/i.test(title)
  ) {
    throw new Error(`Serebii page does not identify species #${pokemon.dexNum} (${pokemon.id})`)
  }
  $('script, style, iframe, form, nav, noscript, template').remove()
  const tables = $('table').filter((_, table) => {
    const heading = compactText($(table).find('td,th').first().text())
    return /^(?:Locations?\b|Evolutionary Chain\b|Alternate Forms?\b|Form(?:e)? Changes?\b)/i.test(
      heading,
    )
  })
  const selected = tables.filter((_, table) => !$(table).parents().is(tables))
  if (
    !selected
      .toArray()
      .some((table) => /^Locations?\b/i.test(compactText($(table).find('td,th').first().text())))
  ) {
    throw new Error('Serebii page contains no identifiable location table')
  }

  const result = load('<!doctype html><html><head></head><body></body></html>')
  result('head').append(result('<title></title>').text(title))
  for (const table of selected.toArray()) result('body').append($.html(table))
  result('*').each((_, element) => {
    if (!('attribs' in element)) return
    // Keep image filenames and alt/title text: evolution conditions and regional
    // forms are often encoded by images rather than ordinary text in these tables.
    for (const key of Object.keys(element.attribs)) {
      if (!['href', 'src', 'alt', 'title', 'rowspan', 'colspan'].includes(key)) {
        result(element).removeAttr(key)
      } else if (
        ['href', 'src'].includes(key) &&
        /^\s*(?:javascript|data):/i.test(element.attribs[key])
      ) {
        result(element).removeAttr(key)
      }
    }
  })
  const evidence = result.html().replace(/\s+/g, ' ').trim()
  if (evidence.length > maxEvidenceLength) {
    throw new Error(
      'Serebii location/form/evolution evidence is too large to review without truncation',
    )
  }
  return evidence
}

let lastRequestAt = 0
let requestQueue = Promise.resolve()

async function throttle(signal?: AbortSignal): Promise<void> {
  const turn = requestQueue.then(async () => {
    signal?.throwIfAborted()
    const remaining = 500 - (Date.now() - lastRequestAt)
    if (remaining > 0) await delay(remaining, undefined, { signal })
    signal?.throwIfAborted()
    lastRequestAt = Date.now()
  })
  requestQueue = turn.catch(() => {})
  await turn
}

export async function fetchSerebiiEvidence(
  target: Target,
  pokemon: AvailabilityPokemon,
  options: Options = {},
): Promise<SerebiiEvidence> {
  options.signal?.throwIfAborted()
  if (!target.gameIds.length || target.gameIds.some((id) => pageUrl(pokemon, id) !== target.url)) {
    throw new Error('Invalid Serebii evidence target URL or game coverage')
  }
  const cacheDir = options.cacheDir ?? '.local/serebii'
  const key = createHash('sha256').update(target.url).digest('hex')
  const cacheFile = join(cacheDir, `${key}.json`)
  if (!options.forceRefresh) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf8'))
      if (cached?.version === 1 && cached.url === target.url && typeof cached.html === 'string') {
        const html = extractEvidence(cached.html, pokemon)
        options.signal?.throwIfAborted()
        return { ...target, html }
      }
    } catch (error) {
      options.signal?.throwIfAborted()
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        // Invalid cached evidence is never silently accepted; a single fresh fetch
        // can repair it, with ordinary network errors left visible to the caller.
        if (!(error instanceof Error) || !error.message.startsWith('Serebii')) throw error
      }
    }
  }
  await throttle(options.signal)
  const signal = AbortSignal.any(
    [options.signal, AbortSignal.timeout(30_000)].filter((value): value is AbortSignal => !!value),
  )
  const response = await fetch(target.url, { signal, redirect: 'error' })
  if (!response.ok) throw new Error(`Serebii returned HTTP ${response.status}`)
  if (Number(response.headers.get('content-length')) > maxPageBytes) {
    throw new Error('Serebii page exceeds the maximum supported size')
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > maxPageBytes)
    throw new Error('Serebii page exceeds the maximum supported size')
  const contentType = response.headers.get('content-type') ?? ''
  const start = new TextDecoder().decode(bytes.slice(0, 2048))
  const charset = /charset\s*=\s*["']?([\w-]+)/i.exec(`${contentType} ${start}`)?.[1] ?? 'utf-8'
  const html = extractEvidence(new TextDecoder(charset).decode(bytes), pokemon)
  signal.throwIfAborted()
  await mkdir(cacheDir, { recursive: true })
  const temporary = `${cacheFile}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, url: target.url, html }), 'utf8')
    signal.throwIfAborted()
    await rename(temporary, cacheFile)
  } finally {
    await rm(temporary, { force: true })
  }
  return { ...target, html }
}

import { load } from 'cheerio'
import type { CatalogEntry } from './types.ts'

const origin = 'https://www.serebii.net'
const regionAliases: Record<string, string> = {
  lumiosecity: 'kalos',
  terarium: 'unova',
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function locationUrl(value: string, base = origin): URL | null {
  try {
    const url = new URL(value, base)
    if (!['serebii.net', 'www.serebii.net'].includes(url.hostname)) return null
    if (!/^\/pokearth\/[^/]+\/(?:[^/]+\/)*[^/]+\.shtml$/.test(url.pathname)) return null
    if (url.pathname.endsWith('/index.shtml')) return null
    url.protocol = 'https:'
    url.hostname = 'www.serebii.net'
    url.hash = ''
    url.search = ''
    return url
  } catch {
    return null
  }
}

export function parseSerebiiCatalog(html: string): CatalogEntry[] {
  const $ = load(html)
  const entries = new Map<string, CatalogEntry>()
  $('select option[value]').each((_, option) => {
    const url = locationUrl($(option).attr('value')!)
    const name = cleanText($(option).text())
    if (!url || !name || /^Pok[eé]arth\b/i.test(name)) return
    const sourceRegion = url.pathname.split('/')[2]
    entries.set(url.pathname, {
      source: 'serebii',
      sourceId: url.pathname,
      url: url.href,
      name,
      // Preserve unknown catalog regions so the importer can report explicit exclusions.
      region: regionAliases[sourceRegion] ?? sourceRegion,
      games: [],
      pokeApiId: null,
      pages: [url.href],
    })
  })
  if (!entries.size) throw new Error('Pokéarth catalog contains no location entries')
  return [...entries.values()]
}

function editionKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\b(?:pokemon|and|versions?)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const editions: Record<string, string[]> = {}
const gamePartners = new Map<string, string>()
const gamePairs = [
  [
    ['Red', 'rb-r'],
    ['Blue', 'rb-b'],
  ],
  [
    ['Gold', 'gs-g'],
    ['Silver', 'gs-s'],
  ],
  [
    ['Ruby', 'rs-r'],
    ['Sapphire', 'rs-s'],
  ],
  [
    ['FireRed', 'frlg-fr'],
    ['LeafGreen', 'frlg-lg'],
  ],
  [
    ['Diamond', 'dp-d'],
    ['Pearl', 'dp-p'],
  ],
  [
    ['HeartGold', 'hgss-hg'],
    ['SoulSilver', 'hgss-ss'],
  ],
  [
    ['Black', 'bw-b'],
    ['White', 'bw-w'],
  ],
  [
    ['Black 2', 'b2w2-b2'],
    ['White 2', 'b2w2-w2'],
  ],
  [
    ['X', 'xy-x'],
    ['Y', 'xy-y'],
  ],
  [
    ['Omega Ruby', 'oras-or'],
    ['Alpha Sapphire', 'oras-as'],
  ],
  [
    ['Sun', 'sm-s'],
    ['Moon', 'sm-m'],
  ],
  [
    ['Ultra Sun', 'usum-us'],
    ['Ultra Moon', 'usum-um'],
  ],
  [
    ["Let's Go, Pikachu!", 'lgpe-lgp'],
    ["Let's Go, Eevee!", 'lgpe-lge'],
  ],
  [
    ['Sword', 'swsh-sw'],
    ['Shield', 'swsh-sh'],
  ],
  [
    ['Brilliant Diamond', 'bdsp-bd'],
    ['Shining Pearl', 'bdsp-sp'],
  ],
  [
    ['Scarlet', 'sv-s'],
    ['Violet', 'sv-v'],
  ],
] as const

for (const [left, right] of gamePairs) {
  editions[editionKey(left[0])] = [left[1]]
  editions[editionKey(right[0])] = [right[1]]
  editions[editionKey(`${left[0]} & ${right[0]}`)] = [left[1], right[1]]
  gamePartners.set(left[1], right[1])
  gamePartners.set(right[1], left[1])
}
for (const [name, id] of [
  ['Yellow', 'y'],
  ['Crystal', 'c'],
  ['Emerald', 'e'],
  ['Platinum', 'pt'],
  ['Colosseum', 'col'],
  ['XD', 'xd'],
  ['XD: Gale of Darkness', 'xd'],
  ['Legends: Arceus', 'la'],
  ['Legends: Z-A', 'lza'],
]) {
  editions[editionKey(name)] = [id]
}
editions.letsgopikachueevee = ['lgpe-lgp', 'lgpe-lge']
editions.redblueyellow = ['rb-r', 'rb-b', 'y']
editions.goldsilvercrystal = ['gs-g', 'gs-s', 'c']
editions.rubysapphireemerald = ['rs-r', 'rs-s', 'e']
editions.diamondpearlplatinum = ['dp-d', 'dp-p', 'pt']
editions.letsgo = editions.letsgopikachueevee
editions.bdsp = ['bdsp-bd', 'bdsp-sp']
editions.dppt = editions.diamondpearlplatinum

const mapEditions: Record<string, string[]> = {
  'kanto-lgpe': editions.letsgo,
  'kanto-frlg': editions.fireredleafgreen,
  'kanto-hgss': editions.heartgoldsoulsilver,
  'kanto-rb': editions.redblue,
  'kanto-rby': editions.redblueyellow,
  'johto-hgss': editions.heartgoldsoulsilver,
  'hoenn-oras': editions.omegarubyalphasapphire,
  'hoenn-em': editions.emerald,
  'sinnoh-bdsp': editions.bdsp,
  'sinnoh-pt': editions.platinum,
  'orre-xd': editions.xd,
}

// This only rejects incompatible evidence; regions never create game memberships.
const regionGames: Record<string, string[]> = {
  kanto: [
    'rb-r',
    'rb-b',
    'y',
    'gs-g',
    'gs-s',
    'c',
    'frlg-fr',
    'frlg-lg',
    'hgss-hg',
    'hgss-ss',
    'lgpe-lgp',
    'lgpe-lge',
  ],
  johto: ['gs-g', 'gs-s', 'c', 'hgss-hg', 'hgss-ss'],
  hoenn: ['rs-r', 'rs-s', 'e', 'oras-or', 'oras-as'],
  orre: ['col', 'xd'],
  sinnoh: ['dp-d', 'dp-p', 'pt', 'bdsp-bd', 'bdsp-sp'],
  unova: ['bw-b', 'bw-w', 'b2w2-b2', 'b2w2-w2'],
  kalos: ['xy-x', 'xy-y', 'lza'],
  alola: ['sm-s', 'sm-m', 'usum-us', 'usum-um'],
  galar: ['swsh-sw', 'swsh-sh'],
  hisui: ['la'],
  paldea: ['sv-s', 'sv-v'],
  kitakami: ['sv-s', 'sv-v'],
  terarium: ['sv-s', 'sv-v'],
  lumiosecity: ['lza'],
}

const versionClasses = new Set([
  'red',
  'blue',
  'yellow',
  'gold',
  'silver',
  'crystal',
  'ruby',
  'sapphire',
  'emerald',
  'firered',
  'leafgreen',
  'diamond',
  'pearl',
  'platinum',
  'heartgold',
  'soulsilver',
  'black',
  'white',
  'black2',
  'white2',
  'x',
  'y',
  'sun',
  'moon',
  'ultrasun',
  'ultramoon',
  'lgpika',
  'lgeevee',
  'sword',
  'shield',
  'scarlet',
  'violet',
  'col',
  'colosseum',
  'xd',
])

export function parseSerebiiPage(html: string, url: string): { games: string[]; pages: string[] } {
  const $ = load(html)
  // Team Flare HQ still uses the legacy table layout; scope it to the content cell,
  // not the surrounding table containing the site's game navigation.
  const content = $('main').first()
  const main = (
    content.length ? content : $('table.tab').first().closest('td[width="99%"]')
  ).clone()
  if (!main.length) throw new Error(`Pokéarth page has no main content: ${url}`)
  main.find('nav, aside, header, footer, select, script, style').remove()
  const games = new Set<string>()
  const pages = new Set<string>()
  const currentUrl = locationUrl(url)
  const sourceRegion = currentUrl?.pathname.split('/')[2] ?? ''
  const allowed = regionGames[sourceRegion] ?? []
  const allowedEvidence = new Set(allowed)
  // Pokéarth catalogs Navel Rock and Birth Island under Kanto, including Emerald visits.
  if (sourceRegion === 'kanto') allowedEvidence.add('e')
  const addEdition = (label: string) => {
    for (const game of editions[editionKey(cleanText(label))] ?? []) {
      if (allowedEvidence.has(game)) games.add(game)
    }
  }

  main.find('table.anctab').each((_, table) => {
    const heading = $(table).find('tr').first().find('td, th').first().text()
    if (cleanText(heading) !== 'Game Anchors') return
    $(table)
      .find('a[href]')
      .each((_, anchor) => {
        const target = locationUrl($(anchor).attr('href')!, url)
        if (target && currentUrl && target.pathname === currentUrl.pathname) {
          // Explicit edition labels on the active page are useful even without encounters.
          // Labels containing only a generation remain unresolved.
          addEdition($(anchor).text())
        }
        if (
          target &&
          currentUrl &&
          target.pathname !== currentUrl.pathname &&
          target.pathname.split('/')[2] === currentUrl.pathname.split('/')[2] &&
          target.pathname.split('/').at(-1) === currentUrl.pathname.split('/').at(-1)
        ) {
          pages.add(target.href)
        }
      })
  })

  main.find('td[class], th[class]').each((_, cell) => {
    if ($(cell).closest('.anctab').length) return
    if (!($(cell).attr('class') ?? '').split(/\s+/).some((name) => versionClasses.has(name))) return
    // Palette classes are reused (e.g. ruby for Omega Ruby, col for XD); the visible label wins.
    addEdition($(cell).text())
  })
  main.find('h2, h3, h4, p > b, p > font > b, p > a > font > b').each((_, heading) => {
    if ($(heading).closest('table').length) return
    const label = cleanText($(heading).text()).replace(/^(?:Items|Shops|Trainers)\s*[-–—:]\s*/i, '')
    addEdition(label)
  })

  main.find('.picturetd img[src], .picturetd a[href]').each((_, image) => {
    const reference = $(image).attr('src') ?? $(image).attr('href')!
    const imageUrl = new URL(reference, url)
    if (!['serebii.net', 'www.serebii.net'].includes(imageUrl.hostname)) return
    const folder = imageUrl.pathname.match(/^\/pokearth\/maps\/([^/]+)\//)?.[1]
    for (const game of (folder && mapEditions[folder]) || []) {
      if (allowedEvidence.has(game)) games.add(game)
    }
  })

  // Copied descriptions can claim even in-region remakes for Platinum-only places.
  // Use descriptions only when the page has no concrete edition evidence, then validate
  // the stated games against the catalog section. Keywords are never evidence.
  if (!games.size) {
    const description = cleanText($('meta[name="description"]').attr('content') ?? '')
    const context = description.match(/^.+? in the .+? Region in Pok[eé]mon (.+?)\. Details\b/i)
    const metadataGames = context ? (editions[editionKey(context[1])] ?? []) : []
    if (metadataGames.every((game) => allowed.includes(game))) {
      for (const game of metadataGames) games.add(game)
    }
  }

  const overview = cleanText(
    main.find('table.tab').first().clone().find('table').remove().end().text(),
  )
  const exclusive = overview.match(/only exists in Pok[eé]mon ([^.]+)\./i)
  if (exclusive) {
    const exclusiveGames = editions[editionKey(exclusive[1])] ?? []
    for (const game of exclusiveGames) {
      if (!allowedEvidence.has(game)) continue
      games.add(game)
      const partner = gamePartners.get(game)
      if (partner && !exclusiveGames.includes(partner)) games.delete(partner)
    }
  }
  for (const match of overview.matchAll(/\bIn ([^,]{1,40}), the area (?:has|is|was)\b/g)) {
    addEdition(match[1])
  }
  return { games: [...games], pages: [...pages] }
}

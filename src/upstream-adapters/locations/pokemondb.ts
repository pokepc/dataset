import { load } from 'cheerio'
import type { CatalogEntry } from './types.ts'

const gameBadges: Record<string, string> = {
  R1: 'rb-r',
  B1: 'rb-b',
  Y1: 'y',
  G2: 'gs-g',
  S2: 'gs-s',
  C2: 'c',
  R3: 'rs-r',
  S3: 'rs-s',
  E3: 'e',
  FR3: 'frlg-fr',
  LG3: 'frlg-lg',
  D4: 'dp-d',
  P4: 'dp-p',
  Pt4: 'pt',
  HG4: 'hgss-hg',
  SS4: 'hgss-ss',
  B5: 'bw-b',
  W5: 'bw-w',
  B25: 'b2w2-b2',
  W25: 'b2w2-w2',
  X6: 'xy-x',
  Y6: 'xy-y',
  OR6: 'oras-or',
  AS6: 'oras-as',
  S7: 'sm-s',
  M7: 'sm-m',
  US7: 'usum-us',
  UM7: 'usum-um',
  LGP7: 'lgpe-lgp',
  LGE7: 'lgpe-lge',
  Sw8: 'swsh-sw',
  Sh8: 'swsh-sh',
  BD8: 'bdsp-bd',
  SP8: 'bdsp-sp',
  LA8: 'la',
  S9: 'sv-s',
  V9: 'sv-v',
}

export function parsePokemonDbCatalog(html: string): CatalogEntry[] {
  const $ = load(html)
  const entries: CatalogEntry[] = []
  $('.sv-tabs-panel[id^="loc-"]').each((_, panel) => {
    const region = $(panel).attr('id')!.slice(4)
    $(panel)
      .find('.grid-col > a[href^="/location/"], .grid-col > span.text-muted')
      .each((_, element) => {
        const name = $(element).text().trim()
        const href = $(element).attr('href')
        const url = href
          ? new URL(href, 'https://pokemondb.net').href
          : 'https://pokemondb.net/location'
        entries.push({
          source: 'pokemondb',
          sourceId: href ?? `${region}/${name}`,
          url,
          name,
          region,
          games: [],
          pokeApiId: null,
          pages: href ? [url] : [],
        })
      })
  })
  if (!entries.length) throw new Error('PokémonDB location catalog contains no regional entries')
  return entries
}

export function parsePokemonDbPage(html: string): string[] {
  const $ = load(html)
  if (!$('h1').text().includes('(location)')) throw new Error('Not a PokémonDB location page')
  const games = new Set<string>()
  $('td.cell-loc-game:not(.cell-loc-game-blank)').each((_, cell) => {
    const badge = ($(cell).attr('class') ?? '')
      .split(/\s+/)
      .find((x) => /^cell-loc-game-/.test(x))
      ?.slice(14)
    if (!badge || !gameBadges[badge]) throw new Error(`Unmapped PokémonDB game badge: ${badge}`)
    games.add(gameBadges[badge])
  })
  return [...games]
}

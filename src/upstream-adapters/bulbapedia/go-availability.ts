import { load, type CheerioAPI } from 'cheerio'
import type { AvailabilityPokemon, AvailabilityStatus } from './availability.ts'

type Selection = ReturnType<CheerioAPI>
type GoMethod = { status: AvailabilityStatus; text: string; note?: string }

export type GoAvailabilityEntry = GoMethod & {
  sprite: string
  dexNum: number
  species?: string
  /** Dataset nid suffix; empty means the base record, undefined means unmapped. */
  form?: string
  speciesWide: boolean
}

export type GoAvailability = {
  entries: GoAvailabilityEntry[]
  warnings: string[]
}

const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim()
const normalize = (value: string) =>
  value
    .replaceAll('♀', 'female')
    .replaceAll('♂', 'male')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

// These are filename identities, not availability overrides. The page often uses
// only a species name as image alt text, so that text cannot identify its form.
const spriteForms: Record<number, Record<string, string>> = {
  128: { PC: 'paldea', PB: 'paldea-fire', PA: 'paldea-water' },
  150: { A: 'armored' },
  351: { H: 'sunny', R: 'rainy', S: 'snowy' },
  382: { P: 'primal' },
  383: { P: 'primal' },
  386: { A: 'attack', D: 'defense', S: 'speed' },
  412: { G: 'trash', S: 'sandy' },
  413: { G: 'trash', S: 'sandy' },
  421: { S: 'sunshine' },
  422: { E: 'east' },
  423: { E: 'east' },
  479: { W: 'wash', L: 'mow', R: 'frost', O: 'heat', F: 'fan' },
  483: { O: 'origin' },
  484: { O: 'origin' },
  487: { O: 'origin' },
  492: { S: 'sky' },
  550: { B: 'blue-striped', W: 'white-striped' },
  555: { Z: 'zen', GZ: 'galar-zen' },
  585: { A: 'autumn', S: 'summer', W: 'winter' },
  586: { A: 'autumn', S: 'summer', W: 'winter' },
  641: { T: 'therian' },
  642: { T: 'therian' },
  645: { T: 'therian' },
  646: { W: 'white', B: 'black' },
  647: { R: 'resolute' },
  648: { P: 'pirouette' },
  649: { R: 'burn', B: 'douse', Y: 'shock', W: 'chill' },
  666: {
    '': 'meadow',
    Arc: 'archipelago',
    Con: 'continental',
    Ele: 'elegant',
    Fan: 'fancy',
    Gar: 'garden',
    Hig: 'high-plains',
    Icy: '',
    Jun: 'jungle',
    Mar: 'marine',
    Mod: 'modern',
    Mon: 'monsoon',
    Oce: 'ocean',
    Pok: 'pokeball',
    Pol: 'polar',
    Riv: 'river',
    San: 'sandstorm',
    Sav: 'savanna',
    Sun: 'sun',
    Tun: 'tundra',
  },
  669: { Y: 'yellow', B: 'blue', O: 'orange', W: 'white' },
  670: { Y: 'yellow', B: 'blue', O: 'orange', W: 'white', M: 'eternal-mega' },
  671: { Y: 'yellow', B: 'blue', O: 'orange', W: 'white' },
  676: {
    St: 'star',
    Di: 'diamond',
    De: 'debutante',
    Ma: 'matron',
    Da: 'dandy',
    La: 'la-reine',
    Ka: 'kabuki',
    Ph: 'pharaoh',
    He: 'heart',
  },
  681: { B: 'blade' },
  718: { T: '10', C: 'complete', M: 'complete-mega' },
  720: { U: 'unbound' },
  741: { Po: 'pom-pom', Pa: 'pau', Se: 'sensu' },
  745: { Md: '', Mn: 'midnight', D: 'dusk' },
  778: { B: 'busted' },
  800: { DM: 'dusk-mane', DW: 'dawn-wings' },
  801: { MO: 'original-mega' },
  845: { Gu: 'gulping', Go: 'gorging' },
  849: { A: '', L: 'low-key' },
  854: { A: 'antique' },
  855: { A: 'antique' },
  877: { H: 'hangry' },
  888: { C: 'crowned' },
  889: { C: 'crowned' },
  892: { R: 'rapid-strike', RGMax: 'rapid-strike-gmax' },
  905: { T: 'therian' },
  925: { T: 'three' },
  931: { B: 'blue', Y: 'yellow', W: 'white' },
  978: { D: 'droopy', S: 'stretchy', DM: 'droopy-mega', SM: 'stretchy-mega' },
  982: { T: 'three-segment' },
  999: { '': 'roaming' },
  1012: { A: 'artisan' },
  1013: { M: 'masterpiece' },
}

function spriteIdentity(filename: string): { dexNum: number; form?: string } | undefined {
  const menu = filename.match(/^Menu_(?:HOME|SV)_(\d{4})(?:-(.+))?\.png$/)
  if (menu) {
    const suffix = menu[2]?.toLowerCase().replaceAll('_', '-') ?? ''
    const aliases: Record<string, string> = { 'ice-rider': 'ice', 'shadow-rider': 'shadow' }
    return { dexNum: Number(menu[1]), form: aliases[suffix] ?? suffix }
  }
  const match = filename.match(/^(GO|HOME)(\d{4})(.*?)\.png$/)
  if (!match) return undefined
  const dexNum = Number(match[2])
  const suffix = match[3]
  if (dexNum === 201) {
    const form =
      suffix === '!'
        ? 'exclamation'
        : suffix === '?'
          ? 'question'
          : /^[B-Z]$/.test(suffix)
            ? suffix.toLowerCase()
            : suffix === '' || suffix === 'A'
              ? ''
              : undefined
    return { dexNum, form }
  }
  // GO's bare Gimmighoul and Vivillon images are Roaming and Meadow respectively;
  // HOME menu images follow different defaults and were handled above.
  const aliases = spriteForms[dexNum]
  if (aliases && Object.hasOwn(aliases, suffix)) return { dexNum, form: aliases[suffix] }
  const shared: Record<string, string> = {
    '': '',
    A: 'alola',
    G: 'galar',
    H: 'hisui',
    P: 'paldea',
    M: 'mega',
    MX: 'mega-x',
    MY: 'mega-y',
    MZ: 'mega-z',
    GMax: 'gmax',
    Gi: 'gmax',
    f: 'f',
    _f: 'f',
  }
  return { dexNum, form: shared[suffix] }
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function releaseMethod(date: string, notes: string, asOf: number): GoMethod {
  const text = `GO release: ${date}${notes ? `. ${notes}` : ''}`
  if (/^(?:TBA|TBD)(?:\s+\d{4})?$/.test(date)) {
    return { status: 'unavailable', text, note: 'Announced release date is not yet known.' }
  }
  const match = date.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/)
  const month = match ? months.indexOf(match[1]) : -1
  const timestamp =
    match && month !== -1 ? Date.UTC(Number(match[3]), month, Number(match[2])) : NaN
  const parsed = new Date(timestamp)
  if (!match || Number.isNaN(timestamp) || parsed.getUTCMonth() !== month) {
    return { status: 'unknown', text, note: `Unrecognized GO release date: ${date}.` }
  }
  return timestamp <= asOf
    ? { status: 'obtainableIn', text }
    : { status: 'unavailable', text, note: 'The listed release is in the future.' }
}

function imageFilename(src: string): string {
  try {
    return decodeURIComponent(src.split('/').at(-1) ?? '').replace(/^\d+px-/, '')
  } catch {
    return ''
  }
}

function sourceSpecies(image: Selection): string | undefined {
  const href = image.closest('a').attr('href') ?? ''
  try {
    return decodeURIComponent(href)
      .match(/^\/wiki\/(.+)_\(Pokémon\)(?:#.*)?$/)?.[1]
      .replaceAll('_', ' ')
  } catch {
    return undefined
  }
}

/** Parse only the page's release and explicitly unreleased sections. */
export function parseGoAvailability(
  html: string,
  asOf: Date | string = new Date(),
): GoAvailability {
  const $ = load(html)
  const timestamp = new Date(asOf).getTime()
  if (!Number.isFinite(timestamp)) throw new Error('Invalid GO availability reference date.')
  const title = cleanText($('#firstHeading').text())
  if (title && title !== 'List of Pokémon by availability in Pokémon GO')
    throw new Error(`Unexpected GO availability page title: ${title}.`)
  const entries: GoAvailabilityEntry[] = []
  const warnings = new Set<string>()
  let releaseTables = 0
  const addImages = (content: Selection, method: GoMethod, speciesWide = false) => {
    const images = content.find('img')
    images.each((_, node) => {
      const image = $(node)
      const sprite = imageFilename(image.attr('src') ?? image.attr('data-src') ?? '')
      const identity = spriteIdentity(sprite)
      if (!identity) {
        warnings.add(
          `Unrecognized GO availability sprite: ${sprite || image.attr('alt') || '(empty)'}.`,
        )
        return
      }
      if (identity.form === undefined) warnings.add(`Unmapped GO form sprite: ${sprite}.`)
      const species = sourceSpecies(image)
      entries.push({ ...identity, sprite, species, speciesWide, ...method })
      // A single size sprite accompanies this explicit all-sizes release note.
      // Do not extend it to Gourgeist: that species has no such statement here.
      if (identity.dexNum === 710 && /\ball sizes of Pumpkaboo\b/.test(method.text)) {
        for (const form of ['small', 'large', 'super'])
          entries.push({ ...identity, form, sprite, species, speciesWide, ...method })
      }
    })
    if (!images.length) warnings.add(`GO availability entry has no Pokémon images: ${method.text}`)
  }
  const sections = new Set([
    'List of Pokémon by date',
    'Unreleased Pokémon',
    'Mega Evolution and Primal Reversion',
    'Fusions',
    'Gigantamax',
  ])
  $('h2,h3,h4').each((_, node) => {
    const heading = $(node)
    const name = cleanText(heading.clone().find('.mw-editsection').remove().end().text())
    if (!sections.has(name)) return
    const anchor = heading.parent().hasClass('mw-heading') ? heading.parent() : heading
    let unreleased: 'species' | 'forms' | undefined
    const content = anchor.nextUntil('h1,h2,h3,h4,h5,h6,.mw-heading')
    content.each((_, element) => {
      const block = $(element)
      if (block.is('p')) {
        const text = cleanText(block.text())
        if (/following species have yet to become available/i.test(text)) unreleased = 'species'
        else if (
          /following (?:forms|mega evolutions|fusions|gigantamax forms) have yet to be (?:made available|released)/i.test(
            text,
          )
        )
          unreleased = 'forms'
        else if (/currently available/i.test(text)) unreleased = undefined
        return
      }
      if (block.is('ul,ol') && unreleased) {
        addImages(
          block,
          { status: 'unavailable', text: `GO: explicitly unreleased ${unreleased}.` },
          unreleased === 'species',
        )
        return
      }
      if (!block.is('table')) return
      const rows = block.children('tbody').children('tr').add(block.children('tr'))
      const headers = rows
        .first()
        .children('th,td')
        .toArray()
        .map((cell) => cleanText($(cell).text()))
      if (
        headers[0] === 'Date' &&
        ['Pokémon', 'Transformation', 'Fusion', 'Gigantamax'].includes(headers[1])
      ) {
        releaseTables++
        rows.slice(1).each((_, row) => {
          const cells = $(row).children('td,th')
          const method = releaseMethod(
            cleanText(cells.eq(0).text()),
            cleanText(cells.eq(2).text()),
            timestamp,
          )
          if (method.status === 'unknown') warnings.add(method.note!)
          addImages(cells.eq(1), method)
        })
      } else if (unreleased && headers[0] === 'Generation' && headers[1] === 'Total') {
        rows.slice(1).each((_, row) => {
          addImages(
            $(row).children('td,th').last(),
            {
              status: 'unavailable',
              text: `GO: explicitly unreleased ${unreleased}.`,
            },
            unreleased === 'species',
          )
        })
      } else {
        warnings.add(`Unrecognized table in GO ${name}: ${headers.join(' / ')}.`)
      }
    })
  })
  if (!releaseTables || !entries.length)
    throw new Error('No GO release tables found (blocked response or changed page markup).')
  return { entries, warnings: [...warnings] }
}

function entryMatchesSpecies(entry: GoAvailabilityEntry, pokemon: AvailabilityPokemon): boolean {
  // Flapple and Appletun share a Gigantamax image on this page. The linked
  // species is authoritative where the numeric sprite is reused.
  return entry.species
    ? normalize(entry.species) === normalize(pokemon.refs.bulbapedia)
    : entry.dexNum === Number(pokemon.dexNum)
}

export function resolveGoAvailability(
  parsed: GoAvailability,
  pokemon: AvailabilityPokemon,
  siblings: AvailabilityPokemon[],
): GoMethod | undefined {
  const form = pokemon.nid.replace(/^\d+/, '').replace(/^-/, '')
  const speciesEntries = parsed.entries.filter((entry) => entryMatchesSpecies(entry, pokemon))
  let matches = speciesEntries.filter((entry) => entry.speciesWide || entry.form === form)
  // Reviewed identities, not species-wide availability inheritance. Xerneas changes its
  // appearance automatically; both Toxtricity variants share the GMax form. Exact form entries
  // still win, including an explicit unreleased entry. See docs/audits/ordinary-form-availability.md.
  const sharedForm = (
    {
      'xerneas-active': '',
      'toxtricity-low-key-gmax': 'gmax',
    } as Record<string, string>
  )[pokemon.id]
  const usesSharedForm = !matches.length && sharedForm !== undefined
  if (usesSharedForm) matches = speciesEntries.filter((entry) => entry.form === sharedForm)
  if (!matches.length && pokemon.isFemaleForm && pokemon.isCosmeticForm) {
    const parent = siblings.find((entry) => entry.id === pokemon.baseSpecies && !entry.isFemaleForm)
    if (parent) {
      const method = resolveGoAvailability(parsed, parent, siblings)
      if (method)
        return {
          ...method,
          note: [method.note, `Cosmetic female form inherits ${parent.id}.`]
            .filter(Boolean)
            .join(' '),
        }
    }
  }
  if (!matches.length) return undefined
  const released = matches.filter((entry) => entry.status === 'obtainableIn')
  const explicitlyUnreleased = matches.some(
    (entry) => entry.status === 'unavailable' && entry.text.startsWith('GO: explicitly'),
  )
  if (released.length && explicitlyUnreleased)
    return {
      status: 'unknown',
      text: matches.map((entry) => entry.text).join(' '),
      note: 'The GO source lists this form as both released and unreleased.',
    }
  const result = released[0] ?? matches.find((entry) => entry.status === 'unknown') ?? matches[0]
  const note = [
    result.note,
    ...(usesSharedForm
      ? [`Reviewed shared GO form identity for ${pokemon.id}; not base availability inheritance.`]
      : []),
  ]
    .filter(Boolean)
    .join(' ')
  return { status: result.status, text: result.text, ...(note ? { note } : {}) }
}

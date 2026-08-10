#!/usr/bin/env bun
/**
 * Parse a Bulbapedia regional Pokédex list into pokepc dex entries.
 *
 * Bulbapedia is the source of truth for dex ordering; this dataset is the source of
 * truth for pids. This script joins the two deterministically so no step of the
 * conversion depends on model judgement.
 *
 * Usage:
 *   bun .claude/skills/add-pokedex/scripts/parse-bulbapedia-dex.ts --page "<title|url>" [options]
 *   bun .claude/skills/add-pokedex/scripts/parse-bulbapedia-dex.ts --file <cached.wiki> [options]
 *
 * Options:
 *   --page <title|url>  Bulbapedia page title or full URL (fetched as raw wikitext)
 *   --file <path>       Parse a local wikitext file instead of fetching
 *   --save-wiki <path>  Write the fetched wikitext to disk (cache it before iterating)
 *   --emit              Print the dex JSON to stdout instead of the report
 *   --id <dex-id>       Dex id for --emit (default: placeholder)
 *   --name <name>       Dex name for --emit
 *   --region <slug>     Dex region for --emit (default: null)
 *   --gen <n>           Dex gen for --emit (default: 0)
 *   --base-dex <slug>   Dex baseDex for --emit (default: null)
 *   --pkapi-id <id>     Dex pkApiId for --emit (default: null)
 *
 * Exits non-zero if any row could not be resolved to a pid.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BULBAPEDIA_INDEX_URL = 'https://bulbapedia.bulbagarden.net/w/index.php'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

type ParsedRow = {
  localNum: number
  nationalNum: number
  speciesName: string
  formLabel: string | null
  /** 'MSP' for canonical sprites, 'MSP/Pokopia' etc. for game-exclusive forms. */
  spriteTemplate: string
  sourceLine: number
}

type PokemonRef = {
  id: string
  formNameEng: string | null
  isDefault: boolean
  isCosmeticForm: boolean
}

type ResolvedEntry = {
  pid: string
  dexNum: number
  isForm: boolean
  needsMeta?: boolean
  row: ParsedRow
}

type Unresolved = {
  row: ParsedRow
  reason: string
  candidates: string[]
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

function rawWikitextUrl(pageOrUrl: string): string {
  let title = pageOrUrl
  if (pageOrUrl.startsWith('http')) {
    const url = new URL(pageOrUrl)
    const fromQuery = url.searchParams.get('title')
    title = fromQuery ?? decodeURIComponent(url.pathname.replace(/^\/wiki\//, ''))
  }
  const url = new URL(BULBAPEDIA_INDEX_URL)
  url.searchParams.set('title', title)
  url.searchParams.set('action', 'raw')
  return url.toString()
}

async function fetchWikitext(pageOrUrl: string): Promise<string> {
  const url = rawWikitextUrl(pageOrUrl)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  if (!text.includes('{{rdex')) {
    throw new Error(
      `Fetched ${url} but found no {{rdex}} rows. Is this a regional Pokédex list page?`,
    )
  }
  return text
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * `{{rdex|028|0592|Frillish|2|Water|Ghost|gen=HOME2}}`
 *
 * Deliberately not anchored to the start of the line, and global: pages append rdex rows
 * onto the end of a previous row's type cells, e.g.
 *   `{{typetable|Bug}}{{typetable|Psychic}}{{rdex|017|753|Fomantis|1|Grass|gen=8}}`
 * An anchored match silently drops those rows (four of them in the Isle of Armor dex).
 */
const RDEX_RE = /\{\{rdex\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|}]+?)\s*[|}]/g
/**
 * A dex-number cell of a hand-written block:
 *   `| rowspan="2" style="..." | #028`  (multi-form, rowspan = form count)
 *   `| style="..." | #117`              (single form that still needs a label)
 * The rowspan-less shape is used when one form needs a label {{rdex}} cannot express,
 * such as Paldean Wooper or any game-exclusive form that replaces its species outright.
 */
const NUM_CELL_RE = /^\|\s*(?:rowspan="(\d+)"\s*)?[^|]*\|\s*#?(\d+)\s*$/
/** `! {{MSP|0592F|Frillish}}` or `! {{MSP/Pokopia|0465|Tangrowth|form=-Professor|size=60px}}` */
const SPRITE_RE = /^!\s*\{\{(MSP(?:\/[A-Za-z0-9-]+)?)\|/
/** `| {{p|Frillish}}<br><small>Female</small>` */
const NAME_RE = /^\|\s*\{\{p\|\s*([^|}]+?)\s*\}\}(?:<br>\s*<small>\s*([^<]+?)\s*<\/small>)?/

/**
 * Bulbapedia dex tables mix two row shapes:
 *   - one-line {{rdex}} templates for single-form Pokémon
 *   - hand-written rowspan blocks for multi-form Pokémon
 *
 * A parser that only understands {{rdex}} silently undercounts every dex with forms
 * (the Basin dex reads as 50 entries instead of 52), so both shapes are required.
 */
function parseRows(wikitext: string): ParsedRow[] {
  const lines = wikitext.split('\n')
  const rows: ParsedRow[] = []

  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()

    if (line.startsWith('{{rdexh')) {
      inTable = true
      continue
    }
    if (!inTable) continue
    // A long dex is split across several tables, one per section heading. Close this one
    // and keep scanning rather than stopping at the first `|}`.
    if (line === '|}') {
      inTable = false
      continue
    }

    for (const rdex of line.matchAll(RDEX_RE)) {
      rows.push({
        localNum: Number(rdex[1]),
        nationalNum: Number(rdex[2]),
        speciesName: rdex[3]!,
        formLabel: null,
        spriteTemplate: 'MSP',
        sourceLine: i + 1,
      })
    }

    const numCell = NUM_CELL_RE.exec(line)
    if (numCell) {
      const formCount = numCell[1] === undefined ? 1 : Number(numCell[1])
      const localNum = Number(numCell[2])

      // The national number is the second dex-number cell of the block.
      const natLine = NUM_CELL_RE.exec(lines[i + 1]?.trim() ?? '')
      if (!natLine) {
        throw new Error(
          `Line ${i + 2}: expected a second dex-number cell (national number) after local #${localNum}`,
        )
      }
      const nationalNum = Number(natLine[2])

      // Collect `formCount` sprite+name row pairs.
      let collected = 0
      let pendingSprite: string | null = null

      for (let j = i + 2; j < lines.length && collected < formCount; j++) {
        const inner = lines[j]!.trim()
        if (inner === '|}') break
        // Guard against running into the next block if this one is malformed.
        if (j > i + 2 && NUM_CELL_RE.test(inner)) break

        const sprite = SPRITE_RE.exec(inner)
        if (sprite) {
          pendingSprite = sprite[1]!
          continue
        }

        const name = NAME_RE.exec(inner)
        if (name && pendingSprite !== null) {
          rows.push({
            localNum,
            nationalNum,
            speciesName: name[1]!,
            formLabel: name[2] ?? null,
            spriteTemplate: pendingSprite,
            sourceLine: j + 1,
          })
          pendingSprite = null
          collected++
        }
      }

      if (collected !== formCount) {
        throw new Error(
          `Local #${localNum}: rowspan promised ${formCount} form(s) but parsed ${collected}. ` +
            `The table markup around line ${i + 1} may use an unsupported shape.`,
        )
      }

      // Skip only the national-number cell. The block's remaining lines are re-scanned by
      // the outer loop so that any {{rdex}} appended to a type cell is still picked up.
      i += 1
      continue
    }
  }

  if (rows.length === 0) {
    throw new Error('Parsed zero rows. Check that the page contains an {{rdexh}} dex table.')
  }

  return rows
}

// ---------------------------------------------------------------------------
// Resolve pids against this dataset
// ---------------------------------------------------------------------------

function buildPokemonIndex(dataDir: string): Map<number, PokemonRef[]> {
  const index: string[] = JSON.parse(readFileSync(join(dataDir, 'indices/pokemon.json'), 'utf8'))
  const byDexNum = new Map<number, PokemonRef[]>()

  for (const id of index) {
    const raw = JSON.parse(readFileSync(join(dataDir, 'pokemon', `${id}.json`), 'utf8'))
    const ref: PokemonRef = {
      id: raw.id,
      formNameEng: raw.formNames?.eng ?? null,
      isDefault: raw.isDefault === true,
      isCosmeticForm: raw.isCosmeticForm === true,
    }
    const bucket = byDexNum.get(raw.dexNum)
    if (bucket) bucket.push(ref)
    else byDexNum.set(raw.dexNum, [ref])
  }

  return byDexNum
}

/**
 * Bulbapedia and this dataset disagree on the "Form" suffix in places: the wiki writes
 * "Gigantamax" where the dataset has "Gigantamax Form". Try the label both ways, but only
 * ever as exact string comparisons.
 */
function formLabelVariants(label: string): string[] {
  return / Form$/.test(label) ? [label, label.replace(/ Form$/, '')] : [label, `${label} Form`]
}

/**
 * `MSP/8` is a generation-scoped sprite template and completely ordinary — the whole Isle
 * of Armor dex uses it. `MSP/Pokopia` is game-scoped and marks a form that exists only in
 * that game and so has no pid of its own.
 */
function isGameScopedSprite(template: string): boolean {
  const suffix = template.split('/')[1]
  return suffix !== undefined && !/^\d+$/.test(suffix)
}

/**
 * Resolution rules, in order. Every rule is an exact comparison — nothing here guesses.
 *
 *   1. No form label -> the default pid for that national number.
 *   2. A `formNames.eng` match (exact, or ±" Form") -> that pid. The wiki's labels line up
 *      with this field: "Female", "East Sea", "Droopy Form", "Galarian Form".
 *   3. A game-scoped sprite template -> game-exclusive form with no pid; becomes a `meta`
 *      entry on the canonical species. Checked *after* rule 2 so that Galarian and
 *      Gigantamax forms, which do have pids, are never mistaken for exclusives.
 *   4. First row of a block whose default form carries no formNames.eng -> the default.
 *      Covers labels the dataset leaves implicit, e.g. Shellos "West Sea".
 *   5. Anything else is unresolved and reported. Never guessed.
 */
function resolveRow(
  row: ParsedRow,
  isFirstOfGroup: boolean,
  byDexNum: Map<number, PokemonRef[]>,
): { pid: string; needsMeta: boolean } | { error: string; candidates: string[] } {
  const candidates = byDexNum.get(row.nationalNum)
  if (!candidates || candidates.length === 0) {
    return {
      error: `no Pokémon in this dataset has dexNum ${row.nationalNum}`,
      candidates: [],
    }
  }

  const describe = () =>
    candidates.map((c) => `${c.id}=${JSON.stringify(c.formNameEng)}${c.isDefault ? '*' : ''}`)

  const canonical = candidates.find((c) => c.isDefault) ?? candidates[0]!

  // Rule 1: unlabelled row -> the default form.
  if (row.formLabel === null) {
    return { pid: canonical.id, needsMeta: false }
  }

  // Rule 2: form-name match. More than one hit is ambiguous and must not be guessed —
  // Urshifu carries "Gigantamax Form" on both urshifu-gmax and urshifu-rapid-strike-gmax,
  // and picking the first silently produces a duplicate entry.
  const variants = formLabelVariants(row.formLabel)
  const matches = candidates.filter(
    (c) => c.formNameEng !== null && variants.includes(c.formNameEng),
  )
  if (matches.length === 1) {
    return { pid: matches[0]!.id, needsMeta: false }
  }
  if (matches.length > 1) {
    return {
      error: `form label ${JSON.stringify(row.formLabel)} is ambiguous — ${matches.length} pids share it`,
      candidates: matches.map((c) => c.id),
    }
  }

  // Rule 3: game-exclusive form -> canonical pid carrying a meta block.
  if (isGameScopedSprite(row.spriteTemplate)) {
    return { pid: canonical.id, needsMeta: true }
  }

  // Rule 4: the dataset leaves the base form's label implicit.
  if (isFirstOfGroup && canonical.formNameEng === null) {
    return { pid: canonical.id, needsMeta: false }
  }

  return {
    error: `form label ${JSON.stringify(row.formLabel)} matches no formNames.eng for dexNum ${row.nationalNum}`,
    candidates: describe(),
  }
}

/**
 * `isForm` marks the secondary slots of a local dex number, not "this pid is a form".
 * Isle of Armor #1 is Galarian Slowpoke, so `slowpoke-galar` is isForm:false there while
 * plain `slowpoke` is isForm:true — position in the table decides, not the pid.
 *
 * Game-exclusive forms invert this: the dataset puts the `meta` entry in the isForm:false
 * slot and demotes the plain species to isForm:true (see Mosslax in pokopia.json), which
 * is also what tests/data-integrity-tests/pokedexes.test.ts enforces for duplicate pids.
 */
function resolveAll(
  rows: ParsedRow[],
  byDexNum: Map<number, PokemonRef[]>,
): { entries: ResolvedEntry[]; unresolved: Unresolved[] } {
  const groups = new Map<number, ParsedRow[]>()
  for (const row of rows) {
    const bucket = groups.get(row.localNum)
    if (bucket) bucket.push(row)
    else groups.set(row.localNum, [row])
  }

  const entries: ResolvedEntry[] = []
  const unresolved: Unresolved[] = []

  for (const localNum of [...groups.keys()].sort((a, b) => a - b)) {
    const groupRows = groups.get(localNum)!
    const resolvedGroup: ResolvedEntry[] = []

    groupRows.forEach((row, idx) => {
      const result = resolveRow(row, idx === 0, byDexNum)
      if ('error' in result) {
        unresolved.push({ row, reason: result.error, candidates: result.candidates })
        return
      }
      resolvedGroup.push({
        pid: result.pid,
        dexNum: localNum,
        isForm: false, // assigned below
        needsMeta: result.needsMeta,
        row,
      })
    })

    // Game-exclusive meta entries take the primary slot.
    const exclusive = resolvedGroup.filter((e) => e.needsMeta)
    const ordered =
      exclusive.length > 0
        ? [...exclusive, ...resolvedGroup.filter((e) => !e.needsMeta)]
        : resolvedGroup

    ordered.forEach((entry, idx) => {
      entry.isForm = idx > 0
      entries.push(entry)
    })
  }

  return { entries, unresolved }
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

/**
 * Entries are written one per line with no newline after `{` so that oxfmt keeps them
 * compact, matching every existing dex file. Adding a newline there makes oxfmt expand
 * the object across multiple lines.
 */
function serializeDex(
  header: {
    id: string
    name: string
    gen: number
    region: string | null
    baseDex: string | null
    pkApiId: string | null
  },
  entries: ResolvedEntry[],
): string {
  const lines = [
    '{',
    `  "id": ${JSON.stringify(header.id)},`,
    `  "name": ${JSON.stringify(header.name)},`,
    `  "gen": ${header.gen},`,
    `  "region": ${JSON.stringify(header.region)},`,
    '  "isNational": false,',
    `  "baseDex": ${JSON.stringify(header.baseDex)},`,
    `  "pkApiId": ${JSON.stringify(header.pkApiId)},`,
    '  "entries": [',
  ]

  entries.forEach((entry, idx) => {
    const comma = idx === entries.length - 1 ? '' : ','
    const meta = entry.needsMeta
      ? `, "meta": { "names": { "eng": "TODO ${entry.row.formLabel ?? ''} ${entry.row.speciesName}" }, "speciesNames": { "eng": ${JSON.stringify(entry.row.speciesName)} }, "formNames": { "eng": ${JSON.stringify(entry.row.formLabel ?? '')} }, "imgNid": "TODO" }`
      : ''
    lines.push(
      `    { "pid": ${JSON.stringify(entry.pid)}, "dexNum": ${entry.dexNum}, "isForm": ${entry.isForm}${meta} }${comma}`,
    )
  })

  lines.push('  ]', '}')
  return `${lines.join('\n')}\n`
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next
      i++
    } else {
      out[key] = true
    }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dataDir = join(process.cwd(), 'data')

  if (!args.page && !args.file) {
    console.error('Provide --page "<title|url>" or --file <cached.wiki>. See the header for usage.')
    process.exit(2)
  }

  const wikitext =
    typeof args.file === 'string'
      ? readFileSync(args.file, 'utf8')
      : await fetchWikitext(String(args.page))

  if (typeof args['save-wiki'] === 'string') {
    writeFileSync(args['save-wiki'], wikitext)
  }

  const rows = parseRows(wikitext)
  const byDexNum = buildPokemonIndex(dataDir)
  const { entries, unresolved } = resolveAll(rows, byDexNum)

  const localNums = new Set(entries.map((e) => e.dexNum))
  const maxLocal = Math.max(...localNums)
  const gaps: number[] = []
  for (let n = 1; n <= maxLocal; n++) if (!localNums.has(n)) gaps.push(n)

  // tests/data-integrity-tests/pokedexes.test.ts allows a pid at most twice per dex, and
  // only as one {meta, isForm:false} plus one {isForm:true}. Catch violations here rather
  // than letting a bad file reach the test suite.
  const byPid = new Map<string, ResolvedEntry[]>()
  for (const e of entries) {
    const bucket = byPid.get(e.pid)
    if (bucket) bucket.push(e)
    else byPid.set(e.pid, [e])
  }
  const badDuplicates: string[] = []
  for (const [pid, group] of byPid) {
    if (group.length === 1) continue
    if (group.length > 2) {
      badDuplicates.push(`${pid} appears ${group.length}x (max 2)`)
      continue
    }
    const [a, b] = group as [ResolvedEntry, ResolvedEntry]
    const ok = a.dexNum === b.dexNum && a.needsMeta !== b.needsMeta && a.isForm !== b.isForm
    if (!ok) {
      badDuplicates.push(
        `${pid} appears 2x but not as one meta/isForm:false + one isForm:true at the same dexNum`,
      )
    }
  }

  // The dataset adds cosmetic gender forms that Bulbapedia's dex tables never list as
  // rows — galar-isle-armor carries shinx-f, kadabra-f, magikarp-f and 23 more. Whether a
  // given dex should include them is a dataset policy call, so surface them rather than
  // inventing entries.
  const resolvedPids = new Set(entries.map((e) => e.pid))
  const missingCosmetic: string[] = []
  for (const nat of new Set(entries.map((e) => e.row.nationalNum))) {
    for (const c of byDexNum.get(nat) ?? []) {
      if (!resolvedPids.has(c.id) && c.isCosmeticForm) {
        missingCosmetic.push(`${c.id} (${JSON.stringify(c.formNameEng)}, nat ${nat})`)
      }
    }
  }

  if (args.emit) {
    if (unresolved.length > 0) {
      console.error(`Refusing to emit: ${unresolved.length} unresolved row(s). Run without --emit.`)
      process.exit(1)
    }
    if (badDuplicates.length > 0) {
      console.error(`Refusing to emit: would violate the duplicate-pid rule:`)
      for (const d of badDuplicates) console.error(`  ${d}`)
      process.exit(1)
    }
    process.stdout.write(
      serializeDex(
        {
          id: typeof args.id === 'string' ? args.id : 'TODO-dex-id',
          name: typeof args.name === 'string' ? args.name : 'TODO Pokédex',
          gen: typeof args.gen === 'string' ? Number(args.gen) : 0,
          region: typeof args.region === 'string' ? args.region : null,
          baseDex: typeof args['base-dex'] === 'string' ? args['base-dex'] : null,
          pkApiId: typeof args['pkapi-id'] === 'string' ? args['pkapi-id'] : null,
        },
        entries,
      ),
    )
    return
  }

  console.log(`Parsed rows:      ${rows.length}`)
  console.log(`Resolved entries: ${entries.length}`)
  console.log(`Local dex numbers: ${localNums.size} (1..${maxLocal})`)
  console.log(`Gaps in numbering: ${gaps.length > 0 ? gaps.join(', ') : 'none'}`)

  const forms = entries.filter((e) => e.isForm)
  if (forms.length > 0) {
    console.log(`\nForm slots (isForm: true), ${forms.length}:`)
    for (const e of forms) {
      console.log(`  #${e.dexNum} ${e.pid}  <- ${JSON.stringify(e.row.formLabel)}`)
    }
  }

  const needsMeta = entries.filter((e) => e.needsMeta)
  if (needsMeta.length > 0) {
    console.log(`\nNEEDS HUMAN INPUT — ${needsMeta.length} game-exclusive form(s):`)
    console.log('  These have no pid of their own and need a meta block. The dex list page')
    console.log('  gives only the form label, not the in-game name (e.g. "Mossy" -> "Mosslax"),')
    console.log('  so meta.names.eng and meta.imgNid must be filled in from the game or the')
    console.log("  species' own Bulbapedia article.")
    for (const e of needsMeta) {
      console.log(
        `  #${e.dexNum} ${e.pid}  label=${JSON.stringify(e.row.formLabel)}  sprite=${e.row.spriteTemplate}  (line ${e.row.sourceLine})`,
      )
    }
  }

  if (missingCosmetic.length > 0) {
    console.log(`\nREVIEW — ${missingCosmetic.length} cosmetic form(s) not listed by the wiki:`)
    console.log('  Bulbapedia dex tables omit cosmetic gender forms, but main-series dexes in')
    console.log('  this dataset include them (galar-isle-armor has 26). Decide per dex whether')
    console.log('  to add these; compare against the dex for the same game if one exists.')
    for (const m of missingCosmetic) console.log(`  ${m}`)
  }

  if (badDuplicates.length > 0) {
    console.log(`\nDUPLICATE-PID VIOLATIONS — ${badDuplicates.length}:`)
    for (const d of badDuplicates) console.log(`  ${d}`)
  }

  if (unresolved.length > 0) {
    console.log(`\nUNRESOLVED — ${unresolved.length} row(s):`)
    for (const u of unresolved) {
      console.log(
        `  #${u.row.localNum} ${u.row.speciesName} (nat ${u.row.nationalNum}) line ${u.row.sourceLine}`,
      )
      console.log(`    ${u.reason}`)
      if (u.candidates.length > 0) console.log(`    candidates: ${u.candidates.join('  ')}`)
    }
    process.exit(1)
  }

  if (badDuplicates.length > 0) process.exit(1)

  console.log('\nAll rows resolved to pids in this dataset.')
}

await main()

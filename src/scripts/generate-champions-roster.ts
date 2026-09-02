/**
 * Generate a Champions "Regular Roster" pokedex for a given Regulation Set.
 *
 * Reads every Pokémon available in `data-next/champions/pokemon.json`, orders
 * them by `data/indices/pokemon.json`, and writes a pokedex file shaped like
 * `data/pokedexes/champions-regular-roster-m-a.json`. It also registers the new
 * pokedex id in `data/indices/pokedexes.json` and in the `pokedexes` array of
 * `data/games/champions.json` (both idempotent).
 *
 * A Regulation Set that adds to the previous one can be built from that set's
 * roster instead, with the newly announced Pokémon passed in explicitly. This
 * is the only way to build a set whose additions are not in the ROM dump yet,
 * and it keeps the base roster's own ordering (M-A and M-B deliberately list
 * the recruitable Vivillon/Furfrou pattern ahead of the transfer-only ones).
 *
 * Usage:
 *   bun src/scripts/generate-champions-roster.ts <SET_ID> [options]
 *
 *   --base <SET_ID>   build on top of that set's roster instead of the ROM dump
 *   --add <pid,...>   Pokémon to add, inserted at their `indices/pokemon.json` slot
 *   --preliminary     note in `desc` that the announced additions are incomplete
 *
 *   bun src/scripts/generate-champions-roster.ts M-B
 *   bun src/scripts/generate-champions-roster.ts M-C --base M-B --add rillaboom,baxcalibur --preliminary
 */
import fs from 'node:fs'
import path from 'node:path'

interface ChampionsPokemon {
  id: string
  nid: string
  isForm: boolean
}

interface PokedexEntry {
  pid: string
  dexNum: number
  isForm: boolean
  transferOnly?: boolean
}

const DATA_DIR = path.resolve(process.env.POKEPC_DATASET_DIR ?? 'data')
const DATA_NEXT_DIR = path.resolve('data-next')

const CHAMPIONS_POKEMON = path.join(DATA_NEXT_DIR, 'champions', 'pokemon.json')
const POKEMON_INDEX = path.join(DATA_DIR, 'indices', 'pokemon.json')
const POKEDEXES_INDEX = path.join(DATA_DIR, 'indices', 'pokedexes.json')
const CHAMPIONS_GAME = path.join(DATA_DIR, 'games', 'champions.json')
const POKEDEXES_DIR = path.join(DATA_DIR, 'pokedexes')
const POKEMON_DIR = path.join(DATA_DIR, 'pokemon')

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

function pokedexIdForSet(setId: string): string {
  return `champions-regular-roster-${setId.toLowerCase()}`
}

interface Options {
  baseSetId?: string
  additions: string[]
  preliminary: boolean
}

function parseOptions(flags: string[]): Options {
  const options: Options = { additions: [], preliminary: false }

  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i]
    if (flag === '--preliminary') {
      options.preliminary = true
      continue
    }
    const value = flags[++i]
    if (value === undefined) throw new Error(`Missing value for ${flag}`)
    if (flag === '--base') options.baseSetId = value
    else if (flag === '--add')
      options.additions = value
        .split(',')
        .map((pid) => pid.trim())
        .filter(Boolean)
    else throw new Error(`Unknown option: ${flag}`)
  }

  return options
}

/** Entries of a previously generated roster, in the order that file lists them. */
function readBaseEntries(baseSetId: string): PokedexEntry[] {
  const file = path.join(POKEDEXES_DIR, `${pokedexIdForSet(baseSetId)}.json`)
  if (!fs.existsSync(file)) throw new Error(`No roster for base set ${baseSetId}: ${file}`)
  return readJson<{ entries: PokedexEntry[] }>(file).entries
}

/** Entries for explicitly added Pokémon, read from their own dataset records. */
function readAddedEntries(pids: string[]): PokedexEntry[] {
  return pids.map((pid) => {
    const file = path.join(POKEMON_DIR, `${pid}.json`)
    if (!fs.existsSync(file)) throw new Error(`Unknown Pokémon "${pid}": ${file} does not exist`)
    const pokemon = readJson<{ dexNum: number; isForm: boolean }>(file)
    return { pid, dexNum: pokemon.dexNum, isForm: pokemon.isForm }
  })
}

/**
 * Splice `additions` into `base` at their `indices/pokemon.json` slot, leaving
 * the base order untouched: an addition lands right after the last base entry
 * that precedes it nationally.
 */
function insertByNationalOrder(
  base: PokedexEntry[],
  additions: PokedexEntry[],
  orderMap: Map<string, number>,
): PokedexEntry[] {
  const rank = (pid: string) => orderMap.get(pid) ?? Number.MAX_SAFE_INTEGER
  const merged = [...base]

  for (const addition of [...additions].sort((a, b) => rank(a.pid) - rank(b.pid))) {
    const at = merged.findLastIndex((entry) => rank(entry.pid) < rank(addition.pid))
    merged.splice(at + 1, 0, addition)
  }

  return merged
}

/** Derive the national dex number from a nid like "0003", "0666-polar", "1024". */
function dexNumFromNid(nid: string): number {
  const n = Number.parseInt(nid, 10)
  if (!Number.isFinite(n)) throw new Error(`Cannot derive dexNum from nid: ${nid}`)
  return n
}

function serializeEntry(e: PokedexEntry): string {
  let s = `{ "pid": ${JSON.stringify(e.pid)}, "dexNum": ${e.dexNum}, "isForm": ${e.isForm}`
  if (e.transferOnly) s += `, "transferOnly": true`
  return `${s} }`
}

/** Build the pokedex file content with one entry per line (matches existing files). */
function serializePokedex(
  meta: { id: string; name: string; shortDesc: string; desc: string },
  entries: PokedexEntry[],
): string {
  const lines = [
    '{',
    `  "id": ${JSON.stringify(meta.id)},`,
    `  "name": ${JSON.stringify(meta.name)},`,
    `  "shortDesc": ${JSON.stringify(meta.shortDesc)},`,
    `  "desc": ${JSON.stringify(meta.desc)},`,
    '  "gen": 0,',
    '  "region": null,',
    '  "isNational": false,',
    '  "baseDex": null,',
    '  "pkApiId": null,',
    '  "entries": [',
  ]
  entries.forEach((entry, i) => {
    const comma = i < entries.length - 1 ? ',' : ''
    lines.push(`    ${serializeEntry(entry)}${comma}`)
  })
  lines.push('  ]', '}')
  return `${lines.join('\n')}\n`
}

function main(): void {
  const rawSetId = process.argv[2]
  if (!rawSetId) {
    console.error('Usage: bun src/scripts/generate-champions-roster.ts <SET_ID> [options]')
    console.error("  --base <SET_ID>   build on top of that set's roster instead of the ROM dump")
    console.error('  --add <pid,...>   Pokémon to add, at their indices/pokemon.json slot')
    console.error('  --preliminary     note in `desc` that the announced additions are incomplete')
    process.exit(1)
  }

  const options = parseOptions(process.argv.slice(3))
  const setUpper = rawSetId.toUpperCase()
  const pokedexId = pokedexIdForSet(rawSetId)

  const preliminaryNote = options.preliminary
    ? ` This list is preliminary: only part of the Regulation Set ${setUpper} additions have been announced, so it grows as the remaining Pokémon are revealed.`
    : ''
  const meta = {
    id: pokedexId,
    name: `Recruiting Ranch - Regular Roster ${setUpper}`,
    shortDesc: `List of Pokémon eligible for battle in Pokémon Champions Regulation Set ${setUpper}.`,
    desc: `Regular Roster ${setUpper} features all Pokémon (and forms) eligible for battle in Regulation Set ${setUpper}. This includes all recruitable and transfer-only Pokémon in the Regulation Set.${preliminaryNote}`,
  }

  // 1. Load the global ordering.
  const order = readJson<string[]>(POKEMON_INDEX)
  const orderMap = new Map(order.map((pid, i) => [pid, i]))

  // 2. Build the base entries, either from a previous set or from the ROM dump.
  let entries: PokedexEntry[]
  if (options.baseSetId) {
    entries = readBaseEntries(options.baseSetId)
    console.log(`[base]  ${pokedexIdForSet(options.baseSetId)} (${entries.length} entries)`)
  } else {
    const champions = readJson<ChampionsPokemon[]>(CHAMPIONS_POKEMON)
    const missing: string[] = []
    const sorted = [...champions].sort((a, b) => {
      const ai = orderMap.get(a.id)
      const bi = orderMap.get(b.id)
      if (ai === undefined) missing.push(a.id)
      if (bi === undefined) missing.push(b.id)
      return (ai ?? Number.MAX_SAFE_INTEGER) - (bi ?? Number.MAX_SAFE_INTEGER)
    })
    if (missing.length > 0) {
      console.warn(
        `[warn] ${[...new Set(missing)].length} Pokémon not found in pokemon index (placed last): ${[...new Set(missing)].join(', ')}`,
      )
    }
    entries = sorted.map((p) => ({
      pid: p.id,
      dexNum: dexNumFromNid(p.nid),
      isForm: p.isForm,
    }))
  }

  // 3. Splice in the explicitly announced additions.
  if (options.additions.length > 0) {
    const known = new Set(entries.map((entry) => entry.pid))
    const duplicates = options.additions.filter((pid) => known.has(pid))
    if (duplicates.length > 0) {
      throw new Error(`Already in the roster: ${duplicates.join(', ')}`)
    }
    entries = insertByNationalOrder(entries, readAddedEntries(options.additions), orderMap)
    console.log(`[add]   ${options.additions.join(', ')}`)
  }

  // 4. Write the pokedex file.
  const pokedexFile = path.join(POKEDEXES_DIR, `${pokedexId}.json`)
  fs.writeFileSync(pokedexFile, serializePokedex(meta, entries))
  console.log(`[write] ${path.relative(process.cwd(), pokedexFile)} (${entries.length} entries)`)

  // 5. Register in indices/pokedexes.json (one entry per line, matches existing format).
  const pokedexIndex = readJson<string[]>(POKEDEXES_INDEX)
  if (!pokedexIndex.includes(pokedexId)) {
    pokedexIndex.push(pokedexId)
    const content = `[\n${pokedexIndex.map((s) => `  ${JSON.stringify(s)}`).join(',\n')}\n]\n`
    fs.writeFileSync(POKEDEXES_INDEX, content)
    console.log(`[update] ${path.relative(process.cwd(), POKEDEXES_INDEX)}`)
  } else {
    console.log(`[skip] ${pokedexId} already in indices/pokedexes.json`)
  }

  // 6. Register in games/champions.json `pokedexes` (preserve file formatting via inline replace).
  const gameRaw = fs.readFileSync(CHAMPIONS_GAME, 'utf8')
  const game = JSON.parse(gameRaw) as { pokedexes: string[] }
  if (!game.pokedexes.includes(pokedexId)) {
    const next = [...game.pokedexes, pokedexId]
    const inline = `[${next.map((s) => JSON.stringify(s)).join(', ')}]`
    const replaced = gameRaw.replace(/("pokedexes":\s*)\[[^\]]*\]/, `$1${inline}`)
    if (replaced === gameRaw)
      throw new Error('Could not locate "pokedexes" array in champions.json')
    fs.writeFileSync(CHAMPIONS_GAME, replaced)
    console.log(`[update] ${path.relative(process.cwd(), CHAMPIONS_GAME)}`)
  } else {
    console.log(`[skip] ${pokedexId} already in games/champions.json`)
  }
}

main()

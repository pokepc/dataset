/**
 * Generate a Champions "Regular Roster" pokedex for a given Regulation Set.
 *
 * Reads every Pokémon available in `data-next/champions/pokemon.json`, orders
 * them by `data/indices/pokemon.json`, and writes a pokedex file shaped like
 * `data/pokedexes/champions-regular-roster-m-a.json`. It also registers the new
 * pokedex id in `data/indices/pokedexes.json` and in the `pokedexes` array of
 * `data/games/champions.json` (both idempotent).
 *
 * Usage:
 *   bun src/scripts/generate-champions-roster.ts <SET_ID>
 *   bun src/scripts/generate-champions-roster.ts M-B
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

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
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
    console.error('Usage: bun src/scripts/generate-champions-roster.ts <SET_ID>  (e.g. M-B)')
    process.exit(1)
  }

  const setUpper = rawSetId.toUpperCase()
  const setLower = rawSetId.toLowerCase()
  const pokedexId = `champions-regular-roster-${setLower}`

  const meta = {
    id: pokedexId,
    name: `Recruiting Ranch - Regular Roster ${setUpper}`,
    shortDesc: `List of Pokémon eligible for battle in Pokémon Champions Regulation Set ${setUpper}.`,
    desc: `Regular Roster ${setUpper} features all Pokémon (and forms) eligible for battle in Regulation Set ${setUpper}. This includes all recruitable and transfer-only Pokémon in the Regulation Set.`,
  }

  // 1. Load source data and the global ordering.
  const champions = readJson<ChampionsPokemon[]>(CHAMPIONS_POKEMON)
  const order = readJson<string[]>(POKEMON_INDEX)
  const orderMap = new Map(order.map((pid, i) => [pid, i]))

  // 2. Order champions Pokémon by the global pokemon index.
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

  // 3. Build entries.
  const entries: PokedexEntry[] = sorted.map((p) => ({
    pid: p.id,
    dexNum: dexNumFromNid(p.nid),
    isForm: p.isForm,
  }))

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

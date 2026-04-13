/**
 * Re-tags abilities via OpenAI structured outputs (Zod). Writes data/abilities.json.
 *
 * Requires: OPENAI_API_KEY
 * Optional: OPENAI_MODEL (default: gpt-5.4), BATCH_SIZE (default: 8), DRY_RUN=1
 *
 * Run (do not commit API keys):
 *   OPENAI_API_KEY=... bun run scripts/tag-abilities-openai.ts
 *   DRY_RUN=1 bun run scripts/tag-abilities-openai.ts   # no write, log sample
 *
 * Limit for testing: --limit=20
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { abilityTagIds, typeIds } from '../lib/enums'

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.4'
const BATCH_SIZE = Math.max(1, Number(process.env.BATCH_SIZE ?? 8) || 8)
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ABILITIES_PATH = path.resolve(__dirname, '../data/abilities.json')

const tagEnum = z.enum(abilityTagIds)
const typeEnum = z.enum(typeIds)

const batchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.string().describe('Exact ability id from the input batch'),
        tags: z.array(tagEnum).min(1).describe('At least one tag; only values from the allowed list'),
        immunities: z
          .array(typeEnum)
          .nullable()
          .describe(
            'null if no type-move immunity is clearly stated. Otherwise list types this ability grants immunity to for damaging moves of that type (e.g. "immune to Water-type moves").',
          ),
        weaknesses: z
          .array(typeEnum)
          .nullable()
          .describe(
            'null unless the text clearly states extra damage TO this Pokemon from a type (e.g. Dry Skin + Fire, Fluffy + Fire). Do not infer from species typings.',
          ),
      }),
    )
    .describe('One object per ability in the batch, same ids as input'),
})

const SYSTEM_PROMPT = `You classify Pokemon abilities for a structured dataset.

You MUST:
- Output only the JSON schema requested. For immunities and weaknesses use null when none apply (never guess).
- Use ONLY tag strings from the allowed tag enum — never invent tags.
- Use ONLY type strings from the allowed type enum for immunities/weaknesses — never invent types.
- Give each ability at least one tag.
- Prefer a small set of accurate tags (typically 1–3) over tagging everything possible.
- Do not copy-paste the same tags for every ability; read each description.

IMMUNITIES (use null unless clearly stated):
- Non-null ONLY when the text clearly says this Pokemon is immune to moves of a specific type (e.g. "immune to Electric-type moves", "immune to Ground-type attacks").
- Volt Absorb / Water Absorb / Flash Fire / Levitate-style immunities count.
- Do NOT treat "immune to sandstorm damage", "immune to powder moves", "immune to sound-based moves", or "immune to Intimidate" as type immunities — use null.

WEAKNESSES (use null unless clearly stated):
- Non-null ONLY when the text clearly says attacks of a type deal extra damage TO this Pokemon because of the ability (e.g. Dry Skin: Fire moves stronger; Fluffy: double damage from Fire moves).
- Use null if merely "not very effective" or general type chart — only ability-granted extra weakness.

TAG DEFINITIONS (when to use):
- alert: On switch-in, reveals information about foes (Anticipation, Forewarn, Frisk).
- ally-helper: Primarily helps allies (healing ally, buffing allies' stats, Friend Guard, Battery, Healer).
- stat-boost: Raises or lowers stat stages (including on switch-in or when KOing), Speed Boost, Moxie, Beast Boost, Simple, Intimidate (foe Attack drop), etc.
- move-boost: Move power, accuracy, crit rate, multi-hit count, STAB-like effects, type-changing Normal moves (-ate abilities), Technician, Sheer Force — effects tied to how moves behave, not raw stat stages.
- bypass: Ignores abilities, stats, or typings in specific ways (Mold Breaker line, Unaware, Tinted Lens, Scrappy hitting Ghost).
- damage: Deals HP damage to opponents via the ability (Rough Skin, Iron Barbs, Aftermath, Innards Out, Bad Dreams chip).
- defense: Reduces incoming damage, prevents crits, endure effects, blocks move categories relevant to survival, Magic Bounce, Sturdy, filters — not the same as trap.
- handicap: Hinders this Pokemon (Slow Start, Defeatist, Klutz, Truant, Honey Gather "no competitive use").
- heal: Restores this Pokemon's HP (including when hit by a absorbed type move).
- items: Berries, Fling, stealing meta, Unnerve, Harvest, item suppression — item-focused.
- priority-control: Changes move order / priority bracket (Stall, effects that explicitly alter priority).
- target-weaken: Weakens the target's stats (Cotton Down, etc.) or something else that affects the target.
- status-trigger: Inflicts non-volatile status or flinch on others via contact/chance (Static, Flame Body, Poison Point, Stench).
- status-immunity: This Pokemon cannot get certain status conditions or is cured (Limber, Immunity, Comatose, Overcoat powder, etc.).
- steal: Steals held items (Pickpocket, Magician).
- weather: Sets or strongly depends on weather (Rain, Sun, Sand, Snow, Cloud Nine, Air Lock, Primordial Sea, etc.) — classic weather, not Electric Terrain.
- terrain: Sets Electric/Psychic/Misty/Grassy Terrain, or ability fundamentally tied to terrain (Hadron Engine, Surge abilities, Mimicry, Seed Sower).
- trap: Prevents opposing switches (Shadow Tag, Arena Trap, Magnet Pull).
- ability-change: Changes this Pokemon's Ability (Wandering Spirit, Receiver, etc.).
- type-change: Changes this Pokemon's Type (Protean, Libero, etc.).
- species-specific: Text ties the effect to a specific species or form line ("If this Pokemon is a X", Arceus plates, Cherrim, Silvally, etc.).
- other: Rare mechanics that truly fit no other tag; use sparingly. Do not use together with other tags. It's either this tag or the others. Prioritize the other tags if they apply.

If both terrain and weather apply, you may include both. Do not use "other" when a specific tag fits.`

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined
  return { limit: Number.isFinite(limit) && limit! > 0 ? limit : undefined }
}

function buildUserContent(batch: Array<{ id: string; name: string; shortDesc: string; desc: string }>): string {
  const lines = batch.map((a) =>
    JSON.stringify({
      id: a.id,
      name: a.name,
      shortDesc: a.shortDesc,
      desc: a.desc,
    }),
  )
  return [
    'Classify each ability below. Return results for EVERY id in this batch, once each.',
    'Input (one JSON object per line):',
    ...lines,
  ].join('\n')
}

type BatchRow = z.infer<typeof batchResponseSchema>['results'][number]

function normalizeEntry(parsed: BatchRow): { tags: string[]; immunities?: string[]; weaknesses?: string[] } {
  const tags = [...new Set(parsed.tags)].sort()
  const out: { tags: string[]; immunities?: string[]; weaknesses?: string[] } = { tags }
  const im = parsed.immunities
  const wk = parsed.weaknesses
  if (im != null && im.length > 0) out.immunities = [...new Set(im)].sort()
  if (wk != null && wk.length > 0) out.weaknesses = [...new Set(wk)].sort()
  return out
}

async function runBatch(
  client: OpenAI,
  batch: Array<{ id: string; name: string; shortDesc: string; desc: string }>,
): Promise<Map<string, { tags: string[]; immunities?: string[]; weaknesses?: string[] }>> {
  const completion = await client.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserContent(batch) },
    ],
    response_format: zodResponseFormat(batchResponseSchema, 'ability_batch'),
    temperature: 0.2,
  })

  const message = completion.choices[0]?.message
  if (!message?.parsed) {
    throw new Error(`No parsed response: ${message?.refusal ?? completion}`)
  }

  const { results } = message.parsed
  const expected = new Set(batch.map((b) => b.id))
  const got = new Set(results.map((r) => r.id))
  for (const id of expected) {
    if (!got.has(id)) throw new Error(`Missing result for ability id: ${id}`)
  }
  for (const r of results) {
    if (!expected.has(r.id)) throw new Error(`Unexpected ability id in response: ${r.id}`)
  }

  const map = new Map<string, { tags: string[]; immunities?: string[]; weaknesses?: string[] }>()
  for (const r of results) {
    map.set(r.id, normalizeEntry(r))
  }
  return map
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const { limit } = parseArgs()
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey && !DRY_RUN) {
    console.error('Set OPENAI_API_KEY (or DRY_RUN=1 with --limit for local schema check only).')
    process.exit(1)
  }

  type AbilityRow = {
    id: string
    name: string
    psName: string
    gen: number
    shortDesc: string
    desc: string
    tags?: string[]
    immunities?: string[]
    weaknesses?: string[]
  }

  const raw = JSON.parse(fs.readFileSync(ABILITIES_PATH, 'utf8')) as AbilityRow[]
  const slice = limit != null ? raw.slice(0, limit) : raw
  const batches = chunk(slice, BATCH_SIZE)

  const merged = new Map<string, { tags: string[]; immunities?: string[]; weaknesses?: string[] }>()

  if (DRY_RUN && !apiKey) {
    console.error('DRY_RUN without API key: validating Zod schema only.')
    const sample = batchResponseSchema.safeParse({
      results: [
        {
          id: 'voltabsorb',
          tags: ['heal'],
          immunities: ['electric'],
          weaknesses: null,
        },
        {
          id: 'stench',
          tags: ['status-trigger'],
          immunities: null,
          weaknesses: null,
        },
      ],
    })
    console.log('sample parse:', sample.success, sample.success ? 'ok' : sample.error)
    process.exit(sample.success ? 0 : 1)
  }

  const client = new OpenAI({ apiKey: apiKey! })

  let bi = 0
  for (const batch of batches) {
    bi += 1
    console.error(`Batch ${bi}/${batches.length} (${batch.length} abilities)...`)
    const part = await runBatch(client, batch)
    for (const [k, v] of part) merged.set(k, v)
  }

  if (DRY_RUN) {
    console.log(JSON.stringify(Object.fromEntries(merged), null, 2))
    console.error('DRY_RUN: not writing abilities.json')
    return
  }

  const idToMeta = merged
  const next = raw.map((row) => {
    const meta = idToMeta.get(row.id)
    if (!meta) return row
    const updated: AbilityRow = {
      ...row,
      tags: meta.tags,
    }
    if (meta.immunities?.length) updated.immunities = meta.immunities
    else delete updated.immunities
    if (meta.weaknesses?.length) updated.weaknesses = meta.weaknesses
    else delete updated.weaknesses
    return updated
  })

  fs.writeFileSync(ABILITIES_PATH, JSON.stringify(next, null, 2) + '\n')
  console.error(`Wrote ${ABILITIES_PATH} (${idToMeta.size} abilities updated from ${slice.length} processed).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/** Apply the reviewed form-transition manifest offline. Preview unless --write is supplied. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { format } from 'oxfmt'
import { formMethodSchema, type FormMethod } from '../lib/form-schemas.ts'
import { expandFormMethods } from '../lib/form-methods.ts'
import { itemSchema } from '../lib/schemas.ts'
import manifest from './form-data/methods.json' with { type: 'json' }
import additions from './form-data/items.json' with { type: 'json' }
import previousHashes from './form-data/previous-method-hashes.json' with { type: 'json' }
import { methodHash } from './form-data/transition-audit.ts'

export const formMethods = Object.fromEntries(
  Object.entries(manifest).map(([id, methods]) => [
    id,
    methods.map((method) => formMethodSchema.parse(method)),
  ]),
)
export const formItems = additions.map((item) => itemSchema.parse(item))

export async function migrateFormRecord(original: string, methods: FormMethod[]): Promise<string> {
  const pokemon = JSON.parse(original)
  methods.forEach((method) => formMethodSchema.parse(method))
  if (pokemon.formMethods && !isDeepStrictEqual(pokemon.formMethods, methods)) {
    const expectedHash = (previousHashes as Record<string, string>)[pokemon.id]
    if (!expectedHash || methodHash(pokemon.formMethods) !== expectedHash)
      throw new Error(`Refusing to overwrite existing form methods: ${pokemon.id}`)
  }
  // The legacy item was incorrectly attached to ordinary Mawile as well as Mega Mawile.
  const misplacedMawilite = pokemon.id === 'mawile' && pokemon.formItem === 'mawilite'
  if (
    pokemon.formItem &&
    !misplacedMawilite &&
    !methods.some((method) => method.item?.id === pokemon.formItem)
  ) {
    throw new Error(`Unmigrated formItem: ${pokemon.id}`)
  }
  let updated = original
  const changed = !isDeepStrictEqual(pokemon.formMethods ?? [], methods)
  if (changed && pokemon.formMethods) {
    updated = updated.replace(/^  "formMethods": [\s\S]*?(?=^  "[^"\n]+":|^})/gm, '')
  }
  if (changed && methods.length) {
    const formatted = await format('form-methods.json', JSON.stringify({ formMethods: methods }))
    if (formatted.errors.length) throw new Error('Could not format form methods')
    const field = formatted.code.slice(
      formatted.code.indexOf('\n') + 1,
      formatted.code.lastIndexOf('\n}'),
    )
    const offset = updated.indexOf('  "names":')
    if (offset < 0) throw new Error('Missing form-method insertion point')
    updated = updated.slice(0, offset) + field + ',\n' + updated.slice(offset)
  }
  updated = updated.replace(/^  "formItem": [^\n]*\n/m, '')
  updated = updated.replace(/,\n}(\s*)$/, '\n}$1')
  const expected = { ...pokemon }
  delete expected.formItem
  if (methods.length) expected.formMethods = methods
  else delete expected.formMethods
  if (!isDeepStrictEqual(JSON.parse(updated), expected))
    throw new Error('Migration changed unexpected fields')
  return updated
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--write'))
    throw new Error('Usage: migrate-pokemon-forms.ts [--write]')
  const records = readdirSync('data/pokemon')
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const path = resolve('data/pokemon', file)
      const original = readFileSync(path, 'utf8')
      return {
        path,
        original,
        pokemon: JSON.parse(original) as Pkds.Pokemon & { formItem?: string },
      }
    })
  const byId = new Map(records.map(({ pokemon }) => [pokemon.id, pokemon]))
  const expanded = expandFormMethods(
    Object.entries(formMethods).map(([id, methods]) => ({ id, formMethods: methods })),
  )
  for (const [id, methods] of Object.entries(expanded)) {
    const target = byId.get(id)
    if (!target) throw new Error(`Unknown destination: ${id}`)
    for (const method of methods)
      for (const from of method.from) {
        if (from === id || byId.get(from)?.dexNum !== target.dexNum)
          throw new Error(`Invalid form transition: ${from} -> ${id}`)
      }
  }
  const originalItems = readFileSync('data/items.json', 'utf8')
  const items: Pkds.Item[] = JSON.parse(originalItems)
  const missingItems = formItems.filter(
    (item) => !items.some((existing) => existing.id === item.id),
  )
  const knownItems = new Set([...items, ...missingItems].map((item) => item.id))
  for (const methods of Object.values(expanded))
    for (const method of methods) {
      if (method.item && !knownItems.has(method.item.id))
        throw new Error(`Unknown item: ${method.item.id}`)
    }
  // Validate and prepare the complete migration before the first write.
  const changes: { path: string; original: string; code: string }[] = []
  for (const { path, original, pokemon } of records) {
    const methods = formMethods[pokemon.id]
    if (!methods && !pokemon.formMethods && !pokemon.formItem) continue
    const code = await migrateFormRecord(original, methods ?? [])
    if (code !== original) changes.push({ path, original, code })
  }
  if (missingItems.length) {
    const path = resolve('data/items.json')
    const result = await format('items.json', JSON.stringify([...items, ...missingItems]))
    if (result.errors.length) throw new Error('Could not format items')
    changes.push({ path, original: originalItems, code: result.code })
  }
  for (const { path, original } of changes)
    if (readFileSync(path, 'utf8') !== original) throw new Error(`Concurrent edit: ${path}`)
  if (args.includes('--write')) for (const { path, code } of changes) writeFileSync(path, code)
  console.log(
    `${args.includes('--write') ? 'Migrated' : 'Would migrate'} ${changes.length} files; ${missingItems.length} new items.`,
  )
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) await main()

import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { format } from 'oxfmt'
import { availabilityFields, availabilityJson, type AvailabilityReport } from './availability.ts'

export async function patchPokemonFile(file: string, report: AvailabilityReport): Promise<boolean> {
  const original = await readFile(file, 'utf8')
  const current = JSON.parse(original) as Record<string, unknown>
  if (current.id !== report.pokemon.id || current.nid !== report.pokemon.nid) {
    throw new Error('The destination Pokémon does not match the availability report.')
  }
  const fields = [...availabilityFields, 'storableIn'] as const
  for (const field of fields) {
    if (JSON.stringify(current[field]) !== JSON.stringify(report.pokemon[field])) {
      throw new Error(`The Pokémon's ${field} changed during lookup. Run the command again.`)
    }
  }
  const patch = availabilityJson(report)
  for (const field of fields) current[field] = patch[field]
  const config = JSON.parse(
    await readFile(new URL('../../../.oxfmtrc.json', import.meta.url), 'utf8'),
  )
  const formatted = await format(file, JSON.stringify(current, null, 2), config)
  if (formatted.errors.length) {
    throw new Error(
      `Could not format ${file}: ${formatted.errors.map((error) => error.message).join('; ')}`,
    )
  }
  if (formatted.code === original) return false

  // Format before replacing the destination so a formatting/write failure leaves it intact.
  const temporary = `${file}.${randomUUID()}.tmp`
  const { mode } = await stat(file)
  try {
    await writeFile(temporary, formatted.code, { flag: 'wx', mode: mode & 0o777 })
    if ((await readFile(file, 'utf8')) !== original) {
      throw new Error('The Pokémon file changed during patching. Run the command again.')
    }
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
  return true
}

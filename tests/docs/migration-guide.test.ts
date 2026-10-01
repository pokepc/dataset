import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { localeCodeByV7Key } from '../../src/lib/languages'
import { textSchemas } from '../../src/lib/schemas'

const guide = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../docs/migrating-to-v8.md'),
  'utf8',
)

function section(heading: string): string {
  const start = guide.indexOf(`## ${heading}`)
  if (start < 0) throw new Error(`Missing section ${heading}`)
  const end = guide.indexOf('\n## ', start + 1)
  return guide.slice(start, end < 0 ? undefined : end)
}

describe('v7 to v8 migration guide', () => {
  it('maps every v7 translation key to its v8 locale code', () => {
    const rows = [...section('Locale codes').matchAll(/^\| `([a-z-]+)` +\| `([a-z]+)` /gm)]
    expect(Object.fromEntries(rows.map(([, code, key]) => [key, code]))).toEqual(localeCodeByV7Key)
  })

  it('names every locale text field of the v8 schemas', () => {
    const moved = section('Data files')
    const fields = new Set(
      Object.values(textSchemas).flatMap((schema) => Object.keys(schema.shape)),
    )
    for (const field of fields) expect(moved, field).toContain(field)
  })

  it('has no pending sections left', () => {
    expect(guide).not.toMatch(/\b(TBD|TODO|Pending)\b/)
  })
})

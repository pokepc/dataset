import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DATA_NEXT_ROOT = join(process.cwd(), 'data-next')

export function writeJsonFile(fullPath: string, data: unknown): void {
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`)
}

export function writeJsonDataFile(relativePath: string, data: unknown): void {
  const fullPath = join(DATA_NEXT_ROOT, relativePath)
  writeJsonFile(fullPath, data)
}

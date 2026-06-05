import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { appLangs } from './languages'
import '../upstream-adapters/projectpokemon-champout/build'

const DATA_NEXT_ROOT = join(process.cwd(), 'data-next')

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

writeJsonFile(join(DATA_NEXT_ROOT, 'languages.json'), appLangs)

console.log(`Generated ${appLangs.length} app languages`)

import { writeJsonDataFile } from './fs'
import { appLangs } from './languages'

await import('../upstream-adapters/projectpokemon-champout/build')
await import('../upstream-adapters/pokeapi/build')

writeJsonDataFile('languages.json', appLangs)
console.log(`Exported ${appLangs.length} app languages`)

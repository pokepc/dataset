/**
 * Brings data/codes up to date with the dataset: appends codes for new ids and marks removed ids
 * as retired, never renumbering existing codes. Set `replacedBy` on retired Pokémon by hand.
 */
import { codeMapKinds, findCodeMapProblems, syncCodeMap } from '../lib/codes'
import { loadCodeMap, loadCodeMapLiveIds, writeDatasetFile } from '../lib/fs'

let failed = false

for (const kind of codeMapKinds) {
  const current = loadCodeMap(kind)
  const liveIds = loadCodeMapLiveIds(kind)
  const synced = syncCodeMap(current, liveIds)

  const appended = synced.length - current.length
  const retired = synced.filter((entry, index) => entry.retired && !current[index]?.retired).length
  if (appended > 0 || retired > 0) {
    writeDatasetFile(synced, `codes/${kind}.json`)
  }
  console.log(`${kind}: ${synced.length} codes, ${appended} appended, ${retired} newly retired`)

  const problems = findCodeMapProblems(synced, liveIds)
  if (problems.length > 0) {
    failed = true
    console.error(problems.map((problem) => `  ${kind}: ${problem}`).join('\n'))
  }
}

if (failed) {
  process.exitCode = 1
}

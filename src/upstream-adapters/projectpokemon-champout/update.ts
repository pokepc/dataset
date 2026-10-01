/**
 * `pnpm champions:update`: parses the Champions game dump (`src/upstreams/projectpokemon-champout`),
 * adds PokéAPI ids, and rewrites `mods/champions/` plus the base facts Champions owns. Run it
 * manually after updating the submodule and review the diff; it is not part of `pnpm build`.
 *
 * Usage: bun src/upstream-adapters/projectpokemon-champout/update.ts [--data-dir=data]
 */
import { resolve } from 'node:path'
import { DATASET_DIR, loadGameSetSource } from '../../lib/fs'
import { toLocaleCode } from '../../lib/languages'
import { mergeGameSet } from '../../lib/merge'
import {
  enrichChampionsRecordsWithPokeApiIds,
  formatEnrichChampionsDataSummary,
} from '../pokeapi/enrich-champions'
import { I18N_CODE, langMap } from './mappings'
import { buildData, DEFAULT_DATASET_ROOT, formatBuildWarning, type BuiltData } from './parser'
import { CHAMPIONS_SET, championsToV8, diffMergedChampions, type ChampionsDump } from './to-v8'
import { readModdableBase, writeChampionsV8 } from './v8-files'

/** Parser output with text keyed by v8 locale code. Locales missing from the dump stay missing. */
export function toChampionsDump(data: BuiltData): ChampionsDump {
  const i18n: ChampionsDump['i18n'] = {}
  for (const code of I18N_CODE) i18n[toLocaleCode(langMap[code].gameLocale)] = data.i18n[code]
  return {
    pokemon: data.pokemon,
    pokemonMoves: data.pokemonMoves,
    moves: data.moves,
    abilities: data.abilities,
    items: data.items,
    battleStates: data.battleStates,
    i18n,
  }
}

if (import.meta.main) {
  const dataArg = process.argv.find((arg) => arg.startsWith('--data-dir='))
  const dataDir = dataArg ? resolve(dataArg.slice('--data-dir='.length)) : DATASET_DIR

  const data = buildData(DEFAULT_DATASET_ROOT, {
    onWarning: (warning) => console.warn(formatBuildWarning(warning)),
  })
  const { records, result } = await enrichChampionsRecordsWithPokeApiIds({
    abilities: data.abilities,
    items: data.items,
    moves: data.moves,
  })
  console.log(formatEnrichChampionsDataSummary(result))

  const dump = toChampionsDump({ ...data, ...records })
  const { written, deleted } = writeChampionsV8(
    dataDir,
    championsToV8(dump, readModdableBase(dataDir)),
  )

  const merged = mergeGameSet(loadGameSetSource(CHAMPIONS_SET, { dataDir }))
  const problems = diffMergedChampions(dump, merged)
  if (problems.length > 0) {
    console.error(`Merged champions does not match the dump:\n${problems.slice(0, 30).join('\n')}`)
    process.exit(1)
  }

  console.log(
    [
      `Champions: ${dump.pokemon.length} Pokémon, ${dump.moves.length} moves`,
      `${dump.abilities.length} abilities, ${dump.items.length} items`,
      `${dump.battleStates.length} battle states, ${Object.keys(dump.i18n).length} locales`,
    ].join(', '),
  )
  console.log(
    written.length + deleted.length === 0
      ? 'No changes.'
      : `Updated ${written.length} files, deleted ${deleted.length}. Run \`pnpm format\` and review the diff.`,
  )
}

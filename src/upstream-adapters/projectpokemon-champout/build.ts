import {
  buildData,
  DEFAULT_DATASET_ROOT,
  DEFAULT_OUTPUT_ROOT,
  formatBuildWarning,
  writeBuiltData,
} from './parser'
import { gameLocales } from '../../lib-next/languages'

const data = buildData(DEFAULT_DATASET_ROOT, {
  onWarning: (warning) => {
    console.warn(formatBuildWarning(warning))
  },
})

writeBuiltData(data, DEFAULT_OUTPUT_ROOT)

console.log(
  [
    `Generated ${data.moves.length} moves`,
    `${data.abilities.length} abilities`,
    `${data.items.length} items`,
    `${data.battleStates.length} battle states`,
    `${data.pokemonMap.length} pokemon map entries`,
    `${data.movesMap.length} move map entries`,
    `${data.abilitiesMap.length} ability map entries`,
    `${data.itemsMap.length} item map entries`,
    `${data.pokemonMoves.length} pokemon move rows`,
    `for ${Object.keys(data.i18n).length} source languages`,
    `wrote ${gameLocales.length} locale directories`,
  ].join(', '),
)

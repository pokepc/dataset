import {
  enrichChampionsDataWithPokeApiIds,
  formatEnrichChampionsDataSummary,
} from './enrich-champions'

const result = await enrichChampionsDataWithPokeApiIds()

console.log(formatEnrichChampionsDataSummary(result))

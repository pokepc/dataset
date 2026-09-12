import { loadAllPokemon as loadAllRecords, writeDatasetFile } from '@pokepc/dataset/lib/fs'
import { pokemonSchema as recordSchema } from '@pokepc/dataset/lib/schemas'

const FILE_DIR = 'pokemon'

async function main() {
  const allRecords = loadAllRecords()
  const recordsById = Object.fromEntries(allRecords.map((record) => [record.id, record]))
  for (const record of allRecords) {
    if (!record.isFemaleForm) {
      continue
    }

    if (!record.baseSpecies) {
      throw new Error(`Record ${record.id} has no base species`)
    }

    const baseRecord = recordsById[record.baseSpecies]
    record.gen = Math.max(2, baseRecord.gen)
    void recordSchema.parse(record) // validate
    writeDatasetFile(record, `${FILE_DIR}/${record.id}.json`, false)
  }
}

await main()

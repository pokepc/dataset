import { transformTextData } from './text'
import { transformWazaMasterData } from './waza'

export type InputData = {
  path: string
  data: unknown
}

export function transformInputData(inputData: InputData): unknown {
  if (inputData.path === 'masterdata/waza.json') {
    return transformWazaMasterData(inputData.data)
  }

  if (inputData.path.startsWith('rom-txt/')) {
    return transformTextData(inputData.path, inputData.data)
  }

  return inputData.data
}

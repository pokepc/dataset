import { transformWazaMasterData } from './waza'

export type InputData = {
  path: string
  data: unknown
}

export function transformInputData(inputData: InputData): unknown {
  if (inputData.path === 'masterdata/waza.json') {
    return transformWazaMasterData(inputData.data)
  }

  return inputData.data
}

type TextDataset = {
  mSDataSet: unknown[]
}

type TextRecord = Record<string, unknown>

const TEXT_REPLACEMENTS = [
  {
    path: 'rom-txt/usa/wazaname.json',
    labelName: 'WAZANAME_011',
    text: 'Vice Grip',
  },
] as const

export function transformTextData(path: string, data: unknown): unknown {
  if (!isTextDataset(data)) {
    return data
  }

  const replacements = TEXT_REPLACEMENTS.filter((replacement) => replacement.path === path)

  if (replacements.length === 0) {
    return data
  }

  const replacementByLabel = new Map(
    replacements.map((replacement) => [replacement.labelName, replacement.text]),
  )

  return {
    ...data,
    mSDataSet: data.mSDataSet.map((entry) => transformTextEntry(entry, replacementByLabel)),
  }
}

function transformTextEntry(entry: unknown, replacementByLabel: Map<string, string>): unknown {
  if (!isRecord(entry)) {
    return entry
  }

  const replacement = stringField(entry, 'LabelName')
  const text = replacement === undefined ? undefined : replacementByLabel.get(replacement)

  if (text === undefined) {
    return entry
  }

  return {
    ...entry,
    OriginalText: text,
    TextInfos: Array.isArray(entry.TextInfos)
      ? entry.TextInfos.map((textInfo) => transformTextInfo(textInfo, text))
      : entry.TextInfos,
  }
}

function transformTextInfo(textInfo: unknown, text: string): unknown {
  if (!isRecord(textInfo)) {
    return textInfo
  }

  return {
    ...textInfo,
    Text: text,
  }
}

function isTextDataset(value: unknown): value is TextDataset {
  return isRecord(value) && Array.isArray(value.mSDataSet)
}

function isRecord(value: unknown): value is TextRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: TextRecord, field: string): string | undefined {
  const fieldValue = value[field]

  return typeof fieldValue === 'string' ? fieldValue : undefined
}

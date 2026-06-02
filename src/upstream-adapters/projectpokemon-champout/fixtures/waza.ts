type WazaFixtureRow = Record<string, string>

const MISSING_WAZA_ROWS = [
  {
    id: '863',
    type: '0',
    category: '2',
    target: '12',
    power: '0',
    accuracy: '101',
    pp: '1',
    direct: '0',
    priority: '0',
    classification_a: '0',
    classification_b: '0',
    text_pattern: '0',
    tcost: '250',
    available: '0',
    ms_name: 'wazaname',
    ms_lbl: 'WAZANAME_863',
    ms_name_info: 'wazainfo_syn',
    ms_lbl_info: 'WAZAINFO_SYN_863',
    con_ref: '',
    buf_ref: '',
  },
  {
    id: '892',
    type: '12',
    category: '0',
    target: '0',
    power: '120',
    accuracy: '100',
    pp: '8',
    direct: '1',
    priority: '0',
    classification_a: '0',
    classification_b: '0',
    text_pattern: '0',
    tcost: '250',
    available: '0',
    ms_name: 'wazaname',
    ms_lbl: 'WAZANAME_892',
    ms_name_info: 'wazainfo_syn',
    ms_lbl_info: 'WAZAINFO_SYN_892',
    con_ref: '',
    buf_ref: '',
  },
] as const satisfies readonly WazaFixtureRow[]

export function transformWazaMasterData(data: unknown): unknown {
  if (!Array.isArray(data)) {
    return data
  }

  const rows = [...data]
  const ids = new Set(rows.map((row) => stringField(row, 'id')))
  const labels = new Set(rows.map((row) => stringField(row, 'ms_lbl')))

  for (const fixture of MISSING_WAZA_ROWS) {
    if (ids.has(fixture.id) || labels.has(fixture.ms_lbl)) {
      continue
    }

    rows.push({ ...fixture })
  }

  return rows
}

function stringField(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  const fieldValue = (value as Record<string, unknown>)[field]

  return typeof fieldValue === 'string' ? fieldValue : undefined
}

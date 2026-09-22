import type { FormMethod, FormRevert, FormRevertDetail } from './form-schemas.ts'

/** Expand shorthand without inheriting forward items, conditions, notes, or level requirements. */
export function resolveFormRevert(rule: FormRevert, method: FormMethod): FormRevertDetail {
  const detail: FormRevertDetail =
    typeof rule === 'string'
      ? { trigger: 'automatic', conditions: [{ key: 'battle_event', events: [rule] }] }
      : 'afterTurns' in rule
        ? {
            trigger: 'automatic',
            conditions: [{ key: 'elapsed_time', amount: rule.afterTurns, unit: 'turns' }],
          }
        : structuredClone(rule)
  const games = detail.games === undefined ? method.games : detail.games
  delete detail.games
  if (games) detail.games = [...games]
  return detail
}

/** Derive incoming transitions when needed; the published JSON only stores contextual returns once. */
export function expandFormMethods(
  records: readonly { id: string; formMethods?: readonly FormMethod[] }[],
): Record<string, FormMethod[]> {
  const expanded: Record<string, FormMethod[]> = {}
  const origins = new Map<string, Set<string>>()
  for (const record of records) {
    const sources = origins.get(record.id) ?? new Set<string>()
    for (const method of record.formMethods ?? [])
      for (const source of method.from) sources.add(source)
    origins.set(record.id, sources)
  }
  for (const record of records)
    for (const method of record.formMethods ?? []) {
      const { revert, ...forward } = structuredClone(method)
      ;(expanded[record.id] ??= []).push(forward)
      for (const rule of revert ?? []) {
        const { to, games, ...action } = resolveFormRevert(rule, method)
        for (const target of to ? [to] : method.from) {
          const result: FormMethod = {
            from: [record.id],
            ...(games ? { games: [...games] } : {}),
            ...structuredClone(action),
          }
          if (!to && origins.get(record.id)!.size > 1) {
            result.conditions.push({ key: 'original_form', forms: [target] })
          }
          ;(expanded[target] ??= []).push(result)
        }
      }
    }
  return expanded
}

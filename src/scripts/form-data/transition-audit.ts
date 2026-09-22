import { createHash } from 'node:crypto'
import type { FormMethod } from '../../lib/form-schemas.ts'

/** Stable object keys; array order is preserved when protecting reviewed input against edits. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`
  return JSON.stringify(value)
}

export function methodHash(methods: FormMethod[]): string {
  return createHash('sha256').update(stableJson(methods)).digest('hex')
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonical).sort((a, b) => stableJson(a).localeCompare(stableJson(b)))
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, canonical(entry)]))
  return value
}

/** Compare semantics independently of grouping, shorthand, object order, and OR-list order. */
export function atomicFormTransitions(methods: Record<string, FormMethod[]>): string[] {
  const result = new Set<string>()
  for (const [to, entries] of Object.entries(methods))
    for (const method of entries) {
      if (method.revert) throw new Error('Expand compact reversions before comparing transitions')
      const { from, games, conditions, ...action } = method
      let alternatives: FormMethod['conditions'][] = [[]]
      for (const condition of conditions) {
        const choices =
          condition.key === 'battle_event'
            ? condition.events.map((event) => ({ ...condition, events: [event] }))
            : [condition]
        alternatives = alternatives.flatMap((prior) => choices.map((choice) => [...prior, choice]))
      }
      for (const source of from)
        for (const game of games ?? [null])
          for (const alternative of alternatives) {
            result.add(
              stableJson(canonical({ to, from: source, game, ...action, conditions: alternative })),
            )
          }
    }
  return [...result].sort()
}

export function transitionDigest(methods: Record<string, FormMethod[]>): {
  count: number
  sha256: string
} {
  const transitions = atomicFormTransitions(methods)
  return {
    count: transitions.length,
    sha256: createHash('sha256').update(transitions.join('\n')).digest('hex'),
  }
}

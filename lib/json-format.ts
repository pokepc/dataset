type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface JsonFormatOptions {
  indent?: number | string
  maxInlineLength?: number
  maxInlineItems?: number
  sortKeys?: boolean | ((a: string, b: string) => number)
  trailingComma?: boolean
  /**
   * Keep objects that are direct items of an array on a single line when possible.
   * This is the main behavior you asked for.
   */
  inlineArrayObjects?: boolean
  /**
   * Allow primitive-only arrays to stay inline when short enough.
   */
  inlinePrimitiveArrays?: boolean
}

interface FormatContext {
  indentUnit: string
  maxInlineLength: number
  maxInlineItems: number
  sortKeys: boolean | ((a: string, b: string) => number)
  trailingComma: boolean
  inlineArrayObjects: boolean
  inlinePrimitiveArrays: boolean
}

export function formatJsonCompact(value: JsonValue, options: JsonFormatOptions = {}): string {
  const ctx: FormatContext = {
    indentUnit: typeof options.indent === 'number' ? ' '.repeat(options.indent) : (options.indent ?? '  '),
    maxInlineLength: options.maxInlineLength ?? 80,
    maxInlineItems: options.maxInlineItems ?? 8,
    sortKeys: options.sortKeys ?? false,
    trailingComma: options.trailingComma ?? false,
    inlineArrayObjects: options.inlineArrayObjects ?? true,
    inlinePrimitiveArrays: options.inlinePrimitiveArrays ?? true,
  }

  return formatValue(value, 0, ctx, {
    parentType: 'root',
    forceInline: false,
  })
}

type ParentType = 'root' | 'object' | 'array'

interface NodeState {
  parentType: ParentType
  forceInline: boolean
}

function formatValue(value: JsonValue, level: number, ctx: FormatContext, state: NodeState): string {
  if (value === null) return 'null'

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`Cannot serialize non-finite number: ${value}`)
      }
      return Object.is(value, -0) ? '-0' : String(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'object':
      if (Array.isArray(value)) {
        return formatArray(value, level, ctx, state)
      }
      return formatObject(value, level, ctx, state)
    default: {
      const exhaustive: never = value
      throw new TypeError(`Unsupported value: ${String(exhaustive)}`)
    }
  }
}

function formatArray(value: JsonValue[], level: number, ctx: FormatContext, state: NodeState): string {
  if (value.length === 0) return '[]'

  const mustInline = state.forceInline
  const canInlineEntireArray =
    ctx.inlinePrimitiveArrays && isPrimitiveOnlyArray(value) && value.length <= ctx.maxInlineItems

  if (mustInline || canInlineEntireArray) {
    const inline = `[${value.map((v) => formatValue(v, level + 1, ctx, { parentType: 'array', forceInline: true })).join(', ')}]`
    if (mustInline || inline.length <= ctx.maxInlineLength) {
      return inline
    }
  }

  const nextIndent = indent(level + 1, ctx)
  const currentIndent = indent(level, ctx)

  const lines = value.map((item) => {
    const formatted = formatValue(item, level + 1, ctx, {
      parentType: 'array',
      forceInline: false,
    })

    return `${nextIndent}${formatted}`
  })

  return `[\n${joinLines(lines, ctx.trailingComma)}\n${currentIndent}]`
}

function formatObject(
  value: { [key: string]: JsonValue },
  level: number,
  ctx: FormatContext,
  state: NodeState,
): string {
  const keys = getSortedKeys(value, ctx.sortKeys)

  if (keys.length === 0) return '{}'

  const mustInline = state.forceInline
  const preferInline = state.parentType === 'array' && ctx.inlineArrayObjects

  if (mustInline || preferInline || canInlineObject(value, keys, ctx)) {
    const inline = `{ ${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}: ${formatValue(value[key], level + 1, ctx, { parentType: 'object', forceInline: true })}`,
      )
      .join(', ')} }`

    if (mustInline || inline.length <= ctx.maxInlineLength) {
      return inline
    }
  }

  const nextIndent = indent(level + 1, ctx)
  const currentIndent = indent(level, ctx)

  const lines = keys.map((key) => {
    const formattedValue = formatValue(value[key], level + 1, ctx, {
      parentType: 'object',
      forceInline: false,
    })

    return `${nextIndent}${JSON.stringify(key)}: ${formattedValue}`
  })

  return `{\n${joinLines(lines, ctx.trailingComma)}\n${currentIndent}}`
}

function canInlineObject(value: { [key: string]: JsonValue }, keys: string[], ctx: FormatContext): boolean {
  if (keys.length > ctx.maxInlineItems) return false

  for (const key of keys) {
    const v = value[key]
    if (isMultilineCandidate(v)) return false
  }

  const inline = `{ ${keys.map((key) => `${JSON.stringify(key)}: ${formatCompact(value[key])}`).join(', ')} }`

  return inline.length <= ctx.maxInlineLength
}

function isMultilineCandidate(value: JsonValue): boolean {
  if (value === null) return false
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0
  }
  return false
}

function isPrimitiveOnlyArray(value: JsonValue[]): boolean {
  return value.every(isPrimitive)
}

function isPrimitive(value: JsonValue): value is JsonPrimitive {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function formatCompact(value: JsonValue): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot serialize non-finite number: ${value}`)
    }
    return Object.is(value, -0) ? '-0' : String(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    return `[${value.map(formatCompact).join(', ')}]`
  }
  const keys = Object.keys(value)
  return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${formatCompact(value[k])}`).join(', ')} }`
}

function getSortedKeys(
  value: { [key: string]: JsonValue },
  sortKeys: boolean | ((a: string, b: string) => number),
): string[] {
  const keys = Object.keys(value)

  if (sortKeys === true) {
    return keys.sort((a, b) => a.localeCompare(b))
  }

  if (typeof sortKeys === 'function') {
    return keys.sort(sortKeys)
  }

  return keys
}

function indent(level: number, ctx: FormatContext): string {
  return ctx.indentUnit.repeat(level)
}

function joinLines(lines: string[], trailingComma: boolean): string {
  if (!trailingComma) return lines.join(',\n')
  return lines.map((line, index) => (index < lines.length - 1 ? `${line},` : line)).join('\n')
}

export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export function arrayUnique<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

export function sanitizeSearchQuery(query?: string | null) {
  if (query === undefined || query === null) {
    return ''
  }
  return query
    .toLowerCase()
    .replace(/\s{2,}/, ' ')
    .replace(/,/g, ' ')
    .replace(/\s{2,}/, ' ')
}

export function sanitizeFormStringSpaces(str: string | FormDataEntryValue | null | undefined) {
  if (!str) {
    return ''
  }
  return str.toString().replace(/\s+/g, ' ').trim()
}

export function splitSearchQueryTokens(query?: string | null): {
  positive: string[]
  negative: string[]
} {
  const tokens = sanitizeSearchQuery(query).trim().split(/\s+/).filter(Boolean)

  return tokens.reduce(
    (result, token) => {
      if (token.startsWith('!')) {
        const negatedToken = token.slice(1).trim()
        if (negatedToken) {
          result.negative.push(negatedToken)
        }
      } else {
        result.positive.push(token)
      }

      return result
    },
    { positive: [] as string[], negative: [] as string[] },
  )
}

export function matchesSearchQuery(haystack: string, query?: string | null): boolean {
  const { positive, negative } = splitSearchQueryTokens(query)
  if (positive.length === 0 && negative.length === 0) {
    return true
  }

  const normalizedHaystack = sanitizeSearchQuery(haystack)

  return (
    positive.every((token) => normalizedHaystack.includes(token)) &&
    negative.every((token) => !normalizedHaystack.includes(token))
  )
}

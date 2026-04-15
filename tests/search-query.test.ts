import { describe, expect, it } from 'vitest'
import { matchesSearchQuery, splitSearchQueryTokens } from '../lib/utils'

describe('search query helpers', () => {
  it('splits positive and negated tokens', () => {
    expect(splitSearchQueryTokens('pikachu !mega ! battle')).toEqual({
      positive: ['pikachu', 'battle'],
      negative: ['mega'],
    })
  })

  it('matches positive tokens and excludes negated tokens', () => {
    const haystack = 'pikachu electric not-battle-only cosplay form'

    expect(matchesSearchQuery(haystack, 'pikachu form')).toBe(true)
    expect(matchesSearchQuery(haystack, 'pikachu !mega')).toBe(true)
    expect(matchesSearchQuery(haystack, 'pikachu !battle-only')).toBe(false)
    expect(matchesSearchQuery(haystack, '!cosplay')).toBe(false)
  })
})

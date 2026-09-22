import { describe, expect, it } from 'vitest'
import { createStaticApiDocument } from './document.ts'
import { renderOpenApiIndexHtml } from './index-html.ts'

describe('static OpenAPI document', () => {
  const document = createStaticApiDocument({
    version: '0.0.0-test',
    serverUrl: 'https://example.com/dataset',
  })

  it('uses OpenAPI 3.1.0', () => {
    expect(document.openapi).toBe('3.1.0')
  })

  it('documents key static paths', () => {
    const paths = document.paths ?? {}

    expect(paths['/data/abilities.json']).toBeDefined()
    expect(paths['/data/pokemon/{pokemonId}.json']).toBeDefined()
    expect(paths['/data/games/{gameId}.json']).toBeDefined()
    expect(paths['/data/pokedexes/{pokedexId}.json']).toBeDefined()
    expect(paths['/data/boxpresets/modern/{gameSet}/{presetId}.json']).toBeDefined()
    expect(paths['/data/metadata/pokemon-mugshots.json']).toBeDefined()
  })

  it('emits reusable schemas', () => {
    expect(document.components?.schemas?.Ability).toBeDefined()
    expect(document.components?.schemas?.Pokemon).toBeDefined()
    expect(document.components?.schemas?.ModernBoxPreset).toBeDefined()
    expect(document.components?.schemas?.ErrorResponse).toBeDefined()
  })

  it('exposes alternative evolution methods in the public Pokemon schema', () => {
    expect(document.components?.schemas?.Pokemon).toHaveProperty(
      'properties.evoMethods.type',
      'array',
    )
    expect(document.components?.schemas?.Pokemon).toHaveProperty(
      'properties.evoMethods.items.properties.trigger.enum',
      ['level_up', 'trade', 'use_item', 'special'],
    )
    for (const field of ['evolutionMethods', 'evolvesFrom', 'evoFromLevel', 'evoFromCondition'])
      expect(document.components?.schemas?.Pokemon).not.toHaveProperty(`properties.${field}`)
  })

  it('exposes form transitions separately from evolution without the legacy item field', () => {
    expect(document.components?.schemas?.Pokemon).toHaveProperty(
      'properties.formMethods.type',
      'array',
    )
    expect(document.components?.schemas?.Pokemon).toHaveProperty(
      'properties.formMethods.items.properties.from.type',
      'array',
    )
    expect(document.components?.schemas?.Pokemon).not.toHaveProperty('properties.formItem')
  })
})

describe('OpenAPI index HTML', () => {
  it('loads the generated OpenAPI JSON file', () => {
    expect(renderOpenApiIndexHtml()).toContain('./openapi.json')
  })
})

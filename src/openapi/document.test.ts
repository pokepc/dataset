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

  it('documents base data at the root, without the v7 /data prefix', () => {
    const paths = document.paths ?? {}

    expect(paths['/abilities.json']).toBeDefined()
    expect(paths['/battle-states.json']).toBeDefined()
    expect(paths['/pokemon/{pokemonId}.json']).toBeDefined()
    expect(paths['/games/{gameId}.json']).toBeDefined()
    expect(paths['/pokedexes/{pokedexId}.json']).toBeDefined()
    expect(paths['/boxpresets/modern/{gameSet}/{presetId}.json']).toBeDefined()
    expect(paths['/metadata/pokemon-mugshots.json']).toBeDefined()
    expect(paths['/codes/{kind}.json']).toBeDefined()
    expect(Object.keys(paths).filter((path) => path.startsWith('/data/'))).toEqual([])
  })

  it('documents locale text, mods and merged game set paths', () => {
    const paths = document.paths ?? {}

    expect(paths['/i18n/{locale}/pokemon.json']).toBeDefined()
    expect(paths['/i18n/{locale}/boxpresets/{variant}/{gameSet}.json']).toBeDefined()
    expect(paths['/i18n/{locale}/pokemon-prose/{pokemonId}.md']).toBeDefined()
    expect(paths['/mods/{gameSet}/roster.json']).toBeDefined()
    expect(paths['/mods/{gameSet}/pokemon/{pokemonId}.json']).toBeDefined()
    expect(paths['/games/{gameSet}/pokemon/{pokemonId}.json']).toBeDefined()
    expect(paths['/games/{gameSet}/moves.json']).toBeDefined()
    expect(paths['/games/{gameSet}/i18n/{locale}/moves.json']).toBeDefined()
    // Only game sets get merged folders; there are no per-version or DLC paths.
    expect(Object.keys(paths).filter((path) => path.startsWith('/games/{gameId}/'))).toEqual([])
  })

  it('links the v7 to v8 migration guide', () => {
    expect(document.info.description).toContain('Migrating from v7')
  })

  it('exposes text-free records and per-locale text schemas', () => {
    const pokemon = document.components?.schemas?.Pokemon
    expect(pokemon).not.toHaveProperty('properties.names')
    expect(pokemon).toHaveProperty('properties.learnset.type', 'array')
    expect(document.components?.schemas?.PokemonText).toBeDefined()
    expect(document.components?.schemas?.GameSetRoster).toBeDefined()
    expect(document.components?.schemas?.MovesOverride).toBeDefined()
  })

  it('emits reusable schemas', () => {
    expect(document.components?.schemas?.Ability).toBeDefined()
    expect(document.components?.schemas?.Pokemon).toBeDefined()
    expect(document.components?.schemas?.ModernBoxPreset).toBeDefined()
    expect(document.components?.schemas?.ErrorResponse).toBeDefined()
  })

  it('exposes lifecycle dates as optional Game metadata', () => {
    const game = document.components?.schemas?.Game
    for (const field of ['delistedDate', 'serviceEndDate']) {
      expect(game).toHaveProperty(`properties.${field}`)
      expect(game).toHaveProperty(
        `properties.${field}.description`,
        expect.stringContaining('Announced'),
      )
      expect(game).toHaveProperty('required', expect.not.arrayContaining([field]))
    }
  })

  it('exposes optional legacy ability IDs in the public Pokemon schema', () => {
    const pokemon = document.components?.schemas?.Pokemon
    expect(pokemon).toHaveProperty('properties.legacyAbilities.type', 'array')
    expect(pokemon).toHaveProperty('properties.legacyAbilities.items.type', 'string')
    expect(pokemon).toHaveProperty('required', expect.not.arrayContaining(['legacyAbilities']))
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
    expect(document.components?.schemas?.Pokemon).toHaveProperty(
      'properties.formMethods.items.properties.revert.type',
      'array',
    )
  })
})

describe('OpenAPI index HTML', () => {
  it('loads the generated OpenAPI JSON file', () => {
    expect(renderOpenApiIndexHtml()).toContain('./openapi.json')
  })
})

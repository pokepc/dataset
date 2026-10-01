import { describe, expect, it } from 'vitest'
import {
  battleStateSchema,
  boxPresetTextFileSchema,
  classicBoxPresetFileSchema,
  gameSchema,
  itemSchema,
  languageSchema,
  modernBoxPresetSchema,
  moddableTextOverrideFileSchemas,
  moveOverrideSchema,
  moveSchema,
  pokedexSchema,
  pokemonOverrideSchema,
  pokemonSchema,
  rosterSchema,
  textFileSchemas,
} from './schemas'

const pokemon = {
  id: 'pikachu',
  nid: '0025',
  dexNum: 25,
  region: 'kanto',
  gen: 1,
  type1: 'electric',
  color: 'yellow',
  ability1: 'static',
  abilityHidden: 'lightningrod',
  isPrerelease: false,
  isDefault: true,
  isForm: false,
  isLegendary: false,
  isMythical: false,
  isBaby: false,
  isUltraBeast: false,
  isParadox: false,
  isConvergent: false,
  isCosmeticForm: false,
  isFemaleForm: false,
  hasGenderDifferences: true,
  isBattleOnlyForm: false,
  isFusion: false,
  isMega: false,
  isPrimal: false,
  isGmax: false,
  isRegional: false,
  canGmax: true,
  canDynamax: true,
  canBeAlpha: true,
  debutIn: 'rb',
  obtainableIn: ['rb-r'],
  transferOnlyIn: [],
  storableIn: ['rb-r', 'champions'],
  eventOnlyIn: [],
  shinyReleased: true,
  baseHp: 35,
  baseAtk: 55,
  baseDef: 40,
  baseSpAtk: 50,
  baseSpDef: 50,
  baseSpeed: 90,
  height: 40,
  weight: 600,
  maleRate: 50,
  femaleRate: 50,
  baseForms: [],
  forms: ['pikachu-f'],
  refs: {
    pkApiId: '25',
    pkApiFormId: '25',
    pkApiFormSlug: 'pikachu',
    smogon: 'pikachu',
    showdown: 'pikachu',
    showdownName: 'Pikachu',
    serebii: 'pikachu',
    bulbapedia: 'Pikachu',
  },
  championsId: '0025000',
  evoMethods: [{ from: ['pichu'], trigger: 'level_up', conditions: [{ key: 'friendship' }] }],
}

const move = {
  id: 'pound',
  psName: 'Pound',
  gen: 1,
  type: 'normal',
  power: 40,
  accuracy: 100,
  pp: 35,
  category: 'physical',
  priority: 0,
  isZ: false,
  isGmax: false,
  target: 'single_target',
  classification: [],
  contact: true,
  championsId: '1',
  pokeApiId: 1,
}

describe('v8 base record schemas', () => {
  it('accepts records without text', () => {
    expect(pokemonSchema.safeParse(pokemon).success).toBe(true)
    expect(moveSchema.safeParse(move).success).toBe(true)
    expect(
      battleStateSchema.safeParse({
        id: 'harsh-sunlight',
        championsId: '1',
        state: 'harsh_sunlight',
      }).success,
    ).toBe(true)
    expect(
      itemSchema.safeParse({
        id: 'cheriberry',
        psName: 'Cheri Berry',
        gen: 3,
        category: 'berry',
        pokeApiId: 126,
        battleCategories: ['berry', 'recovery'],
      }).success,
    ).toBe(true)
  })

  it('rejects v7 text fields that moved to locale files', () => {
    expect(pokemonSchema.safeParse({ ...pokemon, names: { eng: 'Pikachu' } }).success).toBe(false)
    expect(pokemonSchema.safeParse({ ...pokemon, formsDesc: 'Forms' }).success).toBe(false)
    expect(moveSchema.safeParse({ ...move, name: 'Pound' }).success).toBe(false)
    expect(moveSchema.safeParse({ ...move, shortDesc: 'No additional effect.' }).success).toBe(
      false,
    )
  })

  it('rejects inline method notes', () => {
    const evoMethods = [{ ...pokemon.evoMethods[0], notes: { eng: 'Level up with friendship' } }]
    expect(pokemonSchema.safeParse({ ...pokemon, evoMethods }).success).toBe(false)
  })

  it('rejects invalid values', () => {
    expect(pokemonSchema.safeParse({ ...pokemon, id: 'Pikachu' }).success).toBe(false)
    expect(pokemonSchema.safeParse({ ...pokemon, championsId: '25' }).success).toBe(false)
    expect(pokemonSchema.safeParse({ ...pokemon, learnset: ['pound', 'pound'] }).success).toBe(
      false,
    )
    expect(moveSchema.safeParse({ ...move, target: 'everyone' }).success).toBe(false)
    expect(moveSchema.safeParse({ ...move, pokeApiId: 0 }).success).toBe(false)
  })

  it('keeps a null pokeApiId distinct from an unknown one', () => {
    expect(moveSchema.safeParse({ ...move, pokeApiId: null }).success).toBe(true)
    const { pokeApiId: _, ...withoutPokeApiId } = move
    expect(moveSchema.safeParse(withoutPokeApiId).success).toBe(true)
  })

  it('validates language records with their v8 locale code', () => {
    const language = {
      id: 'ja',
      name: '日本語',
      nameEng: 'Japanese',
      alpha3: 'jap',
      inGameCode: 'JPN',
      locale: 'ja',
      flag: '🇯🇵',
      pkApiId: 1,
      code: 'jpn',
    }
    expect(languageSchema.safeParse(language).success).toBe(true)
    expect(languageSchema.safeParse({ ...language, code: 'jap' }).success).toBe(false)
  })

  it('requires a meta id on Pokédex entries with meta', () => {
    const dex = {
      id: 'pokopia',
      gen: 9,
      region: null,
      isNational: false,
      baseDex: null,
      pkApiId: null,
      entries: [
        {
          pid: 'snorlax',
          dexNum: 108,
          isForm: false,
          meta: { id: 'mosslax', imgNid: '0000-mosslax' },
        },
      ],
    }
    expect(pokedexSchema.safeParse(dex).success).toBe(true)
    const withoutId = { ...dex, entries: [{ ...dex.entries[0], meta: { imgNid: '0000-mosslax' } }] }
    expect(pokedexSchema.safeParse(withoutId).success).toBe(false)
  })

  it('rejects game names in records', () => {
    const game = {
      id: 'champions',
      gen: 9,
      nameSlug: 'champions',
      pokeApiGameVersionId: null,
      pokeApiGameVersionGroupId: null,
      codename: null,
      type: 'game',
      series: 'spinoff',
      gameSet: null,
      gameSuperSet: null,
      releaseDate: '2026-01-01',
      region: null,
      originMark: null,
      pokedexes: [],
      maxBoxes: 1,
      maxBoxSize: 30,
      maxPartySize: 6,
      maxBattleTeams: 1,
      platforms: ['switch'],
      features: Object.fromEntries(
        [
          'storage',
          'party',
          'battleTeams',
          'pokedex',
          'training',
          'shiny',
          'items',
          'gender',
          'pokerus',
          'nature',
          'ribbons',
          'marks',
          'markings',
          'shadow',
          'ball',
          'mega',
          'zmove',
          'gmax',
          'alpha',
          'tera',
          'plusmvs',
          'mints',
          'sizes',
          'abilities',
        ].map((key) => [key, false]),
      ),
    }
    expect(gameSchema.safeParse(game).success).toBe(true)
    expect(gameSchema.safeParse({ ...game, name: 'Pokémon Champions' }).success).toBe(false)
  })

  it('validates box presets without text', () => {
    const classic = {
      'fully-sorted-paldea': {
        id: 'fully-sorted-paldea',
        version: 1,
        gameSet: 'sv',
        boxes: [{ pokemon: ['sprigatito', null, { pid: 'pikachu', shiny: true }] }],
      },
    }
    expect(classicBoxPresetFileSchema.safeParse(classic).success).toBe(true)
    const titled = structuredClone(classic) as Record<string, any>
    titled['fully-sorted-paldea'].boxes[0].title = 'Box 1'
    expect(classicBoxPresetFileSchema.safeParse(titled).success).toBe(false)

    const modern = {
      schemaVersion: 2,
      id: 'minimal-paldea',
      gameSet: 'sv',
      boxes: [{ slots: ['sprigatito', null] }],
    }
    expect(modernBoxPresetSchema.safeParse(modern).success).toBe(true)
    expect(modernBoxPresetSchema.safeParse({ ...modern, name: 'Minimal' }).success).toBe(false)
    expect(modernBoxPresetSchema.safeParse({ ...modern, schemaVersion: 1 }).success).toBe(false)
  })
})

describe('v8 override schemas', () => {
  it('accepts sparse overrides', () => {
    expect(moveOverrideSchema.safeParse({ id: 'pound', pp: 20 }).success).toBe(true)
    expect(
      pokemonOverrideSchema.safeParse({ id: 'pikachu', learnset: ['thunderbolt'] }).success,
    ).toBe(true)
  })

  it('accepts $unset of base properties', () => {
    expect(
      pokemonOverrideSchema.safeParse({ id: 'greninja', $unset: ['abilitySpecial'] }).success,
    ).toBe(true)
  })

  it('rejects overrides that change nothing', () => {
    expect(moveOverrideSchema.safeParse({ id: 'pound' }).success).toBe(false)
  })

  it('rejects properties both set and unset', () => {
    expect(moveOverrideSchema.safeParse({ id: 'pound', pp: 20, $unset: ['pp'] }).success).toBe(
      false,
    )
  })

  it('rejects unknown, id and empty $unset entries', () => {
    expect(moveOverrideSchema.safeParse({ id: 'pound', $unset: ['name'] }).success).toBe(false)
    expect(moveOverrideSchema.safeParse({ id: 'pound', $unset: ['id'] }).success).toBe(false)
    expect(moveOverrideSchema.safeParse({ id: 'pound', $unset: [] }).success).toBe(false)
  })

  it('rejects text and invalid values in overrides', () => {
    expect(moveOverrideSchema.safeParse({ id: 'pound', name: 'Pound' }).success).toBe(false)
    expect(moveOverrideSchema.safeParse({ id: 'pound', pp: -1 }).success).toBe(false)
  })

  it('validates rosters', () => {
    expect(rosterSchema.safeParse({ pokemon: ['pikachu'], moves: [] }).success).toBe(true)
    expect(rosterSchema.safeParse({ pokemon: ['pikachu', 'pikachu'] }).success).toBe(false)
    expect(rosterSchema.safeParse({ ribbons: [] }).success).toBe(false)
  })
})

describe('v8 locale file schemas', () => {
  it('accepts text keyed by id', () => {
    const pokemonText = {
      pikachu: { name: 'Pikachu', genus: 'Mouse Pokémon', formName: '' },
      'aegislash-blade': { formNotes: { '1': 'Note', '1.revert.0': 'Revert note' } },
      alcremie: { evoNotes: { '0': 'Note' } },
    }
    expect(textFileSchemas.pokemon.safeParse(pokemonText).success).toBe(true)
    expect(
      textFileSchemas.items.safeParse({ cheriberry: { pluralName: 'Cheri Berries' } }).success,
    ).toBe(true)
    expect(
      textFileSchemas.pokedexes.safeParse({
        pokopia: { name: 'Pokopia', entries: { mosslax: { name: 'Mosslax' } } },
      }).success,
    ).toBe(true)
  })

  it('rejects unknown fields and malformed note keys', () => {
    expect(textFileSchemas.moves.safeParse({ pound: { title: 'x' } }).success).toBe(false)
    expect(textFileSchemas.pokemon.safeParse({ pikachu: { names: 'x' } }).success).toBe(false)
    expect(textFileSchemas.pokemon.safeParse({ pikachu: { evoNotes: { a: 'x' } } }).success).toBe(
      false,
    )
    expect(
      textFileSchemas.pokemon.safeParse({ pikachu: { formNotes: { '1.revert': 'x' } } }).success,
    ).toBe(false)
  })

  it('accepts box preset text aligned with boxes', () => {
    expect(
      boxPresetTextFileSchema.safeParse({
        'minimal-paldea': { name: 'Minimal', boxes: [null, 'Legendaries'] },
      }).success,
    ).toBe(true)
  })

  it('validates mod text overrides', () => {
    const file = moddableTextOverrideFileSchemas.moves
    expect(file.safeParse({ pound: { desc: 'Champions text' } }).success).toBe(true)
    expect(file.safeParse({ pound: { $unset: ['shortDesc'] } }).success).toBe(true)
    expect(file.safeParse({ pound: {} }).success).toBe(false)
    expect(file.safeParse({ pound: { desc: 'x', $unset: ['desc'] } }).success).toBe(false)
  })
})

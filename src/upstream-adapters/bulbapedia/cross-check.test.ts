import { beforeEach, describe, expect, it, vi } from 'vitest'
import pikachu from '../../../data/pokemon/pikachu.json'
import voltorb from '../../../data/pokemon/voltorb.json'
import electrode from '../../../data/pokemon/electrode.json'
import celebi from '../../../data/pokemon/celebi.json'
import jirachi from '../../../data/pokemon/jirachi.json'
import shellos from '../../../data/pokemon/shellos.json'
import gastrodon from '../../../data/pokemon/gastrodon.json'
import lugia from '../../../data/pokemon/lugia.json'
import hooh from '../../../data/pokemon/hooh.json'
import pikachuFemale from '../../../data/pokemon/pikachu-f.json'
import pikachuGmax from '../../../data/pokemon/pikachu-gmax.json'
import raichuAlola from '../../../data/pokemon/raichu-alola.json'
import raichu from '../../../data/pokemon/raichu.json'
import raichuFemale from '../../../data/pokemon/raichu-f.json'
import dugtrio from '../../../data/pokemon/dugtrio.json'
import dugtrioAlola from '../../../data/pokemon/dugtrio-alola.json'
import graveler from '../../../data/pokemon/graveler.json'
import gravelerAlola from '../../../data/pokemon/graveler-alola.json'
import { fetchPokeApiJson } from '../pokeapi/client.ts'
import { fetchSerebiiEvidence } from '../serebii/availability-evidence.ts'
import {
  availabilityJson,
  type AvailabilityGame,
  type AvailabilityPokemon,
  type AvailabilityReport,
  type AvailabilityRow,
  type AvailabilityStatus,
} from './availability.ts'
import {
  createAvailabilityCrossChecker,
  formatCrossChecks,
  parsePokeApiEncounters,
} from './cross-check.ts'

vi.mock('../pokeapi/client.ts', () => ({ fetchPokeApiJson: vi.fn() }))
vi.mock('../serebii/availability-evidence.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../serebii/availability-evidence.ts')>()),
  fetchSerebiiEvidence: vi.fn(),
}))

function game(id: string, gen: number, versionId: number | null): AvailabilityGame {
  return {
    id,
    name: id,
    gen,
    type: 'game',
    gameSet: null,
    gameSuperSet: null,
    pokeApiGameVersionId: versionId,
    pokeApiGameVersionGroupId: null,
  }
}

const red = game('rb-r', 1, 1)
const blue = game('rb-b', 1, 2)
const gold = game('gs-g', 2, 4)
const ruby = game('rs-r', 3, 7)
const diamond = game('dp-d', 4, 12)
const sword = { ...game('swsh-sw', 8, 33), gameSet: 'swsh' }
const shield = { ...game('swsh-sh', 8, 34), gameSet: 'swsh' }
const scarlet = { ...game('sv-s', 9, 40), gameSet: 'sv' }
const violet = { ...game('sv-v', 9, 41), gameSet: 'sv' }
const games: AvailabilityGame[] = [
  red,
  blue,
  gold,
  ruby,
  diamond,
  sword,
  shield,
  scarlet,
  violet,
  { ...game('swsh-islearmor', 8, null), type: 'dlc', gameSet: 'swsh' },
  { ...game('sv-tealmask', 9, null), type: 'dlc', gameSet: 'sv' },
]

function pokemon(value: AvailabilityPokemon = pikachu): AvailabilityPokemon {
  return { ...value, obtainableIn: [], transferOnlyIn: [], eventOnlyIn: [], storableIn: [sword.id] }
}

function row(
  entry: AvailabilityGame = sword,
  status: AvailabilityStatus = 'obtainableIn',
  options: Partial<AvailabilityRow> = {},
): AvailabilityRow {
  return {
    game: entry,
    status,
    basis: 'source',
    methods: [{ text: 'Fixture location', status }],
    storable: true,
    ...options,
  }
}

function report(rows = [row()], entry: AvailabilityPokemon = pokemon()): AvailabilityReport {
  return { pokemon: entry, rows, gameOrder: games.map((game) => game.id), warnings: [] }
}

function encounters(versionId = 33, name = 'sword') {
  return [
    {
      location_area: { name: 'fixture-route', url: 'https://pokeapi.co/api/v2/location-area/1/' },
      version_details: [
        {
          version: { name, url: `https://pokeapi.co/api/v2/version/${versionId}/` },
          encounter_details: [
            {
              chance: 20,
              method: { name: 'walk', url: 'https://pokeapi.co/api/v2/encounter-method/1/' },
              condition_values: [
                { name: 'time-day', url: 'https://pokeapi.co/api/v2/encounter-condition-value/3/' },
              ],
            },
          ],
        },
      ],
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchPokeApiJson).mockResolvedValue([])
  vi.mocked(fetchSerebiiEvidence).mockImplementation(async (target) => ({
    ...target,
    html: '<table><tr><td>Fixture location evidence</td></tr></table>',
  }))
})

describe('PokéAPI encounter normalization', () => {
  it.each(['green-japan', 'blue-japan', 'palpark'])(
    'ignores the upstream game %s without producing encounters or warnings',
    (name) => {
      expect(parsePokeApiEncounters(encounters(999, name), games)).toEqual({
        encounters: [],
        unmapped: [],
      })
    },
  )
  it('continues reporting other unmapped versions', () => {
    expect(parsePokeApiEncounters(encounters(999, 'red-japan'), games).unmapped).toEqual([
      'red-japan',
    ])
  })
  it('uses exact version IDs and preserves methods, locations, and conditions', () => {
    const grouped = { ...sword, id: 'swsh', type: 'set' as const }
    expect(parsePokeApiEncounters(encounters(), [...games, grouped])).toEqual({
      encounters: [
        {
          gameId: sword.id,
          versionId: 33,
          version: 'sword',
          location: 'fixture-route',
          methods: [{ name: 'walk', conditions: ['time-day'] }],
        },
      ],
      unmapped: [],
    })
  })

  it.each([
    [35, 'the-isle-of-armor-sword', sword.id],
    [50, 'the-isle-of-armor-shield', shield.id],
    [42, 'the-teal-mask-scarlet', scarlet.id],
    [43, 'the-teal-mask-violet', violet.id],
  ])('maps DLC version %s (%s) only to its explicit parent %s', (id, name, parent) => {
    expect(
      parsePokeApiEncounters(encounters(id, name), games).encounters.map((entry) => entry.gameId),
    ).toEqual([parent])
  })

  it('does not map DLC names without the matching dataset DLC', () => {
    const result = parsePokeApiEncounters(encounters(35, 'the-isle-of-armor-sword'), [
      sword,
      shield,
    ])
    expect(result.encounters).toEqual([])
    expect(result.unmapped).toEqual(['the-isle-of-armor-sword'])
  })

  it('reports unmapped versions without guessing from a version group', () => {
    const result = parsePokeApiEncounters(encounters(999, 'future-version'), [
      { ...sword, pokeApiGameVersionGroupId: 999 },
    ])
    expect(result).toEqual({ encounters: [], unmapped: ['future-version'] })
  })

  it('refuses ambiguous local version mappings', () => {
    expect(() =>
      parsePokeApiEncounters(encounters(), [...games, { ...shield, pokeApiGameVersionId: 33 }]),
    ).toThrow('Ambiguous dataset mapping')
  })

  it.each([
    {},
    [{ location_area: { name: 'route', url: 'not-a-url' }, version_details: [] }],
    [
      {
        ...encounters()[0],
        version_details: [{ version: encounters()[0].version_details[0].version }],
      },
    ],
    [
      {
        ...encounters()[0],
        version_details: [
          {
            ...encounters()[0].version_details[0],
            encounter_details: [{ method: { name: 'walk' }, condition_values: [] }],
          },
        ],
      },
    ],
  ])('rejects malformed encounter data rather than treating it as absence', (value) => {
    expect(() => parsePokeApiEncounters(value, games)).toThrow()
  })

  it.each([
    'https://example.com/api/v2/version/31/',
    'https://pokeapi.co/api/v2/version-group/31/',
    'https://pokeapi.co/api/v2/version/not-an-id/',
  ])('refuses invalid version references: %s', (url) => {
    const value = encounters()
    value[0].version_details[0].version.url = url
    expect(() => parsePokeApiEncounters(value, games)).toThrow('invalid version reference')
  })

  it('does not count a version with no actual encounter details as positive evidence', () => {
    const value = encounters()
    value[0].version_details[0].encounter_details = []
    expect(parsePokeApiEncounters(value, games).encounters).toEqual([])
  })
})

describe('availability source cross-checks', () => {
  it.each([voltorb, electrode])(
    'retains $id erroneous Sun static encounters as documented context only',
    async (selected) => {
      const sun = game('sm-s', 7, 27)
      const raw = encounters(27, 'sun')
      raw[0].location_area.name = 'new-mauville-area'
      const detail = raw[0].version_details[0].encounter_details[0]
      detail.method.name = 'static'
      detail.condition_values = []
      vi.mocked(fetchPokeApiJson).mockResolvedValue(raw)
      const input = report([row(sun, 'transferOnlyIn')], {
        ...pokemon(selected),
        transferOnlyIn: [sun.id],
      })
      const output = await createAvailabilityCrossChecker()(input, [...games, sun], [selected])
      expect(output.crossChecks?.unresolvedConflictIds).toEqual([])
      expect(output.crossChecks?.conflicts).toEqual([])
      expect(output.crossChecks?.pokeApi.encounters[0].methods[0]).toMatchObject({
        name: 'static',
        knownUpstreamError: {
          pokemonId: selected.refs.pkApiId,
          evidenceUrls: expect.arrayContaining([
            'https://bulbapedia.bulbagarden.net/wiki/New_Mauville',
          ]),
        },
      })
      expect(formatCrossChecks(output)).toContain('Known upstream error (sm-s)')
      expect(formatCrossChecks(output)).not.toContain('Uncertain (sm-s)')
      expect(availabilityJson(output)).toEqual(availabilityJson(input))
      expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
      expect(raw[0].version_details[0].encounter_details[0]).not.toHaveProperty(
        'knownUpstreamError',
      )
    },
  )

  it.each(['pokemon', 'version', 'location', 'method', 'condition', 'mixed methods'])(
    'does not suppress a conflict when %s falls outside an exception',
    async (difference) => {
      const destination = difference === 'version' ? game('sm-m', 7, 28) : game('sm-s', 7, 27)
      const raw = encounters(
        destination.pokeApiGameVersionId!,
        difference === 'version' ? 'moon' : 'sun',
      )
      raw[0].location_area.name = difference === 'location' ? 'other-area' : 'new-mauville-area'
      const detail = raw[0].version_details[0].encounter_details[0]
      detail.method.name = difference === 'method' ? 'walk' : 'static'
      if (difference !== 'condition') detail.condition_values = []
      if (difference === 'mixed methods')
        raw[0].version_details[0].encounter_details.push({
          ...detail,
          method: { ...detail.method, name: 'walk' },
        })
      vi.mocked(fetchPokeApiJson).mockResolvedValue(raw)
      const selected = difference === 'pokemon' ? pikachu : voltorb
      const input = report([row(destination, 'transferOnlyIn')], pokemon(selected))
      const output = await createAvailabilityCrossChecker()(
        input,
        [...games, destination],
        [selected],
      )
      expect(output.crossChecks?.unresolvedConflictIds).toEqual([`pokeapi:${destination.id}`])
      if (difference === 'mixed methods') {
        expect(output.crossChecks?.conflicts[0].evidence).toContain('walk')
        expect(output.crossChecks?.conflicts[0].evidence).not.toContain('static')
        expect(output.crossChecks?.pokeApi.encounters[0].methods).toHaveLength(2)
      }
    },
  )

  it.each([
    [celebi, 'colosseum-bonus-disc-jpn'],
    [jirachi, 'colosseum-bonus-disc-us'],
    [jirachi, 'pokemon-channel-pal'],
  ] as const)('keeps %s Bonus Disc evidence as a transfer route', async (selected, method) => {
    const data = encounters(7, 'ruby')
    data[0].version_details[0].encounter_details[0].method.name = method
    vi.mocked(fetchPokeApiJson).mockResolvedValue(data)
    const input = report([row(ruby, 'transferOnlyIn')], pokemon(selected))
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(output.crossChecks?.unresolvedConflictIds).toEqual([])
    expect(output.crossChecks?.pokeApi.encounters[0].methods[0]).toMatchObject({
      name: method,
      availability: 'transferOnlyIn',
    })
    const unavailable = report([row(ruby, 'unavailable')], pokemon(selected))
    const conflict = await createAvailabilityCrossChecker()(unavailable, games, [
      unavailable.pokemon,
    ])
    expect(conflict.crossChecks?.unresolvedConflictIds).toContain('pokeapi:rs-r')
  })

  it.each([shellos, gastrodon])(
    'does not attribute East Sea Sword/Shield encounters to %s',
    async (selected) => {
      for (const version of [sword, shield]) {
        vi.mocked(fetchPokeApiJson).mockResolvedValue(
          encounters(version.pokeApiGameVersionId!, version === sword ? 'sword' : 'shield'),
        )
        const input = report([row(version, 'transferOnlyIn')], pokemon(selected))
        const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
        expect(output.crossChecks?.unresolvedConflictIds).toEqual([])
        expect(output.crossChecks?.pokeApi.encounters[0]).toMatchObject({
          formScope: 'form-ambiguous',
        })
        expect(availabilityJson(output).transferOnlyIn).toContain(version.id)
      }
    },
  )

  it.each([lugia, hooh])(
    'retains MysticTicket event evidence without overriding a transfer route for %s',
    async (selected) => {
      const emerald = game('e', 3, 9)
      const data = encounters(9, 'emerald')
      data[0].location_area.name = 'navel-rock-area'
      data[0].version_details[0].encounter_details[0].method.name = 'static'
      vi.mocked(fetchPokeApiJson).mockResolvedValue(data)
      const input = report([row(emerald, 'transferOnlyIn')], pokemon(selected))
      const output = await createAvailabilityCrossChecker()(
        input,
        [...games, emerald],
        [input.pokemon],
      )
      expect(output.crossChecks?.unresolvedConflictIds).toEqual([])
      expect(output.crossChecks?.pokeApi.encounters[0].methods[0].availability).toBe('eventOnlyIn')
      data[0].location_area.name = 'another-location'
      const other = await createAvailabilityCrossChecker()(
        input,
        [...games, emerald],
        [input.pokemon],
      )
      expect(other.crossChecks?.unresolvedConflictIds).toContain('pokeapi:e')
    },
  )

  it('retains explicit event conditions in PokéAPI evidence', async () => {
    const data = encounters()
    data[0].version_details[0].encounter_details[0].condition_values[0].name =
      'other-event-arceus-in-party'
    vi.mocked(fetchPokeApiJson).mockResolvedValue(data)
    const input = report([row(sword, 'eventOnlyIn')])
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(output.crossChecks?.unresolvedConflictIds).toEqual([])
    expect(output.crossChecks?.pokeApi.encounters[0].methods[0].availability).toBe('eventOnlyIn')
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters())
    const ordinary = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(ordinary.crossChecks?.unresolvedConflictIds).toContain('pokeapi:swsh-sw')
  })

  it('classifies Pokémon Ranger as an external-game transfer', async () => {
    const data = encounters(12, 'diamond')
    data[0].version_details[0].encounter_details[0].method.name = 'pokemon-ranger'
    vi.mocked(fetchPokeApiJson).mockResolvedValue(data)
    const input = report([row(diamond, 'transferOnlyIn')])
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(output.crossChecks?.unresolvedConflictIds).toEqual([])
    expect(output.crossChecks?.pokeApi.encounters[0].methods[0].availability).toBe('transferOnlyIn')
  })

  it('collects supporting encounters without changing a mechanical candidate or fetching Serebii', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters())
    const input = report()
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(output.crossChecks?.pokeApi).toMatchObject({
      url: 'https://pokeapi.co/api/v2/pokemon/25/encounters/',
      status: 'checked',
      encounters: [{ gameId: sword.id, formScope: 'selected-form' }],
    })
    expect(output.crossChecks?.conflicts).toEqual([])
    expect(availabilityJson(output)).toEqual(availabilityJson(input))
    expect(input.crossChecks).toBeUndefined()
    expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
    expect(fetchPokeApiJson).toHaveBeenCalledWith(
      'pokemon/25/encounters',
      expect.objectContaining({ retries: 2, minIntervalMs: 500 }),
    )
  })

  it('never removes gift or evolution routes because encounters are absent', async () => {
    const input = report([
      row(sword, 'obtainableIn', {
        methods: [{ text: 'Evolve a gift Pokémon', status: 'obtainableIn' }],
      }),
    ])
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(availabilityJson(output).obtainableIn).toEqual([sword.id])
    expect(output.crossChecks?.pokeApi.status).toBe('checked')
    expect(output.crossChecks?.conflicts).toEqual([])
    expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
  })

  it.each(['transferOnlyIn', 'eventOnlyIn', 'unavailable', 'unknown'] as const)(
    'marks positive encounters against %s as unresolved and requests targeted Serebii evidence',
    async (status) => {
      vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters())
      const input = report([row(sword, status)])
      const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
      expect(output.crossChecks?.conflicts).toEqual([
        expect.objectContaining({
          id: 'pokeapi:swsh-sw',
          gameId: sword.id,
          message: expect.stringContaining(status),
          evidence: expect.stringContaining('fixture-route (walk; time-day)'),
        }),
      ])
      expect(output.crossChecks?.unresolvedConflictIds).toEqual(['pokeapi:swsh-sw'])
      expect(fetchSerebiiEvidence).toHaveBeenCalledOnce()
      expect(fetchSerebiiEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          gameIds: [sword.id],
          url: 'https://www.serebii.net/pokedex-swsh/pikachu/',
        }),
        input.pokemon,
        expect.any(Object),
      )
      expect(availabilityJson(output)).toEqual(availabilityJson(input))
      expect(formatCrossChecks(output)).toContain('Uncertain (swsh-sw)')
    },
  )

  it('does not challenge the female Gen 1 policy using shared species encounters', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters(1, 'red'))
    const input = report([row(red, 'unavailable', { basis: 'rule' })], pokemon(pikachuFemale))
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon, pikachu])
    expect(output.crossChecks?.pokeApi.encounters[0].formScope).toBe('selected-form')
    expect(output.crossChecks?.conflicts).toEqual([])
    expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
  })

  it('does not treat a shared alternate-form ID as evidence for that form', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters())
    const alternate = {
      ...pokemon(raichuAlola),
      refs: { ...raichuAlola.refs, pkApiId: pikachu.refs.pkApiId },
      transferOnlyIn: [sword.id],
    }
    const output = await createAvailabilityCrossChecker()(
      report([row(sword, 'transferOnlyIn')], alternate),
      games,
      [alternate, pikachu],
    )
    expect(output.crossChecks?.pokeApi.encounters[0].formScope).toBe('form-ambiguous')
    expect(output.crossChecks?.pokeApi.encounters).toHaveLength(1)
    expect(output.crossChecks?.conflicts).toEqual([])
    expect(formatCrossChecks(output)).toContain('shared with other forms')
    expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
  })

  it('allows an exact regional-form ID to independently contradict the candidate', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters())
    const input = report([row(sword, 'transferOnlyIn')], pokemon(raichuAlola))
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon, pikachu])
    expect(fetchPokeApiJson).toHaveBeenCalledWith('pokemon/10100/encounters', expect.any(Object))
    expect(output.crossChecks?.pokeApi.encounters[0].formScope).toBe('selected-form')
    expect(output.crossChecks?.conflicts).toHaveLength(1)
  })

  it('does not independently establish battle-only forms even with an exact ID', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters())
    const input = report([row(sword, 'unavailable')], pokemon(pikachuGmax))
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(output.crossChecks?.pokeApi.encounters[0].formScope).toBe('form-ambiguous')
    expect(output.crossChecks?.conflicts).toEqual([])
  })

  it.each([
    {
      selected: dugtrio,
      regional: dugtrioAlola,
      gameId: 'usum-us',
      versionId: 29,
      version: 'ultra-sun',
      location: 'lush-jungle-east-cave',
      method: 'walk',
    },
    {
      selected: dugtrio,
      regional: dugtrioAlola,
      gameId: 'usum-um',
      versionId: 30,
      version: 'ultra-moon',
      location: 'lush-jungle-east-cave',
      method: 'walk',
    },
    {
      selected: graveler,
      regional: gravelerAlola,
      gameId: 'sm-s',
      versionId: 27,
      version: 'sun',
      location: 'tapu-village-area',
      method: 'npc-trade',
    },
    {
      selected: graveler,
      regional: gravelerAlola,
      gameId: 'sm-m',
      versionId: 28,
      version: 'moon',
      location: 'tapu-village-area',
      method: 'npc-trade',
    },
    {
      selected: raichuFemale,
      regional: raichuAlola,
      gameId: 'sm-s',
      versionId: 27,
      version: 'sun',
      location: 'fixture-route',
      method: 'walk',
    },
  ])(
    'keeps $selected.id $version encounters as form-ambiguous context',
    async ({ selected, regional, gameId, versionId, version, location, method }) => {
      const destination = game(gameId, 7, versionId)
      const raw = encounters(versionId, version)
      raw[0].location_area.name = location
      raw[0].version_details[0].encounter_details[0].method.name = method
      vi.mocked(fetchPokeApiJson).mockResolvedValue(raw)
      const entry = { ...pokemon(selected), transferOnlyIn: [gameId] }
      const input = report([row(destination, 'transferOnlyIn')], entry)
      const output = await createAvailabilityCrossChecker()(
        input,
        [...games, destination],
        [entry, regional],
      )
      expect(output.crossChecks?.pokeApi.encounters).toEqual([
        expect.objectContaining({
          gameId,
          location,
          formScope: 'form-ambiguous',
          formReason: expect.stringContaining(regional.id),
        }),
      ])
      expect(output.crossChecks?.conflicts).toEqual([])
      expect(output.crossChecks?.unresolvedConflictIds).toEqual([])
      expect(availabilityJson(output)).toEqual(availabilityJson(input))
      expect(availabilityJson(output).obtainableIn).not.toContain(gameId)
      expect(formatCrossChecks(output)).toContain(`Limitation (${gameId})`)
      expect(formatCrossChecks(output)).not.toContain('Uncertain (')
    },
  )

  it('keeps genuine pre-regional encounters blocking in the same response as ambiguous later encounters', async () => {
    const sun = game('sm-s', 7, 27)
    vi.mocked(fetchPokeApiJson).mockResolvedValue([
      ...encounters(1, 'red'),
      ...encounters(27, 'sun'),
    ])
    const input = report(
      [row(red, 'transferOnlyIn'), row(sun, 'transferOnlyIn')],
      pokemon(graveler),
    )
    const output = await createAvailabilityCrossChecker()(
      input,
      [...games, sun],
      [graveler, gravelerAlola],
    )
    expect(
      output.crossChecks?.pokeApi.encounters.map(({ gameId, formScope }) => ({
        gameId,
        formScope,
      })),
    ).toEqual([
      { gameId: red.id, formScope: 'selected-form' },
      { gameId: sun.id, formScope: 'form-ambiguous' },
    ])
    expect(output.crossChecks?.unresolvedConflictIds).toEqual(['pokeapi:rb-r'])
    expect(availabilityJson(output)).toEqual(availabilityJson(input))
  })

  it('keeps unique regional endpoints independent even with the base species present', async () => {
    const sun = game('sm-s', 7, 27)
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters(27, 'sun'))
    const input = report([row(sun, 'transferOnlyIn')], pokemon(raichuAlola))
    const output = await createAvailabilityCrossChecker()(
      input,
      [...games, sun],
      [raichu, raichuAlola],
    )
    expect(output.crossChecks?.pokeApi.encounters[0].formScope).toBe('selected-form')
    expect(output.crossChecks?.unresolvedConflictIds).toEqual(['pokeapi:sm-s'])
  })

  it('targets unknown methods and restrictive changes, sharing one generation page', async () => {
    const input = report(
      [
        row(sword, 'obtainableIn', {
          methods: [{ text: 'Unrecognized location text', status: 'unknown' }],
        }),
        row(shield, 'transferOnlyIn'),
        row(scarlet, 'obtainableIn'),
      ],
      { ...pokemon(), obtainableIn: [shield.id] },
    )
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(fetchSerebiiEvidence).toHaveBeenCalledOnce()
    expect(output.crossChecks?.serebii[0].gameIds).toEqual([sword.id, shield.id])
    expect(availabilityJson(output)).toEqual(availabilityJson(input))
  })

  it('does not spend the page limit on unknown species rows before a regional form existed', async () => {
    const input = report(
      [red, gold, ruby, diamond, scarlet].map((entry) => row(entry, 'unknown')),
      pokemon(raichuAlola),
    )
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(fetchSerebiiEvidence).toHaveBeenCalledOnce()
    expect(output.crossChecks?.serebii[0].gameIds).toEqual([scarlet.id])
  })

  it('reports invalid supplementary references without losing the primary candidate', async () => {
    const entry = { ...pokemon(), refs: { ...pikachu.refs, serebii: '../invalid' } }
    const input = report([row(sword, 'unknown')], entry)
    const output = await createAvailabilityCrossChecker()(input, games, [entry])
    expect(output.crossChecks?.warnings.join(' ')).toContain('target mapping unavailable')
    expect(availabilityJson(output)).toEqual(availabilityJson(input))
    expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
  })

  it('limits targeted Serebii evidence to three pages per lookup and reports uncovered games', async () => {
    const input = report([red, gold, ruby, diamond].map((entry) => row(entry, 'unknown')))
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(fetchSerebiiEvidence).toHaveBeenCalledTimes(3)
    expect(output.crossChecks?.serebii).toHaveLength(3)
    expect(output.crossChecks?.warnings.join('\n')).toMatch(
      /No targeted Serebii evidence for .*three-page request limit/,
    )
  })

  it('prioritizes a later-generation encounter conflict over earlier ambiguous methods within the page limit', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters(40, 'scarlet'))
    const input = report([
      ...[red, gold, ruby, diamond].map((entry) => row(entry, 'unknown')),
      row(scarlet, 'transferOnlyIn'),
    ])
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(fetchSerebiiEvidence).toHaveBeenCalledTimes(3)
    expect(fetchSerebiiEvidence).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ gameIds: [scarlet.id] }),
      input.pokemon,
      expect.any(Object),
    )
    expect(output.crossChecks?.serebii.flatMap((page) => page.gameIds)).toContain(scarlet.id)
    expect(output.crossChecks?.unresolvedConflictIds).toEqual(['pokeapi:sv-s'])
    expect(output.crossChecks?.warnings.join('\n')).toContain('three-page request limit')
  })

  it('reuses successful encounter and Serebii requests across adjacent female forms', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters())
    const check = createAvailabilityCrossChecker()
    const male = report([row(sword, 'transferOnlyIn')])
    const female = report(
      [row(shield, 'unknown'), row(sword, 'transferOnlyIn')],
      pokemon(pikachuFemale),
    )
    await check(male, games, [male.pokemon, female.pokemon])
    const second = await check(female, games, [male.pokemon, female.pokemon])
    expect(fetchPokeApiJson).toHaveBeenCalledOnce()
    expect(fetchSerebiiEvidence).toHaveBeenCalledOnce()
    expect(new Set(second.crossChecks?.serebii[0].gameIds)).toEqual(new Set([sword.id, shield.id]))
  })

  it('reuses failed requests within the run but keeps the failure visible for every form', async () => {
    vi.mocked(fetchPokeApiJson).mockRejectedValue(new Error('PokéAPI offline'))
    vi.mocked(fetchSerebiiEvidence).mockRejectedValue(new Error('Serebii offline'))
    const check = createAvailabilityCrossChecker()
    for (const entry of [pokemon(), pokemon(pikachuFemale)]) {
      const output = await check(report([row(sword, 'unknown')], entry), games, [
        pikachu,
        pikachuFemale,
      ])
      expect(output.crossChecks?.pokeApi.status).toBe('unavailable')
      expect(output.crossChecks?.serebii).toEqual([])
      expect(formatCrossChecks(output)).toContain('PokéAPI offline')
      expect(formatCrossChecks(output)).toContain('Serebii offline')
    }
    expect(fetchPokeApiJson).toHaveBeenCalledOnce()
    expect(fetchSerebiiEvidence).toHaveBeenCalledOnce()
  })

  it('reports malformed upstream responses as unavailable rather than an empty encounter list', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue({ detail: 'Service failure' })
    const output = await createAvailabilityCrossChecker()(report(), games, [pikachu])
    expect(output.crossChecks?.pokeApi.status).toBe('unavailable')
    expect(output.crossChecks?.warnings.join('\n')).toContain('PokéAPI cross-check unavailable')
  })

  it('reports unknown versions without changing the candidate', async () => {
    vi.mocked(fetchPokeApiJson).mockResolvedValue(encounters(999, 'future-version'))
    const input = report()
    const output = await createAvailabilityCrossChecker()(input, games, [input.pokemon])
    expect(output.crossChecks?.pokeApi.status).toBe('checked')
    expect(output.crossChecks?.warnings.join('\n')).toContain(
      'without dataset mapping: future-version',
    )
    expect(availabilityJson(output)).toEqual(availabilityJson(input))
  })

  it('does not guess PokéAPI IDs from dex numbers or form IDs', async () => {
    const entry = { ...pokemon(), refs: { ...pikachu.refs, pkApiId: '' } }
    const output = await createAvailabilityCrossChecker()(report([row()], entry), games, [entry])
    expect(fetchPokeApiJson).not.toHaveBeenCalled()
    expect(output.crossChecks?.pokeApi).toMatchObject({ status: 'unmapped', url: null })
    expect(output.crossChecks?.warnings.join('\n')).toContain('No exact Pokémon PokéAPI ID')
  })

  it('propagates an already-aborted signal before starting requests', async () => {
    const controller = new AbortController()
    controller.abort(new Error('User stopped'))
    await expect(
      createAvailabilityCrossChecker()(report(), games, [pikachu], controller.signal),
    ).rejects.toThrow('User stopped')
    expect(fetchPokeApiJson).not.toHaveBeenCalled()
    expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
  })

  it('propagates cancellation even when the PokéAPI request resolves successfully without encounters', async () => {
    const controller = new AbortController()
    vi.mocked(fetchPokeApiJson).mockImplementation(async () => {
      controller.abort(new Error('User stopped'))
      return []
    })
    await expect(
      createAvailabilityCrossChecker()(report(), games, [pikachu], controller.signal),
    ).rejects.toThrow('User stopped')
    expect(fetchSerebiiEvidence).not.toHaveBeenCalled()
  })

  it.each(['pokeapi', 'serebii'])(
    'propagates abort during %s without reporting it as a source outage',
    async (source) => {
      const controller = new AbortController()
      const abort = async () => {
        controller.abort(new Error('User stopped'))
        throw controller.signal.reason
      }
      if (source === 'pokeapi') vi.mocked(fetchPokeApiJson).mockImplementation(abort)
      else vi.mocked(fetchSerebiiEvidence).mockImplementation(abort)
      await expect(
        createAvailabilityCrossChecker()(
          report([row(sword, 'unknown')]),
          games,
          [pikachu],
          controller.signal,
        ),
      ).rejects.toThrow('User stopped')
    },
  )
})

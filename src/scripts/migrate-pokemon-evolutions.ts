/** Offline migration using the bulk CSV snapshot from the evolution audit. Dry-run unless --write. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { format } from 'oxfmt'
import {
  evolutionMethodSchema,
  type EvolutionCondition,
  type EvolutionMethod,
} from '../lib/evolution-schemas.ts'
import { parseCsv } from '../upstream-adapters/locations/pokeapi.ts'

type Row = Record<string, string>
// Input-only compatibility for records written before evoMethods became canonical.
type Pokemon = Pkds.Pokemon & {
  evolvesFrom?: string
  evolutionMethods?: EvolutionMethod[]
}
const sv = ['sv-s', 'sv-v']
const swsh = ['swsh-sw', 'swsh-sh']
const sm = ['sm-s', 'sm-m', 'usum-us', 'usum-um']
const g67 = ['xy-x', 'xy-y', 'oras-or', 'oras-as', ...sm]
const correctedSources: Record<string, string> = {
  'gastrodon-east': 'shellos-east',
  'sawsbuck-summer': 'deerling-summer',
  'sawsbuck-autumn': 'deerling-autumn',
  'sawsbuck-winter': 'deerling-winter',
  'wormadam-sandy': 'burmy-sandy',
  'wormadam-trash': 'burmy-trash',
}

const newItems: [string, string, number, Pkds.ItemCategory, boolean, string][] = [
  [
    'blackaugurite',
    'Black Augurite',
    8,
    'other',
    true,
    'Used on Scyther to evolve it into Kleavor in Legends: Arceus.',
  ],
  [
    'peatblock',
    'Peat Block',
    8,
    'other',
    true,
    'Used on Ursaring during a full moon to evolve it into Ursaluna in Legends: Arceus.',
  ],
  [
    'scrollofdarkness',
    'Scroll of Darkness',
    9,
    'other',
    true,
    'Used on Kubfu to evolve it into Single Strike Style Urshifu.',
  ],
  [
    'scrollofwaters',
    'Scroll of Waters',
    9,
    'other',
    true,
    'Used on Kubfu to evolve it into Rapid Strike Style Urshifu.',
  ],
  [
    'linkingcord',
    'Linking Cord',
    8,
    'other',
    true,
    'Used to evolve Kadabra, Machoke, Graveler, or Haunter in Legends: Arceus.',
  ],
  [
    'leaderscrest',
    'Leader’s Crest',
    9,
    'other',
    false,
    'Held by the Bisharp that another Bisharp must defeat to evolve into Kingambit.',
  ],
  [
    'gimmighoulcoin',
    'Gimmighoul Coin',
    9,
    'material',
    true,
    'Collect 999 in the Bag, then level up Gimmighoul to evolve it into Gholdengo.',
  ],
]
export const evolutionItems: Pkds.Item[] = newItems.map(
  ([id, name, gen, category, unholdable, desc]) => ({
    id,
    name,
    psName: name,
    gen,
    category,
    unholdable,
    shortDesc: desc,
    desc,
  }),
)

function condition(method: EvolutionMethod, value: EvolutionCondition): void {
  method.conditions = method.conditions.filter((entry) => entry.key !== value.key)
  method.conditions.push(value)
}

function scoped(method: EvolutionMethod, games: string[]): EvolutionMethod {
  const result = structuredClone(method)
  result.games = games
  if (games.length === 1 && games[0] === 'la') result.activation = 'manual'
  return result
}

/** Species-level upstream rows must not become ordinary evolution links on every form. */
export function matchingEvolutionRows(pokemon: Pokemon, rows: Row[]): Row[] {
  if (!pokemon.evolvesFrom && pokemon.id !== 'melmetal') return []
  const speciesRows = rows.filter((row) => Number(row.evolved_species_id) === pokemon.dexNum)
  const exact = speciesRows.filter(
    (row) => row.evolved_pokemon_form_id === pokemon.refs.pkApiFormId,
  )
  return exact.length ? exact : speciesRows.filter((row) => !row.evolved_pokemon_form_id)
}

export function createEvolutionMigrator(tables: Record<string, Row[]>) {
  const names = Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [
      table,
      new Map(rows.map((row) => [row.id, row.identifier])),
    ]),
  )
  const name = (table: string, value: string): string => {
    const result = names[table]?.get(value)
    if (!result) throw new Error(`Missing ${table} reference ${value}`)
    return result
  }
  const slug = (table: string, value: string) => name(table, value).replaceAll('-', '')

  function fromRow(pokemon: Pokemon, row: Row): EvolutionMethod {
    const trigger = name('evolution_triggers', row.evolution_trigger_id)
    const method: EvolutionMethod = {
      from: [correctedSources[pokemon.id] ?? pokemon.evolvesFrom ?? 'meltan'],
      trigger:
        trigger === 'trade'
          ? 'trade'
          : trigger === 'use-item'
            ? 'use_item'
            : ['level-up', 'in-battle-level-up'].includes(trigger)
              ? 'level_up'
              : 'special',
      conditions: [],
    }
    if (row.minimum_level) method.minLevel = Number(row.minimum_level)
    if (row.trigger_item_id || row.held_item_id)
      method.item = {
        id: slug('items', row.trigger_item_id || row.held_item_id),
        role: row.trigger_item_id ? 'used' : 'held',
      }
    if (row.minimum_happiness) condition(method, { key: 'friendship' })
    if (row.minimum_beauty)
      condition(method, { key: 'beauty', minValue: Number(row.minimum_beauty) })
    if (row.minimum_affection)
      condition(method, { key: 'affection', minLevel: Number(row.minimum_affection) })
    if (row.gender_id)
      condition(method, { key: 'gender', gender: row.gender_id === '1' ? 'female' : 'male' })
    if (['day', 'night', 'dusk'].includes(row.time_of_day))
      condition(method, { key: 'time_of_day', time: row.time_of_day as 'day' | 'night' | 'dusk' })
    if (row.time_of_day === 'full-moon') condition(method, { key: 'full_moon' })
    if (row.known_move_id)
      condition(method, { key: 'known_move', move: slug('moves', row.known_move_id) })
    if (row.known_move_type_id)
      condition(method, {
        key: 'known_move_type',
        type: name('types', row.known_move_type_id) as Pkds.TypeId,
      })
    if (row.party_species_id)
      condition(method, {
        key: 'party_pokemon',
        pokemon: slug('pokemon_species', row.party_species_id),
      })
    if (row.party_type_id)
      condition(method, {
        key: 'party_type',
        type: name('types', row.party_type_id) as Pkds.TypeId,
      })
    if (row.trade_species_id)
      condition(method, {
        key: 'trade_partner',
        pokemon: slug('pokemon_species', row.trade_species_id),
      })
    if (row.relative_physical_stats !== '')
      condition(method, {
        key: 'attack_defense_comparison',
        comparison:
          Number(row.relative_physical_stats) < 0
            ? 'lt'
            : Number(row.relative_physical_stats) > 0
              ? 'gt'
              : 'eq',
      })
    if (row.needs_overworld_rain === '1')
      condition(method, { key: 'overworld_weather', weather: ['rain'] })
    if (row.turn_upside_down === '1') condition(method, { key: 'device_upside_down' })
    if (row.needs_multiplayer === '1') condition(method, { key: 'union_circle' })
    if (row.minimum_steps) {
      condition(method, { key: 'walk_steps', count: Number(row.minimum_steps), mode: 'lets_go' })
      condition(method, { key: 'outside_poke_ball' })
    }
    if (row.minimum_damage_taken)
      condition(method, {
        key:
          trigger === 'recoil-damage'
            ? 'recoil_damage_without_fainting'
            : 'damage_without_fainting',
        amount: Number(row.minimum_damage_taken),
      })
    if (row.percentage_chance)
      condition(method, { key: 'hidden_value_branch', percentage: Number(row.percentage_chance) })
    if (row.used_move_id)
      condition(method, {
        key: 'use_move',
        move: slug('moves', row.used_move_id),
        count: Number(row.minimum_move_count),
        ...(['11', '12'].includes(row.evolution_trigger_id)
          ? { style: row.evolution_trigger_id === '11' ? ('agile' as const) : ('strong' as const) }
          : {}),
      })
    if (row.region_id && pokemon.id !== 'quilava')
      condition(method, {
        key: 'region',
        region: ({ '7': 'alola', '8': 'galar', '9': 'hisui' } as Record<string, string>)[
          row.region_id
        ],
        relation: 'in',
      })
    if (row.location_id) {
      const location =
        pokemon.id === 'runerigus'
          ? 'dusty_bowl_arch'
          : pokemon.id === 'leafeon'
            ? 'moss_rock'
            : pokemon.id === 'glaceon'
              ? 'ice_rock'
              : pokemon.id === 'crabominable'
                ? 'mount_lanakila'
                : 'magnetic_field'
      condition(method, { key: 'location', location })
    }
    if (trigger === 'in-battle-level-up') condition(method, { key: 'battle_experience' })
    if (trigger === 'three-critical-hits')
      condition(method, { key: 'critical_hits_in_one_battle', count: 3 })
    if (trigger === 'three-defeated-bisharp') {
      method.trigger = 'level_up'
      condition(method, {
        key: 'defeat_pokemon_holding_item',
        pokemon: 'bisharp',
        item: 'leaderscrest',
        count: 3,
      })
    }
    if (trigger === 'gimmighoul-coins') {
      method.from = ['gimmighoul', 'gimmighoul-roaming']
      method.trigger = 'level_up'
      method.item = { id: 'gimmighoulcoin', role: 'bag', quantity: 999 }
    }
    if (trigger === 'meltan-candies')
      condition(method, { key: 'candy', pokemon: 'meltan', count: 400 })
    if (trigger === 'tower-of-darkness' || trigger === 'tower-of-waters')
      condition(method, {
        key: 'interact_with_scroll',
        scroll: trigger === 'tower-of-darkness' ? 'darkness' : 'waters',
      })
    if (trigger === 'shed') {
      method.minLevel = 20
      method.additionalResult = true
      condition(method, { key: 'evolve_other', pokemon: 'ninjask' })
      condition(method, { key: 'spare_party_slot' })
      // Retain the generation exception as a note until exact game scopes are enumerated.
      method.notes = {
        eng: 'From Generation IV onward, also requires a regular Poké Ball in the Bag. Generation III does not require the spare Poké Ball.',
      }
    }
    return method
  }

  return (pokemon: Pokemon): EvolutionMethod[] => {
    let methods = matchingEvolutionRows(pokemon, tables.pokemon_evolution).map((row) =>
      fromRow(pokemon, row),
    )
    if (!methods.length) throw new Error(`No evolution rows for ${pokemon.id}; refusing to guess`)
    const base = methods[0]
    const time = (method: EvolutionMethod, value: 'day' | 'night' | 'dusk') =>
      condition(method, { key: 'time_of_day', time: value })
    const useItem = (
      id: string,
      games: string[],
      conditions: EvolutionCondition[] = [],
    ): EvolutionMethod =>
      scoped(
        {
          from: base.from,
          trigger: 'use_item',
          item: { id, role: 'used' },
          conditions,
        },
        games,
      )

    if (pokemon.id === 'mothim')
      methods.forEach((method) => {
        method.from = ['burmy', 'burmy-sandy', 'burmy-trash']
      })
    if (pokemon.isFemaleForm)
      methods.forEach((method) => condition(method, { key: 'gender', gender: 'female' }))
    if (pokemon.id.startsWith('toxtricity')) {
      const natures =
        pokemon.id === 'toxtricity'
          ? [
              'hardy',
              'brave',
              'adamant',
              'naughty',
              'docile',
              'impish',
              'lax',
              'hasty',
              'jolly',
              'naive',
              'rash',
              'sassy',
              'quirky',
            ]
          : [
              'lonely',
              'bold',
              'relaxed',
              'timid',
              'serious',
              'modest',
              'mild',
              'quiet',
              'bashful',
              'calm',
              'gentle',
              'careful',
            ]
      methods.forEach((method) => condition(method, { key: 'nature', natures }))
      methods = methods.map((method) => scoped(method, [...swsh, ...sv]))
    }
    if (pokemon.dexNum === 869) {
      const form = pokemon.formId!
      const recipe = form.slice(0, form.lastIndexOf('-'))
      const sweet = `${form.slice(form.lastIndexOf('-') + 1)}sweet`
      const recipes: Record<
        string,
        ['clockwise' | 'counterclockwise' | 'either', number, 'lt' | 'gt', 'day' | 'night' | 'dusk']
      > = {
        'vanilla-cream': ['clockwise', 5, 'lt', 'day'],
        'ruby-cream': ['counterclockwise', 5, 'lt', 'day'],
        'matcha-cream': ['clockwise', 5, 'lt', 'night'],
        'mint-cream': ['counterclockwise', 5, 'gt', 'night'],
        'lemon-cream': ['clockwise', 5, 'gt', 'night'],
        'salted-cream': ['counterclockwise', 5, 'lt', 'night'],
        'ruby-swirl': ['counterclockwise', 5, 'gt', 'day'],
        'caramel-swirl': ['clockwise', 5, 'gt', 'day'],
        'rainbow-swirl': ['either', 10, 'gt', 'dusk'],
      }
      const [direction, seconds, comparison, daytime] = recipes[recipe]
      base.item = { id: sweet, role: 'held' }
      condition(base, { key: 'spin', direction, seconds, comparison })
      time(base, daytime)
      if (daytime === 'dusk')
        base.notes = {
          eng: 'The evening window depends on the game; in Sword/Shield it is 19:00–19:59.',
        }
      methods = [scoped(base, [...swsh, ...sv])]
    }
    if (pokemon.id === 'melmetal') methods = [scoped(base, ['go'])]
    if (
      [
        'palafin',
        'pawmot',
        'brambleghast',
        'rabsca',
        'kingambit',
        'gholdengo',
        'maushold',
        'maushold-three',
        'dudunsparce',
        'dudunsparce-three-segment',
      ].includes(pokemon.id)
    )
      methods = methods.map((method) => scoped(method, sv))
    if (pokemon.id === 'annihilape') {
      base.trigger = 'level_up'
      methods = [scoped(base, sv)]
    }
    if (pokemon.id === 'wyrdeer') methods = [scoped(base, ['la'])]
    if (pokemon.id === 'sirfetchd') methods = [scoped(base, swsh)]
    if (pokemon.id === 'kleavor') methods = [useItem('blackaugurite', ['la'])]
    if (pokemon.id === 'ursaluna') methods = [useItem('peatblock', ['la'], [{ key: 'full_moon' }])]
    if (pokemon.id.startsWith('basculegion')) {
      methods = [scoped(base, ['la']), scoped({ ...base, trigger: 'level_up' }, sv)]
    }
    if (pokemon.id === 'overqwil') {
      const requirements: EvolutionCondition[] = [
        { key: 'use_move', move: 'barbbarrage', count: 20, style: 'strong' },
      ]
      methods = [
        scoped({ ...base, trigger: 'special', conditions: requirements }, ['la']),
        scoped(
          {
            ...base,
            trigger: 'level_up',
            conditions: [{ key: 'known_move', move: 'barbbarrage' }],
          },
          sv,
        ),
        scoped(
          {
            ...base,
            trigger: 'special',
            activation: 'manual',
            conditions: [{ key: 'hit_with_move', move: 'barbbarrage', count: 20 }],
            notes: {
              eng: 'Bulbapedia counts hits (including multiple targets); Serebii/PokéAPI summarize move uses. Exact counter semantics need verification.',
            },
          },
          ['lza'],
        ),
      ]
    }
    if (pokemon.id === 'runerigus') {
      base.notes = {
        eng: 'Sources disagree on accumulated damage versus currently missing HP and the precise threshold. Do not treat this as an executable counter until verified.',
      }
      methods = [scoped(base, swsh), scoped(base, ['lza'])]
      condition(methods[1], { key: 'location', location: 'coulant_waterway_bridge' })
      methods[1].activation = 'manual'
    }
    if (pokemon.id.startsWith('urshifu')) {
      methods = methods.map((method) => scoped(method, method.trigger === 'use_item' ? sv : swsh))
    }
    if (pokemon.id === 'sylveon')
      methods = methods.map((method) =>
        scoped(
          method,
          method.conditions.some((entry) => entry.key === 'affection')
            ? g67
            : [...swsh, ...sv, 'lza'],
        ),
      )
    if (pokemon.id === 'quilava')
      methods = methods.map((method) =>
        method.minLevel === 17
          ? scoped(method, ['la'])
          : {
              ...method,
              notes: {
                eng: 'This level-14 route excludes Legends: Arceus, which requires level 17; the complete other-game scope is not yet enumerated.',
              },
            },
      )
    if (pokemon.id === 'solgaleo' || pokemon.id === 'lunala')
      methods = [
        scoped(
          base,
          pokemon.id === 'solgaleo'
            ? ['sm-s', 'usum-us', 'swsh-sw', 'sv-s']
            : ['sm-m', 'usum-um', 'swsh-sh', 'sv-v'],
        ),
      ]
    if (pokemon.id.startsWith('lycanroc')) {
      condition(base, {
        key: 'ability',
        abilities:
          pokemon.id === 'lycanroc-dusk' ? ['owntempo'] : ['keeneye', 'vitalspirit', 'steadfast'],
      })
      const game7 =
        pokemon.id === 'lycanroc-dusk'
          ? ['usum-us', 'usum-um']
          : pokemon.id === 'lycanroc-midnight'
            ? ['sm-m', 'usum-um']
            : ['sm-s', 'usum-us']
      base.notes = {
        eng: 'Own Tempo identifies a distinct Rockruff variant, not an Ability Capsule/Patch change. Dusk hours depend on the game.',
      }
      methods = [scoped(base, game7), scoped(base, [...swsh, ...sv])]
    }
    if (pokemon.id === 'malamar')
      base.notes = {
        eng: 'On Switch, use handheld mode with attached Joy-Con and disconnect other controllers.',
      }
    if (pokemon.dexNum === 666)
      condition(base, { key: 'vivillon_pattern', pattern: pokemon.formId! })
    if (pokemon.id === 'goodra') {
      const fog = scoped(base, sm)
      condition(fog, { key: 'overworld_weather', weather: ['rain', 'fog'] })
      methods.push(fog)
    }

    // An item-use alternative in PLA does not erase the ordinary trade/held-item route.
    const ordinaryTrade = ['alakazam', 'alakazam-f', 'machamp', 'golem', 'gengar']
    const heldItemPla = [
      'scizor',
      'scizor-f',
      'steelix',
      'steelix-f',
      'rhyperior',
      'rhyperior-f',
      'electivire',
      'magmortar',
      'dusknoir',
      'porygon2',
      'porygonz',
      'chansey',
      'gliscor',
      'weavile',
      'weavile-f',
      'sneasler',
    ]
    if (ordinaryTrade.includes(pokemon.id))
      methods.push(useItem('linkingcord', ['la'], base.conditions))
    if (heldItemPla.includes(pokemon.id))
      methods.push(useItem(base.item!.id, ['la'], base.conditions))
    if (pokemon.id === 'probopass') methods.push(useItem('thunderstone', ['la']))

    // Introduction groups in upstream are NOT game eligibility. Only these researched scopes are added.
    if (
      pokemon.id.endsWith('-hisui') &&
      [
        'typhlosion-hisui',
        'samurott-hisui',
        'decidueye-hisui',
        'lilligant-hisui',
        'braviary-hisui',
        'sliggoo-hisui',
        'avalugg-hisui',
      ].includes(pokemon.id)
    )
      methods = methods.map((method) => scoped(method, ['la']))
    if (['raichu-alola', 'exeggutor-alola', 'marowak-alola'].includes(pokemon.id)) {
      base.notes = {
        eng: 'Evolve in Alola; Ultra Space in Ultra Sun/Ultra Moon produces the ordinary form instead.',
      }
      methods = [scoped(base, sm)]
    }
    if (['mrmime-galar', 'weezing-galar'].includes(pokemon.id)) methods = [scoped(base, swsh)]
    const ordinaryRegions: Record<string, string> = {
      raichu: 'alola',
      'raichu-f': 'alola',
      exeggutor: 'alola',
      marowak: 'alola',
      typhlosion: 'hisui',
      samurott: 'hisui',
      decidueye: 'hisui',
      lilligant: 'hisui',
      braviary: 'hisui',
      sliggoo: 'hisui',
      avalugg: 'hisui',
      mrmime: 'galar',
      weezing: 'galar',
    }
    if (ordinaryRegions[pokemon.id])
      methods.forEach((method) =>
        condition(method, {
          key: 'region',
          region: ordinaryRegions[pokemon.id],
          relation: 'outside',
        }),
      )

    // Deduplicate repeated location/generation rows after normalization; retain distinct scoped routes.
    return [
      ...new Map(
        methods.map((method) => {
          const parsed = evolutionMethodSchema.parse(method)
          return [JSON.stringify(parsed), parsed] as const
        }),
      ).values(),
    ]
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--write'))
    throw new Error('Usage: node src/scripts/migrate-pokemon-evolutions.ts [--write]')
  let migrate: ReturnType<typeof createEvolutionMigrator> | undefined
  const changes: { path: string; result: { code: string; errors: [] } }[] = []
  let methods = 0
  for (const file of readdirSync('data/pokemon')
    .filter((file) => file.endsWith('.json'))
    .sort()) {
    const path = resolve('data/pokemon', file)
    const original = readFileSync(path, 'utf8')
    const pokemon: Pokemon = JSON.parse(original)
    let evoMethods = pokemon.evoMethods ?? pokemon.evolutionMethods
    if (!evoMethods && !pokemon.evolvesFrom && pokemon.id !== 'melmetal') continue
    if (
      pokemon.isBattleOnlyForm ||
      pokemon.isMega ||
      pokemon.isGmax ||
      pokemon.isPrimal ||
      pokemon.isFusion
    )
      throw new Error(`Unexpected transformation evolution: ${pokemon.id}`)
    if (!evoMethods) {
      if (!migrate) {
        const cache = resolve('.local/evolution-audit/pokeapi')
        const tables = Object.fromEntries(
          [
            'pokemon_evolution',
            'pokemon_species',
            'evolution_triggers',
            'items',
            'moves',
            'types',
          ].map((name) => [name, parseCsv(readFileSync(resolve(cache, `${name}.csv`), 'utf8'))]),
        )
        migrate = createEvolutionMigrator(tables)
      }
      evoMethods = migrate(pokemon)
    }
    const code = await migrateEvolutionRecord(original, evoMethods)
    if (code === original) continue
    methods += evoMethods.length
    changes.push({ path, result: { code, errors: [] } })
  }
  const items: Pkds.Item[] = JSON.parse(readFileSync('data/items.json', 'utf8'))
  const missingItems = evolutionItems.filter(
    (item) => !items.some((existing) => existing.id === item.id),
  )
  // Prepare and format everything before the first write, so validation errors cannot partly migrate data.
  const prepared = await Promise.all([
    ...changes,
    ...(missingItems.length
      ? [
          {
            path: resolve('data/items.json'),
            result: await format('items.json', JSON.stringify([...items, ...missingItems])),
          },
        ]
      : []),
  ])
  for (const { path, result } of prepared)
    if (result.errors.length) throw new Error(`Formatting failed: ${path}`)
  if (args.includes('--write'))
    for (const { path, result } of prepared) writeFileSync(path, result.code)
  console.log(
    `${args.includes('--write') ? 'Migrated' : 'Would migrate'} ${changes.length} Pokémon, ${methods} methods, ${missingItems.length} new items.`,
  )
}

/** Preserve method contents and unrelated text while removing redundant legacy evolution fields. */
export async function migrateEvolutionRecord(
  original: string,
  methods: EvolutionMethod[],
): Promise<string> {
  const pokemon = JSON.parse(original)
  if (!methods.length) throw new Error('Evolution methods must not be empty')
  methods.forEach((method) => evolutionMethodSchema.parse(method))
  for (const existing of [pokemon.evoMethods, pokemon.evolutionMethods]) {
    if (existing && !isDeepStrictEqual(existing, methods))
      throw new Error('Refusing to overwrite existing evolution methods')
  }
  if (pokemon.evoMethods && pokemon.evolutionMethods)
    throw new Error('Record contains both evoMethods and evolutionMethods')
  let updated = original
  if (pokemon.evolutionMethods) {
    updated = updated.replace(/^  "evolutionMethods":/m, '  "evoMethods":')
  } else if (!pokemon.evoMethods) {
    const formatted = await format('evolution.json', JSON.stringify({ evoMethods: methods }))
    if (formatted.errors.length) throw new Error('Could not format evolution methods')
    const field = formatted.code.slice(
      formatted.code.indexOf('\n') + 1,
      formatted.code.lastIndexOf('\n}'),
    )
    const anchor = pokemon.evolvesFrom ? '  "evolvesFrom":' : '  "names":'
    const offset = original.indexOf(anchor)
    if (offset < 0) throw new Error('Missing evolution insertion point')
    updated = original.slice(0, offset) + field + ',\n' + original.slice(offset)
  }
  updated = updated
    .replace(/^  "(?:evolvesFrom|evoFrom[^"\n]*)": [\s\S]*?(?=^  "[^"\n]+":|^})/gm, '')
    .replace(/,\n}(\s*)$/, '\n}$1')
  const expected = { ...pokemon, evoMethods: methods }
  for (const key of Object.keys(expected))
    if (key === 'evolutionMethods' || key === 'evolvesFrom' || key.startsWith('evoFrom'))
      delete expected[key]
  if (!isDeepStrictEqual(JSON.parse(updated), expected))
    throw new Error('Migration changed unexpected fields')
  return updated
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) await main()

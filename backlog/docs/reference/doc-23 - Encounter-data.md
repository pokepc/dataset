---
id: doc-23
title: Encounter data
type: specification
created_date: '2026-10-13 06:15'
updated_date: '2026-10-13 08:15'
---
`data/encounters/<pokemonId>.json` lists where a Pokémon record can be met in each game. A record
with no file has no imported encounters; that does not mean it is unobtainable.

```json
{
  "game": "rb-r",
  "location": "kanto-viridian-forest",
  "method": "walk",
  "minLevel": 3,
  "maxLevel": 5,
  "conditions": [],
  "source": "pokeapi"
}
```

- `game` is an individual game id. Encounters of a DLC version use the base game, as in the
  [location catalog](doc-5).
- `location` is a `data/locations.json` id whose `games` include the game. PokéAPI location areas
  fold into their parent place.
- `method` and `conditions` are PokéAPI identifiers (`walk`, `surf`, `gift`, `time-night`,
  `swarm-yes`...). An empty `conditions` list means unconditional. Records hold no display text;
  names for methods and conditions belong to the consumer until an i18n file covers them.
- One entry per game, place, method and condition set, with the widest level range of the merged
  rows. Encounter slot rarity is not imported.
- `source` names the provider of the entry. Only `pokeapi` exists today; TASK-285 in pokepc-net
  adds sources for games PokéAPI does not cover.
- Files are sorted by game index, location id, PokéAPI method order and level. Consumers load one
  file per Pokémon (`loadEncounters(id)` in `lib/fs`), so the data stays out of catalog bundles.

## Rebuilding

```sh
pnpm encounters:import            # preview, writes .local/encounters/report.json
pnpm encounters:import --offline --write
```

The importer reads the PokéAPI CSV tables (`encounters`, `encounter_slots`, `encounter_methods`,
`encounter_condition_value_map`, `encounter_condition_values`, `location_areas`, `versions`,
`pokemon`) at the revision pinned in `src/upstream-adapters/locations/fetch.ts`, so encounters and
the place catalog come from the same snapshot. A repeat offline import produces identical files;
`--write` replaces `data/encounters/` entirely.

## Mapping rules

Reviewed decisions with their sources live in `src/upstream-adapters/encounters/overrides.ts`; the
report records them under `decisions`.

- Pokémon: a PokéAPI Pokémon id maps to the record whose `refs.pkApiId` matches. When several
  records share the id (gender forms, Megas, cosmetic forms such as Unown or Vivillon), the
  encounter attaches to the default record, because PokéAPI does not tell those forms apart.
- Place-decided forms: `placeFormOverrides` moves an encounter to a form when the game and place
  decide it. East Sea Shellos and Gastrodon in Diamond, Pearl and Platinum (Routes 212, 213, 222,
  224 and 230 and Pastoria City, east of Mt. Coronet) are the reviewed cases. Forms decided by
  season, flower colour, battle terrain or the player's region (Deerling, Sawsbuck, Flabébé, Burmy,
  Vivillon, Unown) stay on the default record as species-level encounters, and so do Shellos and
  Gastrodon outside Sinnoh until their forms per place are reviewed.
- Ability variants: `pokeApiPokemonAliases` maps PokéAPI Pokémon the dataset keeps as one record
  (Own Tempo Rockruff to `rockruff`, Power Construct Zygarde to `zygarde`).
- Places: a PokéAPI location maps through `locations[].pokeApiId`. Alternate PokéAPI records of a
  catalog place are aliased (Kanto Victory Road, the Hoenn team hideout, the Kanto Underground Path
  trades at the Routes 5-6 entrance). Locations with no single place are excluded with a reason:
  roaming Pokémon, `unknown-all-*` placeholders, event distributions picked up at a Poké Center or
  Mart, Max Raid dens spread over the Wild Area, and the unnamed Isle of Armor cave trades.
- Rows that still cannot be mapped are left out and listed in the report with their row counts.
  Today only the Japanese Red, Green and Blue versions remain (no dataset game).

## Coverage

At revision `bc92d3b6`: 117,127 PokéAPI rows, 115,054 imported, 303 excluded and 1,770 unresolved,
giving 70,316 entries for 922 records. PokéAPI covers Generation 1 to Sword/Shield with its DLCs and
Let's Go; it has no rows for BDSP, Legends: Arceus, Scarlet/Violet, Legends: Z-A or Champions, and
upstream issues report missing gift, trade and legendary encounters in covered games. PokéAPI data
is BSD-3-Clause.

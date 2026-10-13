---
id: doc-23
title: Encounter data
type: specification
created_date: '2026-10-13 06:15'
updated_date: '2026-10-13 06:15'
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

- Pokémon: a PokéAPI Pokémon id maps to the record whose `refs.pkApiId` matches. When several
  records share the id (gender forms, Megas, cosmetic forms such as Unown or Vivillon), the
  encounter attaches to the default record, because PokéAPI does not tell those forms apart.
  Form-specific encounters (Shellos East Sea, Burmy cloaks) need reviewed overrides.
- Places: a PokéAPI location maps through `locations[].pokeApiId`. Reviewed aliases and
  exclusions with their sources live in `src/upstream-adapters/encounters/overrides.ts`: alternate
  PokéAPI records of a catalog place (Kanto Victory Road, the Hoenn team hideout) are aliased, and
  pseudo-locations with no single place (roaming, `unknown-all-*`) are excluded.
- Rows that cannot be mapped are left out and listed in the report with their row counts: the
  Japanese Red, Green and Blue versions (no dataset game), Max Raid dens and Poké Center or Mart
  records (no single catalog place), the Kanto Underground Path (two catalog places) and PokéAPI
  Pokémon with no dataset record (Own Tempo Rockruff, Power Construct Zygarde).

## Coverage

At revision `bc92d3b6`: 117,127 PokéAPI rows, 115,039 imported, 200 excluded and 1,888 unresolved,
giving 70,309 entries for 920 records. PokéAPI covers Generation 1 to Sword/Shield with its DLCs and
Let's Go; it has no rows for BDSP, Legends: Arceus, Scarlet/Violet, Legends: Z-A or Champions, and
upstream issues report missing gift, trade and legendary encounters in covered games. PokéAPI data
is BSD-3-Clause.

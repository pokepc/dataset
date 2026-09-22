# Location catalog

`data/locations.json` combines the named places listed by
[PokémonDB](https://pokemondb.net/location),
[PokéAPI](https://pokeapi.co/docs/v2#locations-section), and
[Serebii Pokéarth](https://www.serebii.net/pokearth/), with reviewed
[Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Main_Page) exceptions.

```json
{
  "id": "kitakami-apple-hills",
  "name": "Apple Hills",
  "games": ["sv-s", "sv-v"],
  "region": "kitakami",
  "pokeApiId": 1058
}
```

- `id` is a stable lowercase slug, normally prefixed with its geographic region. Explicit aliases
  merge spelling differences and renamed places. Different places with the same name retain separate
  IDs, such as the two Unova Victory Roads.
- `name` is the English display name. PokéAPI names are preferred, with reviewed corrections and
  canonical names for aliases. Meaningful named sublocations are retained.
- `games` contains **individual** IDs from `data/games`, ordered by `data/indices/games.json`.
  Membership means the place exists in that version; it does not promise a wild encounter. DLC
  versions map to their base game IDs.
- `region` references `data/regions.json`. Kitakami is separate from Paldea. Blueberry Academy and
  the Terarium are assigned to Unova, even though they appear in Scarlet/Violet.
- `pokeApiId` is the numeric **location** ID, never a location-area ID, or `null` when unmapped. If
  PokéAPI has multiple records for one normalized place, a reviewed primary ID is used; every
  alternate ID remains in the provenance report. A missing ID does not imply the place is invalid.

Distant Land, Faraway Place, Fateful Encounter, and Mystery Zone are general labels with
`games: null` and `region: null`. They sort first. All other entries sort by the region array's
order, then by lexical ID. This is lexical ordering, so `route-10` precedes `route-2`.

## Rebuilding

```sh
# Preview; reuse cached sources and fetch missing pages.
pnpm locations:import

# Review .local/locations/report.json and .local/locations/candidate.json, then write.
pnpm locations:import --offline --write

# Refresh web snapshots before reviewing another preview.
pnpm locations:import --refresh
```

Bun runs the importer. `POKEPC_DATASET_DIR` can select another dataset directory;
`LOCATIONS_CACHE_DIR` changes the default `.local/locations` cache and report directory. `--offline`
requires all source snapshots to be present and cannot be combined with `--refresh`.

Preview mode does not modify the dataset. `--write` validates the schema, IDs, and references,
refuses source failures and removal of existing IDs, checks for concurrent edits, and replaces the
JSON atomically. It can write the verified subset while leaving unresolved new candidates in the
report. A repeat offline import produces identical JSON.

The report contains source URLs and content hashes, all contributing records for each output ID,
normalization decisions, explicit exclusions, unresolved candidates, fetch failures, and coverage
counts. Cache and reports are local artifacts and are not committed.

## Source rules

The adapters and reviewed mappings live in `src/upstream-adapters/locations/`:

1. **PokéAPI:** read its official CSV tables at the revision pinned in `fetch.ts`. The current
   snapshot is
   [`575291cdb197a7e3a320297be276c9de4ef8401a`](https://github.com/PokeAPI/pokeapi/tree/575291cdb197a7e3a320297be276c9de4ef8401a/data/v2/csv).
   Join locations, English names, regions, location areas, encounters, and versions. This is the
   data behind the API, without thousands of individual REST requests. Positive encounter version
   IDs establish game membership; generation-specific `game_indices` do not. Refreshing web
   snapshots does not advance this pin automatically.
2. **PokémonDB:** retain linked and unlinked entries in every regional catalog panel. For linked
   pages, only positive version badges in encounter rows establish games. A blank badge is not
   evidence. An unlinked catalog entry still participates in identity matching.
3. **Pokéarth:** read regional dropdown entries, then the same location's linked edition pages. Use
   visible game labels, explicit active edition anchors, edition-specific map images, and
   trainer/item/shop headings. Descriptions are a fallback only when concrete evidence is absent.
   Copied metadata, navigation links, and generation labels alone do not establish games.
4. **Review:** union positive evidence after identity normalization. `overrides.ts` records exact
   source corrections, aliases, primary API IDs, canonical names, and additional game evidence with
   source URLs and reasons. No fuzzy name matching or region-wide game expansion is used.
5. **Bulbapedia exceptions:** the versioned
   [exception registry](../src/upstream-adapters/locations/exceptions.json) records the review of
   distinct candidates left unresolved after merging duplicates and aliases from the first three
   sources. Merged names belong in the normal alias mappings, not in this exception list. Include an
   actual in-game location only if it has its own article; a redirect to a parent location's section
   is insufficient. Each decision records its source URL, canonical page title, supported individual
   games, and reason. The importer uses these reviewed decisions directly; new unresolved candidates
   require another review. An included entry may specify a corrected `canonicalId` for an upstream
   placeholder, as with `???` becoming `hoenn-inside-of-truck`. Named physical facilities with
   dedicated articles qualify even when the article covers several regions or multiple instances,
   such as Contest Hall, Secret Base, and Hidden Grotto. Region-specific game evidence is still
   required.

Specific decisions include:

- Tin Tower and Bell Tower share one identity; numbered Kalos routes merge with their descriptive
  route names.
- Original and sequel Unova Victory Roads remain separate. Original Mirage Island and the ORAS
  Mirage Spot islands also remain separate.
- Emerald's Jagged Pass Magma Hideout remains separate from the Lilycove hideout, whose team name
  changes by version. The mixed Pokéarth Magma Hideout edition chain is excluded explicitly.
- Steamdrift Way remains a named sublocation of Route 8. The API's mislabeled Thrifty Megamart
  record is matched using its abandoned-site encounter area.
- Unknown Dungeon in Kalos is a real named place. Roaming aggregates, unnamed encounter
  placeholders, whole-region records, and event/person/transfer-origin metadata are excluded.
- Ranger-region entries are retained in the exclusion report because their regions and games are
  outside the current dataset. Generic Kanto Underground Path is excluded because its API identity
  does not distinguish the two numbered paths.

## Coverage and verification

The import reviews 2,974 source records: 1,104 from PokéAPI, 813 from PokémonDB, and 1,057 from
Pokéarth. After the Bulbapedia review it produces **1,072 locations**, including four general labels
and 19 Kitakami locations; 913 have a primary PokéAPI ID and 159 have `null`.

Two of the initial 100 unresolved names merge into canonical identities through the normal alias
mappings: GTS/Global Terminal and Vaniville Pathway/Route 1. The **98 distinct candidates** have
Bulbapedia exception decisions: **47 included and 51 excluded**. Distant Land is an additional
explicit general-location exception. All 99 exception decisions are retained in `exceptions.json`
and copied into the local provenance report. The result has zero unresolved candidates and 262
excluded source records, including duplicate general labels and earlier source exclusions.

The article requirement applies to this reviewed exception set. It does not remove otherwise
verified locations from the original three-source catalog merely because they lack a Bulbapedia
article. Exclusions include parent-page sections, named gates covered only by the generic Gate
article, the Pokéwalker accessory, and unused Akala Meadow data. Alias normalization retains the
alternate PokéAPI IDs in provenance without adding duplicate places or exception entries.

Focused validation:

```sh
pnpm exec vitest run src/upstream-adapters/locations tests/data-integrity-tests/locations.test.ts src/openapi/document.test.ts
pnpm typecheck
```

Parser tests cover version exclusivity, renamed places, region corrections, legacy HTML, copied
metadata, and malformed sources. Import tests cover preview behavior, deterministic writes, source
failures, removals, and concurrent edits. Dataset checks enforce the exact fields, individual-game
and region references, unique IDs and primary API IDs, general labels, and sort order. Both the
library types and OpenAPI contract use the shared location schema.

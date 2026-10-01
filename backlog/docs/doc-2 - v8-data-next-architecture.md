---
id: doc-2
title: v8 data-next architecture
type: specification
created_date: '2026-09-30 23:58'
updated_date: '2026-10-01 04:44'
---
Specification of the v8 data model that replaces the v7 `data/` layout and `src/lib`. The decision
and its consequences are in
[decision-2](../decisions/decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md);
locale codes are fixed by
[decision-4](../decisions/decision-4%20-%20v8-locale-codes-and-language-records.md) and merged
static output by
[decision-5](../decisions/decision-5%20-%20Merged-static-API-output-only-for-game-sets-with-mods.md).
Paths below are relative to the v8 `data/` directory (`data-next/` until the cut-over, task-7).

## Goals

- **Per game set**: an entity can differ per game set (stats, learnsets, abilities, move data).
  A game set id is the game's `gameSet` (e.g. `swsh`, `sv`), or its game id when it has none
  (e.g. `champions`). DLCs belong to their parent set.
- **Translated**: every user-facing string is stored per locale, outside the records.
- **Linked**: records keep dataset string ids and carry upstream ids (`championsId`, `pokeApiId`)
  when known; a `pokeApiId` is `null` when PokéAPI has no such resource, never guessed.
- **Stable**: v7 ids, `nid`, `gen`, code maps and every kept non-text property keep their names and
  meanings. A property is added, moved or removed, never repurposed.

## Layout

```text
data/
  <kind>.json                     base collection files (see Entity kinds)
  pokemon/<id>.json               base per-entity files, likewise games/, pokedexes/
  boxpresets/classic/<set>.json   box presets (unchanged layout)
  boxpresets/modern/<set>.json    modern preset index; presets in boxpresets/modern/<set>/<id>.json
  indices/<kind>.json             order of per-entity kinds (pokemon, games, pokedexes)
  codes/<kind>.json               append-only code maps (unchanged)
  metadata/                       non-entity metadata (unchanged)
  i18n/<locale>/<kind>.json       base text per locale and kind
  i18n/<locale>/boxpresets/<variant>/<set>.json
  i18n/<locale>/pokemon-prose/<id>.md
  mods/<set>/roster.json          ids the set contains, per moddable kind
  mods/<set>/<kind>.json          sparse overrides for collection kinds
  mods/<set>/pokemon/<id>.json    sparse overrides for Pokémon
  mods/<set>/i18n/<locale>/<kind>.json   text that differs in the set
```

Base + mods is the source of truth (curated, or generated from upstreams) and is what npm ships.
The static API additionally publishes merged per-set data produced by the library's merge function
(task-3, task-11).

## Entity kinds

Storage granularity is unchanged from v7: kinds that were one file per entity stay that way, and
mods mirror the base granularity.

| Kind            | Base storage                         | Moddable | Mod storage                       |
| --------------- | ------------------------------------ | -------- | --------------------------------- |
| `pokemon`       | `pokemon/<id>.json` + `indices/pokemon.json` | yes | `mods/<set>/pokemon/<id>.json` |
| `moves`         | `moves.json`                         | yes      | `mods/<set>/moves.json`           |
| `abilities`     | `abilities.json`                     | yes      | `mods/<set>/abilities.json`       |
| `items`         | `items.json`                         | yes      | `mods/<set>/items.json`           |
| `battle-states` | `battle-states.json` (new in v8)     | yes      | `mods/<set>/battle-states.json`   |
| `games`         | `games/<id>.json` + `indices/games.json` | no   | —                                 |
| `pokedexes`     | `pokedexes/<id>.json` + `indices/pokedexes.json` | no | —                          |
| `boxpresets`    | `boxpresets/{classic,modern}/…`      | no       | —                                 |
| Other collections | `characters`, `colors`, `generations`, `languages`, `locations`, `marks`, `natures`, `originmarks`, `personalities`, `pokeballs`, `regions`, `ribbons`, `types` (`<kind>.json`) | no | — |

Collection files are JSON arrays of records in a stable, curated order. Only moddable kinds can
differ per game set; making another kind moddable later is an additive change.

## Base records

A base record is the game-independent view of an entity: identity, lifecycle, curated
availability, evolutions, forms, upstream ids and default mechanics. Records contain no
user-facing text (see [Text](#text)).

- Base values are the current mainline values that v7 already curated (v7 `data/` becomes base
  unchanged apart from text removal).
- Entities that exist only in one game set (for example Champions battle states) are base records;
  sets that do not have them exclude them through their roster.
- Some properties only make sense inside a game set and are never set in base, only by mods:
  Pokémon `learnset` (move ids the form can learn in that set) and move `usable` (whether the set
  lets a Pokémon use the move). They are optional in the record schemas.
- Game-independent upstream ids live in base: `championsId` (Pokémon, moves, abilities, items,
  battle states) and `pokeApiId` (moves, abilities, items). Pokémon keep their v7 `refs`.

## Mods

A mod is the set of differences for one game set, stored under `mods/<set>/`. Mods only override
existing base ids; a mod record for an id missing from base is invalid.

### Override records

An override record has the base record's `id` plus only the properties whose value differs in the
set. Per-entity overrides (`mods/<set>/pokemon/<id>.json`) hold one record whose `id` matches the
file name; collection overrides (`mods/<set>/<kind>.json`) hold an array of override records in
base order.

Merge semantics, applied per record:

1. Start from a copy of the base record.
2. Every property present in the override replaces the base property entirely. Arrays are replaced,
   never concatenated or merged by element; nested objects (e.g. `refs`) are replaced as a whole.
   `null` is an ordinary value (e.g. `type2: null` makes a Pokémon single-typed).
3. `$unset` (optional array of property names) removes those properties from the result, for
   example `"$unset": ["ability2"]`. A property cannot be both set and unset.
4. `id` cannot be overridden.

The result must validate against the kind's record schema. An override that changes nothing is
invalid, so mods stay minimal.

### Roster

`mods/<set>/roster.json` limits which records of each moddable kind exist in the set:

```json
{ "pokemon": ["venusaur", "venusaur-mega"], "moves": ["pound"], "abilities": ["stench"], "items": ["cheriberry"] }
```

- A kind listed in the roster contains exactly the listed ids, in base order. Every listed id must
  exist in base.
- A kind not listed contains every base record (e.g. Champions lists no `battle-states`).
- An empty array excludes the kind entirely.
- Removing a record from a set means leaving it out of the roster; there is no per-record delete.
- Override records and override text must only target ids in the roster.

A set with no `mods/<set>/` directory has no merged data (decision-5).

## Text

Records hold no user-facing text. Text lives in per-locale files keyed by entity id; a property
missing for a locale is omitted, never copied from another locale or game set. Consumers choose
their own fallback.

### Locales

One locale code set is used for every directory and key: the lowercase in-game language codes.
v7 translation keys map as follows (decision-4):

| v8 locale | v7 key | Language                |
| --------- | ------ | ----------------------- |
| `eng`     | `eng`  | English                 |
| `es-es`   | `esp`  | Spanish (Spain)         |
| `es-la`   | `esla` | Spanish (Latin America) |
| `fra`     | `fra`  | French                  |
| `deu`     | `deu`  | German                  |
| `ita`     | `ita`  | Italian                 |
| `jpn`     | `jap`  | Japanese                |
| `kor`     | `kor`  | Korean                  |
| `chs`     | `chs`  | Chinese (Simplified)    |
| `cht`     | `cht`  | Chinese (Traditional)   |
| `pt-br`   | `por`  | Portuguese (Brazil)     |

`languages.json` keeps the v7 language records (ids `en`, `es`, `esla`, …) and adds `code`, the v8
locale code of that language.

### Locale files

`i18n/<locale>/<kind>.json` is a JSON object mapping entity id to that entity's text fields, in base
order. A file exists only when the locale has text for that kind; an entity with no text in a locale
is absent from the object.

```json
{ "pikachu": { "name": "Pikachu", "genus": "Mouse Pokémon" } }
```

Text fields per kind (v7 record fields move here, keeping their names in singular form):

| Kind                                  | Text fields                                                    |
| ------------------------------------- | -------------------------------------------------------------- |
| `pokemon`                             | `name`, `speciesName`, `formName`, `genus`, `formsDesc`         |
| `moves`, `abilities`, `pokeballs`     | `name`, `shortDesc`, `desc`                                    |
| `items`                               | `name`, `pluralName`, `shortDesc`, `desc`                      |
| `battle-states`                       | `name`, `desc`                                                 |
| `ribbons`                             | `name`, `title`, `shortDesc`, `desc`                           |
| `marks`                               | `name`, `title`, `conditions`, `shortDesc`, `desc`             |
| `pokedexes`                           | `name`, `shortDesc`, `desc`, `entries` (see below)             |
| `games`, `characters`, `colors`, `locations`, `natures`, `originmarks`, `regions`, `types` | `name` |
| `personalities`                       | `shortDesc`                                                    |

- Pokémon `names`, `speciesNames`, `formNames` and `genus` maps become per-locale `name`,
  `speciesName`, `formName` and `genus`. Empty strings mean "officially empty" and are kept.
- Pokédex entries with non-canonical `meta` text (e.g. Pokopia's Mosslax) get a `meta.id` slug;
  their text is `entries.<meta.id>` with `name`, `speciesName` and `formName`.
- Box preset text (`name`, `description`, box titles/names) lives in
  `i18n/<locale>/boxpresets/<variant>/<set>.json`, keyed by preset id, with `boxes` as an array of
  box titles aligned with the preset's boxes (`null` for untitled boxes).
- Species prose (game-independent Markdown, generated by `pnpm generate:pokemon-prose`) lives in
  `i18n/<locale>/pokemon-prose/<id>.md`.
- Kept non-text identifiers stay in records: `psName`, game `nameSlug` and `codename`, Pokémon
  `refs`, mark `chance` and `chanceCharm`, language `name`/`nameEng` (endonym metadata).

### Mod text

`mods/<set>/i18n/<locale>/<kind>.json` has the same shape, holding only fields whose text differs
in the set, for moddable kinds and roster ids only. Merging replaces base text field by field;
`$unset` removes base fields that the set does not have. Text that a set adds but base lacks for a
locale (e.g. official Champions move names in Portuguese) belongs in base when it is
game-independent (names), and in the mod when it is the set's own wording (descriptions).

## Merged data

Merging a game set produces, for each moddable kind: the roster's base records with overrides
applied, and per locale the roster's base text with mod text applied. The library exports the merge
function (task-3); the static API build uses the same function:

| Static API path                        | Contents                                 |
| -------------------------------------- | ---------------------------------------- |
| `/pokemon/{id}.json`, `/moves.json`, … | Base records, at the root (no `/base/`)  |
| `/i18n/{locale}/{kind}.json`           | Base text                                |
| `/games/{id}.json`                     | Game record, unchanged                   |
| `/games/{set}/pokemon/{id}.json`       | Merged Pokémon of a set with mods        |
| `/games/{set}/{kind}.json`             | Merged collection kinds of that set      |
| `/games/{set}/i18n/{locale}/{kind}.json` | Merged text of that set                |

URLs say `games` because users know games better than game sets; `{set}` is a game set id. Only set
ids with mods get folders: `/games/champions/` exists, `/games/swsh-sw/` never does, and clients map
a version or DLC to its `gameSet` themselves. The OpenAPI spec documents these paths.

## Code maps

One global, append-only map per kind across all game sets, continuing the v7 maps unchanged
([decision-1](../decisions/decision-1%20-%20Append-only-numeric-code-maps-for-stored-ids.md)). New
base ids are appended by `pnpm codes:sync`. Mods never introduce ids, so they never need codes.

## Champions

Champions is the first and, in 8.0.0, only set with mods. Its upstream adapter (Project Pokémon
`champout` dump, enriched with PokéAPI ids) is run manually by a maintainer and writes
`mods/champions/` plus Champions text; the maintainer reviews the diff before committing. It is not
part of `pnpm build`. Its learnsets (`pokemon-moves.json` in the preview) become Pokémon `learnset`
overrides, and its in-game descriptions become `mods/champions/i18n/<locale>/` text.

## Preview layout (until task-7)

`data-next/` currently holds the generated preview: `champions/` (full records, learnsets and
per-locale text), `pokemon-texts/<locale>/` prose and `languages.json`. `pnpm build:next`
(`src/lib-next/_build.ts`) regenerates it. The tasks of milestone `m-0` migrate v7 `data/` and this
preview into the layout above and then rename `data-next/` and `src/lib-next/` to `data/` and
`src/lib/`.

## Resolved

- 2026-10-01: base + overrides, game set ids, merged views on the static API only, per-locale text,
  no translation fallback, `/games/{set}/` URLs, Champions migration and upkeep, code maps carry
  over, hard cut (decision-2).
- 2026-10-01: storage granularity, override and roster semantics, locale file shapes, locale codes
  (decision-4), merged output only for sets with mods (decision-5) — task-1.

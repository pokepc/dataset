# Migrating from v7 to v8

This guide is for consumers of `@pokepc/dataset` on npm and of the static JSON API on GitHub Pages
(`https://pokepc.github.io/dataset/`). It is written for developers and coding agents: every change
has a before/after mapping, and the [agent playbook](#agent-playbook) lists exact search patterns
and verification steps. It ships in the npm package as `docs/migrating-to-v8.md`.

For everyday recipes on the v8 layout (names, languages, prose, game sets), see
[usage.md](usage.md).

## Summary

- v8 stores every entity once as a **base** record, plus **mods**: per-game-set overrides holding
  only what that game set changes. Pokémon Champions is the only game set with mods in 8.0.0.
- **Records hold no text.** Names, descriptions and other user-facing strings live in per-locale
  files under `data/i18n/<locale>/`.
- The static API serves base data at the version root (no `/data/` prefix) and **merged** data for
  game sets with mods under `/games/{set}/`. npm ships base + mods and a merge function.
- `data-next/*` and `lib-next/*` (the v7 preview of this model) are gone; `data/*` and `lib/*` now
  hold the v8 model.
- Ids, `nid`, `gen`, the code maps and every kept property keep their names and meanings. A property
  is added, moved or removed, never repurposed.

## Before you migrate: pin v7

v7 stays available, but unversioned entry points switch to v8.

| You use                                    | Risk                                                          | Pin to                                 |
| ------------------------------------------ | ------------------------------------------------------------- | -------------------------------------- |
| npm `@pokepc/dataset`                      | `^7` stays on v7; `latest`, `*` or `>=7` install v8           | `"@pokepc/dataset": "^7"`              |
| `https://pokepc.github.io/dataset/`        | Follows the default branch, which is already the v8 workspace | `https://pokepc.github.io/dataset/v7/` |
| `https://pokepc.github.io/dataset/latest/` | Serves v8 since 8.0.0                                         | `https://pokepc.github.io/dataset/v7/` |

v7 fixes are released from the `7.x` branch as 7.x versions.

## Concepts

| Term        | Meaning                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Base record | The game-independent record of an entity: identity, lifecycle, curated availability, evolutions, forms, upstream ids        |
| Game set    | A game's `gameSet` (e.g. `swsh`, `sv`), or the game id when it has none (e.g. `champions`). DLCs belong to their parent set |
| Mod         | `data/mods/<set>/`: a roster of the set's ids, sparse overrides and the set's own text                                      |
| Merged data | Base + a set's mods + its text: what the entity looks like in that game set                                                 |
| Locale file | `data/i18n/<locale>/<kind>.json`: text keyed by entity id. Missing text is omitted, never filled from another locale or set |

Choose your own fallback for missing text (for example, English).

## Locale codes

Every locale directory and key uses the lowercase in-game language code:

| v8 locale | v7 translation key | v7 language id | Language                |
| --------- | ------------------ | -------------- | ----------------------- |
| `eng`     | `eng`              | `en`           | English                 |
| `es-es`   | `esp`              | `es`           | Spanish (Spain)         |
| `es-la`   | `esla`             | `esla`         | Spanish (Latin America) |
| `fra`     | `fra`              | `fr`           | French                  |
| `deu`     | `deu`              | `de`           | German                  |
| `ita`     | `ita`              | `it`           | Italian                 |
| `jpn`     | `jap`              | `ja`           | Japanese                |
| `kor`     | `kor`              | `ko`           | Korean                  |
| `chs`     | `chs`              | `chs`          | Chinese (Simplified)    |
| `cht`     | `cht`              | `cht`          | Chinese (Traditional)   |
| `pt-br`   | `por`              | `pt`           | Portuguese (Brazil)     |

`data/languages.json` keeps the v7 records and ids and adds `code`, the v8 locale code. In code,
`localeCodes` and `localeCodeByV7Key` from `@pokepc/dataset/lib/languages` hold these tables.

## Data files (npm `@pokepc/dataset/data/*` and static API)

### Paths

| v7                                                                               | v8                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/<kind>.json` (abilities, items, moves, …)                                  | Same path, records without text; text in `data/i18n/<locale>/<kind>.json`                                                                                  |
| `data/pokemon/<id>.json`, `games/<id>`, `pokedexes/<id>`                         | Same paths, records without text                                                                                                                           |
| `data/indices/*`, `data/codes/*`, `data/metadata/*`                              | Unchanged                                                                                                                                                  |
| `data/boxpresets/classic/<set>.json`                                             | Same path, without names, descriptions and box titles                                                                                                      |
| `data/boxpresets/modern/<set>.json`, `<set>/<id>.json`                           | Same paths, `schemaVersion: 2`, without names, descriptions and box names                                                                                  |
| (none)                                                                           | `data/battle-states.json` (new kind, from Champions)                                                                                                       |
| (none)                                                                           | `data/i18n/<locale>/<kind>.json`, `data/i18n/<locale>/boxpresets/<variant>/<set>.json`                                                                     |
| `data-next/pokemon-texts/<locale>/<id>.md`                                       | `data/i18n/<locale>/pokemon-prose/<id>.md` (npm: `@pokepc/dataset/data/i18n/<locale>/pokemon-prose/<id>.md`)                                               |
| `data-next/languages.json`                                                       | `data/languages.json` (v7 records + `code`; the preview's app-language list is `appLangs` in `lib/languages`)                                              |
| `data-next/champions/pokemon.json`, `moves.json`, `abilities.json`, `items.json` | Merged Champions data: `mergeGameSet` / `loadGameSet('champions')` on npm, `/games/champions/…` on the static API; stored as base + `data/mods/champions/` |
| `data-next/champions/pokemon-moves.json`                                         | Pokémon `learnset` in merged Champions data                                                                                                                |
| `data-next/champions/battle-states.json`                                         | `data/battle-states.json` (base)                                                                                                                           |
| `data-next/champions/i18n/<locale>/<kind>.json`                                  | Merged Champions text: `/games/champions/i18n/<locale>/<kind>.json`, or `merged.text`                                                                      |

### Static API URLs

v7 served each version's files under `data/` and `data-next/`. v8 drops both prefixes. With `<v8>` =
`https://pokepc.github.io/dataset/v8` (or `/latest` while v8 is the latest major, or the root for
the development build):

| v7 URL                                                                | v8 URL                                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `<v7>/data/pokemon/{id}.json`                                         | `<v8>/pokemon/{id}.json` (base record, no text)                                                           |
| `<v7>/data/games/{id}.json`, `pokedexes/{id}.json`                    | `<v8>/games/{id}.json`, `<v8>/pokedexes/{id}.json`                                                        |
| `<v7>/data/{kind}.json`                                               | `<v8>/{kind}.json`                                                                                        |
| `<v7>/data/indices/…`, `codes/…`, `metadata/…`                        | `<v8>/indices/…`, `<v8>/codes/…`, `<v8>/metadata/…`                                                       |
| `<v7>/data/boxpresets/…`                                              | `<v8>/boxpresets/…`                                                                                       |
| Text inside `<v7>/data/…` records                                     | `<v8>/i18n/{locale}/{kind}.json`                                                                          |
| `<v7>/data-next/champions/pokemon.json` (list)                        | `<v8>/games/champions/pokemon/{id}.json` (one file per Pokémon; ids in `<v8>/mods/champions/roster.json`) |
| `<v7>/data-next/champions/{moves,abilities,items,battle-states}.json` | `<v8>/games/champions/{kind}.json`                                                                        |
| `<v7>/data-next/champions/i18n/{locale}/{kind}.json`                  | `<v8>/games/champions/i18n/{locale}/{kind}.json`                                                          |
| `<v7>/data-next/languages.json`                                       | `<v8>/languages.json`                                                                                     |
| (none)                                                                | `<v8>/mods/{set}/…` (mods as stored), `<v8>/i18n/{locale}/pokemon-prose/{id}.md`                          |

Only game sets with mods get a `/games/{set}/` folder: in 8.0.0 that is `/games/champions/`.
`/games/swsh-sw/` never exists and `/games/sv/pokemon/…` returns 404: resolve a version or DLC to
its set through its game record's `gameSet`, and use base data for sets without a folder. Each
version's `openapi.json` lists every path and schema.

### Moved text fields

Records lose these fields; their values live in `i18n/<locale>/<kind>.json` under the entity id. v7
Pokémon text maps keyed by v7 translation keys become one field per locale file.

| Records                                                                     | v7 field                                            | v8 locale file field                                                                    |
| --------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Pokémon                                                                     | `names.<key>`                                       | `name`                                                                                  |
| Pokémon                                                                     | `speciesNames.<key>`                                | `speciesName`                                                                           |
| Pokémon                                                                     | `formNames.<key>`                                   | `formName` (`""` = officially no name)                                                  |
| Pokémon                                                                     | `genus.<key>`                                       | `genus`                                                                                 |
| Pokémon                                                                     | `formsDesc`                                         | `formsDesc` (`eng`)                                                                     |
| Pokémon `evoMethods[i]`                                                     | `notes.<key>`                                       | `evoNotes["i"]`                                                                         |
| Pokémon `formMethods[i]`                                                    | `notes.<key>`                                       | `formNotes["i"]`                                                                        |
| Pokémon `formMethods[i].revert[j]`                                          | `notes.<key>`                                       | `formNotes["i.revert.j"]`                                                               |
| Moves, abilities, Poké Balls                                                | `name`, `shortDesc`, `desc`                         | same names                                                                              |
| Items                                                                       | `name`, `shortDesc`, `desc`                         | same, plus `pluralName`                                                                 |
| Ribbons                                                                     | `name`, `title`, `shortDesc`, `desc`                | same names                                                                              |
| Marks                                                                       | `name`, `title`, `conditions`, `shortDesc`, `desc`  | same names                                                                              |
| Pokédexes                                                                   | `name`, `shortDesc`, `desc`                         | same names                                                                              |
| Pokédex entries with `meta`                                                 | `meta.names`, `meta.speciesNames`, `meta.formNames` | `entries.<meta.id>.name`, `.speciesName`, `.formName`; records gain `meta.id`           |
| Games, characters, colors, locations, natures, origin marks, regions, types | `name`                                              | `name`                                                                                  |
| Personalities                                                               | `shortDesc`                                         | `shortDesc`                                                                             |
| Classic box presets                                                         | `name`, `description`, `boxes[i].title`             | `i18n/<locale>/boxpresets/classic/<set>.json`: `<id>.name`, `.description`, `.boxes[i]` |
| Modern box presets                                                          | `name`, `description`, `boxes[i].name`              | `i18n/<locale>/boxpresets/modern/<set>.json`: `<id>.name`, `.description`, `.boxes[i]`  |

`desc: null` in v7 means the field is absent in v8. Kept non-text identifiers stay in records:
`psName`, game `nameSlug` and `codename`, Pokémon `refs`, mark `chance`/`chanceCharm`, language
`name`/`nameEng`.

### Added fields and kinds

| Record                   | New in v8                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pokémon                  | `championsId` (when in Champions); `learnset` only in merged game set data                                                               |
| Moves                    | `target`, `classification`, `contact`, `championsId`, `pokeApiId`; `usable: false` in merged Champions data for moves Pokémon cannot use |
| Abilities, items         | `championsId`, `pokeApiId` (`null` = PokéAPI has no such resource); items `battleCategories` in merged Champions data                    |
| Languages                | `code` (v8 locale code)                                                                                                                  |
| Pokédex entry `meta`     | `id` (key of its text)                                                                                                                   |
| Modern box presets       | `schemaVersion: 2`                                                                                                                       |
| Battle states (new kind) | `{ id, championsId, state }`, ids are slugs such as `harsh-sunlight`                                                                     |

Moving from the Champions preview: the preview's Pokémon `name` is the species name (`speciesName`
for forms), `pokeApiId`/`pokeApiFormId`/`showdownId` are `refs.pkApiId`/`refs.pkApiFormId`/
`refs.showdown` (strings), `isBattleOnly`/`isCosmetic`/`isFemale` are `isBattleOnlyForm`/
`isCosmeticForm`/`isFemaleForm`, `abilities` are `ability1`/`ability2`/`abilityHidden`/
`abilitySpecial`, item `categories` are `battleCategories`, battle state ids are slugs (the old
numeric id is `championsId`), records lose `slug`/`slugLoc`, and moves with variable damage keep
`power: 0` (the preview had `1`). The preview's `pt-br` text was a copy of English and is not part
of v8.

## Library (`@pokepc/dataset/lib/*`)

| v7 module                                                                    | v8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib-next/*`                                                                 | `lib/*` (`lib-next/schemas` record shapes were the preview; use the v8 `lib/schemas`)                                                                                                                                                                                                                                                                                                                                                                                                   |
| `lib/schemas`                                                                | v8 record schemas (strict, no text) plus override, roster and locale text schemas (`textFileSchemas`, `textSchemas`). `boxPresetSchema` → `classicBoxPresetSchema`, `boxPresetMapSchema` → `classicBoxPresetFileSchema`; `i18nTextSchema` and `boxPresetIndexItemSchema` removed; `pokemonSearchFilterSchema` → `lib/search`                                                                                                                                                            |
| `lib/types`                                                                  | Named type exports (`Pokemon`, `Move`, `Text<'pokemon'>`, …). The global `Pkds.*` names remain as aliases of the v8 types; removed: `Pkds.LegacyBoxPreset*` (→ `ClassicBoxPreset*`), `Pkds.ModernBoxPresetIndex` (→ `string[]`), `Pkds.I18nText`, `Pkds.TranslatedPokemon`/`PokemonNameInfo` (→ `lib/utils`), `Pkds.PokemonSearch*` (→ `lib/search`), `Pkds.Language*` code unions (→ `LanguageId`, `LanguageV7Key`, `LanguageInGameCode`), `Pkds.CdnDataBundle*`, global `CatalogBox*` |
| `lib/fs`                                                                     | `loadAll*()` loaders as before (plus `loadAllBattleStates`); `*Fs` yolodb instances and `join*FilesFromIndex` removed (use `loadAll*()`); `loadAllBoxPresets(variant)` → `loadClassicBoxPresets(set)` / `loadModernBoxPresets(set)`; new `loadText(kind, locale)`, `loadBoxPresetText`, `loadPokemonProse`, `loadGameSet`, `loadGameSetSource`, `listModdedGameSets`                                                                                                                    |
| (none)                                                                       | `lib/merge`: `mergeGameSet`, `applyOverride`, `GameSetMergeError`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lib/utils`                                                                  | `translatePokemon(pokemon, lang)` → `translatePokemon(pokemon, text, locale)`; `translatePokemonList(list, lang)` → `translatePokemonList(list, textFile, locale)`; `translatePokemonText`, `translatePokemonById`, `translatePokemonByNid` removed; `generatePokemonSearchableText(pokemon, texts)`, `generatePokemonDescription(pokemon)`, `generateGameDescription(game, gameName, categoryLabel)`, `resolvePokemonName(pokemon, nickname?)`                                         |
| `lib/search`                                                                 | `createSearchablePokemonList(pokemon)` → `createSearchablePokemonList(pokemon, textFile, locale?, searchTextFiles?)`                                                                                                                                                                                                                                                                                                                                                                    |
| `lib/languages`                                                              | Replaced by the former `lib-next/languages` (`appLangs`, `gameLocales`, `localeCodes`, `localeCodeByV7Key`, …); v7 `pokeLangData`, `supportedPokeLangs*`, `pokemonLangToGameLocale` removed                                                                                                                                                                                                                                                                                             |
| `lib/enums`                                                                  | Superset; Champions item categories are `battleItemCategories` (preview: `itemCategories`)                                                                                                                                                                                                                                                                                                                                                                                              |
| `lib/evolution-schemas`, `lib/form-schemas`                                  | Methods no longer accept `notes`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `lib/validators`, `lib/box-preset-sanitizer`, `lib/box-preset-transform`     | Removed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `lib/codes`, `lib/constants`, `lib/form-methods`, `lib/availability-sources` | Unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Code samples

### Reading base data and English text

```ts
// v7
import pikachu from '@pokepc/dataset/data/pokemon/pikachu' with { type: 'json' }
console.log(pikachu.names.eng, pikachu.baseSpeed)
```

```ts
// v8
import pikachu from '@pokepc/dataset/data/pokemon/pikachu' with { type: 'json' }
import pokemonText from '@pokepc/dataset/data/i18n/eng/pokemon' with { type: 'json' }
console.log(pokemonText.pikachu?.name ?? pikachu.id, pikachu.baseSpeed)
```

### Reading text for a locale (Node)

```ts
// v7
import { loadAllPokemon } from '@pokepc/dataset/lib/fs'
const names = loadAllPokemon().map((p) => p.names.jap ?? p.names.eng)
```

```ts
// v8
import { loadAllPokemon, loadText } from '@pokepc/dataset/lib/fs'
const japanese = loadText('pokemon', 'jpn')
const english = loadText('pokemon', 'eng')
// Missing text stays missing; the English fallback is your choice.
const names = loadAllPokemon().map((p) => japanese[p.id]?.name ?? english[p.id]?.name ?? p.id)
```

### Search

```ts
// v7
import { createSearchablePokemonList, searchPokemon } from '@pokepc/dataset/lib/search'
const results = searchPokemon(createSearchablePokemonList(pokemon), { q: 'pika' })
```

```ts
// v8
import { loadText } from '@pokepc/dataset/lib/fs'
import { createSearchablePokemonList, searchPokemon } from '@pokepc/dataset/lib/search'
const list = createSearchablePokemonList(pokemon, loadText('pokemon', 'eng'))
const results = searchPokemon(list, { q: 'pika' })
```

### Merging a game set (npm)

```ts
// v7 (preview)
import championsPokemon from '@pokepc/dataset/data-next/champions/pokemon' with { type: 'json' }
```

```ts
// v8, Node: read and merge from the installed package
import { loadGameSet } from '@pokepc/dataset/lib/fs'
const champions = loadGameSet('champions', { locales: ['eng'] })
const garchomp = champions.records.pokemon?.find((p) => p.id === 'garchomp')
console.log(garchomp?.learnset, champions.text.eng?.moves?.earthquake?.desc)
```

```ts
// v8, any runtime: merge data you already have
import { mergeGameSet } from '@pokepc/dataset/lib/merge'
import { movesOverridesSchema, movesSchema, rosterSchema } from '@pokepc/dataset/lib/schemas'
import rosterJson from '@pokepc/dataset/data/mods/champions/roster' with { type: 'json' }
import movesJson from '@pokepc/dataset/data/moves' with { type: 'json' }
import moveOverridesJson from '@pokepc/dataset/data/mods/champions/moves' with { type: 'json' }
// JSON imports are typed loosely (strings instead of enums); parse them into v8 types first.
const { records } = mergeGameSet({
  base: { moves: movesSchema.parse(movesJson) },
  mods: {
    roster: rosterSchema.parse(rosterJson),
    overrides: { moves: movesOverridesSchema.parse(moveOverridesJson) },
  },
})
```

`mergeGameSet` validates merged records and throws `GameSetMergeError` when mods reference ids
outside the set.

### Fetching from the static API

```ts
// v7
const base = 'https://pokepc.github.io/dataset/v7'
const pikachu = await (await fetch(`${base}/data/pokemon/pikachu.json`)).json()
console.log(pikachu.names.eng)
```

```ts
// v8
const base = 'https://pokepc.github.io/dataset/v8'
const pikachu = await (await fetch(`${base}/pokemon/pikachu.json`)).json()
const text = await (await fetch(`${base}/i18n/eng/pokemon.json`)).json()
console.log(text.pikachu?.name)

// Merged data of a game set with mods
const garchomp = await (await fetch(`${base}/games/champions/pokemon/garchomp.json`)).json()
const champText = await (await fetch(`${base}/games/champions/i18n/eng/moves.json`)).json()
```

Validate fetched JSON with the v8 schemas (`pokemonSchema.parse(pikachu)`) when you need guarantees.

## Agent playbook

Follow these steps to migrate a codebase. Do not guess paths or fields: read them from the installed
v8 package (`lib/schemas`, `lib/types`) or the v8 `openapi.json`.

1. **Pin.** Make sure the project installs `@pokepc/dataset@^8` (or `/v8/` URLs) only when you are
   ready; until then keep `^7` and `/v7/`.
2. **Find usages.** Run each search (ripgrep syntax) from the project root and keep the hit list:

   ```sh
   rg -n "@pokepc/dataset/(data-next|lib-next)/"
   rg -n "@pokepc/dataset/(data|lib)/"
   rg -n "pokepc\.github\.io/dataset"
   rg -n "/data(-next)?(/|['\"`])"
   rg -n "\.(names|speciesNames|formNames|genus|formsDesc)\b"
   rg -n "\.(name|shortDesc|desc|title|conditions|description)\b"
   rg -n "['\"](esp|esla|jap|por)['\"]"
   rg -n "\b(itemsFs|pokeballsFs|abilitiesFs|movesFs|charactersFs|ribbonsFs|marksFs|originMarksFs|typesFs|naturesFs|personalitiesFs|regionsFs|locationsFs|colorsFs|languagesFs|generationsFs)\b"
   rg -n "\b(join(Pokemon|Games|Pokedexes|BoxPreset)FilesFromIndex|loadAllBoxPresets|translatePokemonText|translatePokemonById|translatePokemonByNid|pokeLangData|supportedPokeLangs|pokemonLangToGameLocale)\b"
   rg -n "\b(LegacyBoxPreset\w*|ModernBoxPresetIndex|I18nText|TranslatedPokemon|PokemonNameInfo|PokemonSearch(Filter|Results)|CdnDataBundle\w*|CatalogBox\w*|LanguageAlpha[23])\b"
   rg -n "\b(boxPresetSchema|boxPresetMapSchema|i18nTextSchema|boxPresetIndexItemSchema|pokemonSearchFilterSchema)\b"
   rg -n "schemaVersion:\s*1|\.notes\b|itemCategories"
   ```

   The URL searches find base URLs (check their version prefix) and `/data/` or `/data-next/` path
   segments appended to them. The `.name`/`.desc` search is broad: keep only hits on dataset records
   (Pokémon, moves, items, games, Pokédexes, presets, …).

3. **Classify each hit**: base data (game-independent) or one game set's data. Only the latter uses
   merged data (`/games/{set}/…` or `mergeGameSet`/`loadGameSet`), and only for sets with mods.
4. **Rewrite imports and URLs** with the [data](#data-files-npm-pokepcdatasetdata-and-static-api)
   and [library](#library-pokepcdatasetlib) tables. Replace `data-next/*` and `lib-next/*` with
   `data/*` and `lib/*`; drop the `/data/` URL prefix.
5. **Move text access** to locale files using the [moved fields](#moved-text-fields) and
   [locale code](#locale-codes) tables. Load each needed locale file once and look entities up by
   id. Handle missing text explicitly; v8 never substitutes another language.
6. **Update writers** (tools that create presets or Pokédexes): write text to the locale files and
   records without text; modern presets need `schemaVersion: 2`, Pokédex `meta` entries need `id`.
7. **Keep stored values.** Ids, `nid` and code-map codes are unchanged; no database migration is
   needed for them. Stored v7 locale keys (`jap`, `esp`, `esla`, `por`) need mapping with
   `localeCodeByV7Key`.
8. **Verify.**
   - Re-run every search in step 2; remaining hits must be intentional (non-dataset `.name` etc.).
   - Type-check against the v8 package (`tsc --noEmit`): removed fields and modules fail to compile.
   - Parse a sample of loaded or fetched records with the v8 schemas (`pokemonSchema.parse`, …);
     strict schemas reject leftover text fields.
   - Run the project's tests and compare rendered names for a few Pokémon, forms (e.g.
     `venusaur-mega`) and a non-English locale.

## References

- Static API reference: each version's `openapi.json`
  (`https://pokepc.github.io/dataset/v8/openapi.json`)
- Data model:
  [v8 architecture](https://github.com/pokepc/dataset/blob/main/backlog/docs/doc-2%20-%20v8-data-next-architecture.md)
- Code maps:
  [rules](https://github.com/pokepc/dataset/blob/main/backlog/docs/reference/doc-3%20-%20Code-maps.md)

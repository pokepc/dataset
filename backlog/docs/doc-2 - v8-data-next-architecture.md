---
id: doc-2
title: v8 data-next architecture
type: specification
created_date: '2026-09-30 23:58'
updated_date: '2026-10-01 01:47'
---
Working description of the v8 data model that replaces `data/` and `src/lib`. The decision and its
consequences are in
[decision-2](../decisions/decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md).
This page records what exists today and what is still open; update it as the model settles.

## Goals

- **Per game set**: records describe an entity as a specific game set has it (stats, moves,
  learnsets, abilities, items), instead of one "latest" value. A game set id is the game's
  `gameSet` (e.g. `swsh`, `sv`), or its game id when it has none (e.g. `champions`). DLCs
  belong to their parent set.
- **Translated**: every user-facing string is available in every supported language.
- **Linked**: records keep dataset string ids and carry upstream ids (`championsId`, `pokeApiId`)
  when known; `pokeApiId` is `null` when PokéAPI has no such resource, never guessed.
- **Replaces v7**: at the v8 release, `data-next/` and `lib-next` become the package's primary
  `data/` and `lib` surface.

## Target layout

Inspired by Pokémon Showdown's base data plus per-mod overrides, but with this dataset's schemas:

```text
data-next/
  pokemon/<id>.json             base records (game-independent), likewise for moves, items, …
  mods/<set>/pokemon/<id>.json  sparse overrides: only fields that set changes
  mods/<set>/…                  same per entity kind
  i18n/<locale>/moves.json      base text; records themselves hold no text
  mods/<set>/i18n/<locale>/…    only text that differs in that set
```

`data-next/` (base + mods) is the source of truth (curated or generated from upstreams) and what npm ships. The build merges base and
mods into full per-set data for the static API only:

| Static API path                  | Contents                               |
| -------------------------------- | -------------------------------------- |
| `/pokemon/{id}.json`             | Base record, at the root (no `/base/`) |
| `/games/{set}/pokemon/{id}.json` | Fully merged record for that game set  |
| `/games/{set}/i18n/{locale}/…`   | Merged text for that game set          |
| `/games/{set}.json`              | The game record, unchanged             |

URLs say `games` rather than `gamesets` because it is more familiar to users; `{set}` is still the
game set id. Only set ids are published: `/games/swsh/` exists, `/games/swsh-sw/` does not, so clients
map a version or DLC to its `gameSet` themselves. The OpenAPI spec documents these paths.

`lib-next` exports the same merge function the build uses, so npm consumers get results identical
to the static API.

## Current layout

```text
data-next/
  languages.json              app languages (browser locale, game locale, slug)
  champions/                  first game set (Pokémon Champions)
    pokemon.json              477 records with stats, types, abilities, form flags, upstream ids
    pokemon-moves.json        learnsets
    moves.json abilities.json items.json battle-states.json
    i18n/<locale>/            per in-game locale: names, plural names, description templates
  pokemon-texts/<lang>/       game-independent species prose (Markdown), e.g. eng/, deu/
```

In-game locale directories: `chs`, `cht`, `deu`, `eng`, `es-es`, `es-la`, `fra`, `ita`, `jpn`,
`kor`. Language identifiers (browser locales, in-game codes, URL slugs) are defined in
`src/lib-next/languages.ts`; schemas and enums in `src/lib-next/schemas.ts` and `enums.ts`.

## Build

`pnpm build:next` (`src/lib-next/_build.ts`, run with Bun):

1. `projectpokemon-champout` adapter parses the Champions game dump (`src/upstreams/`, Git
   submodule) into `champions/` and its `i18n/` files. Source file mapping:
   `src/upstream-adapters/projectpokemon-champout/README.md`.
2. `pokeapi` adapter enriches Champions records with PokéAPI ids.
3. Writes `languages.json`.

`pnpm generate:pokemon-prose` separately generates `pokemon-texts/` with an LLM from all game prose.
`data-next/*` and `lib-next/*` are already exported and deployed to Pages as an unstable preview.

## Resolved (2026-10-01)

- **Base + overrides**: each entity has one game-independent base record (species identity,
  lifecycle, curated availability, evolutions, forms). Game sets store only per-set differences
  (stats, learnsets, abilities, items, moves) as overrides keyed by the same ids, under
  `mods/<set>/`.
- **Game set ids**: `gameSet`, falling back to the game id; DLCs override within their parent set.
- **Merged views**: generated at build time for the static API only (`/games/{set}/…`); npm ships
  base + mods plus the merge function in `lib-next`.
- **Translations**: separate per-locale files, base under `i18n/<locale>/` and per-set differences
  under `mods/<set>/i18n/<locale>/`.
- **URLs**: only set ids under `/games/{set}/`; no per-version or DLC copies. Game records stay at
  `/games/{id}.json` beside the `/games/{set}/` folder.
- **Champions migration**: a one-time script splits today's full `champions/` records into base +
  `mods/champions/`.
- **Champions upkeep**: the Champions game-dump adapter stays and keeps parsing upstream data, but
  now writes `mods/champions/` (overrides relative to base) instead of full records. A maintainer
  runs it manually after an upstream update and reviews the resulting diff before committing; it
  is not run automatically by the build.
- **No translation fallback**: a string without official text for a language or game set is left
  missing. Consumers choose their own fallback; the dataset never substitutes another language or
  game set.
- **Code maps carry over**: one global map per entity kind across all game sets, continuing the v7
  maps unchanged ([decision-1](../decisions/decision-1%20-%20Append-only-numeric-code-maps-for-stored-ids.md)).
  New v8 ids are appended.
- **Hard cut**: v8 removes `data/` and `lib/`. v7 stays available on npm 7.x and `/v7/` on Pages.
  The editor moves to the v8 model as part of the release.

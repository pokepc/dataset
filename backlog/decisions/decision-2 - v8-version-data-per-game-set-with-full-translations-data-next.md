---
id: decision-2
title: 'v8: version data per game set with full translations (data-next)'
date: '2026-10-01 00:01'
status: implemented
---
## Context

`data/` holds a single "latest" view of every entity. Values that differ between games (stats,
moves, abilities, items, learnsets) can only express the newest state, and most text is English-only.
Consumers that care about a specific game, or need localized names and descriptions, cannot get
them from the dataset.

## Decision

The next major release (v8) replaces `data/` and the `src/lib` schemas and types with the
`data-next/` model built by `src/lib-next`:

- Data is versioned by game set (the `gameSet` of `data/games/*.json`) as **base + overrides**:
  one game-independent base record per entity, plus per-set overrides holding only what that set
  changes (stats, learnsets, abilities, items, moves), in the spirit of Pokémon Showdown mods:
  `data-next/pokemon/<id>.json` and `data-next/mods/<set>/pokemon/<id>.json`. A set id is the
  game's `gameSet`, or its game id when it has none. Champions is the first set; its upstream
  adapter keeps parsing the game dumps and writes `mods/champions/`, run manually and reviewed by a
  maintainer.
- npm ships base + mods and `lib-next` exports the merge function. The build uses that function to
  publish full per-set data on the static API only: base at the root (`/pokemon/{id}.json`) and
  merged data under `/games/{set}/pokemon/{id}.json` (`games` in URLs because users know games
  better than game sets). Only set ids get folders; versions and DLCs do not.
- Everything user-facing is translatable. Records hold no text: it lives in per-locale files,
  `i18n/<locale>/` for base and `mods/<set>/i18n/<locale>/` for per-set differences;
  game-independent prose (species summaries) under `pokemon-texts/<lang>/`. Missing official text
  is omitted, never filled from another language or game set; consumers pick their own fallback.
- Records keep the dataset's string ids and link to upstream ids (`championsId`, `pokeApiId`) where
  they exist. The v7 code maps continue as one global map per entity kind.
- **Hard cut**: v8 drops `data/` and `lib/` with no deprecated copy. The editor moves to the v8
  model as part of the release.

Status: implemented for 8.0.0 (milestone `m-0`). The preview's `data-next/` and `lib-next` became
the package's `data/` and `lib/`; paths above read accordingly (`data/pokemon/<id>.json`,
`data/mods/<set>/pokemon/<id>.json`, `lib/merge`; prose is in `data/i18n/<locale>/pokemon-prose/`).
Shipped model:
[v8 architecture](../docs/doc-2%20-%20v8-data-next-architecture.md); consumer migration:
[`docs/migrating-to-v8.md`](../../docs/migrating-to-v8.md).

## Consequences

- v8 is a breaking release: `@pokepc/dataset/data/*` and `lib/*` imports are replaced, and the
  static API paths change accordingly. v7 consumers stay on npm 7.x, and `/v7/` stays deployed
  ([decision-3](decision-3%20-%20Versioned-GitHub-Pages-deployment-per-stable-major.md)).
- Consumers needing a single view of a game set must merge base and overrides (or use whatever
  merged output or helpers v8 provides), and must handle missing translations themselves.
- Until the cut-over, `data/` remains the maintained source of truth; curated knowledge there
  (availability, evolutions, forms, lifecycle) must be carried into the new model, not lost.
- Code maps ([decision-1](decision-1%20-%20Append-only-numeric-code-maps-for-stored-ids.md)) must
  survive the migration with unchanged meanings; new v8 ids get appended codes.

## Follow-up decisions

- [decision-4](decision-4%20-%20v8-locale-codes-and-language-records.md): v8 locale codes and
  language records.
- [decision-5](decision-5%20-%20Merged-static-API-output-only-for-game-sets-with-mods.md): merged
  static API output only for game sets with mods.

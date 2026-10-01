---
id: doc-21
title: v7 to v8 migration guide
type: guide
created_date: '2026-10-01 03:11'
updated_date: '2026-10-01 03:11'
---
> **Draft.** v8 is not released. Sections marked **Pending** depend on open milestone `m-0` tasks
> and will be filled in before 8.0.0. Everything else is decided
> ([decision-2](../../decisions/decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md)).

This guide is for consumers of `@pokepc/dataset` on npm and of the static JSON API on GitHub Pages
(`https://pokepc.github.io/dataset/`). It is written for human developers and coding agents: each
change has a before/after mapping, and the [agent playbook](#agent-playbook) lists the exact steps.

## Summary

- v8 stores every entity once as a **base** record, plus **mods**: per-game-set overrides holding only
  what that game set changes. Pokémon Champions is the only game set with mods in 8.0.0.
- Records no longer contain text. Names, descriptions and other user-facing strings live in
  **per-locale files**.
- The static API also publishes **merged** data per game set under `/games/{set}/`. npm ships base +
  mods and a merge function instead.
- `data-next/*` and `lib-next/*` (the v7 preview of this model) are gone; their content is now
  `data/*` and `lib/*`.
- Ids, `nid`, `gen`, the code maps and every other kept property have the same names and meanings.

## Before you migrate: pin v7

v7 stays available, but unversioned entry points switch to v8.

| You use                                  | Risk                                                          | Pin to                                  |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------- |
| npm `@pokepc/dataset`                    | `^7` stays on v7; `latest`, `*` or `>=7` install v8           | `"@pokepc/dataset": "^7"`               |
| `https://pokepc.github.io/dataset/`      | Follows the default branch, which is already the v8 workspace | `https://pokepc.github.io/dataset/v7/`  |
| `https://pokepc.github.io/dataset/latest/` | Switches to v8 when 8.0.0 is tagged                         | `https://pokepc.github.io/dataset/v7/`  |

v7 fixes are released from the `7.x` branch as 7.x versions.

## What stays the same

- Entity ids (`pikachu-alola`, `swsh`, `ribbon-…`) and `nid` values.
- Non-text properties keep their names and meanings (`gen`, `type1`, `baseHp`, `obtainableIn`,
  `storableIn`, `evoMethods`, `formMethods`, …). A property is removed or moved, never repurposed.
- Code maps (`data/codes/*.json`): same codes for the same ids, same append-only rules. New v8 ids get
  new codes appended.
- Game records still describe games, versions, sets and DLCs; a version's `gameSet` names its set.

## Concepts

| Term        | Meaning                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Base record | The game-independent record of an entity (identity, lifecycle, curated availability, evolutions, forms) |
| Game set    | A game's `gameSet` (e.g. `swsh`, `sv`), or the game id when it has none (e.g. `champions`). DLCs belong to their parent set |
| Mod         | Sparse overrides for one game set, stored under `mods/<set>/`, plus that set's roster            |
| Merged data | Base + a set's mods + its text; what the entity looks like in that game set                      |
| Locale file | Text for one locale, under `i18n/<locale>/` (base) or `mods/<set>/i18n/<locale>/` (set-specific) |

Missing official text is **omitted**, never filled from another language or game set. Choose your
own fallback (for example, English).

## npm package

| v7                                                   | v8                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `@pokepc/dataset/data/pokemon/<id>` (record + text)  | `@pokepc/dataset/data/pokemon/<id>` (base record, no text)              |
| Text inside records, e.g. `pokemon.names.eng`        | Locale files under `@pokepc/dataset/data/i18n/<locale>/…`               |
| `@pokepc/dataset/lib/schemas`, `lib/types`           | `@pokepc/dataset/lib/*` with v8 schemas and types                        |
| `@pokepc/dataset/data-next/*`, `lib-next/*` (preview) | Removed; use `data/*` and `lib/*`                                       |
| No per-game data                                     | Merge function exported from `lib/*`: base + mods + text for a game set |

**Pending** ([task-1](../../tasks/task-1%20-%20Finalize-the-v8-storage-spec.md),
[task-3](../../tasks/task-3%20-%20Implement-the-base-mods-merge-function.md)): which
kinds become one file per entity vs a collection file (v7 `moves.json`, `abilities.json`, …), the
locale file shapes, the merge function's name and signature, and the before/after code samples.

## Static API

v7 serves each version's files under `data/`, e.g.
`https://pokepc.github.io/dataset/v7/data/pokemon/pikachu.json`. In v8 (`/v8/`, and `/latest/`
after release):

| Content                        | v8 path                                   |
| ------------------------------ | ----------------------------------------- |
| Base record                    | `/pokemon/{id}.json`                      |
| Merged record for a game set   | `/games/{set}/pokemon/{id}.json`          |
| Merged text for a game set     | `/games/{set}/i18n/{locale}/…`            |
| Game record                    | `/games/{id}.json` (unchanged meaning)    |

Only game **set** ids get `/games/{set}/` folders: `/games/swsh/` exists, `/games/swsh-sw/` and
`/games/swsh-islearmor/` do not. Resolve a version or DLC to its set through its game record's
`gameSet`. Each version's `openapi.json` remains the authoritative list of paths and schemas.

**Pending** ([task-11](../../tasks/task-11%20-%20Publish-v8-static-API-and-OpenAPI.md)): the exact path
prefix relative to `/v8/` (whether `data/` remains), and the full list of entity kinds and i18n files.

## Field changes

Text fields move from records to locale files. Expected moves (confirmed by
[task-1](../../tasks/task-1%20-%20Finalize-the-v8-storage-spec.md)):

| Records                         | v7 text fields                               |
| ------------------------------- | -------------------------------------------- |
| Pokémon                         | `names`, `speciesNames`, `formNames`, `genus` |
| Moves, abilities, items, ribbons | `name`, `desc`, `shortDesc` (ribbons: `title`) |
| Games, Pokédexes, natures, types | `name`                                       |

Locale codes are unified. Expected mapping:

| v7 key | v8 locale |
| ------ | --------- |
| `eng`  | `eng`     |
| `esp`  | `es-es`   |
| `esla` | `es-la`   |
| `fra`  | `fra`     |
| `deu`  | `deu`     |
| `ita`  | `ita`     |
| `jap`  | `jpn`     |
| `kor`  | `kor`     |
| `chs`  | `chs`     |
| `cht`  | `cht`     |

## Agent playbook

Follow these steps when migrating a codebase from v7 to v8. Do not guess paths or field names; read
them from the installed v8 package's schemas or the v8 `openapi.json`.

1. **Find usages.** Search the codebase for:
   - `@pokepc/dataset/data/`, `@pokepc/dataset/lib/`, `@pokepc/dataset/data-next/`,
     `@pokepc/dataset/lib-next/`
   - `pokepc.github.io/dataset/` (note which version prefix each URL uses)
   - text fields: `.names`, `.speciesNames`, `.formNames`, `.genus`, `.desc`, `.shortDesc`
   - v7 locale keys: `'esp'`, `'esla'`, `'jap'`
2. **Decide per usage** whether it needs base data (game-independent) or one game set's data. Use
   merged data (`/games/{set}/…`, or the merge function on npm) only for the latter.
3. **Update imports and URLs** with the [npm](#npm-package) and [static API](#static-api) tables.
   Replace `data-next/*` and `lib-next/*` with `data/*` and `lib/*`.
4. **Move text access** to locale files, mapping locale keys with the table above. Handle missing
   text explicitly; v8 never substitutes another language.
5. **Keep stored values.** Ids, `nid` and code-map codes are unchanged; no database migration is
   needed for them.
6. **Verify.** Type-check against the v8 types, validate fetched JSON with the v8 schemas, and run
   the project's tests.

## References

- [v8 data-next architecture](../doc-2%20-%20v8-data-next-architecture.md) — the model in detail
- [Code maps](../reference/doc-3%20-%20Code-maps.md)
- [Versioned Pages deployment](../../decisions/decision-3%20-%20Versioned-GitHub-Pages-deployment-per-stable-major.md)

---
id: decision-1
title: Append-only numeric code maps for stored ids
date: '2026-10-01 00:01'
status: accepted
---
## Context

Dataset ids are string slugs (`pikachu-alola`, `ribbon-champion`). Large consumer databases, such as
the one behind [pokepc.net](https://pokepc.net), store per-Pokémon moves, ribbons, marks and
Pokédex registrations for many records. Storing slugs for each of those is wasteful; small integers
and bitmaps are far cheaper, but only if an integer keeps the same meaning across every dataset
release that a stored value may have been written with.

## Decision

Keep append-only code maps in `data/codes/` (`pokemon.json`, `ribbons.json`, `marks.json`,
`moves.json`) that assign each id a dense integer code. A released code never changes id, is never
removed and is never reused; ids that leave the dataset stay as `retired` entries, optionally with
`replacedBy`. `pnpm codes:sync` maintains the maps and `tests/data-integrity-tests/codes.test.ts`
enforces the rules, including comparison with the last published release.

Implemented in 7.5.0. Rules and workflow: [Code maps](../docs/reference/doc-3%20-%20Code-maps.md).

## Consequences

- Consumers can store moves as small integer arrays and ribbons, marks and dex registrations as
  bitmaps, keyed by code.
- Adding, renaming or removing a Pokémon, ribbon, mark or move must be followed by `pnpm codes:sync`;
  existing entries are never hand-edited or reordered.
- Renames retire the old code and allocate a new one, so consumers need a migration step when they
  want to follow a rename.
- The v8 data model ([decision-2](decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md))
  must carry these codes forward unchanged.

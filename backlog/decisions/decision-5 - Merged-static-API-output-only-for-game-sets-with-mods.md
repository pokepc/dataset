---
id: decision-5
title: Merged static API output only for game sets with mods
date: '2026-10-01 04:44'
status: accepted
---
## Context

The v8 static API publishes merged per-set data under `/games/{set}/`
([decision-2](decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md)).
In 8.0.0 only Champions has mods. For every other set the merged data would be a full copy of base:
roughly 30 extra copies of the Pokémon files per deployed version, and an implied promise that
those sets were curated per game when they were not.

## Decision

Only game sets with a `mods/<set>/` directory get merged output and a `/games/{set}/` folder.
Base data at the root is the answer for every other set. When a set gains mods, its folder appears.

## Consequences

- 8.0.0 publishes `/games/champions/` only; `/games/sv/pokemon/…` returns 404.
- Clients check the OpenAPI document or fall back to base data for sets without a folder.
- Publishing a new set is additive and non-breaking.
- npm consumers can still call the merge function for any set; without mods it returns base data.


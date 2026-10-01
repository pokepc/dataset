---
id: TASK-11
title: Publish v8 static API and OpenAPI
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 06:00'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-3
  - TASK-7
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Direct JSON clients need the v8 layout on GitHub Pages: base data at the root and fully merged data per game set under `/games/{set}/`, documented by OpenAPI. URLs use `games` because users know games better than game sets; only set ids get folders.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Pages build publishes base data at the root, e.g. `/pokemon/{id}.json`
- [x] #2 Merged per-set data is published under `/games/{set}/…`, including `/games/{set}/i18n/{locale}/…`, using the exported merge function
- [x] #3 Game records stay at `/games/{id}.json`; versions and DLCs get no `/games/{id}/` folders
- [x] #4 The OpenAPI document describes the v8 paths and schemas
- [x] #5 Versioned builds of v6 and v7 tags are unaffected
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pages artifact: copy data/ to the root (base, i18n, mods), then write merged /games/{set}/ for sets with mods via mergeGameSet (writeMergedGameSets).
2. OpenAPI: v8 paths without /data, per-kind text schemas, box preset text, prose (text/markdown), mods, merged game sets, code maps; link the migration guide in the description.
3. Pages assembly accepts v8 artifacts (base at root) next to v6/v7 artifacts (data/); tests for both layouts and for merged output.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
build:pages output: base at root, only games/champions/ as a merged folder (477 Pokémon, moves/abilities/items/battle-states lists, text for 10 locales); 69 documented paths, all resolving except per-kind mod files Champions does not have (documented 404s).
OpenAPI links docs/migrating-to-v8.md on GitHub; the file itself lands with TASK-13.
v6/v7 Pages builds run their own tags' build:pages, so they are unaffected; the assembler now only requires index.html, openapi.json and either data/ or pokemon/.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The v8 Pages artifact serves base data, locale text and mods at the root and merged per-set data under /games/{set}/ (only sets with mods: champions) using the exported merge function; game records stay at /games/{id}.json. The OpenAPI document describes all v8 paths and schemas and links the migration guide. Versioned assembly handles v8 roots beside v6/v7 data/ builds. Verified: pnpm build:pages, documented-path resolution check, vitest src/openapi + src/pages 22 passed (incl. mixed-layout Pages assembly and merged output), tsc clean.
<!-- SECTION:FINAL_SUMMARY:END -->

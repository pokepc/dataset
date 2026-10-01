---
id: TASK-3
title: Implement the base + mods merge function
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 04:55'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-2
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The static API publishes fully merged per-set data, and npm consumers must be able to produce identical results. One merge function, exported from the library and used by the build, guarantees that.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The library exports a function that merges base records, a game set's mods and its i18n files into that set's full data
- [x] #2 Merged output respects the set's roster and the documented override and removal semantics
- [x] #3 Missing translations stay missing; no fallback to another language or game set
- [x] #4 Merged records validate against the v8 schemas
- [x] #5 Unit tests cover overrides, removals, roster filtering and missing text
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pure mergeGameSet in src/lib-next/merge.ts: roster filter in base order, per-record override (replace + $unset), per-locale text merge limited to roster ids, schema validation, explicit errors for out-of-set references.
2. Node loader loadGameSetSource/listModdedGameSets in src/lib-next/fs.ts reading base, i18n and mods/<set>/.
3. Unit tests with fixtures and a temp data dir; document the API in doc-2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merge only covers moddable kinds (pokemon, moves, abilities, items, battle-states); other kinds are global. Merged text follows merged record order; locales follow localeCodes order. Shared test records live in src/lib-next/__fixtures__/ (outside the tsdown entry glob).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added mergeGameSet (pure, lib-next/merge) plus applyOverride/applyTextOverride and GameSetMergeError, and the Node loader loadGameSetSource/listModdedGameSets (lib-next/fs). Merging respects roster (base order, unlisted kinds whole, [] excludes), override replacement and $unset, mod text per field, never falls back to other locales, and validates merged records. Verified: tsc clean; vitest src/lib-next 32 passed (overrides, removals, roster, missing text, error cases, on-disk loader).
<!-- SECTION:FINAL_SUMMARY:END -->

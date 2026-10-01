---
id: TASK-6
title: Make the Champions tool maintain mods/champions
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 05:12'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-3
  - TASK-5
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Champions keeps receiving updates. The Project Pokémon `champout` adapter must keep parsing upstream data so the dataset stays current with little manual effort, but it should now produce overrides instead of full records, and a maintainer must review its output before it lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A manual command parses the latest Champions game dump and writes `mods/champions/` (overrides relative to base) and Champions i18n files
- [x] #2 PokéAPI id enrichment still runs as part of the command
- [x] #3 Running it with unchanged upstream data produces no diff
- [x] #4 The command no longer runs as part of `pnpm build`
- [x] #5 The maintainer workflow (update submodule, run, review diff) is documented
- [x] #6 Adapter tests use fixtures only (no network)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the preview writer (writeBuiltData, English copy into pt-br) and the build:next pipeline (_build.ts, adapter build entrypoints).
2. Make PokéAPI enrichment work on in-memory records.
3. Add pnpm champions:update (update.ts): parse dump -> enrich -> championsToV8 -> writeChampionsV8 -> merge and diff against the dump.
4. Fixture-only tests for conversion rules, idempotent writes and locale mapping; document the maintainer workflow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Real run against the current submodule and PokéAPI: 'No changes.' (AC3). Unmatched PokéAPI resources (3 abilities, 39 items, 1 move) stay null, as before.
build, build:pages no longer regenerate Champions data. Removed the stale build:next note from the add-pokedex skill (.claude/skills links to .agents/skills).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pnpm champions:update: parses the champout dump, enriches with PokéAPI ids in memory, writes mods/champions and the base facts Champions owns (only changed files), then verifies the merged set reproduces the dump. Removed build:next and the preview writer (incl. the English copy into pt-br). Workflow documented in the adapter README and doc-2. Verified: real run reports no changes; to-v8 fixture tests (8) cover rules, idempotent writes and locale mapping; tsc clean; full vitest 9429 passed.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: TASK-7
title: Remove the -next directories
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 05:24'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-4
  - TASK-5
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: chore
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
v8 replaces the v7 layout entirely (hard cut, no deprecated copy). `data-next/` and `src/lib-next` must become the only `data/` and `src/lib`, and the package must stop exposing `-next` paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `data-next/` and `src/lib-next/` no longer exist; their v8 content lives in `data/` and `src/lib/`
- [x] #2 v7-only modules and data files are removed
- [x] #3 package.json `exports`, `files` and scripts, tsdown config and build scripts reference no `-next` paths
- [x] #4 `pnpm build`, `pnpm typecheck` and `pnpm lint` pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace v7 data/ with data-next/ content; move src/lib-next modules over src/lib (enums, schemas, types, fs, languages, method schemas, merge).
2. Remove v7-only modules (validators, classic->modern box preset transform/sanitizer + one-off), applied one-offs (v7->v8 migration, Champions split, forms/evolutions migrations, PokéAPI game ids) and the yolodb dependency.
3. Consolidate lib/fs (v8 loaders, text, box presets, prose, code maps, game sets), port utils/search to explicit locale text, keep Pkds global aliases.
4. Repoint package exports/files, tsdown, Pages/OpenAPI build and workflow; fix every consumer that broke (Bulbapedia CLIs, locations import, champout parser, integrity tests).
5. Verify build, typecheck, lint and the full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ports done here to keep main compiling and green: Bulbapedia CLIs read English names from i18n/eng; locations:import writes locations.json + i18n/eng/locations.json; champout parser reads English names from i18n/eng (champions:update still reports 'No changes.'); integrity tests read text from locale files; the audited form-transition digest still matches exactly with formNotes re-attached.
Package exports gain ./data/*.md for prose. apps/editor still targets v7 APIs and is not compiled by the root typecheck: TASK-9.
Docs still mentioning removed scripts (doc-8 evolutions migration, doc-9 forms migration) are for TASK-12.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
data-next/ and src/lib-next/ are now data/ and src/lib/; v7-only modules, applied one-offs and yolodb are gone; package exports/files, tsdown, Pages build and workflow reference no -next paths. Consumers ported to locale text (Bulbapedia, locations, champout, tests), lib/utils and lib/search take explicit text, Pkds kept as aliases. Verified: pnpm build, pnpm lint (publint + tsc) and full vitest (9380 passed) pass; champions:update reports no changes.
<!-- SECTION:FINAL_SUMMARY:END -->

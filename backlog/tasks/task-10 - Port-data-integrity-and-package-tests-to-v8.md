---
id: TASK-10
title: Port data-integrity and package tests to v8
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 05:56'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-7
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: task
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The data-integrity suite guards the dataset contract and is written against v7 files. It must validate the v8 base, mods and merged output so regressions are caught before release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every data-integrity test runs against v8 base data, or is removed with a documented reason
- [x] #2 Tests validate `mods/champions/` and the merged Champions set
- [x] #3 Code-map tests still compare against the last published release
- [x] #4 The package smoke test imports the v8 exports
- [x] #5 `pnpm test` passes offline
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the existing integrity tests on v8 loaders (ported with TASK-7) and add suites for: every collection kind and entity index (collections), locale files, notes, Pokédex entry text, box preset text and prose (i18n), and mods/champions plus the merged Champions set (mods).
2. Pin @pokepc/dataset-released to 7.5.0 (doc-3 workflow) so code maps compare with the last published release.
3. Port the package smoke test to v8 exports (records + locale files, lib/fs text, mergeGameSet, loadGameSet, Markdown prose export).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
No integrity test was removed. New coverage: 38 collection/index tests, 216 i18n tests (incl. the 'special method needs an English note' rule moved out of the schemas; no such methods exist today), 15 mods/merged Champions tests. Release comparison was previously skipped (alias not installed); now 13 code-map tests run against 7.5.0.
Smoke project now copies @types/node (+undici-types) because it exercises the Node-only lib/fs loaders.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Data-integrity suite covers v8 base data, locale files, mods/champions and the merged Champions set; code maps compare with published 7.5.0 via the pinned @pokepc/dataset-released alias; the package smoke test builds the package and exercises v8 exports end to end. Verified: pnpm test 9653 passed, 0 skipped (network-blocking setup active); pnpm test:e2e passed; tsc clean.
<!-- SECTION:FINAL_SUMMARY:END -->

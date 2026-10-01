---
id: TASK-10
title: Port data-integrity and package tests to v8
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
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
- [ ] #1 Every data-integrity test runs against v8 base data, or is removed with a documented reason
- [ ] #2 Tests validate `mods/champions/` and the merged Champions set
- [ ] #3 Code-map tests still compare against the last published release
- [ ] #4 The package smoke test imports the v8 exports
- [ ] #5 `pnpm test` passes offline
<!-- AC:END -->

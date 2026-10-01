---
id: TASK-9
title: Update the dataset editor for v8
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
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
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`apps/editor` is the main maintainer UI for curated data and currently reads and writes v7 files. It must edit v8 base records, mods and i18n files while keeping its write-safety guarantees.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The editor reads and writes v8 base records and their i18n text
- [ ] #2 The editor can view and edit Champions overrides, or the workflow explicitly limits mods to the Champions tool and documents it
- [ ] #3 Writes validate against v8 schemas and preserve sibling records and index order
- [ ] #4 `pnpm test:editor`, `pnpm typecheck:editor` and `pnpm test:e2e:editor` pass
- [ ] #5 The Dataset editor guide (doc-10) is updated
<!-- AC:END -->

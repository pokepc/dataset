---
id: TASK-3
title: Implement the base + mods merge function
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
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
- [ ] #1 The library exports a function that merges base records, a game set's mods and its i18n files into that set's full data
- [ ] #2 Merged output respects the set's roster and the documented override and removal semantics
- [ ] #3 Missing translations stay missing; no fallback to another language or game set
- [ ] #4 Merged records validate against the v8 schemas
- [ ] #5 Unit tests cover overrides, removals, roster filtering and missing text
<!-- AC:END -->

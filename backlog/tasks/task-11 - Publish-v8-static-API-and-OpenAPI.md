---
id: TASK-11
title: Publish v8 static API and OpenAPI
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
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Direct JSON clients need the v8 layout on GitHub Pages: base data at the root and fully merged data per game set under `/games/{set}/`, documented by OpenAPI. URLs use `games` because users know games better than game sets; only set ids get folders.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Pages build publishes base data at the root, e.g. `/pokemon/{id}.json`
- [ ] #2 Merged per-set data is published under `/games/{set}/…`, including `/games/{set}/i18n/{locale}/…`, using the exported merge function
- [ ] #3 Game records stay at `/games/{id}.json`; versions and DLCs get no `/games/{id}/` folders
- [ ] #4 The OpenAPI document describes the v8 paths and schemas
- [ ] #5 Versioned builds of v6 and v7 tags are unaffected
<!-- AC:END -->

---
id: TASK-12
title: Document and release 8.0.0
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 03:12'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-6
  - TASK-8
  - TASK-9
  - TASK-10
  - TASK-11
  - TASK-13
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: docs
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
v8 is a breaking release for npm and static API consumers. They need a migration guide, and the maintained docs must describe the v8 layout before the release is tagged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reference docs (availability fields, evolutions, forms, code maps, lifecycle, locations) describe v8 file locations
- [ ] #2 README and AGENTS.md describe the v8 layout, exports and static API
- [ ] #3 decision-2 is marked implemented and doc-2 reflects the shipped model
- [ ] #4 8.0.0 is tagged and published to npm
- [ ] #5 `pages-versions.json` includes 8 after the tag exists, and `/v8/` and `/latest/` serve v8
<!-- AC:END -->

---
id: TASK-13
title: Finalize and publish the v7 to v8 migration guide
status: To Do
assignee: []
created_date: '2026-10-01 03:12'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-1
  - TASK-3
  - TASK-11
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/guides/doc-21 - v7-to-v8-migration-guide.md
type: docs
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
v8 breaks npm and static API consumers. A draft guide (doc-21) already covers decided changes, but import paths, file shapes, locale codes, the merge function and API path prefixes are pending earlier tasks. Consumers include coding agents, so the guide must be precise enough to follow mechanically, and it must be reachable from the installed package and the v8 API, not only from the repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every Pending section of doc-21 is resolved against the implemented v8 layout, with no TBD left
- [ ] #2 Before/after mappings cover every v7 npm export path and static API path, including removed `data-next/*` and `lib-next/*`
- [ ] #3 The locale code and moved text field tables match the v8 schemas
- [ ] #4 Before/after code samples cover reading base data, reading text for a locale and merging a game set via npm, and fetching merged data from the static API
- [ ] #5 The agent playbook lists exact search patterns and verification steps, and they were checked against a sample v7 consumer
- [ ] #6 The guide is published at a stable public location shipped in the npm package and linked from README and the v8 OpenAPI description
<!-- AC:END -->

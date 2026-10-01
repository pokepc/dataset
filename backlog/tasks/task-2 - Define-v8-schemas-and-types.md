---
id: TASK-2
title: Define v8 schemas and types
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-1
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consumers, tools and tests all need typed, validated v8 records. `src/lib-next` has partial schemas for Champions only; v8 needs schemas for every base entity kind, mod overrides and i18n files, following the spec from the storage-spec task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Zod schemas and exported types exist for every base entity kind, its mod override shape and its i18n file shape
- [ ] #2 Existing v7 properties keep their names and meanings (e.g. `id`, `nid`, `gen`); removed text fields are documented as moved to i18n files
- [ ] #3 Schema tests cover valid records, invalid records and override edge cases
<!-- AC:END -->

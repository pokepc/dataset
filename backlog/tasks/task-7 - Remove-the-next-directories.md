---
id: TASK-7
title: Remove the -next directories
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
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
- [ ] #1 `data-next/` and `src/lib-next/` no longer exist; their v8 content lives in `data/` and `src/lib/`
- [ ] #2 v7-only modules and data files are removed
- [ ] #3 package.json `exports`, `files` and scripts, tsdown config and build scripts reference no `-next` paths
- [ ] #4 `pnpm build`, `pnpm typecheck` and `pnpm lint` pass
<!-- AC:END -->

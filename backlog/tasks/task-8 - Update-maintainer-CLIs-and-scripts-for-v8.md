---
id: TASK-8
title: Update maintainer CLIs and scripts for v8
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
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Curation tools read and patch v7 files directly, so they break after the layout change. They must keep working on base and mods files so data maintenance continues during and after the migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Pokémon availability CLI and review CLI read and patch v8 base files
- [ ] #2 `pnpm locations:import` writes the v8 layout
- [ ] #3 `pnpm codes:sync` works with v8 data and preserves append-only rules
- [ ] #4 Remaining one-off and migration scripts are updated or removed if obsolete
- [ ] #5 The `add-pokedex` skill (in `.claude/`, `.agents/` and `.codex/`) describes the v8 layout
- [ ] #6 Existing tool tests pass against v8 fixtures
<!-- AC:END -->

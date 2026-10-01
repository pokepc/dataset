---
id: TASK-5
title: Split Champions data into base and mods/champions
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-4
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: task
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`data-next/champions/` currently holds full records generated from the Champions game dump. Under v8 only real differences from base belong in `mods/champions/`; entities or languages that exist only in Champions (new Megas, battle states, extra locales) belong in base. This is a one-time migration; ongoing updates come from the Champions tool task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Champions-only entities and text are added to base
- [ ] #2 `mods/champions/` contains only fields that differ from base, plus the Champions roster
- [ ] #3 Entity kinds with no differences have no Champions mod files
- [ ] #4 Merging base with `mods/champions/` reproduces the previous `data-next/champions/` content, apart from documented intentional differences
- [ ] #5 Upstream ids (`championsId`, `pokeApiId`) are preserved
<!-- AC:END -->

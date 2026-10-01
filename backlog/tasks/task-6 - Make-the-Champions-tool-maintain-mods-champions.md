---
id: TASK-6
title: Make the Champions tool maintain mods/champions
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-3
  - TASK-5
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Champions keeps receiving updates. The Project Pokémon `champout` adapter must keep parsing upstream data so the dataset stays current with little manual effort, but it should now produce overrides instead of full records, and a maintainer must review its output before it lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A manual command parses the latest Champions game dump and writes `mods/champions/` (overrides relative to base) and Champions i18n files
- [ ] #2 PokéAPI id enrichment still runs as part of the command
- [ ] #3 Running it with unchanged upstream data produces no diff
- [ ] #4 The command no longer runs as part of `pnpm build`
- [ ] #5 The maintainer workflow (update submodule, run, review diff) is documented
- [ ] #6 Adapter tests use fixtures only (no network)
<!-- AC:END -->

---
id: TASK-1
title: Finalize the v8 storage spec
status: To Do
assignee: []
created_date: '2026-10-01 02:57'
labels:
  - v8
milestone: m-0
dependencies: []
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: spike
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-2 and doc-2 fix the overall model (base records, `mods/<set>/` overrides, per-locale text files, merged output on the static API only), but several details every later task depends on are still undefined. Settling them first avoids reworking schemas, migrations and tools.

Only Champions will have mods initially.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 doc-2 defines, per entity kind, whether base and mod data is stored one file per entity or as a collection file
- [ ] #2 doc-2 defines override semantics: field replacement, array handling (replace vs merge) and how a mod removes a field or record
- [ ] #3 doc-2 defines how a game set limits its roster, so merged Champions data contains only Champions Pokémon, moves, items and abilities
- [ ] #4 doc-2 defines the shape of `i18n/<locale>/` files for base and mods
- [ ] #5 One locale code set is chosen and documented, resolving the mismatch between v7 codes (e.g. `jap`) and data-next codes (e.g. `jpn`)
- [ ] #6 Any choice with lasting consequences beyond doc-2 is recorded as a decision linked from decision-2
<!-- AC:END -->

---
id: TASK-4
title: Migrate v7 data to the v8 base layout
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
type: task
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current `data/` is the curated source of truth and becomes the v8 base. Converting it by script keeps the migration reproducible and reviewable instead of hand-editing ~1,600 Pokémon files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A migration script converts every v7 data kind (Pokémon, games, Pokédexes, indices, moves, abilities, items, ribbons, marks, natures, types, locations, box presets, metadata and the other collection files) into the v8 base layout
- [ ] #2 Names and other user-facing text move from records into `i18n/<locale>/` files without loss
- [ ] #3 `data-next/pokemon-texts/` prose is placed in the v8 i18n structure
- [ ] #4 Ids, `nid` values and index ordering are unchanged
- [ ] #5 `data/codes/` maps are byte-for-byte unchanged and every v8 id still has a code
- [ ] #6 All migrated files validate against the v8 schemas
<!-- AC:END -->

---
id: TASK-4
title: Migrate v7 data to the v8 base layout
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 05:01'
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
- [x] #1 A migration script converts every v7 data kind (Pokémon, games, Pokédexes, indices, moves, abilities, items, ribbons, marks, natures, types, locations, box presets, metadata and the other collection files) into the v8 base layout
- [x] #2 Names and other user-facing text move from records into `i18n/<locale>/` files without loss
- [x] #3 `data-next/pokemon-texts/` prose is placed in the v8 i18n structure
- [x] #4 Ids, `nid` values and index ordering are unchanged
- [x] #5 `data/codes/` maps are byte-for-byte unchanged and every v8 id still has a code
- [x] #6 All migrated files validate against the v8 schemas
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/scripts/migrate-v7-to-v8.ts: convert every v7 kind into data-next/ base layout; text to i18n/<locale>/ (v7 keys mapped to v8 codes), method notes to evoNotes/formNotes, pokopia meta text keyed by meta.id, box preset text to i18n/eng/boxpresets/; copy codes, indices, metadata; move pokemon-texts prose to i18n/<locale>/pokemon-prose/.
2. Built-in checks: schema validation of all output, lossless v7 rebuild, box preset rebuild, byte-identical codes with full coverage.
3. Point the prose generator at the new path; stop build:next from overwriting languages.json.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run: bun src/scripts/migrate-v7-to-v8.ts && pnpm format — all four checks pass; a second run reproduces byte-identical output.
v7 classic presets carry an undocumented fullId; kept as optional in the v8 classic preset schema.
Null text values (e.g. desc: null) are omitted in v8 (same meaning). v7 has no Portuguese text, so no pt-br directory yet (Champions adds it in task-5). Prose files moved byte-identical (1595 eng, 1442 deu).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a reproducible migration script that writes the v8 base layout to data-next/ (records without text, per-locale text files, method notes, pokopia entry text, box preset text, codes/indices/metadata, prose under i18n/<locale>/pokemon-prose). Verified by the script's own checks: all files validate against the v8 schemas, every v7 record and box preset rebuilds losslessly, code maps are byte-identical and cover every id; rerun reproduces identical output; tsc clean, full vitest 9422 passed.
<!-- SECTION:FINAL_SUMMARY:END -->

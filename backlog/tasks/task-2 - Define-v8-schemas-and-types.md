---
id: TASK-2
title: Define v8 schemas and types
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 04:53'
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
- [x] #1 Zod schemas and exported types exist for every base entity kind, its mod override shape and its i18n file shape
- [x] #2 Existing v7 properties keep their names and meanings (e.g. `id`, `nid`, `gen`); removed text fields are documented as moved to i18n files
- [x] #3 Schema tests cover valid records, invalid records and override edge cases
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build src/lib-next as the future lib: enums (v7 enums + Champions mechanics), languages (v8 locale codes), evolution/form schemas without inline notes, schemas.ts (strict base records, overrides, roster, locale files), types.ts (named exports).
2. Move the Champions preview record schemas into the champout adapter (its parser output shape until task-6).
3. Schema tests for valid/invalid records, override edge cases and locale files.
4. Document moved text fields (incl. method notes) in doc-2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision (2026-10-01): evolution/form method notes move to i18n files (evoNotes/formNotes keyed by method index, '<i>.revert.<j>' for revert details) rather than staying inline.
lib-next evolution/form schemas are copies of lib/ without notes; they replace lib/ in task-7. The 'special method needs a note' rule moves to a data-integrity check (record + eng text).
Champions item categories renamed to battleItemCategories (item field battleCategories) to avoid clashing with v7 bag category. Pokémon type2 stays optional (not nullable); $unset removes it.
Types are named exports (no global Pkds namespace) to avoid colliding with v7 lib/types until task-7.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added v8 schemas and types in src/lib-next: strict base record schemas for every kind (text removed), override schemas with $unset and no-op/conflict checks, roster schema, per-kind locale text and mod text schemas, v8 locale codes with v7 key mapping. Preview schemas moved into the champout adapter. doc-2 documents moved text fields and schema locations. Verified: tsc --noEmit clean; vitest src/lib-next + champout adapter 33 passed.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: TASK-5
title: Split Champions data into base and mods/champions
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 05:07'
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
- [x] #1 Champions-only entities and text are added to base
- [x] #2 `mods/champions/` contains only fields that differ from base, plus the Champions roster
- [x] #3 Entity kinds with no differences have no Champions mod files
- [x] #4 Merging base with `mods/champions/` reproduces the previous `data-next/champions/` content, apart from documented intentional differences
- [x] #5 Upstream ids (`championsId`, `pokeApiId`) are preserved
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Conversion module (champout adapter to-v8.ts): dump records + base -> base updates (upstream ids, move mechanics, battle states, missing-locale names) and mods/champions (roster, overrides, mod text); comparer diffMergedChampions for reproduction checks.
2. v8-files.ts: read moddable base, write base updates (only changed files, key order kept) and regenerate mods/champions.
3. One-time src/scripts/split-champions-preview.ts: run on data-next/champions, validate mod/text files, merge and compare with the preview, remove the preview.
4. Document mapping rules and intentional differences in doc-2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Findings: Champions Pokémon differ from base only in Greninja's abilities (Battle Bond unset); 739 move overrides (pp mostly; 323 usable:false; growth normal->grass and snaptrap grass->steel come straight from the dump and look suspicious, flagged for maintainer review); 166 item battleCategories overrides; abilities need no mod file.
Preview pt-br text was an English copy made by copyMissingLocales -> dropped (no-fallback rule); task-6 must remove that copy step.
Move usable is now z.literal(false) (absent = usable).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split the Champions preview into base updates (championsId/pokeApiId, move target/classification/contact, 69 battle states with text, names for locales base lacked) and mods/champions (roster of 477/835/217/166, 262 Pokémon overrides incl. learnsets and Greninja $unset, 739 move and 166 item overrides, per-locale mod text for descriptions and form labels). Verified by the split script: mod and text files validate, merged records validate, and merging base + mods reproduces the preview except documented representation changes; tsc clean, full vitest 9422 passed.
<!-- SECTION:FINAL_SUMMARY:END -->

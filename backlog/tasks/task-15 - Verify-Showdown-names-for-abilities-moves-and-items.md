---
id: TASK-15
title: 'Verify Showdown names for abilities, moves and items'
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 19:53'
updated_date: '2026-10-01 19:53'
labels:
  - refs
dependencies: []
priority: medium
type: task
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Abilities, moves and items carry psName, their Pokémon Showdown name, and their id doubles as the Showdown id. Verify every record against Showdown data (@pkmn/dex, dev dependency) and keep the field name psName.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every ability, move and item psName and id match Showdown's name and id, or the record is listed as having no Showdown entry
- [x] #2 A data-integrity test checks the values against @pkmn/dex and flags exception entries Showdown has since added
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All 935 moves and 316 of 317 abilities match @pkmn/dex 0.10.11. auraguard (Aura Guard) is in Showdown master (data/abilities.ts) but not yet in @pkmn/dex or the pokemon-showdown npm package, so the test skips it until a release has it. 468 of 491 items match; the other 23 are key or form-change items Showdown does not have (Gracidea, DNA Splicers, the Nectars, Rotom Catalog, Linking Cord, Legend Plate, Blank Plate and so on), and their psName stays the English name. Master agrees with every value. No data changed. Test: tests/data-integrity-tests/showdown.test.ts.
<!-- SECTION:NOTES:END -->

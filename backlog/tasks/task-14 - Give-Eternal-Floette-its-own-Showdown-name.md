---
id: TASK-14
title: Verify Pokémon Showdown refs against Showdown data
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-01 17:44'
updated_date: '2026-10-01 19:53'
labels:
  - pokemon
  - refs
dependencies: []
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PokéPC's Showdown export and import (pokepc-net TASK-299.1, @pokepc/livingdex-core/showdown) map species and forms by refs.showdown and refs.showdownName, so every Pokémon's pair must match Pokémon Showdown's own species id and name. data/pokemon/floette-eternal.json carried Floette's (showdown floette, showdownName Floette), so an Eternal Floette exported as plain Floette and read back as one; Showdown names it Floette-Eternal (id floetteeternal). Audit every record against Showdown data (@pkmn/dex, dev dependency) and fix the wrong ones. Legend Plate Arceus (arceus-legendary) has no Showdown form and stays Arceus, as the product owner decided on 2026-10-01. pokepc-net keeps a temporary override for floette-eternal in packages/livingdex-core/src/showdown.ts until a dataset release carries the fix; remove it then.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 data/pokemon/floette-eternal.json has refs.showdown floetteeternal and refs.showdownName Floette-Eternal
- [x] #2 arceus-legendary keeps refs.showdownName Arceus, documented as having no Showdown form
- [ ] #3 The dataset checks and a release carry the change, and pokepc-net is told to drop its temporary override
- [x] #4 Every Pokémon's refs.showdown and refs.showdownName match a Showdown species id and name, checked by a data-integrity test against @pkmn/dex
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audited all 1,595 Pokémon against @pkmn/dex 0.10.11 and Showdown master (data/pokedex.ts); both agree after the fixes. 61 records were wrong:
- floette-eternal → Floette-Eternal; meowstic-mega → Meowstic-M-Mega; tatsugiri-mega → Tatsugiri-Curly-Mega (Showdown names the Mega after the M and Curly forms).
- Cosmetic forms that Showdown lists as cosmeticFormes used the base species: unown-b…unown-question (27), flabebe/floette/florges colours (12), furfrou trims (9), sawsbuck seasons (3), and alcremie-salted-cream-* (7) → Alcremie-Salted-Cream. Other cosmetic forms (Gastrodon-East, Vivillon patterns, Alcremie creams) already used their Showdown forme.
- Correct by design and unchanged: female forms and Alcremie sweets map to their species or cream (Showdown has no such formes); arceus-legendary stays Arceus; maushold, minior, vivillon and xerneas are Showdown's Maushold-Four, Minior-Meteor, Vivillon-Icy Snow and Xerneas-Neutral.
- Showdown species the dataset does not model (totems, cosplay/starter Pikachu, Starter Eevee, Spiky-eared Pichu, Greninja-Bond, Rockruff-Dusk, Ogerpon Tera, Meowstic-F-Mega) are out of scope.
tests/data-integrity-tests/showdown.test.ts checks every pair. AC #3 needs a dataset release.
<!-- SECTION:NOTES:END -->

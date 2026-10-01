---
id: TASK-1
title: Finalize the v8 storage spec
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 04:44'
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
- [x] #1 doc-2 defines, per entity kind, whether base and mod data is stored one file per entity or as a collection file
- [x] #2 doc-2 defines override semantics: field replacement, array handling (replace vs merge) and how a mod removes a field or record
- [x] #3 doc-2 defines how a game set limits its roster, so merged Champions data contains only Champions Pokémon, moves, items and abilities
- [x] #4 doc-2 defines the shape of `i18n/<locale>/` files for base and mods
- [x] #5 One locale code set is chosen and documented, resolving the mismatch between v7 codes (e.g. `jap`) and data-next codes (e.g. `jpn`)
- [x] #6 Any choice with lasting consequences beyond doc-2 is recorded as a decision linked from decision-2
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Survey v7 data/, data-next/ and their consumers to ground the spec.
2. Rewrite doc-2 as the v8 storage spec: granularity per kind, override + $unset + roster semantics, locale file shapes, locale codes, merged output.
3. Record lasting choices as decision-4 (locale codes, language records) and decision-5 (merged output only for sets with mods), linked from decision-2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Findings: every Champions Pokémon/move/ability/item id already exists in v7 data; Champions Pokémon differ from v7 only in Greninja's abilities; moves differ mostly in pp (679), power (67, partly OHKO/variable-power representation), usable (323 unusable), 2 types, 5 accuracies. Battle states are the only Champions-only kind. Pokopia dex entries reuse pid+dexNum, so their text needs a new meta.id key.
Decision bodies were edited directly because backlog CLI 1.51 has no decision update command.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
doc-2 now specifies the v8 layout: storage per kind (v7 granularity kept, mods mirror it), override semantics (top-level replace, arrays/objects replaced, $unset for removal, roster for record removal), roster rules, i18n file shapes per kind, locale codes and merged static paths. decision-4 (locale codes, languages.json keeps v7 ids + code) and decision-5 (merged /games/{set}/ only for sets with mods) are linked from decision-2. Verified against v7 data and the data-next preview (id overlap, field diffs, pokopia meta).
<!-- SECTION:FINAL_SUMMARY:END -->

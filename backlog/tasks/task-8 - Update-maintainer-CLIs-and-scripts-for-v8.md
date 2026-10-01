---
id: TASK-8
title: Update maintainer CLIs and scripts for v8
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 05:28'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-7
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: task
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Curation tools read and patch v7 files directly, so they break after the layout change. They must keep working on base and mods files so data maintenance continues during and after the migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Pokémon availability CLI and review CLI read and patch v8 base files
- [x] #2 `pnpm locations:import` writes the v8 layout
- [x] #3 `pnpm codes:sync` works with v8 data and preserves append-only rules
- [x] #4 Remaining one-off and migration scripts are updated or removed if obsolete
- [x] #5 The `add-pokedex` skill (in `.claude/`, `.agents/` and `.codex/`) describes the v8 layout
- [x] #6 Existing tool tests pass against v8 fixtures
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Port the Bulbapedia availability/review CLIs, locations import and champout parser to English text files (landed with TASK-7 to keep main green); verify each on real data.
2. Port remaining runtime readers of v7 text: AI ability tagger, prose generator.
3. Remove obsolete one-offs (done in TASK-7: v7->v8 migration, Champions split, forms/evolutions migrations, PokéAPI game ids, modern preset transform); keep fix-champions-storables and generate-champions-roster (ported to mods/champions/roster.json).
4. Port the add-pokedex skill script and docs to the v8 layout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Real-data checks: pokemon:availability raichu-alola prints English names from i18n and --patch reports 'Already up to date'; locations:import --offline --write reports 'locations.json is unchanged.'; codes:sync appends/retires nothing; DRY_RUN fix-champions-storables would update 0; prose generator dry run resolves data/i18n/<locale>/pokemon-prose; add-pokedex parser resolves the live Isle of Armor page as before (Urshifu Gigantamax ambiguity is the documented pre-existing case); --emit writes text-free dex files and --emit-text the i18n entry.
AI tagger also had a wrong data path (src/data) — fixed to data/.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Maintainer tools work on v8: availability and review CLIs read English names from i18n and patch base files; locations:import writes locations.json + i18n/eng/locations.json; codes:sync unchanged; obsolete one-offs removed; AI tagger and prose generator read locale text; add-pokedex skill (script + docs, shared by .claude/.agents/.codex via symlinks) emits text-free dex files plus an i18n entry. Verified with no-op real runs of each write path and full vitest (9380 passed), tsc clean.
<!-- SECTION:FINAL_SUMMARY:END -->

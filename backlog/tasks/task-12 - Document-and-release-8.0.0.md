---
id: TASK-12
title: Document and release 8.0.0
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 02:57'
updated_date: '2026-10-01 17:18'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-6
  - TASK-8
  - TASK-9
  - TASK-10
  - TASK-11
  - TASK-13
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/doc-2 - v8-data-next-architecture.md
type: docs
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
v8 is a breaking release for npm and static API consumers. They need a migration guide, and the maintained docs must describe the v8 layout before the release is tagged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reference docs (availability fields, evolutions, forms, code maps, lifecycle, locations) describe v8 file locations
- [x] #2 README and AGENTS.md describe the v8 layout, exports and static API
- [x] #3 decision-2 is marked implemented and doc-2 reflects the shipped model
- [x] #4 8.0.0 is tagged and published to npm
- [x] #5 `pages-versions.json` includes 8 after the tag exists, and `/v8/` and `/latest/` serve v8
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reference docs (doc-3, doc-4, doc-5, doc-7, doc-8, doc-9): v8 file locations, text in i18n, notes as evoNotes/formNotes, removed migrations.
2. README (layout, exports, static API, Pages output, Champions upkeep) and AGENTS.md (v8 rules).
3. decision-2 status implemented; doc-2/doc-1 reflect the shipped model.
4. Release (maintainer): version bump commit, tag 8.0.0 + push (publishes npm), then add 8 to pages-versions.json.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Docs part done and verified (format:check, tsc, full vitest 9660 passed).
NOT done (needs the maintainer; I may not tag or push):
1) Bump package.json version to 8.0.0 and commit '8.0.0' (past releases are version-only commits).
2) git tag 8.0.0 && git push origin main 8.0.0 — the npm-publish workflow publishes on x.y.z tags; Pages rebuilds after publish.
3) After the tag exists: pages-versions.json majors [6, 7, 8], commit, push (adding 8 before the tag fails the Pages build).
4) Then: pnpm add -D @pokepc/dataset-released@npm:@pokepc/dataset@8.0.0 (doc-3), confirm npm view @pokepc/dataset version, /v8/openapi.json and /latest/ serve v8, check AC4-5 and mark Done.
Note: local branch 7.x exists but origin has no 7.x yet; push it for v7 fixes.

Release done by the maintainer: commit fb53e10e (8.0.0), tag 8.0.0, pages-versions.json [6, 7, 8] in def2f9d3, 7.x pushed. Verified 2026-10-01: npm dist-tag latest = 8.0.0; versions.json lists latest/ and v8/ at 8.0.0 (fb53e10e); HTTP 200 for /v8/openapi.json, /latest/openapi.json, /v8/pokemon/pikachu.json, /latest/i18n/eng/pokemon.json, /v8/games/champions/pokemon/garchomp.json and /v7/data/pokemon/pikachu.json. @pokepc/dataset-released now points at 8.0.0 (13 code-map tests pass).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
v8 docs updated (reference docs, README, AGENTS.md, decision-2 implemented, doc-1/doc-2 shipped state, consumer docs in docs/). 8.0.0 is published on npm (latest) and served at /v8/ and /latest/ with v7 still at /v7/; the release-comparison alias now tracks 8.0.0. Verified with npm view, versions.json, HTTP checks and pnpm test.
<!-- SECTION:FINAL_SUMMARY:END -->

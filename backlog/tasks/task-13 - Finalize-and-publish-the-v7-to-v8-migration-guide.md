---
id: TASK-13
title: Finalize and publish the v7 to v8 migration guide
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 03:12'
updated_date: '2026-10-01 06:05'
labels:
  - v8
milestone: m-0
dependencies:
  - TASK-1
  - TASK-3
  - TASK-11
references:
  - >-
    backlog/decisions/decision-2 -
    v8-version-data-per-game-set-with-full-translations-data-next.md
documentation:
  - backlog/docs/guides/doc-21 - v7-to-v8-migration-guide.md
type: docs
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
v8 breaks npm and static API consumers. A draft guide (doc-21) already covers decided changes, but import paths, file shapes, locale codes, the merge function and API path prefixes are pending earlier tasks. Consumers include coding agents, so the guide must be precise enough to follow mechanically, and it must be reachable from the installed package and the v8 API, not only from the repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every Pending section of doc-21 is resolved against the implemented v8 layout, with no TBD left
- [x] #2 Before/after mappings cover every v7 npm export path and static API path, including removed `data-next/*` and `lib-next/*`
- [x] #3 The locale code and moved text field tables match the v8 schemas
- [x] #4 Before/after code samples cover reading base data, reading text for a locale and merging a game set via npm, and fetching merged data from the static API
- [x] #5 The agent playbook lists exact search patterns and verification steps, and they were checked against a sample v7 consumer
- [x] #6 The guide is published at a stable public location shipped in the npm package and linked from README and the v8 OpenAPI description
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Publish the guide as docs/migrating-to-v8.md (single source), ship it via package.json files, link it from README and the OpenAPI description; doc-21 points to it.
2. Resolve every pending section against the implemented layout: npm data paths, static API URLs, library modules, locale codes, moved/added fields, Champions preview changes.
3. Code samples for base data, locale text, search, merging (Node loader and pure), static API.
4. Agent playbook with ripgrep patterns and verification steps; validate on a sample v7 consumer; guard tables with a docs test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sample v7 consumer (names, search, movesFs, loadAllBoxPresets, LegacyBoxPresetByGameset, data-next and lib-next imports, /v7/data API URL) compiled and ran on published 7.5.0; the playbook searches found every v7 usage after widening the URL patterns (a base URL without a trailing /data/ was missed at first); migrated with the guide it compiled and ran on v8 with matching output. All six v8 code samples type-check and run (the fetch sample's paths exist in dist-pages). The pure merge sample needed schema parsing because JSON imports type enums as strings; the guide says so.
npm pack --dry-run lists docs/migrating-to-v8.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published the v7 to v8 migration guide at docs/migrating-to-v8.md (shipped in the npm package, linked from README and the v8 OpenAPI description; doc-21 now points to it). It maps every v7 npm path, static API URL and lib module (incl. data-next/lib-next), lists locale codes and moved/added fields matching the schemas, has code samples for base data, locale text, search, merging and the static API, and an agent playbook. Verified with a sample v7 consumer (7.5.0 → v8), compiled/ran every v8 sample, docs guard test (3) and lint pass.
<!-- SECTION:FINAL_SUMMARY:END -->

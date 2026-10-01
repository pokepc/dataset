---
id: doc-21
title: v7 to v8 migration guide
type: guide
created_date: '2026-10-01 03:11'
updated_date: '2026-10-01 06:04'
---
The v7 to v8 migration guide is published as
[`docs/migrating-to-v8.md`](../../../docs/migrating-to-v8.md) in the repository
([on GitHub](https://github.com/pokepc/dataset/blob/main/docs/migrating-to-v8.md)). It ships in the npm
package at the same path and is linked from the README and the v8 OpenAPI description. That file is
the single source; edit it there, not here.

It covers, against the implemented v8 layout:

- pinning v7 (npm `^7`, `/v7/` on Pages);
- concepts (base records, game sets, mods, merged data, locale files) and the locale code table
  (v7 translation keys and language ids to v8 codes);
- before/after mappings for every v7 npm data path and static API URL, including the removed
  `data-next/*` preview and `/data/` URL prefix, moved text fields per kind, added fields and kinds,
  and the Champions preview field changes;
- the library mapping for every v7 `lib/*` and `lib-next/*` module;
- code samples for reading base data, reading text for a locale, search, merging a game set via npm
  and fetching merged data from the static API;
- an agent playbook with exact search patterns and verification steps.

Verification (task-13): a sample v7 consumer compiled and ran against the published 7.5.0 package,
the playbook searches found each of its v7 usages, and the consumer migrated with the guide compiled
and ran against the v8 package with the same results. Every v8 code sample in the guide type-checks
and runs (the fetch sample's paths exist in the Pages build). `tests/docs/migration-guide.test.ts`
keeps the locale and text-field tables in sync with the code.

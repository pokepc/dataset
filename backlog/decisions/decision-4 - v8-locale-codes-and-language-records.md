---
id: decision-4
title: v8 locale codes and language records
date: '2026-10-01 04:44'
status: accepted
---
## Context

v7 used several language identifier sets at once: language ids (`en`, `es`, `esla`, `ja`, `pt`),
three-letter translation keys inside records (`eng`, `esp`, `esla`, `jap`, `por`) and in-game codes
(`ENG`, `ES-ES`, `JPN`, `PT-BR`). The `data-next/` preview introduced a fourth: lowercase in-game
codes as directory names (`eng`, `es-es`, `jpn`, `pt-br`). v8 moves all text into per-locale files
([decision-2](decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md)),
so the directory and key names become part of the public contract.

## Decision

- v8 locale codes are the lowercase in-game language codes: `eng`, `es-es`, `es-la`, `fra`, `deu`,
  `ita`, `jpn`, `kor`, `chs`, `cht`, `pt-br`. They name every `i18n/<locale>/` and
  `mods/<set>/i18n/<locale>/` directory.
- v7 translation keys map one-to-one: `esp` → `es-es`, `esla` → `es-la`, `jap` → `jpn`,
  `por` → `pt-br`; the others are unchanged.
- `languages.json` keeps the v7 language records and ids (`en`, `es`, `esla`, …) with their
  properties, and adds `code`, the v8 locale code. Language ids are not repurposed as locale codes.

Mapping table and file shapes: [v8 data-next architecture](../docs/doc-2%20-%20v8-data-next-architecture.md#locales).

## Consequences

- Consumers rename `esp`, `esla`, `jap` and `por` keys when moving text access to locale files.
- The codes match the Champions game dump and the preview, so Champions text needs no remapping.
- Adding a language means adding a code here, a `languages.json` record and its directories.


---
id: TASK-16
title: Shorten the esla and por language keys to esl and pbr
status: Done
assignee:
  - '@claude'
created_date: '2026-10-01 19:56'
updated_date: '2026-10-01 19:56'
labels:
  - languages
dependencies: []
priority: medium
type: chore
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Translation keys are meant to be three letters, but Latin American Spanish used esla and Brazilian Portuguese used por. Rename them to esl and pbr everywhere the keys appear, as decision-6 records.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 languages.json alpha3, languageAlpha3Codes, localeCodeByV7Key and langMeta.oldCode use esl and pbr, and every key is three letters
- [x] #2 Language ids and v8 locale codes are unchanged
- [x] #3 The migration guide, usage guide and v8 architecture doc show the new keys and tell consumers to rename stored esla and por keys
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Breaking for consumers that read alpha3, type against LanguageV7Key or map stored v7 keys with localeCodeByV7Key; release accordingly. Decision: decision-6. Checks: pnpm typecheck and pnpm test (56 files, 9,665 tests) pass.
<!-- SECTION:NOTES:END -->

---
id: decision-6
title: Three-letter language translation keys
date: '2026-10-01 19:56'
status: accepted
---
## Context

The translation keys kept from v7 (`languages.json` `alpha3`, `localeCodeByV7Key`, `langMeta.oldCode`)
were meant to be three letters, but Latin American Spanish used `esla` and Brazilian Portuguese used
`por`, the ISO 639-2 code for Portuguese in general.

## Decision

- Latin American Spanish is `esl` and Brazilian Portuguese is `pbr` in every translation key set:
  `alpha3`, the `languageAlpha3Codes` enum, `localeCodeByV7Key` and `langMeta.oldCode`.
- Every translation key is exactly three letters. The other keys are unchanged.
- Language ids (`esla`, `pt`) and v8 locale codes (`es-la`, `pt-br`) are unchanged.

This amends the key table of [decision-4](decision-4%20-%20v8-locale-codes-and-language-records.md).

## Consequences

- `localeCodeByV7Key` no longer accepts `esla` or `por`: consumers with stored v7 keys rename them to
  `esl` and `pbr` before mapping. The migration guide says so.
- Consumers that read `alpha3` or type against `LanguageV7Key` see the new values.

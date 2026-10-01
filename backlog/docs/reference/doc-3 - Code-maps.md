---
id: doc-3
title: Code maps
type: specification
created_date: '2026-09-30 23:58'
updated_date: '2026-10-01 06:06'
---
`data/codes/` assigns each Pokémon, ribbon, mark and move a small integer code:

| File                 | Covers                                        | Initial order          |
| -------------------- | --------------------------------------------- | ---------------------- |
| `codes/pokemon.json` | every file in `data/pokemon/`, forms included | `indices/pokemon.json` |
| `codes/ribbons.json` | `ribbons.json`                                | file order             |
| `codes/marks.json`   | `marks.json`                                  | file order             |
| `codes/moves.json`   | `moves.json`                                  | file order             |

Consumers such as PokéPC store these codes instead of ids: moves as small integer arrays, and
ribbons, marks and Pokédex registrations as bitmaps where bit `n` is code `n`. A code that changed
meaning would silently change every stored value that uses it, so the maps are append-only.

Each entry is `{ "id", "code" }`, plus `"retired": true` and an optional `"replacedBy"` once the id
leaves the dataset. The schema is `codeMapEntrySchema` in `src/lib/schemas.ts`.

## Rules

- Codes are dense and ordered: the entry at position `n` has code `n`.
- A released code never changes id, is never removed and is never reused.
- An id that leaves the dataset stays in its map with `"retired": true`. Set `"replacedBy"` when a
  live id replaces it, such as a removed ability form replaced by its base form. A retired entry
  never becomes live again; a returning id gets a new code.
- Every id in the dataset has a code. In v8 the maps cover base ids; game set mods
  (`data/mods/<set>/`) only override existing ids, so they never need codes. The v8 cut-over kept
  every map byte-identical to 7.5.0.

## Changing data

After adding, renaming or removing Pokémon, ribbons, marks or moves, run:

```bash
pnpm codes:sync
```

It appends codes for new ids and marks removed ids as retired, without renumbering anything. A
rename is a removal plus an addition: the old id is retired, so set its `replacedBy` to the new id.
Review the diff, then run `pnpm test`.

## Tests

`tests/data-integrity-tests/codes.test.ts` checks the schema, the rules above against the current
data, and, when available, that no code of the previous release changed. The comparison reads the
last published release through the `@pokepc/dataset-released` npm alias and is skipped while that
alias is not installed or its release has no code maps. `src/lib/codes.test.ts` covers the rules
with fixtures.

## Releasing

1. Release as usual (see the README).
2. Once the new version is published, point the alias at it and commit the lockfile:

   ```bash
   pnpm add -D @pokepc/dataset-released@npm:@pokepc/dataset@<published version>
   ```

Consumers that store codes keep their own lock of the codes they depend on and extend it when they
update the dataset.

## Known retired ids

| Retired id                    | Replaced by  |
| ----------------------------- | ------------ |
| `greninja--battle-bond`       | `greninja`   |
| `zygarde--power-construct`    | `zygarde`    |
| `zygarde-10--power-construct` | `zygarde-10` |
| `rockruff--own-tempo`         | `rockruff`   |

Classic box presets in `data/boxpresets/classic/` still reference these four ids.

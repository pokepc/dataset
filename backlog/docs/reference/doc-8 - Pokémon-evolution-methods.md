---
id: doc-8
title: Pokémon evolution methods
type: specification
created_date: '2026-09-30 23:59'
updated_date: '2026-10-01 06:06'
---
`evoMethods` on a resulting Pokémon/form contains alternative ways to evolve into that record. Meet
**one method**, and **all conditions within that method**. `from` lists alternative eligible
predecessor records; it is not a list of party members that must all be present. Each method owns
its predecessor list, so different source forms can have different requirements. Forms sharing the
same requirements can share one method.

## Implementation contract

- Use typed, translation-ready methods as the sole representation of evolution relationships and
  requirements.
- Migrate existing evolution records using the cached audit evidence, preserving unrelated fields.
- Include reviewed alternate routes and exact form requirements; explain unresolved details in notes
  and keep unreviewed game scope unspecified.
- Validate references and representative special cases, exported schemas, and the public build.

The [audit](../audits/doc-16%20-%20Pok%C3%A9mon-evolution-audit.md) records source evidence and remaining coverage limitations.
It is a historical snapshot, not a list of corrections still outstanding after migration. Keep
source URLs and verification status in audit documents, outside the bundled data JSON.

## Method fields

| Field              | Meaning                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `from`             | Nonempty array of eligible local Pokémon/form IDs                                                         |
| `games`            | Optional nonempty array of concrete game IDs; omitted means the game scope is unreviewed, never all games |
| `trigger`          | `level_up`, `trade`, `use_item`, or `special`                                                             |
| `minLevel`         | Optional minimum level, separate from other requirements                                                  |
| `item`             | Item ID with role `held`, `used`, or `bag`, and optional quantity                                         |
| `conditions`       | Typed semantic keys and their parameters; all must be met                                                 |
| `additionalResult` | Shedinja-style extra result, rather than replacing the source instead of its usual evolution              |
| `activation`       | Optional `manual`/`automatic`; PLA requires the Evolve menu action                                        |
| (notes)            | Explanatory text is not part of the method: `data/i18n/<locale>/pokemon.json` holds it as `evoNotes`, keyed by method index (`{ "0": "…" }`). A `special` method without conditions needs an English note |

Methods describe known requirements, not an exhaustive eligibility predicate. Unresolved source
conflicts are explained in notes. Neither source introduction games nor acquisition/storage lists
establish where evolution works.

This is a breaking schema change: `evoMethods` replaces `evolutionMethods`, `evolvesFrom`, and all
`evoFrom*` fields. Consumers can derive a record's predecessors by collecting the unique IDs from
`evoMethods[].from`. Keep the individual methods when matching evolution requirements. Missing
`evoMethods` does not by itself prove that evolution is impossible; do not inherit species evolution
methods into every form.

An explicitly scoped method is evidence for those games, not an assertion that no other game
supports it. A method with omitted `games` can be displayed as a general guide, but does not
establish eligibility in a requested game.

## Translation and special conditions

All fixed evolution vocabularies are exported as typed, readonly arrays from the npm package:

```ts
import { evoConditionKeys, evoTriggers, evoLocations } from '@pokepc/dataset/lib/enums'

for (const key of evoConditionKeys) {
  console.log(key)
}
```

| Scope                             | Exports                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Methods                           | `evoTriggers`, `evoItemRoles`, `evoActivations`                                          |
| Condition keys                    | `evoConditionKeys`                                                                       |
| Gender, time, weather, location   | `evoGenders`, `evoTimesOfDay`, `evoWeather`, `evoLocations`                              |
| Comparisons and region            | `evoStatComparisons`, `evoRegionRelations`                                               |
| Walking, moves, spinning, scrolls | `evoWalkModes`, `evoMoveStyles`, `evoSpinDirections`, `evoSpinComparisons`, `evoScrolls` |

The schemas use these constants directly. Importing the enum arrays does not require importing Zod.
Type parameters use the existing `typeIds` export; Pokémon, item, move, ability, Nature, region, and
game IDs reference their respective data catalogs rather than fixed evolution enums.

Render `conditions[].key` through translation templates, interpolating typed parameters and local
item/move/Pokémon names. For example, `device_upside_down` describes Malamar's requirement without
tying the key to Inkay or confusing it with Alcremie's `spin` condition. `friendship` means high
friendship; its exact threshold is intentionally not universalized across games.

`hidden_value_branch` reports the population distribution; the result is fixed per individual, not
rerolled every attempt. `nature` refers to the original Nature, unaffected by mints. `union_circle`
requires another player. `spare_poke_ball` means a regular Poké Ball. `location` values are
translatable landmark categories, not IDs from the location catalog. `use_move` and `hit_with_move`
deliberately distinguish PP uses from hits on targets. `vivillon_pattern` retains the result pattern
and requires origin/postcard eligibility; it is not a freely selectable choice.

These are bounded, validated data types, not an expression evaluator. Use localized notes for
unresolved or unusually detailed caveats. Verification metadata belongs in audit documents.

## Migration and remaining coverage

The initial migration adds **728 methods to 685 records**, including the previously missing Meltan →
Melmetal route. It corrects the six confirmed non-cosmetic predecessor links and adds seven missing
evolution resources to the item catalog. Existing unrelated fields and record formatting are
preserved. All 63 Alcremie recipes now have distinct item/condition combinations.

The offline migration (`src/scripts/migrate-pokemon-evolutions.ts`, read from the audit CSV snapshot
listed in the [audit manifest](../audits/evolution-findings.json)) was applied in v7 and removed in
v8; see Git history. Evolution data is now maintained in `data/pokemon/<id>.json` and its notes in
`data/i18n/<locale>/pokemon.json`.

Most ordinary methods retain partial game scope rather than inventing a complete game matrix. The
existing cosmetic-female predecessor convention remains unchanged, with explicit female conditions
added. Own Tempo Rockruff is represented as eligibility metadata on the shared Rockruff identity;
the dataset does not yet have a separate visually identical source record. Vivillon pattern
origin/postcard eligibility is represented by a semantic condition rather than an executable origin
resolver. Runerigus and ZA Overqwil retain explanatory notes about conflicting sources. Full GO
mechanics, platform-specific caveats, and remaining game scopes need separate research before use as
a legality engine.

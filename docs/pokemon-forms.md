# Pokémon form transitions

`formMethods` on the **destination record** describes alternative ways an individual Pokémon can
change into that form. One method must match; its conditions must all hold. Each method owns its
`from` array of alternative source record IDs. Fusion partners are requirements, not alternative
sources. Evolution continues to use `evoMethods`.

```json
{
  "formMethods": [
    {
      "from": ["kyurem"],
      "games": ["swsh-sw", "swsh-sh"],
      "trigger": "fuse",
      "item": { "id": "dnasplicers", "role": "used", "consumed": false },
      "conditions": [{ "key": "fusion_partner", "pokemon": "zekrom" }]
    }
  ]
}
```

This example belongs on `kyurem-black`. Separation is a different method on `kyurem`, with
`from: ["kyurem-black"]`. There is no inferred `reversible` flag.

## Contract

| Field        | Meaning                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `from`       | Nonempty, unique array of exact source Pokémon/form IDs; alternatives                                |
| `games?`     | Concrete game or storage application IDs where this rule was researched; omitted means unknown scope |
| `trigger`    | Typed action or automatic change                                                                     |
| `minLevel?`  | Minimum level when relevant, such as Schooling                                                       |
| `item?`      | Item ID, `held` / `used` / `bag` role, optional `consumed` boolean                                   |
| `conditions` | Conjunction of typed conditions; `[]` means no additional requirements are recorded                  |
| `notes?`     | Localized explanatory text keyed by language alpha-3 code                                            |

Optional values are unknown or unrecorded, not an assertion that no restriction exists. Explicit
`games` arrays are researched subsets, not an exhaustive list of supported titles. They never
replace acquisition/storage availability fields. A storage-triggered method may name `home`, which
is a concrete application in the game catalog. `storage_event.service` also supports semantic
services such as `pc`, `bank`, and `day_care` that are not game IDs.

Positive array-valued condition parameters are alternatives: `battle_event.events` means any listed
event, and `ability.abilities` means any listed Ability. Exclusions apply to the whole set:
`held_item_absent.items` requires **none** of the listed items to be held, and weather with relation
`outside` requires weather outside the entire listed set. Separate conditions are AND, including
repeated keys with different parameters (for example, HP greater than zero AND at most 50%).
Identical duplicate conditions are rejected. `known_move.relation` defaults semantically to `knows`;
`does_not_know` supports forgetting Secret Sword.

`original_form` identifies the form the individual had before the relevant temporary transformation.
It is required when a shared state could otherwise allow the wrong return route: Gigantamax Alcremie
retains its cream/sweet combination; Ultra Necrozma retains its fusion partner. Nested
transformations track each relevant origin independently: Mega Zygarde returns to Complete, then
Complete returns to that individual's original 10% or 50% Forme. `intrinsic_form` instead describes
a persistent identity, such as Minior's core color hidden by Meteor Form.

These are requirements for display and filtering, not an executable battle simulator. Mechanic keys
include their ordinary eligibility rules: `mega_evolution` requires an unlocked Key Stone mechanic,
`gigantamax` requires access to Dynamax with a Dynamax Band in an eligible battle, `ultra_burst`
requires its unlocked Z-Ring mechanic, and `terastallization` requires an available Tera Orb.
Specific resources/unlocks and exceptional timing can be recorded in conditions or localized notes.
The [audit](audits/pokemon-forms.md) documents the current limits.

No URL, source, or verification field is accepted in a method. The schema is strict. Evidence and
coverage reports remain outside the published `data` and `build` directories.

## Public exports and translation

```ts
import { formTriggers, formConditionKeys } from '@pokepc/dataset/lib/enums'
import { formMethodSchema } from '@pokepc/dataset/lib/form-schemas'
import type { FormMethod, FormCondition } from '@pokepc/dataset/lib/form-schemas'
import type {} from '@pokepc/dataset/lib/types'
// Pkds.FormMethod and Pkds.FormCondition are also available.
```

All fixed vocabularies are readonly arrays, and the schemas consume those same arrays:

- `formTriggers`, `formItemRoles`, `formConditionKeys`
- `formMoveRelations`, `formTimesOfDay`, `formStatuses`, `formStatusRelations`
- `formInteractions`, `formLocations`, `formEnvironments`, `formSeasons`
- `formTimeUnits`, `formStorageEvents`, `formStorageServices`, `formBattleEvents`
- `formMechanics`, `formComparisons`, `formWeather`, `formWeatherRelations`, `formBattleConditions`

Move categories reuse `moveCategory`. Pokémon, move, item, Ability and game IDs use their existing
catalogs. Locations and interactions are semantic translation keys, not location-catalog IDs. Render
the key using a translation template, interpolating localized catalog names and typed parameters.
Rare condition definitions are in [the vocabulary audit](audits/form-methods/vocabulary.json).

## Migration

This replaces `formItem`. Read item requirements from each `formMethods` entry; one form can use
different items or roles in different games. Giratina uses a Griseous Core in Legends: Arceus, holds
one in Scarlet/Violet, and holds a Griseous Orb in earlier supported games.

Classification flags, `baseSpecies`, `baseForms`, `forms`, evolution and availability fields remain
unchanged. Do not infer switching between regional forms, genders, fixed cosmetic forms, or
different evolution outcomes. Missing `formMethods` alone is not proof that no change exists.

The reviewed manifest and item additions are under `src/scripts/form-data/`. Applying them requires
no network or local source cache:

```sh
pnpm pokemon:forms:migrate
pnpm pokemon:forms:migrate --write
```

The first command previews changes. The migrator validates and prepares all records before writing,
checks for concurrent edits, preserves unrelated record text/values, and refuses to overwrite
different existing methods or discard unmatched legacy requirements. Re-running is idempotent. The
exceptional legacy Mawilite on ordinary Mawile is removed; the actual requirement is on Mega Mawile.

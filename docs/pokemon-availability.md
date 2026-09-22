# Pokémon availability fields

This is the canonical field reference for humans and agents editing `data/pokemon/*.json`, the
schemas, the editor, and the availability tools. It supersedes older audit terminology. Last policy
review: **2026-09-22**. Implementation and source details are in the
[availability CLI guide](pokemon-availability-cli.md).

## Scope

Availability describes an **exact Pokémon record, including its form**, in a concrete game or
storage service. Acquisition, storage, and shiny availability answer different questions. Membership
uses IDs from `data/games/`; acquisition/storage arrays use concrete games rather than game-set
aliases. `debutIn` can identify a game set such as `xy`.

Acquisition records established routes, including historical releases and events. It is not a live
spawn calendar, a guarantee that an old event is active, or a claim that every save, region, DLC
configuration, or destination supports the route. Exportability is part of the acquisition model: an
isolated local recruit that cannot leave its game is not an `obtainableIn` source, except in GO,
where `obtainableIn` simply records that the exact Pokémon/form was released at some point.

## Acquisition and storage

The exportability requirements below have one explicit exception: GO uses historical release,
including costumes that cannot leave GO.

| Field            | Meaning                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `obtainableIn`   | Ordinary in-game acquisition that can supply a Pokémon to another compatible game/service. Includes native catches, evolution, breeding, permanent gifts, NPC trades, and ordinary multiplayer encounters where supported. Merely recruiting or using a Pokémon locally does not qualify if that recruit cannot be exported. |
| `transferOnlyIn` | Availability depends on an external Pokémon, trade, distribution, or an explicitly documented external dependency, rather than a qualifying native acquisition route. Includes eligible HOME visitors in Champions and the curated simplifications below. It does not promise unrestricted export or two-way transfer.       |
| `eventOnlyIn`    | Acquisition through an **in-game event route**, such as an event-unlocked encounter or the special Gigantamax Melmetal HOME gift. It is not the category for every externally distributed Pokémon, and does not assert that trading the species is impossible.                                                               |
| `storableIn`     | The exact form can remain in that game's boxes or service storage. Independent of where it originates, whether it can be exported, whether it is currently obtainable, or whether a battle format allows it. Deposit that reverts the form does not qualify.                                                                 |

Use one acquisition classification for a resolved game/form cell. Ordinary acquisition takes
precedence over the incidental ability to trade the same Pokémon. For the upstream main table,
follow its case-sensitive label and the explicit curated exceptions rather than inventing a second
classification. The integrity tests reject any game shared by `eventOnlyIn` and either
`obtainableIn` or `transferOnlyIn`. Storage can overlap any of them.

An ordinary permanent story event or quest is not automatically `eventOnlyIn`: for example, the
Marine-pattern Spewpa museum quest in Legends: Z-A is ordinary acquisition. Conversely, an in-game
encounter unlocked by a special event remains in the event category. Expired historical routes are
not automatically moved to transfer-only just because their event has ended.

### HOME Pokédex-completion gifts

These special Mystery Gifts are `eventOnlyIn: ["home"]`, even when permanently available. Receiving
them through HOME is an in-service event route; trading them does not add HOME to `transferOnlyIn`.
Keep HOME in `storableIn`. This rule applies only to the rewarded form.

| Reward                  | Required HOME Pokédex completion                                  |
| ----------------------- | ----------------------------------------------------------------- |
| Meloetta (Aria)         | Paldea, Kitakami and Blueberry, using Scarlet/Violet origins      |
| Enamorus (Incarnate)    | Hisui, using Legends: Arceus origins                              |
| Manaphy                 | Sinnoh, using Brilliant Diamond/Shining Pearl origins             |
| Keldeo (Ordinary)       | Galar, Isle of Armor and Crown Tundra, using Sword/Shield origins |
| Meltan                  | Kanto, using Let's Go origins                                     |
| Original Color Magearna | National Pokédex through Eternatus, including Mythical Pokémon    |

The first five are shiny rewards documented on the
[official HOME features page](https://home.pokemon.com/en-gb/features/); the
[HOME Pokédex reference](<https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9dex_(HOME)#Pokédex_entries>)
documents Original Color Magearna. These curated rules supplement the two parsed lists without
adding runtime fetches. Other ordinary HOME gifts retain their separate classifications.

### Champions

As of 2026-09-22, **no record may contain `champions` in `obtainableIn`**. Recruits obtained inside
Champions cannot be sent to HOME, while supported visiting Pokémon can return to HOME. See the
[official Champions connectivity rules](https://champions.pokemon.com/en-gb/pokemon/).

A verified visitor route is `transferOnlyIn`, including High Plains Vivillon even though that
pattern is also recruitable locally. `storableIn` is independent. Removing an invalid recruitment
classification does not by itself prove visitor eligibility; unresearched roster entries remain
unverified. Planned future roster support does not establish current availability. Revisit this
policy only when export behavior changes, with updated evidence and tests.

### Forms and storage

Eternamax Eternatus has no acquisition or storage membership anywhere, including GO. Its boss
appearance and move animation do not establish an obtainable form. Dada Zarude is transfer-only in
Sword/Shield, Scarlet/Violet and HOME, originating from its historical Sword/Shield distribution; it
has no GO acquisition or storage. The distributed-Pokémon route determines this classification, not
merely the fact that its distribution has expired.

Original Cap and World Cap Pikachu are released GO costumes. Include GO in both `obtainableIn` and
`storableIn`, even though these costumes cannot leave GO. Their main-series acquisition remains
independent; see the [cap release evidence](audits/special-form-availability.md).

Do not copy positive species availability to every form. Use an exact form entry or an explicit,
reviewed inheritance rule. Availability in one game does not prove that a pattern, size, regional
form, or transformation exists in another.

Fairy Arceus cannot inherit acquisition or storage before Gen VI, when the Pixie Plate was
introduced. Normal Deoxys has no acquisition route in FireRed, LeafGreen or Emerald: capture
immediately yields Attack, Defense or Speed Forme, respectively. Those routes belong to the exact
resulting form. Released ordinary GO Pokémon such as Cramorant and Zeraora can be stored in GO; this
does not grant storage to their temporary transformations.

Battle transformations such as Mega Evolution and Gigantamax retain their explicit acquisition
rules: a supported in-game transformation can be listed even though the temporary transformed state
cannot itself be boxed or transferred. Exportable acquisition concerns the underlying Pokémon;
`obtainableIn` never promises that a temporary state or held-item form survives transfer.

- Forms requiring a **held item** cannot retain that form in HOME: exclude HOME from all three
  acquisition fields and `storableIn`. An item used once to change/evolve a Pokémon is not
  necessarily a held-item requirement; `formItem` alone does not establish one.
- Rotom appliances keep their form without a held item. They are `transferOnlyIn` and `storableIn`
  in HOME; they do not inherit base Rotom's native HOME gift.
- Furfrou trims are not storable where deposit removes the trim. A game that stores the trim but
  reverts it on withdrawal can still appear in `storableIn`.
- Cosmetic female records inherit the corresponding parent only under the explicit rule; Gen I is
  excluded because it has no genders. This does not apply to female-only species.

See the CLI guide for the complete inherited families, exclusive forms, and Mega/Gigantamax rules,
and the [Vivillon audit](audits/vivillon-availability.md) for its complete pattern matrix. The
[ordinary-form](audits/ordinary-form-availability.md) and
[special-form](audits/special-form-availability.md) audits document the remaining form decisions.
Ability-driven main-game acquisition never implies a shared GO release or shared storage. Fusion
acquisition must account for both components; a transfer-only fusion means an imported component is
needed, not that the fused result can cross games.

## Shiny fields

| Field           | Meaning                                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shinyLockedIn` | Games where the native acquisition of this Pokémon/form is prevented from being shiny. This describes acquisition, not a ban on importing or storing a legal shiny from elsewhere. If an ordinary native route can produce a shiny, do not mark the entire game locked merely because another encounter is locked. |
| `shinyReleased` | Whether a legal shiny of this exact Pokémon/form has been released in at least one game or service. This is global, not proof that it is shiny-obtainable in every listed game. A shiny sprite or programmed shiny coloration alone is not a release.                                                              |
| `shinyBase`     | Optional Pokémon ID used as the shared shiny appearance reference, such as Alcremie flavors sharing a shiny appearance. It is not acquisition evidence and does not implicitly copy any availability fields.                                                                                                       |

`shinyLockedIn` is optional; absent and empty both mean **no locks recorded**, not proof that every
game permits shiny acquisition. `shinyReleased: false` records no established legal shiny release;
do not synthesize a list of shiny locks from it. A global shiny release can coexist with locks in
particular games. Shiny fields are independent of the mutually exclusive acquisition categories. The
two availability parsers do not currently determine shiny release/lock fields.

## Related Pokémon fields

| Field(s)                                                               | Relationship to availability                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debutIn`, `gen`                                                       | Introduction game/game set and generation of the record. They do not imply availability in all later games. Mega group rules explicitly use `debutIn`.                                                        |
| `isPrerelease`                                                         | Marks an unreleased Pokémon/form record. Announcements or assets do not establish a released acquisition route.                                                                                               |
| `isDefault`, `isForm`, `formId`, `baseSpecies`, `baseForms`, `forms`   | Identify a species/form and its relationships. A default or unsuffixed record may represent one specific form, not all forms. These links do not authorize automatic availability inheritance.                |
| `isCosmeticForm`, `isFemaleForm`, `hasGenderDifferences`, `isRegional` | Describe the variant. Cosmetic appearance does not guarantee identical per-game availability.                                                                                                                 |
| `isBattleOnlyForm`, `isMega`, `isPrimal`, `isGmax`, `isFusion`         | Describe a transformation or form mechanic. They require game-specific acquisition/storage rules, not blanket exclusion or blanket base inheritance.                                                          |
| `formItem`                                                             | Associated form item; distinguish held items from consumables and reusable form-changing items before deciding storage or transfer compatibility.                                                             |
| `canGmax`, `canDynamax`, `canBeAlpha`                                  | Capability flags, not per-game availability lists. They do not establish a legal encounter, stored form, or current battle-roster eligibility.                                                                |
| `evoMethods`                                                           | Alternative evolution methods, each with its eligible predecessors. See [evolution methods](pokemon-evolutions.md). An evolution link alone does not prove native acquisition; omitted game scope is unknown. |

Pokédex membership and a game's feature flags are also separate from acquisition. A Pokémon can be
supported without appearing in that game's regional Pokédex. The `transferOnly` property of a
Pokédex entry is scoped to that entry; it does not replace a Pokémon's per-game `transferOnlyIn`.

## Evidence and maintenance

Runtime upstream acquisition comes only from the two Bulbapedia availability lists linked in the CLI
guide. Supplementary researched form rules include their references but do not fetch more pages at
runtime. The main table's labels map as follows:

| Source label                                          | Classification                                    |
| ----------------------------------------------------- | ------------------------------------------------- |
| Ordinary catch/evolve/breed/other native-route labels | `obtainableIn`, subject to export and form rules  |
| `EV`, `EVE`, `EVD`, `CCEV`                            | `eventOnlyIn`: in-game event route                |
| `Ev`, `EvB`, `EvE`, `EvET`                            | `transferOnlyIn`: distributed Pokémon             |
| `PW`, `PWE`                                           | `transferOnlyIn`: Pokéwalker is external to HG/SS |
| Transfer/trade and other external-route labels        | `transferOnlyIn`                                  |

**GO exception:** `obtainableIn` means the exact Pokémon/form has been released in GO at some point,
regardless of whether it can be exported. This includes released costumes and historical events;
exportability does not move a GO release to `transferOnlyIn` or `eventOnlyIn`. This simplification
does not apply to Champions or other games. Storage remains independent.

GO release tables track historical release, not today's spawns, and do not distinguish ordinary
availability from every timed event. S/V's GO-postcard-dependent Vivillon patterns are deliberately
simplified to `transferOnlyIn`; Fancy is native, while Poké Ball must be imported.

Missing or blank source cells are **unknown**, not proof of unavailability. Preserve existing values
and report the gap unless a specific rule establishes a correction, such as Champions' export
restriction. Explicit unreleased/unavailable evidence can remove an acquisition entry. Unsupported
future forms stay unresolved. Saved data and inherited saved values are not source evidence.

The ignored local report `.local/uncovered.json` and adjacent generator
`.local/generate-uncovered.ts` track gaps in the two source lists. They do not certify storage,
shiny mechanics, or every unsupported game's roster. When changing semantics, update this reference,
schema comments, affected rules/data, and regression tests together.

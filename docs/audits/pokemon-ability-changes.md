# Pokémon ability history

Reviewed 2026-09-23 against the current `data/pokemon` records. This audit covers ability access
between core-series games and versions, including assignments in game data that were never usable.
It does not track changes to an ability's effects or abilities temporarily copied during battle.

## Field contract

`legacyAbilities?: string[]` contains unique IDs from `data/abilities.json` that were previously
obtainable on the **exact record's form** and are absent from all four current fields: `ability1`,
`ability2`, `abilityHidden`, and `abilitySpecial`. Omission and `[]` mean no legacy assignments are
recorded. Current slots are unchanged; a change of slot alone does not create a legacy ability.

Unreleased Hidden Abilities and unused Legends: Arceus assignments are excluded. Each entry has a
historical release, but that does not establish availability in every game or retention through
transfer. Game/version context is recorded below rather than encoded in the string array.

The audit produces **10 record patches** with released historical abilities. Eight records with
unreleased assignments and 14 with unused Legends: Arceus assignments are excluded. Cosmetic female
records share the corresponding form's history; unrelated regional forms and transformations do not.

## Released replacements included in the dataset

The comprehensive checklist is Bulbapedia's
[modified Ability access list](https://bulbapedia.bulbagarden.net/wiki/List_of_modified_Ability_access).
The tables use dataset IDs so every affected file can be located directly.

### Black/White to Black 2/White 2

| Record                  | Legacy ID  | Replacement ID | Historical status                                                       |
| ----------------------- | ---------- | -------------- | ----------------------------------------------------------------------- |
| `basculin-blue-striped` | `reckless` | `rockhead`     | Usable; White's NPC-traded Blue-Striped Basculin already had Rock Head. |

### Generation V to VI

[Serebii's XY ability-access reference](https://www.serebii.net/xy/pokemonabilities.shtml)
corroborates the replacements. The historical release distinctions follow Bulbapedia's checklist.

| Records                               | Legacy ID   | Replacement ID | Historical status     |
| ------------------------------------- | ----------- | -------------- | --------------------- |
| `venipede`, `whirlipede`, `scolipede` | `quickfeet` | `speedboost`   | Usable Hidden Ability |

### Generation VI to VII

| Record   | Legacy ID  | Replacement ID | Historical status       |
| -------- | ---------- | -------------- | ----------------------- |
| `gengar` | `levitate` | `cursedbody`   | Usable ordinary ability |

### Generation VIII to IX

Shiftry's second slot changes between the
[Sword/Shield](https://www.serebii.net/pokedex-swsh/shiftry/) and
[Scarlet/Violet](https://www.serebii.net/pokedex-sv/shiftry/) records. Piplup's family replaces its
Hidden Ability; none of these changes removes the other current abilities.

| Records                          | Legacy ID   | Replacement ID | Historical status               |
| -------------------------------- | ----------- | -------------- | ------------------------------- |
| `shiftry`, `shiftry-f`           | `earlybird` | `windrider`    | Usable through Gen VIII         |
| `piplup`, `prinplup`, `empoleon` | `defiant`   | `competitive`  | Usable Hidden Ability before SV |

## Unreleased and unused assignments excluded from the dataset

These differences remain in the research checklist for completeness, but do **not** populate
`legacyAbilities` because the former abilities were never obtainable on these exact forms.

### Unreleased Hidden Abilities

| Transition    | Records                            | Unreleased ID  | Replacement ID |
| ------------- | ---------------------------------- | -------------- | -------------- |
| Gen V to VI   | `zapdos`                           | `lightningrod` | `static`       |
| Gen V to VI   | `litwick`, `lampent`, `chandelure` | `shadowtag`    | `infiltrator`  |
| Gen VI to VII | `raikou`                           | `voltabsorb`   | `innerfocus`   |
| Gen VI to VII | `entei`                            | `flashfire`    | `innerfocus`   |
| Gen VI to VII | `suicune`                          | `waterabsorb`  | `innerfocus`   |

### Legends: Arceus to Scarlet/Violet

These previous assignments existed in Legends: Arceus data, whose battles do not use abilities. The
source list and
[Serebii's SV comparison](https://www.serebii.net/scarletviolet/pokemonabilities.shtml) document
this distinction. None of these unused assignments qualifies as a released legacy ability.

| Records                             | Unused ID     | Replacement ID |
| ----------------------------------- | ------------- | -------------- |
| `growlithe-hisui`, `arcanine-hisui` | `justified`   | `rockhead`     |
| `typhlosion-hisui`                  | `flashfire`   | `frisk`        |
| `sneasel-hisui`, `sneasel-hisui-f`  | `poisontouch` | `pickpocket`   |
| `samurott-hisui`                    | `shellarmor`  | `sharpness`    |
| `braviary-hisui`                    | `defiant`     | `tintedlens`   |
| `sliggoo-hisui`, `goodra-hisui`     | `overcoat`    | `shellarmor`   |
| `decidueye-hisui`                   | `longreach`   | `scrappy`      |
| `kleavor`                           | `steadfast`   | `sharpness`    |
| `basculegion`, `basculegion-f`      | `rattled`     | `swiftswim`    |
| `enamorus`                          | `healer`      | `cutecharm`    |

### Within Scarlet/Violet

| Record  | Unreleased ID | Change                                             | Historical status                                               |
| ------- | ------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `kubfu` | `noguard`     | Hidden slot added in 1.0.0/1.1.0, removed in 1.2.0 | Never legally available; Kubfu was inaccessible before removal. |

## Added abilities that do not produce legacy entries

Every explicit addition in the linked checklist was also compared with the current base-form slots.
The following additions retain the former abilities, so they do not populate this field. The general
introduction of abilities in Gen III and Hidden Abilities in Gen V likewise adds slots rather than
removing assignments. A blank slot is not an ability ID.

### Generation III to IV

Grouped by the added ability; every named species is included, not only the final evolution.

| Added ability | Pokémon                                                     |
| ------------- | ----------------------------------------------------------- |
| Tangled Feet  | Pidgey, Pidgeotto, Pidgeot, Spinda                          |
| Rivalry       | Nidoran♀, Nidorina, Nidoqueen, Nidoran♂, Nidorino, Nidoking |
| Magic Guard   | Cleffa, Clefairy, Clefable                                  |
| Dry Skin      | Paras, Parasect                                             |
| Tinted Lens   | Venonat, Venomoth, Illumise                                 |
| Technician    | Meowth, Persian, Hitmontop, Scyther, Scizor, Smeargle       |
| Anger Point   | Mankey, Primeape, Tauros                                    |
| No Guard      | Machop, Machoke, Machamp                                    |
| Hydration     | Seel, Dewgong                                               |
| Skill Link    | Shellder, Cloyster                                          |
| Forewarn      | Drowzee, Hypno, Smoochum, Jynx                              |
| Steadfast     | Tyrogue                                                     |
| Reckless      | Hitmonlee                                                   |
| Iron Fist     | Hitmonchan                                                  |
| Leaf Guard    | Tangela, Hoppip, Skiploom, Jumpluff                         |
| Scrappy       | Kangaskhan, Miltank                                         |
| Sniper        | Horsea, Seadra, Kingdra, Remoraid, Octillery                |
| Filter        | Mr. Mime                                                    |
| Mold Breaker  | Pinsir                                                      |
| Adaptability  | Eevee                                                       |
| Download      | Porygon, Porygon2                                           |
| Solar Power   | Sunkern, Sunflora, Tropius                                  |
| Super Luck    | Murkrow, Absol                                              |
| Quick Feet    | Granbull, Teddiursa, Ursaring, Poochyena, Mightyena         |
| Gluttony      | Shuckle, Zigzagoon, Linoone                                 |
| Snow Cloak    | Swinub, Piloswine                                           |
| Frisk         | Stantler, Shuppet, Banette                                  |
| Poison Heal   | Shroomish, Breloom                                          |
| Normalize     | Skitty, Delcatty                                            |
| Stall         | Sableye                                                     |
| Simple        | Numel                                                       |
| Solid Rock    | Camerupt                                                    |
| Anticipation  | Barboach, Whiscash                                          |
| Ice Body      | Snorunt, Glalie, Spheal, Sealeo, Walrein                    |

### Later additions

The [XY](https://www.serebii.net/xy/pokemonabilities.shtml),
[Sun/Moon](https://www.serebii.net/sunmoon/pokemonabilities.shtml), and
[SV](https://www.serebii.net/scarletviolet/pokemonabilities.shtml) comparisons provide additional
generation-specific references. Kubfu's subsequently removed addition is handled above.

| Introduced in | Added ability            | Pokémon                                                                    |
| ------------- | ------------------------ | -------------------------------------------------------------------------- |
| Gen VI        | Competitive              | Igglybuff, Jigglypuff, Wigglytuff, Milotic, Gothita, Gothorita, Gothitelle |
| Gen VI        | Lightning Rod            | Plusle                                                                     |
| Gen VI        | Volt Absorb              | Minun                                                                      |
| Gen VI        | Oblivious                | Feebas                                                                     |
| Gen VI        | Protean                  | Kecleon                                                                    |
| Gen VI        | Frisk                    | Duskull, Dusclops, Dusknoir                                                |
| Gen VI        | Reckless                 | Starly                                                                     |
| Gen VI        | Anticipation             | Ferrothorn                                                                 |
| Gen VII       | Hydration                | Wingull                                                                    |
| Gen VII       | Drizzle                  | Pelipper                                                                   |
| Gen VII       | Drought                  | Torkoal                                                                    |
| Gen VII       | Weak Armor               | Roggenrola, Boldore                                                        |
| Gen VII       | Sand Stream              | Gigalith                                                                   |
| Gen VII       | Snow Cloak               | Vanillite, Vanillish                                                       |
| Gen VII       | Snow Warning             | Vanilluxe                                                                  |
| Gen VII       | Slush Rush               | Cubchoo, Beartic                                                           |
| Gen VIII      | Neutralizing Gas, Stench | Koffing, Kantonian Weezing                                                 |
| Gen IX        | Sharpness                | Gallade                                                                    |
| Gen IX        | Unburden                 | Sneasler                                                                   |

Greninja's Battle Bond, Zygarde's Power Construct and special Rockruff's Own Tempo are additional
technical-form access, not removed abilities. They already appear in current dataset slots,
including `abilitySpecial`, and therefore are not legacy entries.

## Exact-form exclusions and completeness

The source's replacement list, additional-access list (including Kubfu's removal), and related-form
list were mapped to the catalog of 1,595 indexed dataset records. The changes above are the complete
set of historical differences established by those sources as of the review date; this is not an
independent reverse engineering of every game's ability tables.

Do not inherit Gengar's Levitate into Mega or Gigantamax Gengar, Chandelure's Shadow Tag into Mega
Chandelure, or Scolipede's Quick Feet into Mega Scolipede. Those exact transformed identities do not
have the same historical assignments. Similarly, Hisuian changes do not apply to their original
regional counterparts, Zapdos's history does not apply to Galarian Zapdos, and Incarnate Enamorus's
history does not apply to Therian Enamorus.

Do not infer Cacophony for Whismur, Loudred or Exploud from speculation about an unused ability. No
documented species assignment is established by that suggestion.

## Scarlet/Violet storage correction

Alolan Meowth and Alolan Persian now include both `sv-s` and `sv-v` in `storableIn`, matching their
existing ordinary acquisition entries. Salvatore's
[League Club trade](https://bulbapedia.bulbagarden.net/wiki/Salvatore#Traded_to_the_player) supplies
Alolan Meowth; its normal evolution supplies Alolan Persian. This correction concerns the exact
forms' box compatibility, without changing regional Pokédex membership or current abilities.

## Validation

The Pokémon integrity checks validate every current/legacy ability reference, reject duplicate
legacy IDs and overlap with current slots, and protect both SV storage entries. Focused regressions
cover usable history, gender variants, exclusion of unreleased/unused abilities and transformations,
and schema round trips. The OpenAPI test verifies the optional string array is exposed to API
consumers.

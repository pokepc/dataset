# Pokémon evolution audit

Audit date: **2026-09-22**. This preserves the pre-migration findings. The accepted representation
and subsequent implementation are documented in [evolution methods](../pokemon-evolutions.md).
Counts and old field values below describe the audit snapshot, not the migrated dataset.

## Result and coverage

All **1,595 records / 1,025 species** were inventoried. There are **684 existing incoming evolution
links**. The audit identified **30 overlapping finding groups affecting 272 records**. These include
confirmed omissions, wrong form links, limitations of the flat schema, and localization work; **272
does not mean 272 incorrect evolution chains**.

The complete affected-ID lists and structured details are in
[evolution-findings.json](evolution-findings.json). The
[record coverage CSV](evolution-record-coverage.csv) contains one row for every local record, its
current evolution fields, applicable PokéAPI method-row IDs, finding IDs, and source links.

| Classification                                  | Records | Meaning                                                                      |
| ----------------------------------------------- | ------: | ---------------------------------------------------------------------------- |
| Existing evolution with findings                |     271 | One or more findings below; categories overlap                               |
| Missing evolution link                          |       1 | Melmetal                                                                     |
| Existing evolution, baseline matches            |     413 | No issue identified by these checks; not proof of completeness in every game |
| No predecessor species                          |     721 | Root species and their associated forms                                      |
| Intentional non-evolving alternate form         |      28 | Species has a predecessor, but this exact form does not evolve from it       |
| Transformation excluded from ordinary evolution |     161 | Classified using the existing battle-only/Mega/Primal/Gmax/fusion flags      |

The scope is **core-series evolution methods, historical alternatives, and the GO-only Meltan
exception**. This is not a complete Pokémon × game evolution-availability matrix, nor a full audit
of GO Candy, buddy tasks, costumes, and temporary event evolution rules. Those require separately
scoped methods. A species being present or obtainable in a game does not prove that its evolution
can be performed there.

### Efficient source strategy

- Downloaded **11 small PokéAPI CSV tables** in bulk rather than requesting 1,025 species or
  hundreds of evolution-chain endpoints. They contain **576 method rows for 484 evolved species**,
  including source/result form IDs. The JSON report records the files' URLs, sizes, and SHA-256
  hashes.
- Reused **1,025 cached Bulbapedia species pages** and **1,261 cached Serebii pages**. The Serebii
  pages cover **689 distinct species**, often with whole-family evolution diagrams. Bulbapedia
  coverage includes every species. Forms share species pages but their form-specific rows must be
  resolved.
- Parsed evolution sections, introductions, Serebii evolution-image labels, and form requirements
  locally. Used targeted manual inspection for exceptions and a few live documentation/aggregate
  method pages, rather than fetching every Pokémon again.
- Existing cache entries do not retain original fetch timestamps. They were read during this audit,
  but not all refreshed. Cache aggregate hashes are recorded; this is a reproducible inventory of
  the available evidence, not a claim that every source was fetched live on the audit date.

Primary bulk source:
[PokéAPI evolution CSV](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_evolution.csv).
The [PokéAPI documentation](https://pokeapi.co/docs/v2#evolution-chains) says `version_group`
records **introduction**, not all eligible games. Do not interpret it as an evolution-availability
whitelist. Its rows omit some alternatives documented by the other sources, including PLA item use.

### What already agrees

- Every existing predecessor resolves locally and belongs to the expected PokéAPI predecessor
  **species**. Six fail the stricter **form** check below.
- **444/445 stored levels**, **102/102 stored items**, and **19/19 stored known moves** match at
  least one applicable PokéAPI method. Shedinja's level 20 is documented by Bulbapedia/Serebii but
  is absent from PokéAPI's special `shed` row. No conflicting stored scalar value was found against
  all comparable alternatives. This check does not prove that other requirements/routes are present:
  Quilava's 14, for example, matches a route while omitting PLA's 17.
- All existing evolution item/move IDs resolve in the local catalogs.
- Antique/Phony Polteageist and Artisan/Counterfeit Sinistcha retain the correct source forms and
  corresponding pots/teacups. Basculegion correctly references White-Striped Basculin. Regional
  chains such as Obstagoon and Perrserker use their regional predecessors.
- No battle transformation has been given an ordinary `evolvesFrom` link.

## Confirmed data omissions and errors

| Finding   | Affected records | Correction                                                                                  |
| --------- | ---------------: | ------------------------------------------------------------------------------------------- |
| E01       |               36 | Record the trade trigger; currently even plain trade evolutions have no method field        |
| E02       |               22 | Record friendship; older Sylveon affection is a separate route                              |
| E03       |               14 | Record explicit male/female requirements, including distinct gender-result forms            |
| E04       |                6 | Correct exact predecessor forms, listed below                                               |
| E05       |                1 | Add Meltan → Melmetal, 400 Meltan Candy, GO only                                            |
| E06       |                1 | Palafin: level 38 **and another player in Union Circle**                                    |
| E07       |                1 | Shedinja: Nincada evolving into Ninjask, spare party slot, regular Poké Ball where required |
| E08 / E22 |            6 / 2 | Hidden-value branch conditions; Maushold additionally requires battle EXP                   |
| E09       |                2 | Toxtricity form depends on original Nature; mints do not change it                          |
| E10       |               63 | Alcremie needs exact Sweet and cream recipe, not one shared spinning sentence               |
| E12 / E30 |           2 / 11 | Add missing evolution-item catalog entries before introducing structured references         |
| E16       |                1 | Quilava: level 17 in PLA; retain level 14 elsewhere                                         |
| E19       |                2 | Cosmoem's result depends on the particular game, not just level 53                          |
| E21       |                3 | Walking evolutions need a subsequent level-up while outside the Poké Ball                   |
| E23       |                1 | Kingambit: defeated Bisharp must hold Leader's Crests                                       |
| E26       |               19 | Vivillon pattern selection needs origin/pattern eligibility metadata                        |
| E28       |                2 | Goodra requires overworld weather; normal Goodra also accepts fog in Gen VII                |

Counts overlap. Exact IDs and proposed values are in the JSON report, including the full Nature
lists and the nine Alcremie cream recipes.

### Wrong predecessor forms

| Result            | Current predecessor | Correct predecessor |
| ----------------- | ------------------- | ------------------- |
| `gastrodon-east`  | `shellos`           | `shellos-east`      |
| `sawsbuck-summer` | `deerling`          | `deerling-summer`   |
| `sawsbuck-autumn` | `deerling`          | `deerling-autumn`   |
| `sawsbuck-winter` | `deerling`          | `deerling-winter`   |
| `wormadam-sandy`  | `burmy`             | `burmy-sandy`       |
| `wormadam-trash`  | `burmy`             | `burmy-trash`       |

These forms exist locally. PokéAPI's required-form IDs agree with the form descriptions in
[Gastrodon](<https://bulbapedia.bulbagarden.net/wiki/Gastrodon_(Pok%C3%A9mon)>),
[Sawsbuck](<https://bulbapedia.bulbagarden.net/wiki/Sawsbuck_(Pok%C3%A9mon)>), and
[Wormadam](<https://bulbapedia.bulbagarden.net/wiki/Wormadam_(Pok%C3%A9mon)>).

Separately, **37 cosmetic female results** point to an unsuffixed predecessor even though a female
predecessor record exists (E25). For example, `weavile-f` points to `sneasel`, not `sneasel-f`.
Decide whether unsuffixed references are exact forms or aggregate species references before
mechanically changing these. This convention issue is not counted as six additional confirmed form
errors. There are 67 female result records overall; some legitimately have no distinct female
predecessor record.

### Important method details

- **Melmetal:** evolution happens only in GO using 400 Meltan Candy. Its absence is not justified by
  the lack of a main-series route.
  [Bulbapedia](<https://bulbapedia.bulbagarden.net/wiki/Melmetal_(Pok%C3%A9mon)#Evolution_data>),
  [Serebii](https://www.serebii.net/pokedex-sm/809.shtml).
- **Shedinja:** is an additional result when Nincada becomes Ninjask, not an exclusive branch.
  Generation III does not require a spare Poké Ball; later games require a regular Poké Ball.
  [Bulbapedia](<https://bulbapedia.bulbagarden.net/wiki/Shedinja_(Pok%C3%A9mon)#Evolution_data>).
- **Alcremie:** all 63 records have the same generic English condition. Store the seven Sweet
  choices independently from nine cream recipes. Duration/direction/time determine the cream; the
  held Sweet determines decoration. The exact evening window differs by game.
  [Bulbapedia](<https://bulbapedia.bulbagarden.net/wiki/Alcremie_(Pok%C3%A9mon)#Evolution_data>),
  [Serebii](https://www.serebii.net/pokedex-sv/alcremie/).
- **Wurmple / Maushold / Dudunsparce:** display a stable hidden-value note and the form
  distribution, not an instruction to retry for a new outcome. The result is predetermined for that
  individual. Maushold also needs battle EXP, unlike an unrestricted level-25 evolution.
  [Wurmple](<https://bulbapedia.bulbagarden.net/wiki/Wurmple_(Pok%C3%A9mon)#Evolution_data>),
  [Maushold](https://www.serebii.net/pokedex-sv/maushold/),
  [Dudunsparce](https://www.serebii.net/pokedex-sv/dudunsparce/).
- **Palafin / walking evolutions / Kingambit:** multiplayer, final level-up, and opponent item
  requirements are distinct conditions, respectively. Kingambit's own held item is not the
  requirement. [SV methods](https://www.serebii.net/scarletviolet/evolution.shtml),
  [Kingambit details](<https://bulbapedia.bulbagarden.net/wiki/Kingambit_(Pok%C3%A9mon)#Evolution_data>).
- **Rockruff:** Own Tempo is a distinct, visually identical form, not an ability that ordinary
  Rockruff gains using an Ability Capsule/Patch. The dataset only has ordinary Rockruff's ability
  list. Dusk Lycanroc's prose already mentions Own Tempo, but `evoFromAbility` is empty and the
  special source variant is unrepresented. Preserve this restriction and the Gen VII game gates;
  either add the variant or model explicit eligibility metadata.
  [Rockruff](<https://bulbapedia.bulbagarden.net/wiki/Rockruff_(Pok%C3%A9mon)#Evolution_data>).
- **Solgaleo / Lunala:** Sun/Ultra Sun/Sword/Scarlet versus Moon/Ultra Moon/Shield/Violet,
  respectively, at level 53. A game-set ID such as `sm` cannot distinguish this.
  [Cosmoem](<https://bulbapedia.bulbagarden.net/wiki/Cosmoem_(Pok%C3%A9mon)>).
- **Multiple predecessors:** male Burmy of any cloak can produce Mothim. Both Chest and transferred
  Roaming Gimmighoul can produce Gholdengo. Bulbapedia's Gimmighoul table shares its method/result
  cells across two rows with `rowspan=2`; flattened text incorrectly appears to omit the Roaming
  route. [Mothim](<https://bulbapedia.bulbagarden.net/wiki/Mothim_(Pok%C3%A9mon)#Evolution_data>),
  [Gimmighoul](<https://bulbapedia.bulbagarden.net/wiki/Gimmighoul_(Pok%C3%A9mon)#Evolution_data>).

## Schema gaps

The current schema has a single `evolvesFrom`, one level/item/move, four optional requirement
fields, and one English string. **No record uses `evoFromTrading`, `evoFromFriendship`,
`evoFromGender`, or `evoFromAbility`**. Filling these fields would fix several omissions, but would
not solve alternatives, exact-form eligibility, or game scope.

### Game-specific alternatives

| Family/method                       | Missing distinction                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Magnezone, Probopass, Vikavolt      | Magnetic area versus Thunder Stone; eligibility differs by game                                       |
| Leafeon, Glaceon                    | Moss/Ice Rock versus evolution stone; BDSP cannot be inferred from generation alone                   |
| Crabominable                        | Mount Lanakila level-up in Gen VII versus Ice Stone in SV                                             |
| Milotic                             | Beauty ≥170 level-up versus Prism Scale trade                                                         |
| Four ordinary trade species         | PLA adds Linking Cord while still supporting trade                                                    |
| Trade-held items                    | PLA directly uses Metal Coat, Protector, Electirizer, Magmarizer, Reaper Cloth, Upgrade, Dubious Disc |
| Chansey, Gliscor, Weavile, Sneasler | Hold-item level-up versus direct item use in PLA, retaining time conditions                           |
| Sylveon                             | Affection in Gen VI–VII versus friendship later, always knowing a Fairy-type move                     |
| Overqwil                            | PLA Strong Style uses; SV knowing Barb Barrage on level-up; ZA hit counter                            |
| Basculegion                         | Recoil counter without fainting; SV then needs level-up, PLA does not                                 |
| Urshifu                             | Interact with a tower's scroll in SwSh versus use the corresponding scroll item in SV                 |
| Runerigus                           | Dusty Bowl arch in SwSh versus Coulant Waterway bridges in ZA                                         |

References: [PLA methods](https://www.serebii.net/legendsarceus/evolution.shtml),
[SV methods](https://www.serebii.net/scarletviolet/evolution.shtml),
[ZA methods](https://www.serebii.net/legendsz-a/evolution.shtml), and the per-species Bulbapedia
evolution sections linked in the coverage CSV. These sources also expose gaps in PokéAPI: for
example, PLA's Thunder Stone route for Probopass predates the version group in its stone row.

Regional destination rules need scopes on **both** ordinary and regional destinations (E18).
Regional-origin metadata is not enough: evolution location/game matters, with exceptions such as
Ultra Space in USUM. Origin/pattern metadata also matters for Vivillon; do not pretend all 19
ordinary patterns are freely selectable from any Spewpa.

### Recommended representation

Add an optional **`evolutionMethods` array on the resulting record**. Each entry is one alternative
route; requirements within one route are combined. This keeps ordinary routes small while allowing
different games and multiple exact predecessor forms. Example design, **not an implemented schema**:

```json
{
  "evolutionMethods": [
    {
      "from": ["inkay"],
      "games": ["sv-s", "sv-v"],
      "trigger": "level_up",
      "minLevel": 30,
      "conditions": [{ "key": "device_upside_down" }]
    }
  ]
}
```

This example is only the SV route, not the complete Malamar game list. Use **concrete game IDs** to
support Sun versus Moon and remakes; never derive the list from `obtainableIn`/`storableIn` or
PokéAPI's introduction group. An omitted scope must mean **unreviewed/unspecified**, not all games.
Also preserve PLA's manual “Evolve” action in presentation rather than promising automatic
evolution.

Recommended reusable fields are `trigger`, `minLevel`, `gender`, `timeOfDay`, `knownMove`,
`knownMoveType`, and an item reference with a role (`held`, `used`, `bag`) and optional quantity.
Friendship, Beauty, affection, Nature, party member/type, trade partner, stat comparison, and
location can be typed conditions. References should use existing local IDs.

For unusual cases, **semantic condition keys plus typed parameters and an optional translated note
are enough**. Prefer `device_upside_down` over `inkay_method`: it describes the requirement, and a
generic `rotate_device` could also mean an unrelated rotation. Suggested keys:

| Key                                    | Parameters / use                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `device_upside_down`                   | Malamar; platform/controller caveats in a translated note                                   |
| `union_circle`                         | Another player present                                                                      |
| `walk_steps`                           | Count, mode (`lets_go`), final level-up handled by the route                                |
| `use_move` / `hit_with_move`           | Move ID, count, optional battle style; keep uses distinct from hits                         |
| `recoil_damage_without_fainting`       | Amount; Basculegion                                                                         |
| `damage_without_fainting`              | Amount, qualifying damage, location; exact Runerigus semantics need resolution              |
| `critical_hits_in_one_battle`          | Count; Sirfetch'd                                                                           |
| `defeat_species_holding_item`          | Opponent species, item, count; Kingambit                                                    |
| `spin`                                 | Direction, duration, time; Alcremie                                                         |
| `spare_party_slot` / `spare_poke_ball` | Shedinja, alongside an additional-result method                                             |
| `hidden_value_branch`                  | Stable note/form discriminator and displayed probability; no arbitrary expression execution |

Do not build a general rules engine or expose PokéAPI's postfix `condition_expression` directly. Use
a bounded, discriminated set of supported condition types so translation templates have stable
parameter contracts. Free-text evidence belongs in audit/source metadata; user-visible caveats need
a translation key or existing localized-text shape.

Keep source URLs and verification status/date per method or in a companion evidence file. Separate
`verified`, `partial`, and `disputed`; a Boolean “has evolution” cannot convey these differences.

### Item catalog and integrity

The 470-entry `data/items.json` lacks seven needed resources: Black Augurite, Peat Block, Scroll of
Darkness, Scroll of Waters, Linking Cord, Leader's Crest, and Gimmighoul Coin. Add appropriate
non-held evolution items/bag materials before referencing them. The catalog does already contain the
seven Sweets and existing recorded evolution items.

Current integrity tests check predecessor and evolution-ability references but do not check
`evoFromItem` or `evoFromMove`. Add these checks when implementing fixes, plus method-scoped game,
form, item, move and Nature references, and prevent ordinary evolution from inheriting into
temporary transformations. No currently stored item/move reference was found dangling.

## Exceptions and unresolved details

Do **not** fill every missing link by copying the species chain. The 28 deliberately excluded
alternate records are Eternal Flower Floette, Bloodmoon Ursaluna, Poké Ball Vivillon, eight cap
Pikachu, and 17 memory-type Silvally. The Silvally forms are obtained by changing the evolved
Silvally's form, not separate Type: Null evolution outcomes. Temporary transformations are also
excluded. Evolution blockers such as partner/cap/Cosplay Pikachu, partner Eevee and the relevant
Gigantamax Factor restrictions need to remain distinct from appearance-only form inheritance.

Two source conflicts are retained as E29:

- **Runerigus:** Bulbapedia describes accumulated qualifying attack damage without fainting,
  allowing healing; Serebii's ZA page describes currently missing more than 49 HP. The local “49+ HP
  lost” sentence lacks the necessary precision. Verify the counter/threshold against game behavior
  or implementation before encoding it as an executable condition.
- **Overqwil in ZA:** Bulbapedia distinguishes **hits**, including multiple targets, whereas
  Serebii/PokéAPI summarize **uses**. Preserve this distinction and verify the exact counter before
  automation. The game-specific route itself is established.

No unsupported discrepancy was automatically applied. Sources sometimes contain their own table
errors (for example mismatched Pokédex numbers on Serebii's PLA/ZA method pages), so match names and
forms instead of copying numeric labels blindly.

## Suggested implementation order

1. Correct the six confirmed form links and add the missing trade/friendship/gender information with
   clear legacy-field semantics. Add Melmetal's GO-only route and the obvious missing notes.
2. Introduce optional method arrays and item roles, extend the item catalog, and migrate the known
   game/form alternatives. Keep legacy fields as a compatibility summary until consumers migrate.
3. Convert the 114 English condition strings to semantic translation keys, expand Alcremie recipes
   and Vivillon eligibility, and settle the cosmetic-female predecessor convention.
4. Resolve the two disputed counters and separately audit a complete game matrix / GO mechanics if
   the product needs executable eligibility rather than a correct evolution guide.

Validation for this report: full record/species counts, predecessor-species and form comparison,
scalar comparison against form-matched bulk rules, local item/move reference checks, and artifact
consistency checks. No runtime behavior changed, so application build/test suites were not needed.

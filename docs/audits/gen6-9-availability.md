# Generation 6–9 availability audit

Audited on 2026-09-19 following
[the availability feedback](https://pokepc.net/feedback/fbp-03yjpo7usb15f#comment-fbc-04ky2kc3s4e87).

## Scope and method

Reviewed XY, ORAS, SM, USUM, Let's Go, Sword/Shield with DLC, BDSP, Legends: Arceus, Scarlet/Violet
with DLC, and Legends: Z-A with DLC: 18 game-version IDs. GO, HOME, and Champions were not
independently reclassified.

Compared all 1,101 species/regional-form rows in
[Bulbapedia's availability matrix](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability)
with the dataset, then checked form mechanics and Serebii's encounters, gifts, version exclusives,
transfer lists, and event histories. The dataset contains 1,595 records including gender
differences, cosmetics, and battle forms. Checked every stored record in the scoped games for an
acquisition classification; retained battle-only forms outside box storage.

The overview matrix is a baseline, not an automatic import: it omits some historical events, groups
cosmetic forms, and sometimes combines acquisition through another version with native encounters.
Form-specific and event sources below take precedence.

## Classification decisions

- `obtainableIn`: a permanent in-game encounter, gift, trade, breeding/evolution route, or supported
  form change. DLC and save-data bonuses count. A locally available trade evolution counts;
  receiving a species exclusive to another version does not make it native.
- `eventOnlyIn`: a historical, temporary distribution or event encounter is the only native source,
  including its breedable offspring and obtainable evolutions/forms. This does not mean the
  distribution is still running. Ordinary availability takes precedence over events.
- `transferOnlyIn`: compatible with the game but needs an imported/traded Pokémon when no permanent
  native or documented historical event route exists. Imported GO/HOME gifts are transfers in the
  destination game. This includes Meltan/Melmetal in Let's Go and Melmetal in Sword/Shield.
- `storableIn`: legal box compatibility, independent of regional Pokédex membership. Original Color
  Magearna was unreleased in Gen 7 and cannot travel backwards from HOME, despite having game data
  there. Remove those four storage entries.
- Permanent offline QR gifts (Magearna and USUM Partner Cap Pikachu) are `obtainableIn` under the
  existing schema's anytime-acquisition rule, even when a source calls them events.
- Preserve version-native distinctions for SV Union Circle encounters and Sword/Shield Dynamax
  Adventures hosted by the opposite version. Documented events playable in both versions, including
  event outbreaks and distributions, are accounted for separately.
- Ordinary Vivillon patterns use the existing XY convention: availability across supported save
  regions, not all patterns on a single save. Fixed Fancy/Poké Ball patterns require their own
  evidence. Likewise, ORAS's event Pumpkaboo is Super Size, not every size.

## Results

The first pass changed 851 Pokémon JSON records, only in the four availability/storage arrays. The
table below records that first-pass snapshot. Counts include separate gender and cosmetic records;
changed counts overlap between versions.

| Game version                      | Storable records after audit | Changed records |
| --------------------------------- | ---------------------------: | --------------: |
| X / Y                             |                    942 / 942 |         95 / 93 |
| Omega Ruby / Alpha Sapphire       |                    943 / 943 |       109 / 104 |
| Sun / Moon                        |                1,076 / 1,076 |       717 / 717 |
| Ultra Sun / Ultra Moon            |                1,085 / 1,085 |       582 / 583 |
| Let's Go Pikachu / Eevee          |                    193 / 193 |         17 / 20 |
| Sword / Shield                    |                    881 / 881 |         73 / 68 |
| Brilliant Diamond / Shining Pearl |                    647 / 647 |         42 / 46 |
| Legends: Arceus                   |                          368 |               0 |
| Scarlet / Violet                  |                1,039 / 1,039 |         49 / 47 |
| Legends: Z-A                      |                          488 |               1 |

### Gen 6 and 7

- Restored missing Island Scan encounters and their breeding/evolution families, including
  Fennekin/Braixen from USUM Delphox; propagated the routes to relevant gender differences, Rotom
  appliances, and ordinary Vivillon patterns. SM and USUM have different rosters.
- Filled the widespread Gen 7 transfer/event classification gaps for compatible non-native species
  and forms. Corrected XY Friend Safari availability and version restrictions.
- Distinguished historical gifts from imports, including XY Fancy/Poké Ball Vivillon, ORAS Poké Ball
  Vivillon and its offspring, and ORAS Super Size Pumpkaboo/Gourgeist.
- Corrected Let's Go version exclusives and GO-only Meltan/Melmetal acquisition.

Sources: Serebii's [SM Island Scan](https://www.serebii.net/sunmoon/qrscanner.shtml),
[USUM Island Scan](https://www.serebii.net/ultrasunultramoon/islandscan.shtml),
[Rotom forms](https://www.serebii.net/pokedex-sm/479.shtml),
[USUM QR gifts](https://www.serebii.net/ultrasunultramoon/qrevents.shtml),
[Vivillon events](https://www.serebii.net/events/dex/666.shtml),
[Pumpkaboo events](https://www.serebii.net/events/dex/710.shtml),
[Let's Go exclusives](https://www.serebii.net/letsgopikachueevee/exclusives.shtml),
[GO connectivity](https://www.serebii.net/letsgopikachueevee/goconnectivity.shtml), and Bulbapedia's
[Vivillon region settings](https://bulbapedia.bulbagarden.net/wiki/List_of_Nintendo_3DS_country_and_region_settings).

### Gen 8

- Corrected Sword/Shield and BDSP exclusives falsely marked native in both versions; retained event
  exceptions and reflected form/gender variants.
- Included gifts and historical distributions beyond regional dexes. BDSP Mew/Jirachi and Legends:
  Arceus save-data gifts remain ordinary obtainable Pokémon; BDSP Darkrai/Shaymin remain
  event-dependent. No Legends: Arceus corrections were needed.

Sources: Serebii's
[Sword/Shield transfer roster](https://www.serebii.net/swordshield/transferonly.shtml),
[Dynamax Adventures](https://www.serebii.net/swordshield/dynamaxadventurespokemon.shtml),
[serial gifts](https://www.serebii.net/swordshield/serialcode.shtml),
[Dynamax Crystals](https://www.serebii.net/swordshield/dynamaxcrystals.shtml),
[Wild Area events](https://www.serebii.net/swordshield/wildareaevents.shtml), and
[BDSP exclusives](https://www.serebii.net/brilliantdiamondshiningpearl/exclusives.shtml).

### Gen 9

- Added Alolan Meowth/Persian to both SV storage and ordinary availability (Salvatore's League Club
  trade). Also corrected Scarlet Gulpin/Swalot via Jacq's League Club trade.
- Incorporated historical raid, outbreak, and serial-code routes for compatible non-native Pokémon,
  including Alolan Raichu, Hisuian forms, Deoxys/Keldeo/Zarude and opposite-version exclusives.
  Evolved/form-changed records inherit only routes that the game supports.
- Cross-checked SV's unsupported-species list against storage: the supported 733 species were
  already represented; the missing storage entries were the two Alolan cat forms.
- Meloetta was already obtainable in SV. Alolan Sandshrew/Sandslash were already absent from
  Kitakami's regional dex. Regional dex membership and obtainable rosters stay separate.
- Z-A's Lumiose/Hyperspace and transfer lists already covered its 364 stored species, including
  transfer-only forms. Reclassified Zeraora as event-dependent because its mission requires the
  Mystery Gift Mewtwo/Diancie missions. No storage expansion was needed.

Sources: Serebii's
[League Club trades](https://www.serebii.net/scarletviolet/leagueclubtrades.shtml),
[SV non-dex Pokémon](https://www.serebii.net/scarletviolet/pokemonnotindex.shtml),
[unsupported species](https://www.serebii.net/scarletviolet/unobtainable.shtml),
[transfer roster](https://www.serebii.net/scarletviolet/transferonly.shtml),
[serial gifts](https://www.serebii.net/scarletviolet/serialcode.shtml),
[raid events](https://www.serebii.net/scarletviolet/teraraidbattleevents.shtml),
[outbreak events](https://www.serebii.net/scarletviolet/massoutbreakevents.shtml),
[Z-A Lumiose roster](https://www.serebii.net/legendsz-a/availablepokemon.shtml),
[Hyperspace roster](https://www.serebii.net/legendsz-a/hyperspacepokedex.shtml),
[transfer-only forms](https://www.serebii.net/legendsz-a/transferonly.shtml),
[Zeraora mission](https://www.serebii.net/legendsz-a/sidemissions/raginglightning.shtml), and
Bulbapedia's [Salvatore](https://bulbapedia.bulbagarden.net/wiki/Salvatore).

## Verification and boundaries

### Retained second-pass fixes

At the user's request, only the following second-pass data corrections were retained; all other
unstaged second-pass changes were reverted to the staged first-pass checkpoint:

- Nine Furfrou trims: removed Gen 6 box storage. They revert on deposit in Gen 6, but on withdrawal
  in Gen 7, so Gen 7 storage remains. See
  [Furfrou form data](<https://bulbapedia.bulbagarden.net/wiki/Furfrou_(Pok%C3%A9mon)#Form_data>).
- Hoopa Unbound: removed ORAS box storage for the same deposit-reversion behavior; retained its
  staged acquisition classifications. See
  [Hoopa form data](<https://bulbapedia.bulbagarden.net/wiki/Hoopa_(Pok%C3%A9mon)#Form_data>).
- Original Color Magearna: classified its HOME gift as `eventOnlyIn`, as requested; its transfer
  destinations are unchanged. See
  [HOME gifts](https://www.serebii.net/pokemonhome/giftpokemon.shtml).
- Removed six event/transfer overlaps across five Mega-form records: Charizard X in Y, Charizard Y
  in X, Pinsir in Y, Heracross in X, and Blaziken in both X/Y. Kept their existing transfer entries.

These changes affect 16 Pokémon records and have focused regression coverage. The staged checkpoint
was preserved; the broader transfer/event reclassification was not retained.

### First-pass verification

Regression tests cover distinct acquisition mechanisms, missing feedback cases, form-specific
exceptions, and the invariant that each stored record has exactly one acquisition category in the
audited versions. Transfer-only references are now included in game-reference validation.

Validation: all 6,983 existing data-integrity checks and 59 new availability checks passed;
`tsc --noEmit`, formatting checks on changed files, and `git diff --check` passed. An initial new
test incorrectly expected Crowned Zacian to be boxed in Sword/Shield; corrected that expectation and
added a regression for its different Sword/Shield and SV storage behavior.

The authoritative changes are in `data/pokemon`; no schema/API change or generated Champions data is
required. Regional dexes and regional box presets were not expanded with non-dex Pokémon. This is a
dated availability audit, not a live event calendar or a guarantee that old transfer
services/distributions remain accessible. Ability/gender-model feedback and Gen 5 Victini are
outside the requested Gen 6–9 availability scope.

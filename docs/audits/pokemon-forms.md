# Form-change audit — 2026-09-22

The initial dataset pass covers the inventory of **1,595 records / 1,025 species**, including all
**307 species with multiple records**. It adds **1,082 incoming methods to 494 records**, including
reverse transitions, and removes **140 legacy `formItem` fields**. This is a researched core-series
baseline; it is not a claim of exhaustive game-by-game coverage. **56 methods have unknown game
scope**. Even explicit game lists can be incomplete.

The subsequent compact migration stores **591 forward/independent methods on 261 records**. It moves
491 standalone returns into nested `revert` rules. Expansion exactly preserves all **16,445 distinct
directed form/game/condition combinations**, including item roles and localized notes. The
[comparison artifact](form-methods/compact-reverts.json) records the baseline commit, normalized
transition digest, and byte sizes. The initial flat-method counts above remain historical.

With records sorted identically, the form-method payload falls from **296,584 to 252,673 bytes
minified** (14.8%) and **17,797 to 15,049 bytes gzipped** (15.4%). These sizes measure method data
and record IDs, not the full Pokémon bundle. Gzip size depends on record order. Alcremie's 126
incoming return objects become one `revert` array on its Gigantamax method.

## Acquisition of evidence

The species cache supplied all 307 candidate pages without individual new requests. The audit read
their Form data sections and used targeted Serebii/species/Ability/item pages for version
differences and disagreements. PokéAPI's `forms_switchable` metadata is only a candidate signal: it
does not describe methods, misses known switchers, and can include fixed forms. It was not used to
generate transitions or as a coverage gate. See
[PokéAPI's species and form documentation](https://pokeapi.co/docs/v2#pokemon-species).

The reviewed species manifests are [persistent/manual changes](form-methods/persistent.json) and
[battle/automatic changes](form-methods/battle.json). They record citations and remaining gaps per
species. The [record coverage table](form-methods/coverage.csv) classifies every dataset record; a
fixed-form classification is not an assertion about all future games. Its method counts describe the
initial flat representation, before compact reversions. The
[cached source index](form-methods/sources.csv) records the candidate page URLs and content hashes.

Generic rules use [Mega Evolution](https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution),
[Gigantamax](https://bulbapedia.bulbagarden.net/wiki/Gigantamax), and
[Primal Reversion](https://bulbapedia.bulbagarden.net/wiki/Primal_Reversion), with exact parent/item
relationships checked against the cached species sections. These rules distinguish held Mega Stones
from the Bag requirement in Let's Go, Z-A's Mega Gauge, and ordinary versus Primal reversion.
Type/mask/Drive/Memory methods use the cached Arceus, Genesect, Silvally and Ogerpon pages.

## Corrections and safeguards

- Added previously absent Mega Stone requirements for Staraptor, Heatran, Darkrai and Zeraora. Their
  four items already existed in the catalog.
- Removed misplaced `mawilite` from ordinary Mawile. Mega Mawile retains the requirement.
- Added 14 missing form-change resources to the item catalog.
- Source identities survive shared Mega/Gigantamax forms, all 63 Alcremie combinations, Minior core
  colors, and Necrozma's two possible pre-Ultra fusions.
- Mega Zygarde starts from Complete Forme; Magearna Original Color, Tatsugiri variants, Eternal
  Floette, and regional Darmanitan do not gain incorrect cross-form links.
- Arceus methods exclude Fairy as a source before Generation VI. Legend Plate behavior is a Legends:
  Arceus mode; held-Plate and held-Z-Crystal rules are separate. `judgment_type_match` means the
  target form's type is selected by the Legend Plate's effectiveness/resistance rules, including
  random choice among remaining ties. It is not a freely chosen type.
- Power Construct uses HP **at most** 50%, following the dedicated Ability sources over the species
  page's conflicting “below half” description. Living-HP requirements remain explicit.
- Eternamax is an unobtainable boss state. Eternabeam's animation does not create a player form
  transition, so no method was invented.

## Limits retained for follow-up

- Pokémon GO costs, unlocks, regional/event trim restrictions, fusion resources, Mega Energy and
  Primal Energy are not included. Champions and other spin-off mechanics are not a verified matrix.
- Fixed regional/gender/cosmetic forms remain distinct. Gaining a Gigantamax Factor via Max Soup is
  eligibility metadata, not itself a switch between dataset records. Melmetal's special source of
  the factor is not generalized to other individuals.
- Cosplay Pikachu's interchangeable costumes and Ogerpon's Terastallized mask states have no
  corresponding records here. This migration does not create those identities. Battle Bond Greninja
  and hidden Minior color identities remain collapsed in the existing base records.
- Furfrou and Hoopa timer/storage behavior in Generation IX remains partly unresolved; no expiry
  rule was copied blindly from older games. Kitakami's seasonal form changes and some PLA storage
  behavior also remain unmodeled. The species audit lists the details.
- The adjacent Primal Reversion descriptions disagree about Z-A's in-battle recall/end timing. Only
  the documented out-of-battle recall reset is asserted for Z-A. Some other battle edge cases,
  Contest changes, and animation-only behavior are outside the baseline.
- The model does not track every story unlock, occupied fusion device, party-capacity restriction,
  move replacement, or battle legality exception. Conditions and notes describe supported routes;
  applications must not treat them as a complete legality simulator.

## Item assets

Read-only GET checks at `https://static.pokepc.net/images/items/gen9-style/{id}.webp` on the review
date returned **13 HTTP 200 responses with valid RIFF/WEBP signatures**. **`zygardecube` returned
HTTP 404**. The [asset report](form-methods/item-assets.json) contains the individual results. No
CDN content was changed. The missing asset does not justify changing the normalized item ID or
inventing an alias.

Source URLs and audit/verification metadata are kept exclusively in development documentation, not
inside the bundled Pokémon methods or item records.

## Validation

Initial form-data migration:

- Root and editor typechecks passed.
- Root suite: 46 files / 9,072 tests passed. Editor suite: 11 files / 129 tests passed.
- Data and library builds, editor production build, package consumer smoke test, and `publint`
  passed. The pinned pnpm launcher stalled in this environment; equivalent installed binaries were
  used, and the consumer smoke test reused the completed build rather than invoking pnpm again.
- The data build retains the pre-existing upstream-ID warnings for 3 abilities, 39 items and 1 move;
  package lint retains its existing repository-URL suggestion.
- Formatting and `git diff --check` passed. No browser interaction changed, so no browser E2E run
  was needed.
- A second migration run reports zero changes. Comparison with the original records confirms that
  only `formItem` removal and `formMethods` addition changed Pokémon values.

Compact-reversion migration (2026-09-23):

- Root suite: 47 files / 9,088 tests passed. After the helper review fix, the focused helper and
  form-integrity suites passed all 8 tests, including a new regression for separate entry methods
  sharing a destination. Root and editor typechecks passed.
- Editor suite: 11 files / 129 tests passed. Library build, editor production build, package
  consumer smoke test and `publint` passed, with the existing repository-URL suggestion.
- Expanding compact data reproduces the baseline's 16,445 normalized transitions and digest. All
  1,595 records preserve every value outside `formMethods`; no items were added or changed.
- The migration is idempotent. Formatting and `git diff --check` passed. Installed binaries and the
  already-built package were used as described above; the unrelated `data-next` build was not
  repeated.

# Pokémon availability CLI

Read the [canonical field definitions](pokemon-availability.md) for acquisition, storage, shiny
availability, and related form metadata. The rules below describe how the tools implement them.

The availability tools parse two Bulbapedia pages:

- [List of Pokémon by availability](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability)
- [List of Pokémon by availability in Pokémon GO](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO)

Each command loads both complete lists once. Bulk review shares the parsed tables across all
records. Species articles, PokéAPI encounters, Serebii pages, and AI verdicts are no longer part of
this workflow. No API key is required.

## Single Pokémon

```bash
pnpm pokemon:availability pikachu
pnpm pokemon:availability 0026-alola
pnpm --silent pokemon:availability 25 --json
pnpm pokemon:availability pikachu --patch
```

IDs, NIDs, and numeric shorthand are accepted, including form suffixes. Default output shows one row
per concrete dataset game. `--json` prints only the identity and four availability properties to
stdout; source URLs and warnings go to stderr. `--patch` overrides table/JSON output, applies the
candidate, formats the file with the repository's Oxfmt configuration, and prints added/removed
games.

The three acquisition fields can change. The explicit inheritance rules below also copy `storableIn`
from the base, with form-specific exceptions. Held-item forms exclude HOME; other records preserve
storage membership and ordering. Unrelated Pokémon properties are preserved. Acquisition arrays use
dataset game order. The patcher checks that availability has not changed since the record was loaded
and that the file has not changed during formatting; a concurrent edit stops replacement. Writes use
a temporary file and atomic rename.

## Bulk review

```bash
pnpm pokemon:availability:all
pnpm pokemon:availability:all --skip-unchanged
pnpm pokemon:availability:all --from 0122-galar
pnpm pokemon:availability:all --dry-run
pnpm pokemon:availability:all --from tauros-paldea --patch-all --skip-unchanged
```

Records are visited in `data/indices/pokemon.json` order, including forms. The shared source pages
are validated before any Pokémon file is patched. Each record shows its identity, warnings, and
proposed changes, followed by:

```text
p) patch  s) skip >
```

- `p` patches and formats the current file, then advances. A patch failure stays on the current
  record.
- `s` skips without writing.
- `--from <id|nid>` starts at that record, inclusive. Earlier records receive no reports or writes.
  An unknown ID fails before source loading.
- `--skip-unchanged` skips the prompt when no availability membership changes. It keeps warnings
  visible; unchanged values may have been retained because the source lacks the selected form.
- `--patch-all` patches automatically without stdin or prompts. It stops at the first report or
  patch error, prints a `--from` recovery hint, and exits nonzero. Earlier completed patches remain
  saved.
- `--dry-run` visits the range without stdin, prompts, or writes. It prints proposals and warnings,
  then totals for reviewed, changed, unchanged, warning-bearing, and failed records. Individual
  report failures are counted and the remaining records are reviewed; any failure exits nonzero. It
  cannot be combined with `--patch-all`.

Ctrl+C cancels active source requests and stops the loop. A file replacement already started
finishes safely, and completed patches remain saved. Interactive end of input also stops the run.
There is no persisted cursor; use `--from` to resume.

## Source rules and limits

The main parser follows the page's legend, game columns, and stated version order instead of
interpreting prose from species articles. Codes for ordinary in-game acquisition, evolution,
breeding, and related routes map to `obtainableIn`. Transfer and trade routes map to
`transferOnlyIn`. Event codes are case-sensitive.

`eventOnlyIn` means obtainable through an in-game event route, including an event-unlocked catch. It
does not mean a distributed Pokémon or a guarantee that trading is impossible. A game in
`eventOnlyIn` must not also appear in `obtainableIn` or `transferOnlyIn`; the dataset integrity
tests reject both overlaps. `storableIn` is independent and may overlap any acquisition field.

| Main-table labels          | Dataset classification |
| -------------------------- | ---------------------- |
| `EV`, `EVE`, `EVD`, `CCEV` | `eventOnlyIn`          |
| `Ev`, `EvB`, `EvE`, `EvET` | `transferOnlyIn`       |
| `PW`, `PWE`                | `transferOnlyIn`       |

Pokéwalker is external to HeartGold/SoulSilver. The GO page determines GO availability
independently. GO release tables establish historical release, not current spawns or event
exclusivity. Released entries default to `obtainableIn`; researched exact-record exceptions in
`go-event-availability.ts` use `eventOnlyIn` for limited-claim research/pass routes and their
dependent evolutions. See the
[GO legendary/mythical audit](audits/go-legendary-mythical-availability.md) for sources and retained
permanent-research/recurring-raid routes. These rules add no runtime fetches, appear with a rule
basis and their own source link, and cannot establish release by themselves. Explicit unreleased
entries and future/TBA releases are unavailable; unlisted forms remain unverified unless an explicit
inheritance rule applies. Image filenames distinguish forms whose visible label contains only the
species name. Contradictory released/unreleased entries retain existing data with warnings.

The main source does not enumerate every nonregional alternate form. Unmatched forms retain the
existing classification and emit warnings; a species row is not silently treated as proof for an
unlisted alternate form. Cosmetic female records inherit their corresponding parent form's source
availability, except that Generation 1 is excluded from all three acquisition arrays because those
games have no genders. Female-only species are not cosmetic female records.

Games and services absent from the source tables retain saved values, copying the base's values for
the explicitly inherited forms below. Those saved classifications never count as source evidence.
Champions is an explicit exception: native recruits cannot be exported, so `obtainableIn` always
excludes it, even for saved or inherited data. A verified visitor route can establish
`transferOnlyIn`; otherwise visitor eligibility remains unknown. This policy does not alter storage.
Storage membership is never inferred from acquisition codes. Explicit HOME and exclusive-game rules
can establish additional cells. An empty source cell is inconclusive and retains that game with a
warning. Unknown codes or malformed table structure fail parsing instead of producing an empty
candidate.

### Base-form inheritance

The agreed families inherit their base's main-table availability and saved storage:

- Pumpkaboo/Gourgeist sizes, Alcremie flavors/sweets, and Unown A–Z.
- Arceus/Silvally types and Flabébé/Floette/Florges colors.
- Furfrou trims, Minior cores, Rotom appliances, and Genesect drives.

Exact GO entries take priority, including explicit unreleased or inconclusive entries. Only a
missing GO form entry falls back to the base's GO entry. Inconclusive main cells retain the form's
existing values; they do not borrow saved base data as evidence. Missing sibling records are
reported instead of inventing a base. Outside the source tables, acquisition copies saved base
values and remains marked as dataset data.

Legendary Plate Arceus has acquisition and storage only in Legends: Arceus. Eternal Floette has
acquisition only in Legends: Z-A and retains its existing storage. Rotom appliances exclude games
before Platinum, including Diamond/Pearl, from acquisition and storage. Minior cores use the species
source row but inherit storage from the red core, never the battle-only Meteor form.

Rotom's five appliance forms are `transferOnlyIn` and `storableIn` in HOME. They do not require a
held item to keep their forms, and they do not inherit base Rotom's HOME gift acquisition.

Forms that require a held item cannot retain that form in HOME. This excludes HOME from all four
availability fields for Arceus types, Silvally types, Genesect drives, the Origin forms of
Dialga/Palkia/Giratina, Crowned Zacian/Zamazenta, Ogerpon's held masks, and held-item Mega/Primal
forms. The HOME restriction applies even without a base record and overrides base-form acquisition
inheritance. An item used to change or evolve a form does not by itself establish a held-item
requirement.

Furfrou trims copy base storage except XY/ORAS and Bank, where deposit removes the trim. Gen VII
storage remains valid because reversion happens on withdrawal; GO, HOME and later saved storage are
retained. This is an explicit
[form-storage rule](<https://bulbapedia.bulbagarden.net/wiki/Furfrou_(Pok%C3%A9mon)#Form_data>), not
an additional page fetched by the parser.

Cap Pikachu and Unown ?/! do not inherit these ordinary base rules. Mega/Gigantamax transformations
keep their separate rules below.

### Researched remaining forms

The [ordinary-form audit](audits/ordinary-form-availability.md) and
[special-form audit](audits/special-form-availability.md) cover all 83 previously unresolved
records. Their main-game rules live in `curated-form-availability.ts` and do not add GO species
fallback.

- Ability/move-driven battle forms follow the corresponding main-game base acquisition, including
  explicit LZA mechanic exceptions. They never inherit base storage or native HOME gifts.
- Persistent ordinary variants use researched current-game encounters/evolutions. Antique/Artisan
  forms cannot be inferred from breeding alone. Introduction gates and item mechanics limit the
  legendary forms, Primals, Unown punctuation, and Deoxys's Gen III version-specific forms.
- Fusions evaluate both the host and its particular partner, preserving version differences. Fused
  Pokémon cannot enter Bank/HOME. Ultra Necrozma is restricted to USUM.
- Cap distributions and Dada Zarude use external routes; Partner Cap's USUM QR gift is event-only.
  Ash-Greninja requires the external SM demo and transforms only in Gen VII. Eternamax is not a
  playable obtainable main-game form. Hisuian Samurott is explicitly unavailable in LZA.
- Storage retains existing values except researched temporary-state and deposit-reversion
  exclusions, including Hoopa Unbound in ORAS, and adds the confirmed Gen III compatibility for
  punctuation Unown. Shiny fields are unchanged.

GO uses its exact release entries. Two researched shared identities are mapped narrowly: Active
Xerneas is its automatic appearance, and both Toxtricity variants share Gigantamax. An exact form
entry takes precedence over either alias, including explicit unavailability. These aliases never
infer a Gigantamax release from an ordinary Toxtricity release.

### Curated Vivillon patterns

All 20 Vivillon patterns use a [curated game-by-pattern matrix](audits/vivillon-availability.md),
including the unsuffixed Icy Snow record and the two special patterns. Positive species cells never
establish a pattern’s availability. Scarlet/Violet postcard-dependent patterns are `transferOnlyIn`
by user policy. GO is still parsed independently and storage is preserved. The research references
are recorded alongside the rules; no additional pages are fetched at runtime.

### Mega and Gigantamax rules

Explicit rules supplement the main list for transformations. The dataset's `debutIn` selects the
Mega group; the [Mega Evolution reference](https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution)
is not fetched or parsed at runtime.

| Mega group   | Supported games                                        |
| ------------ | ------------------------------------------------------ |
| XY           | XY, ORAS, Sun/Moon, Ultra Sun/Ultra Moon, Legends: Z-A |
| ORAS         | ORAS, Sun/Moon, Ultra Sun/Ultra Moon, Legends: Z-A     |
| Legends: Z-A | Legends: Z-A                                           |

Older Kanto Megas also work in Let's Go. Mega Latias/Latios are a documented exception to their ORAS
debut: XY supports them with Mega Stones traded from ORAS, mapped to `transferOnlyIn`. Supported
transformations require a qualifying base Pokémon: a transfer-only base makes the Mega
`transferOnlyIn`, while an ordinary native base route permits `obtainableIn`. `eventOnlyIn` is
inherited from the base form's main-table in-game event gate. Exact base forms take precedence over
species rows. Unrecognized introduction groups and inconclusive base cells remain unverified.

Gigantamax forms are `obtainableIn` in Sword/Shield, except Gigantamax Melmetal: its HOME gift is
`eventOnlyIn`, and Sword/Shield are `transferOnlyIn`. GO Mega, Primal, fusion, and Gigantamax
availability always comes from the GO page's separate tables. Champions Mega/Gigantamax coverage
remains unresolved; future planned coverage is not treated as current availability.

The 2026-09-22 source audit covered all 1,595 dataset records. The main page had 1,025 species,
1,101 distinct rows, and 40 mapped games. Parsed rows plus researched rules now cover every record
within those main-game columns. GO resolves 1,585 records; 10 exact identities remain absent from
its source: the eight cap Pikachu, Dada Zarude, and Eternamax Eternatus. These GO gaps retain their
saved values and warnings, not invented base-form releases. An explicit unavailable cell also counts
as coverage. Games outside the lists have only explicitly researched rules; copied saved base values
do not close source-coverage gaps. Storage and shiny fields are not certified by these coverage
counts.

The local coverage generator and report live together:

```bash
node .local/generate-uncovered.ts
node .local/generate-uncovered.ts --as-of 2026-09-22
```

The generator uses saved `.local/availability/main.html` and `go.html` snapshots without network
requests. It accepts `--main-html`, `--go-html`, `--output`, and `--as-of`. The JSON includes source
hashes, rule coverage, record IDs and form names, unresolved games, and evidence for inconclusive
cells. Explicit unavailability counts as coverage; saved dataset values do not. Neither command
patches dataset records. These local artifacts are ignored by Git.

## Cache and saved HTML

Live pages are cached under `.local/bulbapedia` using URL-based SHA-256 filenames and cache
version 2. `BULBAPEDIA_CACHE_DIR` overrides that directory. Complete source HTML is validated before
it is cached or reused. There is no automatic expiry; `--refresh-sources` explicitly refreshes both
lists. A failed refresh reports an error and leaves the old cache file intact.

For a reproducible, fully offline run, save both complete pages and provide both paths:

```bash
pnpm pokemon:availability raichu-alola \
  --html /tmp/availability.html --go-html /tmp/go-availability.html

pnpm pokemon:availability:all --dry-run \
  --html /tmp/availability.html --go-html /tmp/go-availability.html
```

`--html` and `--go-html` must be supplied together. They bypass network access and caching,
including when `--refresh-sources` is supplied. Do not pass species pages to these options.

Requests have a 30-second timeout. HTTP errors, challenge pages, missing legends, and invalid tables
fail before output or patching. The CLI fetches only these two URLs and does not crawl linked pages.

The old `--with-ai`, `--ai-harder`, and `--no-cross-check` flags and interactive AI action have been
removed. Unknown options fail explicitly.

## Development

```bash
pnpm exec vitest run src/upstream-adapters/bulbapedia
pnpm typecheck
```

Tests use source-shaped HTML fixtures, mocked requests, offline CLI subprocesses, and disposable
datasets. They do not fetch live pages or patch checkout data.

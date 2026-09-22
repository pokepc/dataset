# Pokémon availability CLI

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

Only `obtainableIn`, `transferOnlyIn`, and `eventOnlyIn` can change. Storage membership, storage
ordering, and unrelated Pokémon properties are preserved. Acquisition arrays use dataset game order.
The patcher checks that availability has not changed since the record was loaded and that the file
has not changed during formatting; a concurrent edit stops replacement. Writes use a temporary file
and atomic rename.

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
independently. GO release tables establish historical availability (`obtainableIn`), not current
spawns or exclusive events. Explicit unreleased entries and future/TBA releases are unavailable;
unlisted forms remain unverified. Image filenames distinguish forms whose visible label contains
only the species name. Contradictory released/unreleased entries retain existing data with warnings.

The main source does not enumerate every nonregional alternate form. Unmatched forms retain the
existing classification and emit warnings; a species row is not silently treated as proof for an
unlisted alternate form. Cosmetic female records inherit their corresponding parent form's source
availability, except that Generation 1 is excluded from all three acquisition arrays because those
games have no genders. Female-only species are not cosmetic female records.

Games and services absent from the source tables retain their current values. Storage membership is
never inferred from acquisition codes. The explicit HOME gift rule below is the only service
exception. An empty source cell is inconclusive and retains that game with a warning. Unknown codes
or malformed table structure fail parsing instead of producing an empty candidate.

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
transformations are otherwise `obtainableIn`, with `eventOnlyIn` inherited from the base form's
main-table in-game event gate. Exact base forms take precedence over species rows. Unrecognized
introduction groups and inconclusive base cells remain unverified.

Gigantamax forms are `obtainableIn` in Sword/Shield, except Gigantamax Melmetal: its HOME gift is
`eventOnlyIn`, and Sword/Shield are `transferOnlyIn`. GO Mega, Primal, fusion, and Gigantamax
availability always comes from the GO page's separate tables. Champions remains unresolved; future
planned coverage is not treated as current availability.

The 2026-09-22 source audit covered all 1,595 dataset records. The main page had 1,025 species,
1,101 distinct rows, and 40 mapped games. Cosmetic female inheritance and the 130 Mega/Gigantamax
rules leave 265 records without main-game coverage and one partially covered record (Hisuian
Samurott's blank Legends: Z-A cell). GO resolves 1,580 records; 15 remain unlisted, including Low
Key Gigantamax Toxtricity, which the source does not distinguish from its other Gigantamax form.
There are 267 records with at least one gap and 14 with gaps in both lists. HOME is covered only for
Gigantamax Melmetal; Pokopia, Champions, Winds, and Waves remain outside these rules.

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

# Pokémon availability CLI

Run from this checkout after `pnpm install`, using Node.js 24 or newer:

```bash
pnpm pokemon:availability pikachu
pnpm pokemon:availability 0026-alola
pnpm --silent pokemon:availability 25 --json > /tmp/pikachu-availability.json
pnpm pokemon:availability pikachu --patch
```

The argument accepts an existing Pokémon `id` or `nid`, including form suffixes. Numeric inputs are
padded (`25` becomes `0025`); a form must be requested explicitly (`26-alola` becomes `0026-alola`).
The script resolves the species page using `refs.bulbapedia`.

The terminal table uses aligned borders and wraps long descriptions to the terminal width (120
columns when output is redirected, with a 60-column minimum and 160-column maximum). It includes one
logical row for every concrete dataset game (`type: "game"`), in dataset order. Paired versions are
split into individual IDs. Set/superset records are not extra rows; DLC methods are attached to
their parent games and labeled with the expansion name. Rows show the source methods and whether the
acquisition classification comes from `source`, the existing `dataset`, or remains `unknown`.
Missing evidence is not proof that a Pokémon is unavailable.

## JSON output

`--json` writes only a JSON object to stdout. Use `pnpm --silent` to suppress pnpm's own script
banner. Source information and warnings are written to stderr. `--patch` overrides this output mode.

The object contains `id`, `nid`, `obtainableIn`, `transferOnlyIn`, `eventOnlyIn`, and `storableIn`,
using the same field names and game IDs as Pokémon records. It is a candidate patch, not a complete
Pokémon record. The command edits the dataset only when `--patch` is supplied.

For game rows supported by the parsed methods, acquisition fields are updated with this precedence:

1. Ordinary in-game acquisition, including evolution, breeding, permanent gifts, and NPC trades.
2. Transfers or player trades, when there is no ordinary in-game route.
3. Events, when there is no known ordinary or transfer route.

An explicit `Unobtainable` row removes that game from the three acquisition fields. An event-only
summary does not replace a transfer route already recorded in the dataset. Unknown or absent
acquisition evidence retains existing values, with a warning. `storableIn` is always preserved:
encounter tables cannot establish box compatibility or whether a form reverts on deposit. Other
fields, such as `shinyLockedIn`, are not inferred.

Review the warnings and table before using the JSON as a patch. Retained values have not been
independently verified by this command, and an event listing describes historical availability, not
necessarily an event active today.

## Patching a Pokémon record

```bash
pnpm pokemon:availability pikachu --patch
pnpm pokemon:availability 0026-alola --html /tmp/raichu.html --patch
```

`--patch` applies the candidate availability fields to `data/pokemon/<id>.json`, retaining
unresolved values and `storableIn` as described above. Other Pokémon fields are preserved. The
updated file is formatted with Oxfmt using the repository's `.oxfmtrc.json` and replaced atomically.
Formatting happens before replacement, so a formatting failure does not leave a partially written
Pokémon file. The command does not stage or commit anything.

Patch mode prints a summary instead of the table or JSON, even when combined with `--json`. For each
availability property it lists added and removed games by name and ID, or says `unchanged`. Warnings
still go to stderr. For example:

```text
Patched and formatted: /path/to/data/pokemon/pikachu.json

obtainableIn:
  Added: Red (rb-r)
  Removed: Blue (rb-b)
transferOnlyIn:
  Added: none
  Removed: Red (rb-r)
eventOnlyIn: unchanged
storableIn: unchanged
```

If the file already matches the formatted result, it is left untouched. If availability is edited
during the lookup, the patch fails instead of overwriting that edit; rerun to use the latest data.

## Saved pages and failure handling

To reproduce a result or work when the site blocks automated requests, save the species page's HTML
and run:

```bash
pnpm pokemon:availability raichu-alola --html /tmp/raichu.html
```

The live request has a 30-second timeout. HTTP errors, challenge pages, mismatched species titles,
and pages without recognizable location rows fail with a nonzero exit status. They do not produce an
empty JSON result that could erase existing data. Requests are made only for the selected species;
the CLI does not crawl linked pages.

## Parsing approach and limits

The parser uses Cheerio to read Bulbapedia's **Game locations** and **In side games** HTML tables.
It keeps cell boundaries, links, line breaks, and form annotations. For example, an NPC trade link
differs from a player trade, even if both display the word “Trade”. Converting the page to Markdown
first would discard useful structure and is unnecessary.

Rules handle common locations, evolution, breeding, gifts, trades, transfers, and event markers.
Form annotations are matched against names in the local dataset; unqualified species methods are not
applied to alternate forms. Battle-only forms, unfamiliar text, version-specific superscripts,
accessory routes, and unmatched forms can require manual verification. Default/female records share
unqualified species methods; this does not verify the gender of individual gifts or fixed
encounters. Unknown methods retain the existing classification unless another parsed method
establishes ordinary acquisition.

This is a deterministic extraction aid, not a complete game-mechanics engine. It does not follow
location pages, reconstruct transfer compatibility, check event schedules, or prove availability of
evolution/breeding prerequisites. Some games and services, including HOME or GO on many species
pages, have no suitable location row and retain dataset values. Serebii is not fetched as a fallback
in this version.

No AI service or API key is required. An optional AI review could help interpret unresolved prose
and linked sources, but it would still need evidence for storage and form mechanics. That review
would be a separate step rather than a requirement for running this CLI.

## Development

```bash
pnpm exec vitest run src/upstream-adapters/bulbapedia
pnpm typecheck
```

Tests use small synthetic HTML fixtures modeled on the source's table structure, an offline CLI
subprocess check, and disposable datasets for patching. They do not fetch the live site or patch the
checkout's Pokémon records.

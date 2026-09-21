# Pokémon availability CLI

Run from this checkout after `pnpm install`, using Node.js 24 or newer:

```bash
pnpm pokemon:availability pikachu
pnpm pokemon:availability 0026-alola
pnpm --silent pokemon:availability 25 --json > /tmp/pikachu-availability.json
pnpm pokemon:availability pikachu --patch
pnpm pokemon:availability pikachu --with-ai --patch
```

The argument accepts an existing Pokémon `id` or `nid`, including form suffixes. Numeric inputs are
padded (`25` becomes `0025`); a form must be requested explicitly (`26-alola` becomes `0026-alola`).
The script resolves the species page using `refs.bulbapedia`.

The terminal table uses aligned borders and wraps long descriptions to the terminal width (120
columns when output is redirected, with a 60-column minimum and 160-column maximum). It includes one
logical row for every concrete dataset game (`type: "game"`), in dataset order. Paired versions are
split into individual IDs. Set/superset records are not extra rows; DLC methods are attached to
their parent games and labeled with the expansion name. Rows show the source methods and whether the
acquisition classification comes from `source`, an explicit dataset `rule`, the existing `dataset`,
or remains `unknown`. Missing evidence is not proof that a Pokémon is unavailable.

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

## AI verification

```bash
pnpm pokemon:availability raichu-alola --with-ai
pnpm --silent pokemon:availability 0026-alola --with-ai --json
pnpm pokemon:availability raichu-alola --with-ai --patch
```

`--with-ai` uses the OpenAI Responses API with **`gpt-5.6-terra`**, medium reasoning, and structured
output. It reads `OPENAI_API_KEY` from the environment, falling back to this repository's `.env`. It
does not print, change, or save the key. The flag makes a billable API request using that key. There
is no model substitution or automatic retry.

The verifier receives the full current Pokémon JSON, full dataset game records, the exact candidate
JSON, parsed methods and their provenance, and the important article HTML. The HTML includes the
introduction, biology/forms/evolution, game locations with event subsections, and Pokémon GO context
where present. Scripts, navigation, presentation attributes, and unrelated stats/learnsets are
removed; table structure, links, titles, row spans, and form annotations remain. Evidence over
500,000 characters is rejected rather than silently truncated.

Terra independently checks Pokémon/form identity, game IDs and versions, acquisition methods, DLC
mapping, event/transfer precedence, preservation rules, and whether the candidate accurately
represents the supplied source. It must return one check for every concrete dataset game, plus
findings identifying input, parsing, or output issues with evidence. Local validation rejects
missing/duplicate game checks, invented game IDs, and malformed reviews.

The review and findings go to **stderr**, preserving JSON stdout and the patch-only summary. A
passing review allows normal output or patching. An inaccurate or uncertain review, missing key,
timeout, API error, refusal, or incomplete response exits nonzero before printing candidate output
or writing the Pokémon file. Requests have a two-minute timeout. With `--patch`, successful
verification is followed by the existing Oxfmt write and added/removed-games summary.

The AI reviews the extraction; it never rewrites the candidate or applies suggested corrections. An
unverified value deliberately retained from the dataset is labeled `retained`, not verified. Missing
evidence alone is allowed for retained values; an evidenced contradiction is reported. A pass is a
model assessment of the supplied evidence, not proof that all existing data are correct. The
verifier has no browsing or other tools and does not follow linked pages.

Model and response format references:
[GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) and
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Interactive full-dataset review

```bash
pnpm pokemon:availability:all
pnpm pokemon:availability:all --skip-unchanged
```

The companion CLI visits every record in `data/indices/pokemon.json` order, including forms. It uses
the same parser, change summary, patcher, and AI verifier as the single-Pokémon tool. The current
position, identity, source, warnings, and added/removed games for all four properties appear before
each prompt:

```text
p) patch  s) skip  a) ai pass >
```

Type a letter and Enter. `p` patches and formats the current file with Oxfmt, then advances. `s`
leaves it unchanged and advances. `a` verifies the displayed candidate with GPT-5.6 Terra, prints
the review and changes summary again, then offers only `p` or `s`. It never patches automatically.
Failed, uncertain, or unsuccessful AI reviews block `p`; use `s` to continue. AI is optional and
reuses the existing API key configuration.

`--skip-unchanged` automatically advances past candidates with no added or removed games in any
availability property. These count as already up to date; array ordering and file formatting alone
do not trigger a prompt. Their progress and warnings remain visible, and no files are written or AI
requests made for them. Changed candidates keep the usual patch/skip/AI prompt. Lookup failures
still prompt for skip because their availability could not be checked.

Lookup failures offer skip without creating a candidate. Patch failures stay on the current Pokémon.
Invalid input does not advance. Consecutive forms sharing a species page reuse its HTML; only one
page is kept in memory. Pokémon files are written only after an explicit `p`.

Ctrl+C stops the loop and cancels an active page fetch or AI request. A file replacement already
started after `p` finishes safely. Completed patches remain saved. End of input also stops the
review. The final line counts patched, unchanged, and skipped records. There is no persisted cursor;
a new run starts at the beginning.

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
encounters. Records with `isFemaleForm: true` are unavailable in Generation 1 games: those game IDs
are excluded from all three acquisition arrays, even if the species page lists encounters. This rule
uses each game's `gen`, applies in both deterministic and AI modes, and does not exclude female-only
species such as Nidoran♀ (`isFemaleForm: false`). Storage remains preserved. Unknown methods retain
the existing classification unless another parsed method establishes ordinary acquisition.

This is a deterministic extraction aid, not a complete game-mechanics engine. It does not follow
location pages, reconstruct transfer compatibility, check event schedules, or prove availability of
evolution/breeding prerequisites. Some games and services, including HOME or GO on many species
pages, have no suitable location row and retain dataset values. Serebii is not fetched as a fallback
in this version.

Without `--with-ai`, the CLI makes no AI requests and requires no API key. Both modes retain the
same conservative storage and form rules; AI verification adds a review before output or patching.

## Development

```bash
pnpm exec vitest run src/upstream-adapters/bulbapedia
pnpm typecheck
```

Tests use small synthetic HTML fixtures modeled on the source's table structure, an offline CLI
subprocess check, mocked OpenAI responses, and disposable datasets for patching. They do not fetch
the live site, make billable API requests, or patch the checkout's Pokémon records.

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

Every lookup follows **Bulbapedia → cached PokéAPI cross-check → targeted Serebii evidence**. AI
remains optional (`--with-ai` or interactive `a`). Use `--no-cross-check` for Bulbapedia alone,
including fully offline runs against a saved HTML file. Both CLIs accept `--refresh-sources` to
refresh all three source caches, including Bulbapedia.

Successful Bulbapedia species pages are cached on disk in the repository's `.local/bulbapedia/`,
shared by both commands and all forms using the same page URL. The full HTML is retained for parsing
and AI review. Cached pages are reused across runs until `--refresh-sources` is supplied or their
cache files are removed; there is no automatic expiry. Set `BULBAPEDIA_CACHE_DIR` to override the
cache directory. HTTP errors, challenge pages without Game locations, and aborted requests are not
cached. Invalid cache entries are fetched again; a failed refresh reports the error and leaves the
previous cache intact. `--html` uses the supplied file directly without reading or writing the
Bulbapedia cache.

The terminal table uses aligned borders and wraps long descriptions to the terminal width (120
columns when output is redirected, with a 60-column minimum and 160-column maximum). It includes one
logical row for every concrete dataset game (`type: "game"`), in dataset order. Paired versions are
split into individual IDs. Set/superset records are not extra rows; DLC methods are attached to
their parent games and labeled with the expansion name. Rows show the source methods and whether the
acquisition classification comes from `source`, an explicit dataset `rule`, the existing `dataset`,
an AI correction (`ai`), or remains `unknown`. Missing evidence is not proof that a Pokémon is
unavailable.

## JSON output

`--json` writes only a JSON object to stdout. Use `pnpm --silent` to suppress pnpm's own script
banner. Source information and warnings are written to stderr. `--patch` overrides this output mode.

The object contains `id`, `nid`, `obtainableIn`, `transferOnlyIn`, `eventOnlyIn`, and `storableIn`,
using the same field names and game IDs as Pokémon records. It is a candidate patch, not a complete
Pokémon record. The command edits the dataset only when `--patch` is supplied.

All four game lists follow `data/indices/games.json` order, using the shared
`sortStringsInGivenOrder` helper. This also applies when patching: `storableIn` keeps its existing
game membership but is sorted, and retained IDs absent from the game index stay at the end.

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
still go to stderr. In a color-capable terminal, property headings use green for `obtainableIn`,
cyan for `transferOnlyIn`, magenta for `eventOnlyIn`, and yellow for `storableIn`. The same colors
appear in interactive review summaries. Redirected output stays plain by default; Node's `NO_COLOR`,
`NODE_DISABLE_COLORS`, and `FORCE_COLOR` settings are respected. For example:

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

## Additional source checks

The PokéAPI pass uses `refs.pkApiId` and the game's `pokeApiGameVersionId`. It fetches
[`pokemon/{id}/encounters`](https://pokeapi.co/docs/v2#pokemon-location-areas) once per distinct ID,
covering every recorded version in one response. Paired DLC version names map to their individual
parent game, never to both versions. Encounters for an ID shared with another alternate form are
provided as context, without claiming they prove that form's availability. The female Gen 1 rule
still applies.

PokéAPI is positive evidence only. An empty response does not establish unavailability,
transfer-only status, event exclusivity, or storage. It does not overwrite the Bulbapedia candidate
automatically. An encounter contradicting that candidate produces an **uncertain source conflict**,
shown in the table and diagnostics. Conflicts block `--patch` and interactive `p` until an AI pass
resolves them; plain `--json` still prints the mechanical candidate with uncertainty diagnostics on
stderr.

Serebii pages are requested for conflicting games, unknown source methods, or changes that remove
ordinary acquisition. Ambiguous species rows before the selected form's debut are excluded; actual
encounter contradictions still receive attention. URLs are grouped by generation and species; at
most three relevant pages are requested per Pokémon, prioritizing conflicts. Unsupported games and
targets beyond this limit are reported. Coverage includes the main games from Generations 1–7,
Sword/Shield, BDSP, Legends: Arceus, and Scarlet/Violet; LGPE, Legends: Z-A, future games, and side
games currently have no Serebii adapter. Only locations, evolution, and form context is sent to AI,
with table structure and annotations preserved. This is supplementary evidence for AI to interpret,
not another automatic availability parser. The CLI does not crawl links or make one request per
game.

PokéAPI reuses the existing `.local/pokeapi` disk cache and its `POKEAPI_CACHE_DIR`,
`POKEAPI_CACHE`, and `POKEAPI_REFRESH_CACHE` settings. Serebii uses `.local/serebii`. Supplementary
requests run sequentially, with at least 500 ms between requests to the same provider, a 30-second
timeout, at most two PokéAPI attempts, and one Serebii attempt. Repeated URLs, including failures,
are reused during an `:all` run. Request failures are visible warnings, not empty verified results;
they never resolve an existing conflict. Tests use mocks and fixtures only.

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
JSON, parsed methods and their provenance, the supplementary source evidence and conflicts, and the
important Bulbapedia article HTML. The HTML includes the introduction, biology/forms/evolution, game
locations with event subsections, and Pokémon GO context where present. Scripts, navigation,
presentation attributes, and unrelated stats/learnsets are removed; table structure, links, titles,
row spans, and form annotations remain. Evidence over 500,000 characters is rejected rather than
silently truncated.

Terra independently checks Pokémon/form identity, game IDs and versions, acquisition methods, DLC
mapping, event/transfer precedence, preservation rules, and whether the candidate accurately
represents the supplied source. Its Zod structured output includes the final `candidateJson`,
`differenceReason`, one check for every concrete dataset game, `conflictResolutions`, and findings
with evidence. It may correct parsing mistakes when the supplied evidence supports the correction.
Every reported conflict needs an explicit resolution; resolved conflicts must cite both conflicting
sources and have an accurate game check. Invented citations, omitted conflicts, and unresolved
disagreements cannot pass. Sources are not resolved by majority vote. Checks describe the final AI
candidate; corrected parser mistakes are warnings, while unresolved errors still block patching.
Local validation rejects missing/duplicate game checks, invented game IDs, changed Pokémon identity,
overlapping acquisition categories, changes to storage membership, and female Gen 1 routes.

If the AI candidate differs from the mechanical candidate, `AI difference:` explains why in at most
**25 words**, enforced locally by Zod. Reordering alone is not a difference. Each changed game must
have an accurate check with source evidence. Otherwise the reason is null and the CLI says the
candidates match. All accepted lists retain the dataset's game order.

The review and findings go to **stderr**, preserving JSON stdout and the patch-only summary. A
passing review uses the AI candidate for the table, JSON, summary, and patch. An inaccurate or
uncertain review, missing key, timeout, API error, refusal, or incomplete response exits nonzero
before printing candidate output or writing the Pokémon file. Requests have a two-minute timeout.
With `--patch`, successful verification is followed by the existing Oxfmt write and
added/removed-games summary.

The AI only proposes availability fields, never other Pokémon properties. An unverified value
deliberately retained from the dataset is labeled `retained`, not verified. Missing evidence alone
is allowed for retained values; an evidenced contradiction is reported. A pass is a model assessment
of the supplied evidence, not proof that all existing data are correct. The verifier has no browsing
or other tools and does not follow linked pages.

Model and response format references:
[GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) and
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Interactive full-dataset review

```bash
pnpm pokemon:availability:all
pnpm pokemon:availability:all --skip-unchanged
pnpm pokemon:availability:all --skip-unchanged --with-ai
pnpm pokemon:availability:all --from mrmime-galar --skip-unchanged --with-ai
pnpm pokemon:availability:all --from 0122-galar
```

The companion CLI visits every record in `data/indices/pokemon.json` order, including forms. It uses
the same parser, change summary, patcher, and AI verifier as the single-Pokémon tool. The current
position, identity, source, warnings, and added/removed games for all four properties appear before
each prompt:

```text
p) patch  s) skip  a) ai pass >
```

`--from <id|nid>` starts at that exact record, **inclusive**, then continues in dataset index order.
It accepts the same IDs, NIDs, and numeric shorthand as the single-Pokémon command, including form
suffixes. Earlier records receive no source lookups, cross-checks, AI calls, prompts, or writes.
Progress retains the original full-dataset position; final totals count only this run's processed
records. An unknown ID fails before any lookup. It combines with all other review options.

Type a letter and Enter. `p` patches and formats the current file with Oxfmt, then advances. `s`
leaves it unchanged and advances. `a` verifies the displayed candidate with GPT-5.6 Terra, prints
the review and the final AI candidate's changes summary, then offers only `p` or `s`. After a
passing review, `p` applies that AI candidate. It never patches automatically. Failed, uncertain, or
unsuccessful AI reviews block `p`; use `s` to continue. AI is optional and reuses the existing API
key configuration.

`--with-ai` runs the same GPT-5.6 Terra verification automatically for each candidate before the
first prompt. You then choose `p` or `s`; passing AI verification never patches automatically.
Failed, uncertain, or unsuccessful reviews still block patching. Each review makes a billable API
request using the existing key. Combine with `--skip-unchanged` to review candidates with added or
removed games **or unresolved source conflicts**. Other unchanged candidates are skipped before AI;
the source cross-check still runs.

`--skip-unchanged` automatically advances past candidates with no added or removed games in any
availability property and no unresolved source conflicts. These count as already up to date; array
ordering and file formatting alone do not trigger a prompt. Their progress and warnings remain
visible, and no files are written or AI requests made for them. Changed candidates keep the usual
patch/skip/AI prompt. Lookup failures still prompt for skip because their availability could not be
checked.

Lookup failures offer skip without creating a candidate. Patch failures stay on the current Pokémon.
Invalid input does not advance. Consecutive forms sharing a species page reuse its HTML; only one
page is kept in memory. Pokémon files are written only after an explicit `p`.

Ctrl+C stops the loop and cancels an active page fetch or AI request. A file replacement already
started after `p` finishes safely. Completed patches remain saved. End of input also stops the
review. The final line counts patched, unchanged, and skipped records. There is no persisted cursor;
a new run starts at the beginning unless `--from` is supplied.

## Saved pages and failure handling

To reproduce a result or work when the site blocks automated requests, save the species page's HTML
and run:

```bash
pnpm pokemon:availability raichu-alola --html /tmp/raichu.html --no-cross-check
```

The live request has a 30-second timeout. HTTP errors, challenge pages, mismatched species titles,
and pages without recognizable location rows fail with a nonzero exit status. They do not produce an
empty JSON result that could erase existing data. Requests are made only for the selected species
and its targeted supplementary pages; the CLI does not crawl linked pages.

## Parsing approach and limits

The parser uses Cheerio to read Bulbapedia's **Game locations** and **In side games** HTML tables.
It keeps cell boundaries, links, line breaks, and form annotations. For example, an NPC trade link
differs from a player trade, even if both display the word “Trade”. Converting the page to Markdown
first would discard useful structure and is unnecessary.

Rules handle common locations, evolution, breeding, gifts, trades, transfers, and event markers.
Gift attributes such as **Gigantamax Factor** are not form restrictions: the Master Dojo gifts for
Bulbasaur and Squirtle count as ordinary acquisition in Sword and Shield through the Expansion Pass.
Form annotations are matched against names in the local dataset, including grouped labels such as
**Kantonian/Hisuian Forms**. This recognizes Hisuian Arcanine's Scarlet/Violet DLC evolution row
without applying it to unrelated forms. Unqualified species methods are not applied to alternate
forms. Battle-only forms, unfamiliar text, version-specific superscripts, accessory routes, and
unmatched forms can require manual verification. Default/female records share unqualified species
methods; this does not verify the gender of individual gifts or fixed encounters. Records with
`isFemaleForm: true` are unavailable in Generation 1 games: those game IDs are excluded from all
three acquisition arrays, even if the species page lists encounters. This rule uses each game's
`gen`, applies in both deterministic and AI modes, and does not exclude female-only species such as
Nidoran♀ (`isFemaleForm: false`). Storage remains preserved. Unknown methods retain the existing
classification unless another parsed method establishes ordinary acquisition.

This is a deterministic extraction aid, not a complete game-mechanics engine. It does not follow
location pages, reconstruct transfer compatibility, check event schedules, or prove availability of
evolution/breeding prerequisites. Some games and services, including HOME or GO on many species
pages, have no suitable location row and retain dataset values. Serebii cannot replace a missing or
blocked primary Bulbapedia page in this version.

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

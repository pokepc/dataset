---
name: add-pokedex
description:
  Add a new Pokédex to this dataset, or fill in / correct an existing one, using Bulbapedia regional
  dex lists as the source. Use when asked to add a dex for a game or DLC (e.g. "add the Basin dex",
  "add the Winds & Waves dexes"), to backfill an empty dex (the five hisui-* sub-dexes have no
  entries), to complete a dex that gained Pokémon, or to fix wrong pids or ordering in an existing
  dex. Also covers registering the dex in the indices and adding a DLC game record when the dex
  ships with an expansion.
---

# Adding and updating Pokédexes

Bulbapedia owns dex ordering; this dataset owns pids. The join between them is mechanical, so it
belongs in a script — `scripts/parse-bulbapedia-dex.ts` does the fetching, parsing and pid
resolution. Your job is the judgement calls and the registration checklist.

## Rule 1: never read the dex list through a summarizing fetch

WebFetch and friends run the page through a small model. On the Basin dex that model reported "Total
Entries: 50" — the real count is 52, because it silently collapsed the Frillish and Jellicent gender
rows. A dex that is short a few entries is still schema-valid and still passes all 7000+ tests, so
nothing downstream catches it.

Always go through the script, which fetches `action=raw` wikitext and parses it programmatically.

## Workflow

### 1. Parse and resolve

```bash
bun .claude/skills/add-pokedex/scripts/parse-bulbapedia-dex.ts \
  --page "List of Pokémon by Pokédex (Basin) number in Pokémon Pokopia" \
  --save-wiki /tmp/basin.wiki
```

`--page` takes a page title or a full URL. `--save-wiki` caches the wikitext so you can re-run with
`--file /tmp/basin.wiki` while iterating instead of re-fetching.

Read the report before going further. It gives entry count, local-number count, gaps in numbering
and every form slot, plus four things that need your attention:

- **UNRESOLVED** — a row whose form label matched no `formNames.eng` for that national number, or
  matched more than one. The script lists the candidates and exits non-zero. It never guesses.
  Usually a genuinely new form, a label wording change on the wiki, or a real ambiguity: Urshifu
  carries `"Gigantamax Form"` on both `urshifu-gmax` and `urshifu-rapid-strike-gmax`, which no label
  alone can separate.
- **NEEDS HUMAN INPUT** — a game-exclusive form (a game-scoped sprite template such as
  `MSP/Pokopia`; `MSP/8` is just generation-scoped and ordinary). These have no pid of their own and
  become `meta` entries. The dex page gives only the form label ("Mossy"), not the in-game name
  ("Mosslax"), so you must fill `meta.names.eng` and `meta.imgNid` from the game or the species' own
  article. The script emits a `TODO` scaffold.
- **REVIEW: cosmetic forms** — pids the wiki's table never lists as rows. Bulbapedia omits cosmetic
  gender forms, but main-series dexes here include them: `galar-isle-armor` carries `shinx-f`,
  `kadabra-f`, `magikarp-f` and 23 more. Whether a dex should include them is a per-dex policy call.
  The Pokopia dexes include only what the wiki lists.
- **DUPLICATE-PID VIOLATIONS** — would fail `pokedexes.test.ts`. The script refuses to emit rather
  than writing a file the test suite will reject.

Expect gaps to be `none` for a complete dex. Gaps mean unparsed rows — investigate before
continuing, do not paper over them.

The script reproduces all three Pokopia dexes exactly, entry for entry. Main-series dexes need the
two REVIEW/NEEDS-INPUT passes resolved by hand before they are complete; treat its output there as a
strong first draft, not a finished file.

### 2. Decide the header fields

Only these need judgement. See `references/dex-conventions.md` for the precedents.

| Field     | How to decide                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | `<parent>-<area>`, e.g. `pokopia-basin`, `galar-isle-armor`, `paldea-kitakami`                                                                           |
| `name`    | Follow the game's existing dexes. Pokopia prefixes the game (`Pokopia Basin Pokédex`); Galar and Paldea use the bare area name (`Isle of Armor Pokédex`) |
| `gen`     | Match the parent game. Spinoffs use `0`                                                                                                                  |
| `region`  | A slug from `data/regions.json` — nothing else validates, but a fabricated region is still wrong. New areas reuse the parent's region                    |
| `baseDex` | Parent dex slug for sub-dexes. Match the game's existing sub-dexes rather than the global convention if they disagree                                    |
| `pkApiId` | PokeAPI pokedex id as a **string**, or `null`. Always `null` for spinoffs and DLC PokeAPI does not carry                                                 |

### 3. Emit the dex file

```bash
bun .claude/skills/add-pokedex/scripts/parse-bulbapedia-dex.ts \
  --file /tmp/basin.wiki --emit \
  --id pokopia-basin --name "Pokopia Basin Pokédex" --region kanto --gen 0 \
  > data/pokedexes/pokopia-basin.json
```

`--emit` refuses to run while anything is unresolved. Output is pre-formatted to survive `oxfmt`
unchanged — one entry per line, no newline after `{`.

For an **existing** dex, emit to a temp path and diff against the current file rather than
overwriting. That distinguishes real additions from incidental reordering, and protects
hand-authored `meta` blocks the wiki cannot regenerate.

### 4. Register it — the step this repo has already missed once

Commit `4b9e5ea5` added the Pokopia dex files and forgot the index; `c8235def` had to fix it. An
unregistered dex is invisible to every loader **and** skipped by the integrity tests, so it fails by
doing nothing at all.

- [ ] `data/pokedexes/<id>.json` written
- [ ] `data/indices/pokedexes.json` — append the id near its game's other dexes
- [ ] `data/games/<game>.json` — add the id to `pokedexes`
- [ ] If the dex ships with DLC: new `data/games/<game>-<part>.json` + `data/indices/games.json`

### 5. DLC game records

This repo models DLC **parts**, never the umbrella pass — `swsh-islearmor`, `swsh-crowntundra`,
`sv-tealmask`, `sv-indigodisk`, `lza-megadimension`. So a "Pokopia Expansion Pass" record would be
wrong; `pokopia-bubblybasin` is right.

Copy the shape from `data/games/swsh-islearmor.json` and inherit scalars from the parent game
(`gen`, `series`, `region`, `originMark`, `maxBoxes`, `maxBoxSize`, `platforms`, `features`). Set
`type: "dlc"` and `gameSet: "<parent>"`. Omit `onlineFeatures` — every existing DLC record does. The
parent game lists the DLC's dex too, so both files change.

Get `releaseDate` from the Bulbapedia article for the DLC, not the dex list page. It is usually
stated per part ("Released with Patch 2.0.0 on August 5, 2026"). Never invent one; if it is
genuinely unannounced, say so rather than guessing.

### 6. Verify

```bash
pnpm format && pnpm typecheck && pnpm test
```

Then confirm the data itself, since the tests accept any well-formed dex:

```bash
node -e 'const d=require("./data/pokedexes/pokopia-basin.json");const n=new Set(d.entries.map(e=>e.dexNum));const m=Math.max(...n);console.log("entries",d.entries.length,"numbers",n.size,"gaps",[...Array(m)].map((_,i)=>i+1).filter(i=>!n.has(i)).join(",")||"none")'
```

Cross-check the entry count and the highest local number against the wiki page's own prose, which
often states the total.

`pnpm build` also runs `build:next`, which fetches live from PokeAPI. That is unrelated to dex work
and can fail on upstream data problems.

## Gotchas

- `entries` is `.strict()` — an unknown key on an entry is a hard validation failure.
- A pid may appear at most **twice** in one dex, and only as one `{meta, isForm: false}` plus one
  `{isForm: true}` with no meta, sharing a `dexNum`. Enforced by
  `tests/data-integrity-tests/pokedexes.test.ts`.
- `isForm` marks the secondary slot of a local number, not "this pid is a form". Isle of Armor #1 is
  Galarian Slowpoke, so there `slowpoke-galar` is `isForm: false` and plain `slowpoke` is
  `isForm: true`. The script derives this from table position.
- Every pid must exist as `data/pokemon/<pid>.json` **and** be listed in
  `data/indices/pokemon.json`. A genuinely new species needs its own Pokémon record first — that is
  a separate, larger job than adding a dex.

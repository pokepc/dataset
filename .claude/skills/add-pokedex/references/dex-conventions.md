# Pokédex data conventions

Reference for `.claude/skills/add-pokedex`. Schema lives in `src/lib/schemas.ts` (`pokedexSchema`,
`pokedexEntrySchema`, `gameSchema`).

## Header fields

| Field                | Notes                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | Must match the filename stem. Nothing asserts this, but every file follows it                                                             |
| `name`               | Single English string. There is **no** i18n for dex names                                                                                 |
| `gen`                | `0` for spinoffs (both Pokopia dexes, both champions rosters), otherwise the real generation                                              |
| `region`             | Slug from `data/regions.json`, or `null` (`national`, champions rosters). Not cross-validated by any test — a wrong value passes silently |
| `isNational`         | `false` in every file including `national.json`. Effectively unused                                                                       |
| `baseDex`            | Parent dex for sub-dexes, else `null`                                                                                                     |
| `pkApiId`            | PokeAPI pokedex id as a **string** (`kanto` is `"2"`), `null` when PokeAPI has no equivalent                                              |
| `shortDesc` / `desc` | Optional. Only the two champions rosters use them                                                                                         |
| `entries`            | `.strict()` per entry — unknown keys are a hard failure. `[]` is valid                                                                    |

### baseDex precedents

```
galar-isle-armor    -> galar
galar-crown-tundra  -> galar
paldea-kitakami     -> paldea
paldea-blueberry    -> paldea
hisui-*             -> hisui
kalos-mega          -> kalos-lumiose
pokopia-event       -> null      # breaks the convention; pokopia-basin follows it for consistency
pokopia-basin       -> null
```

### Naming precedents

Bare area name for main-series sub-dexes, game-prefixed for Pokopia:

```
Isle of Armor Pokédex     Kitakami Pokédex      Blueberry Pokédex     Mega Pokédex
Pokopia Pokédex           Pokopia Event Pokédex Pokopia Basin Pokédex
```

Bulbapedia's own name is a data point, not the rule — it calls the Basin dex the "Bubbly Basin
Pokédex" and the Event dex simply the "Event Pokédex". Match the game's siblings.

## Entry fields

| Field            | Notes                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `pid`            | Pokémon slug. Must exist as `data/pokemon/<pid>.json` **and** in `data/indices/pokemon.json`        |
| `dexNum`         | **Local** number for regional/game dexes; national number for `national*` and the champions rosters |
| `isForm`         | Secondary slot of a local number — see below                                                        |
| `transferOnly`   | Champions rosters only                                                                              |
| `originDex`      | `kalos-mega` only (all 96 entries point at `kalos-lumiose`)                                         |
| `isNonCanonical` | In the schema, used by zero entries                                                                 |
| `meta`           | Game-exclusive forms with no pid of their own                                                       |

### `isForm` is positional

It marks the secondary slot of a local dex number, not "this pid is an alternate form". Which pid
gets the primary slot depends on the dex:

```jsonc
// galar.json — plain Frillish is the species slot
{ "pid": "frillish",   "dexNum": 305, "isForm": false },
{ "pid": "frillish-f", "dexNum": 305, "isForm": true  },

// galar-isle-armor.json — Galarian Slowpoke is #1, so it takes the primary slot
{ "pid": "slowpoke",       "dexNum": 1, "isForm": true  },
{ "pid": "slowpoke-galar", "dexNum": 1, "isForm": false },
```

The parser derives this from row order in the wiki table, which is why it matches both.

### Regional and alternate forms are separate pids

Not a form field: `slowpoke-galar`, `shellos-east`, `toxtricity-low-key`, `tatsugiri-droopy`,
`frillish-f`, `venusaur-mega`. Several form pids share one `dexNum`.

## pid resolution

`data/pokemon/*.json` carries `dexNum` and `formNames.eng`, and Bulbapedia's form labels line up
with that field almost exactly:

| Bulbapedia label | `formNames.eng`   | pid                   |
| ---------------- | ----------------- | --------------------- |
| Female           | `"Female"`        | `frillish-f`          |
| Male             | `"Male"`          | `frillish` (default)  |
| East Sea         | `"East Sea"`      | `shellos-east`        |
| West Sea         | `null` (default)  | `shellos`             |
| Curly Form       | `"Curly Form"`    | `tatsugiri` (default) |
| Droopy Form      | `"Droopy Form"`   | `tatsugiri-droopy`    |
| Galarian Form    | `"Galarian Form"` | `slowpoke-galar`      |
| Low Key Form     | `"Low Key Form"`  | `toxtricity-low-key`  |
| Paldean Form     | `"Paldean Form"`  | `wooper-paldea`       |

Note the `formNames` key — there is no `formName` field. The default form sometimes leaves it `null`
even where Bulbapedia labels it (Shellos "West Sea", Urshifu "Single Strike Style"), which is why
the script falls back to the default for the first row of a block.

The wiki and the dataset disagree on the `" Form"` suffix in places — Bulbapedia writes "Gigantamax"
where the dataset has `"Gigantamax Form"` — so the resolver tries the label both ways.

Two things the wiki table cannot tell you:

- **Cosmetic gender forms are omitted from wiki dex tables** but main-series dexes here include
  them. `galar-isle-armor` has 26 (`shinx-f`, `kadabra-f`, `magikarp-f`, …) that appear nowhere in
  the page's markup. The Pokopia dexes include only what the wiki lists. Compare against another dex
  for the same game before deciding.
- **A label can be ambiguous.** Both `urshifu-gmax` and `urshifu-rapid-strike-gmax` have
  `formNames.eng: "Gigantamax Form"`, so the two Gigantamax rows under Isle of Armor #101 cannot be
  told apart by label alone. Resolve those by hand.

## Game-exclusive forms (`meta`)

Pokopia's exclusives have no `data/pokemon` record. They reuse the canonical pid plus a `meta`
block, and the meta entry takes the `isForm: false` slot:

```jsonc
{ "pid": "snorlax", "dexNum": 108, "isForm": false, "meta": {
    "names":        { "eng": "Mosslax" },
    "speciesNames": { "eng": "Snorlax" },
    "formNames":    { "eng": "Mossy" },
    "imgNid": "0000-mosslax" } },
{ "pid": "snorlax", "dexNum": 108, "isForm": true },
```

In the wikitext these use a game-scoped sprite template — `{{MSP/Pokopia|0143|Snorlax|form=-Mossy}}`
rather than plain `{{MSP|...}}` — which is how the script detects them.

`meta.names.eng` is the **in-game name**, which the dex list page does not contain. The label there
is only `Mossy`; the name `Mosslax` has to come from the game or the species article. `imgNid`
follows `0000-<slug>`. `meta.canonicalPid`, `meta.attributes` and `meta.tags` are supported but
unused.

Some exclusives have no paired plain entry (`smeargle`, `rotom`, `greedent`, `tinkaton`) because the
wiki lists only the special form for that number. That is correct and the duplicate-pid test allows
it.

## Registration

Three places, no TypeScript enum anywhere:

1. `data/pokedexes/<id>.json`
2. `data/indices/pokedexes.json` — the **only** enumeration of dexes. `loadAllPokedexes`
   (`src/lib/fs.ts`) reads it and throws if a listed id has no file. A file that exists but is not
   listed is silently invisible to every loader and every test
3. `data/games/<game>.json` → `pokedexes`

No OpenAPI change is needed: `/data/pokedexes/{pokedexId}.json` is templated and `build:pages`
copies all of `data/`.

## DLC game records

Parts, never the umbrella pass:

```
swsh-islearmor    The Isle of Armor              -> ["galar-isle-armor"]
swsh-crowntundra  The Crown Tundra               -> ["galar-crown-tundra"]
sv-tealmask       The Teal Mask                  -> ["paldea-kitakami"]
sv-indigodisk     The Indigo Disk                -> ["paldea-blueberry"]
lza-megadimension Legends: Z-A - Mega Dimension  -> []
pokopia-bubblybasin  Bubbly Basin                -> ["pokopia-basin"]
```

`type: "dlc"`, `gameSet: "<parent>"`, `gameSuperSet: null`. Inherit the parent's `gen`, `series`,
`region`, `originMark`, `maxBoxes`, `maxBoxSize`, `platforms` and `features`. Omit `onlineFeatures`
— every DLC record does, though the parent may have one. `releaseDate` is required and non-nullable;
no record uses `isUnreleased`, and unreleased games use a placeholder end-of-year date (`wiwa` is
`2027-12-31`).

## Formatting

`.oxfmtrc.json` no longer ignores `data/` (only `data/generated/`), so `oxfmt` formats these files.
It preserves object expansion based on whether a newline follows `{`: keep each entry on one line
and it stays compact; add a newline and it expands permanently. Multi-line `meta` entries in
`pokopia.json` are expanded for exactly this reason.

Do not reintroduce the old custom JSON formatter (`lib/json-format.ts`,
`scripts/format-json-dir.ts`, the `format:json` / `format:data` scripts) — it was added in
`3ff2e908` and has since been removed.

## Known gaps in the dataset

Work this skill exists to do:

- `hisui-obsidian`, `hisui-crimson`, `hisui-cobalt`, `hisui-coronet`, `hisui-alabaster` all have
  `"entries": []`
- `wiwa`, `wiwa-wi`, `wiwa-wa` (Winds & Waves, gen 10) have no dexes at all
- `lza-megadimension` has `"pokedexes": []` while its three dexes hang off `lza` — worth confirming
  that is intentional

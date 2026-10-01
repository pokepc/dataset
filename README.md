# PokéPC Dataset

Static JSON data for Pokémon, games, Pokédexes, box presets, and related PokéPC metadata.

The package also includes TypeScript helpers, Zod schemas, and an OpenAPI description for serving
the dataset as a static JSON API.

> **Upgrading from v7?** Follow the [v7 to v8 migration guide](docs/migrating-to-v8.md), also
> shipped in the package as `docs/migrating-to-v8.md`.

## Install

```bash
pnpm add @pokepc/dataset
```

Example imports:

```ts
import bulbasaur from '@pokepc/dataset/data/pokemon/bulbasaur' with { type: 'json' }
import pokemonText from '@pokepc/dataset/data/i18n/eng/pokemon' with { type: 'json' }
import { pokemonSchema } from '@pokepc/dataset/lib/schemas'

const pokemon = pokemonSchema.parse(bulbasaur) // base record, no text
const name = pokemonText.bulbasaur?.name // text lives in per-locale files
```

Node helpers read the installed data directly:

```ts
import { loadAllPokemon, loadGameSet, loadText } from '@pokepc/dataset/lib/fs'

const japanese = loadText('pokemon', 'jpn') // missing translations stay missing
const champions = loadGameSet('champions') // base + Champions mods, merged
```

Exports: `@pokepc/dataset/data/*` (JSON files, and `data/i18n/<locale>/pokemon-prose/<id>.md`) and
`@pokepc/dataset/lib/*` (`schemas`, `types`, `fs`, `merge`, `languages`, `enums`, `search`, `utils`,
`codes`, `evolution-schemas`, `form-schemas`, `form-methods`, `constants`, `availability-sources`).

JSON imports depend on your runtime or bundler configuration. In this repository, the raw files are
always available under `data/`.

## Static API

The OpenAPI docs and static JSON API are hosted on GitHub Pages:

- API client (Swagger UI) https://pokepc.github.io/dataset/
- OpenAPI spec: https://pokepc.github.io/dataset/openapi.json

| URL path           | Dataset source                            |
| ------------------ | ----------------------------------------- |
| `/dataset/`        | Latest default-branch build (development) |
| `/dataset/latest/` | Latest stable SemVer tag                  |
| `/dataset/v6/`     | Latest stable v6 tag                      |
| `/dataset/v7/`     | Latest stable v7 tag                      |
| `/dataset/v8/`     | Latest stable v8 tag (after 8.0.0)        |

Each path serves its own `openapi.json` and data. v8 builds serve base data at their root
(`/pokemon/{id}.json`, `/moves.json`, …), text under `/i18n/{locale}/`, mods under `/mods/{set}/`
and merged data of game sets with mods under `/games/{set}/` (8.0.0: `/games/champions/`); v6 and v7
builds keep their `data/` (and v7 `data-next/`) layout. Every spec lists all deployed servers, with
its own server selected first in Swagger UI. The documentation links open each version's matching
schema; changing the server dropdown only changes the request destination.
[`versions.json`](https://pokepc.github.io/dataset/versions.json) records the deployed refs and
commits.

Retained major paths are configured in [`pages-versions.json`](pages-versions.json). Add a major
after its first stable tag exists to expose `/vN/`; removing one removes that path on the next
deployment. Root and `/latest/` are always included. Tags may use `6.9.1` or `v6.9.1` spelling;
prereleases are excluded and versions are compared numerically. Conflicting equal-precedence tags,
missing configured releases, or tag/package version mismatches fail the build.

Pages rebuilds for default-branch source/configuration changes and after a successful **Publish npm
Packages** workflow. To refresh independently of npm, run **Deploy to GitHub Pages** manually from
Actions. Every deployment replaces the site with one complete artifact, preserving all configured
major paths. Historical builds use their own code and frozen dependency lockfiles.

### Use Cases of the `openapi.json` spec

Apart from being able to use it in your code with validators or generators, when combined with AI
agents, it unlocks many extras:

1. Tool calling / agent usage: The LLM can know what endpoints exist and how to call them.

2. Code generation: It can generate typed clients, fetch wrappers, SDK helpers, Zod schemas, etc.

3. Documentation Q&A: Users can ask natural-language questions and the LLM can map them to the right
   endpoint/schema.

4. Safer answers: Enums like language IDs, generation IDs, region IDs, ribbon IDs, etc. reduce
   hallucinations.

5. Dataset exploration: The LLM can inspect available resources without manually reading every file.

## Data Layout

```text
data/
  abilities.json, moves.json, …   collection files (base records)
  pokemon/ games/ pokedexes/      one file per entity
  indices/                        order of the per-entity files
  boxpresets/{classic,modern}/
  codes/ metadata/
  i18n/<locale>/<kind>.json       text per locale (eng, jpn, es-es, …)
  i18n/<locale>/pokemon-prose/    species prose (Markdown)
  mods/<set>/                     game set roster, overrides and text (8.0.0: champions)
```

Records are **base** data: game-independent and without text. Names, descriptions and other text
live in `i18n/<locale>/`; missing translations are omitted, never filled from another language.
**Mods** hold what a game set changes; `mergeGameSet` (`lib/merge`) or `loadGameSet` (`lib/fs`)
combine base, mods and text into that set's data. The model is specified in the
[v8 architecture](backlog/docs/doc-2%20-%20v8-data-next-architecture.md); upgrading from v7 is
covered by the [migration guide](docs/migrating-to-v8.md).

Root JSON files are collection files. `games/`, `pokedexes/`, and `pokemon/` contain one JSON file
per entity. `indices/` controls the order of those per-entity files. `codes/` holds append-only
numeric codes for Pokémon, ribbons, marks and moves; read the
[code map rules](backlog/docs/reference/doc-3%20-%20Code-maps.md) before adding, renaming or
removing any of them.

The [game lifecycle reference](backlog/docs/reference/doc-4%20-%20Game-lifecycle-dates.md) defines
release, digital delisting and required-service shutdown dates, including announced future closures.

The
[Pokémon availability field reference](backlog/docs/reference/doc-7%20-%20Pok%C3%A9mon-availability-fields.md)
defines acquisition, storage, shiny availability, and related form fields for both maintainers and
agents. The
[evolution reference](backlog/docs/reference/doc-8%20-%20Pok%C3%A9mon-evolution-methods.md) and
[form-transition reference](backlog/docs/reference/doc-9%20-%20Pok%C3%A9mon-form-transitions.md)
explain the method arrays, typed conditions, and translation-ready enum exports. The
[ability-history audit](backlog/docs/audits/doc-15%20-%20Pok%C3%A9mon-ability-history.md) defines
`legacyAbilities` and lists released historical ability changes, with unreleased/unused assignments
documented as exclusions.

## Contributing

Requirements: Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

When changing data, run the tests before opening a PR. Champions data is maintained with
`pnpm champions:update` after updating its upstream submodule (see
[the adapter README](src/upstream-adapters/projectpokemon-champout/README.md)); it is not part of
`pnpm build`. When changing the static API docs, run `pnpm build:pages` and check the local Swagger
UI with `pnpm dev:openapi`.

`pnpm test` blocks external network requests, including in Node CLI subprocesses. Upstream tests
must use fixtures, mocked responses, or loopback test servers; they must not crawl live services.

Build a GitHub Pages-ready artifact:

```bash
pnpm build:pages
```

This writes:

```text
dist-pages/
  index.html
  openapi.json
  pokemon/ moves.json … i18n/ mods/   the data/ directory, at the root
  games/<set>/                        merged data of game sets with mods
```

Build all published versions from the remote default branch and tags (requires Git, Node.js 24+,
Bun, pnpm, and network access). This uses the current checkout's deployment configuration and
Swagger shell while leaving its source files and index unchanged:

```bash
pnpm build:pages:versions
```

The aggregate output adds `latest/`, configured `vN/` directories, and `versions.json` to
`dist-pages/`. Sources pointing to the same commit are built once. All sources must build
successfully before the output is replaced. CI pins the root source to its tested checkout with
`--root-sha=<full-commit-sha>` so a concurrent push cannot mix the checked configuration with a
newer default-branch build.

To build and preview the aggregate site locally under the same project prefix:

```bash
pnpm build:pages:versions --base-url=http://localhost:4173/dataset/
pnpm dev:pages:versions
```

Open `http://localhost:4173/dataset/`. This preview serves the assembled files without rebuilding
them; every server option targets the local preview. Keep the build URL's port aligned with the
preview's `PORT` or `--port` setting. A deployment build uses the public `package.json` homepage as
its base URL by default.

Preview the Swagger UI locally:

```bash
pnpm dev:openapi
```

The dev server runs at `http://localhost:4173/` by default. Override the port with
`PORT=4174 pnpm dev:openapi` or `node src/openapi/dev.ts --port=4174`.

## Dataset editor

Edit this checkout's `data/` with the local maintainer app:

```bash
pnpm dev:editor
```

The editor runs on `http://127.0.0.1:3003` without external-directory configuration.
`pnpm dev:openapi` starts only the OpenAPI preview, and `pnpm dev` runs both in parallel. See the
[editor guide](backlog/docs/guides/doc-10%20-%20Dataset-editor.md) for editing rules, builds and
disposable browser tests.

## Pokémon availability lookup

Game records include PokéAPI version and version-group IDs. See the
[game ID mapping guide](backlog/docs/reference/doc-6%20-%20Pok%C3%A9API-game-IDs.md) for the schema
and mapping rules.

Inspect the two Bulbapedia availability lists using a dataset Pokémon ID or nid:

```bash
pnpm pokemon:availability pikachu
pnpm --silent pokemon:availability 0026-alola --json
pnpm pokemon:availability pikachu --patch
pnpm pokemon:availability:all --dry-run
```

The command prints a terminal table with one row per game or candidate Pokémon availability fields.
It preserves existing values where the source is inconclusive, including `storableIn`, and reports
warnings. With `--patch`, it updates and formats the selected Pokémon file and prints a summary of
added and removed games instead of the table or JSON. The CLI and editor share deterministic parsers
for the main and GO availability lists; no AI or API key is required. See the
[CLI guide](backlog/docs/guides/doc-11%20-%20Pok%C3%A9mon-availability-CLI.md) for saved HTML input,
classification rules, and limitations.

Run `pnpm pokemon:availability:all` to review every Pokémon interactively. Each iteration shows the
changes summary and accepts `p` to patch or `s` to skip. Press Ctrl+C to stop.

## Credits

This dataset uses public data from:

- [Pokémon Showdown](https://pokemonshowdown.com/)
- [PokéAPI](https://pokeapi.co/)
- [Project Pokémon](https://github.com/projectpokemon)
- [Serebii.net](https://serebii.net/)
- [Bulbapedia](https://bulbapedia.bulbagarden.net/)

Thanks to everyone who collects and maintains public Pokémon game data.

# PokéPC Dataset

Static JSON data for Pokémon, games, Pokédexes, box presets, and related PokéPC metadata.

The package also includes TypeScript helpers, Zod schemas, and an OpenAPI description for serving
the dataset as a static JSON API.

## Install

```bash
pnpm add @pokepc/dataset
```

Example imports:

```ts
import bulbasaur from '@pokepc/dataset/data/pokemon/bulbasaur'
import { pokemonSchema } from '@pokepc/dataset/lib/schemas'

const pokemon = pokemonSchema.parse(bulbasaur)
```

JSON imports depend on your runtime or bundler configuration. In this repository, the raw files are
always available under `data/`.

## Static API

The OpenAPI docs and static JSON API are hosted on GitHub Pages:

- API client (Swagger UI) https://pokepc.github.io/dataset/
- OpenAPI spec: https://pokepc.github.io/dataset/openapi.json

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
  abilities.json
  games/
  indices/
  metadata/
  pokedexes/
  pokemon/
  boxpresets/
    classic/
    modern/
```

Root JSON files are collection files. `games/`, `pokedexes/`, and `pokemon/` contain one JSON file
per entity. `indices/` controls the order of those per-entity files.

## Contributing

Requirements: Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

When changing data, run the tests before opening a PR. When changing the static API docs, run
`pnpm build:pages` and check the local Swagger UI with `pnpm dev:openapi`.

Build a GitHub Pages-ready artifact:

```bash
pnpm build:pages
```

This writes:

```text
dist-pages/
  index.html
  openapi.json
  data/
```

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
[editor guide](docs/editor.md) for editing rules, builds and disposable browser tests.

## Pokémon availability lookup

Inspect Bulbapedia game locations using a dataset Pokémon ID or nid:

```bash
pnpm pokemon:availability pikachu
pnpm --silent pokemon:availability 0026-alola --json
pnpm pokemon:availability pikachu --patch
pnpm pokemon:availability pikachu --with-ai --patch
```

The command prints a terminal table with one row per game or candidate Pokémon availability fields.
It preserves existing values where the source is inconclusive, including `storableIn`, and reports
warnings. With `--patch`, it updates and formats the selected Pokémon file and prints a summary of
added and removed games instead of the table or JSON. Optional `--with-ai` uses GPT-5.6 Terra to
verify the input, source HTML, and candidate output before proceeding, using `OPENAI_API_KEY` from
the environment or repository `.env`. See the [CLI guide](docs/pokemon-availability-cli.md) for
saved HTML input, classification rules, and limitations.

Run `pnpm pokemon:availability:all` to review every Pokémon interactively. Each iteration shows the
changes summary and accepts `p` to patch, `s` to skip, or `a` for AI verification followed by
patch/skip. Press Ctrl+C to stop.

## Credits

This dataset uses public data from:

- [Pokémon Showdown](https://pokemonshowdown.com/)
- [PokéAPI](https://pokeapi.co/)
- [Project Pokémon](https://github.com/projectpokemon)
- [Serebii.net](https://serebii.net/)
- [Bulbapedia](https://bulbapedia.bulbagarden.net/)

Thanks to everyone who collects and maintains public Pokémon game data.

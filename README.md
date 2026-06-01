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
pnpm dev
```

The dev server runs at `http://localhost:4173/` by default. Override the port with
`PORT=4174 pnpm dev` or `node src/openapi/dev.ts --port=4174`.

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

## Development

Requirements: Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

When changing data, run the tests before opening a PR. When changing the static API docs, run
`pnpm build:pages` and check the local Swagger UI with `pnpm dev`.

## Credits

This dataset uses public data from:

- [Pokémon Showdown](https://pokemonshowdown.com/)
- [PokéAPI](https://pokeapi.co/)
- [Serebii.net](https://serebii.net/)
- [Bulbapedia](https://bulbapedia.bulbagarden.net/)

Thanks to everyone who collects and maintains public Pokémon game data.

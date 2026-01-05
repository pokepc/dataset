# PokéPC static dataset

JSON data files for Pokémon, Games, Pokédexes, Living Dex Box presets, etc.

## Structure

- `data/`
  - `games/`: Individial JSON files for each game.
  - `indices/`: Keeps the sorting of the individual JSON files.
  - `metadata/`: Extra metadata files (e.g. Pokémon sprite slice coords, etc.)
  - `pokedexes/`: Individial JSON files for each Pokédex.
  - `pokemon/`: Individial JSON files for each Pokémon.
  - `boxpresets/`: Individial JSON files for each Living Dex Box preset.
  - `.*.json`: Standalone JSON files (types, colors, items, etc.)

- `lib/`
  - `constants.ts`: Constants.
  - `enums.ts`: Values that are constant (e.g. move categories, item categories, etc.).
  - `fs.ts`: File system utilities to load the dataset JSON files with the correct types.
  - `languages.ts`: Languages extra data and utilities.
  - `schemas.ts`: Zod schemas for the dataset.
  - `search.ts`: Full-text search utilities. This is what powers the Pokémon searchbox on the PokéPC
    website.
  - `types.ts`: All type definitions created from the schemas and the enums. Use the `Pkds.` prefix
    to access them directly without imports. e.g. `Pkds.Pokemon`.
  - `utils.ts`: Utility functions and helpers.
  - `validators.ts`: Validators for the dataset.

- `tests/*.test.ts`: Tests for the whole dataset.

## How to update the dataset

Requirements: Bun 1.3+ and PNPM 10.27+

- Clone this project and install the dependencies with `pnpm install`.
- Edit the files that you need.
- Run `pnpm test` to check if the dataset is still valid.
- Before pushing any code, run `pnpm lint` and `pnpm typecheck` to check if there are any circular
  imports or type errors.

## How to use the dataset and the lib in other projects

We don't offer a built version of this code via npm or similar.

The recommended way to use it in your projects is to add it as a git submodule, e.g.:

```bash
git submodule add git@github.com:pokepc/dataset.git src/dataset
```

This way, you can directly use the dataset and the lib `*.ts` files in your project as you wish.

Once you build your own project, make sure you delete any content that is not needed, such as the
`dataset/tests/` directory, so you can save some space.

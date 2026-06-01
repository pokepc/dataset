# PokéPC static dataset

JSON data files of Pokémon, Games, Pokédexes, Living Dex Box presets, etc., used in
https://pokepc.net and https://classic.pokepc.net.

Data has been collected from many public sources including: PokéAPI, Serebii.net and Bulbapedia.

## How to update the dataset

Requirements: Bun 1.3+ and PNPM 11.5+

- Clone this project and install the dependencies with `pnpm install`.
- Edit the files that you need.
- Run `pnpm test` to check if the dataset is still valid.
- Before pushing any code, run `pnpm lint` and `pnpm typecheck` to check if there are any circular
  imports or type errors.

> TIP: If you edit a Box preset, you can preview it by running `pnpm run dev` and visiting
> `http://localhost:4011/boxes` (you will need to restart the server to see any data changes).
> <img width="745" height="340" alt="image" src="https://github.com/user-attachments/assets/73f18a73-9dd6-4b23-8d3e-1b846c3b130a" />

## Structure

- `data/`
  - `games/`: Individial JSON files for each game.
  - `indices/`: Keeps the sorting of the individual JSON files.
  - `metadata/`: Extra metadata files (e.g. Pokémon sprite slice coords, etc.)
  - `pokedexes/`: Individial JSON files for each Pokédex.
  - `pokemon/`: Individial JSON files for each Pokémon.
  - `boxpresets/`: Living Dex Box presets.
    - `classic/`: legacy one-file-per-game-set preset maps.
    - `modern/`: route-loadable prepared presets. Each `GAMESET_ID.json` is an ordered array of
      preset ids, and each `GAMESET_ID/PRESET_ID.json` is one standalone preset file.
  - `.*.json`: Standalone JSON files (types, colors, items, etc.)

- `src/lib/`
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

- `src/utils/`: Generic utils.

- `src/scripts/`: Various maintenance scripts.

- `tests/*.test.ts`: Tests for the whole dataset.

## Modern box presets

Modern box presets can be migrated from `data/boxpresets/classic/**` with:

```bash
bun src/scripts/transform-modern-box-presets.ts
```

> NOTE: this will replace the existing `data/boxpresets/modern/**` presets, so make sure to back up
> your work first.

The generated layout is intentionally easy to prune by hand:

- `data/boxpresets/modern/GAMESET_ID.json`: ordered preset ids for that game set.
- `data/boxpresets/modern/GAMESET_ID/PRESET_ID.json`: one schema-versioned preset file.

During `pnpm build:data`, this tree is copied to `public/dataset/boxpresets/` without adding the
presets to the main `pokepc-static-data*.min.json` bundle. Route loaders should fetch only the
needed same-origin asset, such as `/dataset/boxpresets/home.json` or
`/dataset/boxpresets/home/grouped-region.json`.

Known Classic-only Pokémon ids are sanitized to `null` slots by `lib/box-preset-sanitizer.ts` so box
and slot order stays stable while incompatible content is made visible in transform diagnostics.

## Pokemon search syntax

The Pokemon search is powered by `generatePokemonSearchableText()` in `lib/utils.ts` and the
matching helpers in `lib/search.ts`.

### How matching works

- Search is case-insensitive.
- Commas are treated like spaces.
- Multiple spaces are collapsed.
- Positive tokens are combined with AND. Example: `pikachu electric` only matches entries containing
  both terms.
- Negated tokens start with `!` and must **not** be present. Example: `pikachu !mega` matches
  Pikachu results that do not contain `mega`.

### Searchable criteria

Each Pokemon contributes searchable text from the following data:

- Pokemon names from all available languages
- Form names from all available languages
- National Dex number
- Pokemon `id`
- `type:<type-id>` for both primary and secondary types
- `region:<region-id>`
- `color:<color-id>` Special case: brown Pokemon also include `color:orange`
- Generation tokens for both species dex generation and the Pokemon's own `gen` field: `gen1`,
  `gen:1`, `gen2`, `gen:2`, etc.
- Tags/flags when applicable: `mythical`, `legendary`, `female`, `baby`, `ultrabeast`,
  `ultra beast`, `regional`, `fusion`, `paradox`, `convergent`, `cosmetic`, `gigantamax`, `gmax`,
  `is-form`, `is-mega`, `is-battle-only`, `not-battle-only`, `is-storable`, `not-storable`

### Examples

- `charizard type:fire`
- `pikachu !is-form`
- `type:water !region:paldea`
- `gen:4 !legendary`
- `gmax !is-battle-only`

### Usage snippet

```ts
import { loadAllPokemon } from '@pokepc/dataset/lib/fs'
import { createSearchablePokemonList, searchPokemon } from '@pokepc/dataset/lib/search'

const pokemon = createSearchablePokemonList(loadAllPokemon())

// all Pokemon or forms in generation 9 that are not mega and are electric and green
const results = searchPokemon(pokemon, {
  q: 'gen9 !is-mega electric green', // or 'gen9 !is-mega type:electric color:green'
  forms: true,
})

console.log(results.pokemon.map((item) => item.id))
```

## How to use the dataset and the lib in other projects

We don't offer a built version of this code via npm or similar.

The recommended way to use it in your projects is to add it as a git submodule, e.g.:

```bash
git submodule add git@github.com:pokepc/dataset.git packages/dataset
```

This way, you can directly use the dataset and the lib `*.ts` files in your project as you wish,
e.g. as a monorepo workspace dependency: `"@pokepc/dataset": "workspace:*",`

Once you build your own project, make sure you delete any content that is not needed, such as the
`dataset/tests/` directory, so you can save some space.

## Credits

A big part of the data in this dataset is made possible thanks to the following projects:

- [Pokémon Showdown](https://pokemonshowdown.com/)
- [PokéAPI](https://pokeapi.co/)
- [Serebii.net](https://serebii.net/)
- [Bulbapedia](https://bulbapedia.bulbagarden.net/)

Thanks to everyone for collecting and making the game data available to the public.

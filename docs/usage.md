# Using the dataset

Recipes for consumers of `@pokepc/dataset` on npm and of the static JSON API on GitHub Pages. This
guide ships in the npm package as `docs/usage.md`. Upgrading from v7? See
[migrating-to-v8.md](migrating-to-v8.md).

## How the data is organized

- **Records** (`data/pokemon/<id>.json`, `data/moves.json`, …) are game-independent base data and
  hold **no text**.
- **Text** lives in one file per locale and kind: `data/i18n/<locale>/<kind>.json`, keyed by id. For
  example `data/i18n/eng/pokemon.json` holds every Pokémon's English `name`, `speciesName`,
  `formName` and `genus`. Missing translations are omitted, never copied from another language: pick
  your own fallback.
- **Locales**: `eng`, `es-es`, `es-la`, `fra`, `deu`, `ita`, `jpn`, `kor`, `chs`, `cht`, `pt-br`
  (`localeCodes` in `@pokepc/dataset/lib/languages`; `data/languages.json` has their metadata).
- **Game sets** with their own data (8.0.0: Pokémon Champions) have mods in `data/mods/<set>/`;
  merging base, mods and text gives that set's view (stats, learnsets, in-game descriptions).
- **Order**: `data/indices/{pokemon,games,pokedexes}.json` list the per-entity files in display
  order.

Schemas and types for every file are in `@pokepc/dataset/lib/schemas` and `lib/types`. The static
API's `openapi.json` lists every URL.

## Where to read from

| Consumer                | Read with                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Node (scripts, servers) | `@pokepc/dataset/lib/fs` loaders, which read the installed `data/` directly                                |
| Bundled apps            | JSON imports such as `@pokepc/dataset/data/i18n/eng/pokemon` (parse with `lib/schemas` to get exact types) |
| Any HTTP client         | The static API: `https://pokepc.github.io/dataset/v8/` (pin the major version)                             |

Static API URLs mirror `data/` without a prefix: `data/pokemon/pikachu.json` is
`<api>/pokemon/pikachu.json`, `data/i18n/eng/pokemon.json` is `<api>/i18n/eng/pokemon.json`.

## List every Pokémon with English names

Two files are enough: the index (order and ids) and the English text.

```ts
import idsJson from '@pokepc/dataset/data/indices/pokemon' with { type: 'json' }
import textJson from '@pokepc/dataset/data/i18n/eng/pokemon' with { type: 'json' }
import { indexSchema, textFileSchemas } from '@pokepc/dataset/lib/schemas'

// Parsing gives exact types (JSON imports are typed loosely) and checks the files.
const ids = indexSchema.parse(idsJson)
const text = textFileSchemas.pokemon.parse(textJson)
const pokemon = ids.map((id) => ({
  id,
  name: text[id]?.name ?? id,
  formName: text[id]?.formName,
}))
```

Static API: fetch `<api>/indices/pokemon.json` and `<api>/i18n/eng/pokemon.json` (two requests).

`name` is the full display name (`Mega Venusaur`), `speciesName` the species name when it differs
(`Venusaur`) and `formName` the form label (`Mega Form`, or `""` when the form officially has no
name).

## Full Pokémon records with their names

Records include types, stats, abilities, availability, evolution and form methods. In Node, load
them all and join the text:

```ts
import { loadAllPokemon, loadText } from '@pokepc/dataset/lib/fs'
import { translatePokemonList } from '@pokepc/dataset/lib/utils'

const english = loadText('pokemon', 'eng')
const pokemon = translatePokemonList(loadAllPokemon(), english, 'eng')
console.log(pokemon[0]?.name, pokemon[0]?.type1, pokemon[0]?.baseHp)
```

Over HTTP, each record is its own file (`<api>/pokemon/{id}.json`), so a full list costs one request
per Pokémon; prefer the npm package when you need all of them.

## Text in another language, with a fallback

```ts
import { loadText } from '@pokepc/dataset/lib/fs'
import type { LocaleCode } from '@pokepc/dataset/lib/types'

function pokemonName(id: string, locale: LocaleCode): string {
  return loadText('pokemon', locale)[id]?.name ?? loadText('pokemon', 'eng')[id]?.name ?? id
}
console.log(pokemonName('pikachu', 'jpn'))
```

The same applies to every kind: `loadText('moves', 'deu')`, `loadText('games', 'fra')`, … Moves,
abilities and items have `name`, `shortDesc` and `desc`; see `textSchemas` in `lib/schemas` for each
kind's fields. To map a stored v7 language key (`jap`, `esp`, …) use `localeCodeByV7Key`.

## Search Pokémon

```ts
import { loadAllPokemon, loadText } from '@pokepc/dataset/lib/fs'
import { localeCodes } from '@pokepc/dataset/lib/languages'
import { createSearchablePokemonList, searchPokemon } from '@pokepc/dataset/lib/search'

// Show English names, match names in every locale.
const list = createSearchablePokemonList(
  loadAllPokemon(),
  loadText('pokemon', 'eng'),
  'eng',
  localeCodes.map((locale) => loadText('pokemon', locale)),
)
const { pokemon } = searchPokemon(list, { q: 'pika', type: 'electric' })
console.log(pokemon.map((p) => p.name))
```

## Pokémon prose

Species prose is Markdown, one file per Pokémon and locale:
`data/i18n/<locale>/pokemon-prose/<id>.md`. It starts with a `## <genus>` heading followed by a few
paragraphs. It exists for English and German so far, and not for every form; a missing file means
there is no prose.

```ts
import { loadPokemonProse } from '@pokepc/dataset/lib/fs'

const markdown = loadPokemonProse('pikachu', 'deu') ?? loadPokemonProse('pikachu', 'eng')
```

- Bundlers: import `@pokepc/dataset/data/i18n/eng/pokemon-prose/pikachu.md` with your bundler's
  raw-text loader (for example Vite's `?raw`).
- Static API: `<api>/i18n/{locale}/pokemon-prose/{id}.md` (`text/markdown`; 404 when missing).

## Games, versions and game sets

Game records cover sets, versions and DLCs; their names are in `data/i18n/<locale>/games.json`. A
version or DLC belongs to the game set in its `gameSet`; a standalone game is its own set.

```ts
import { loadAllGames, loadText } from '@pokepc/dataset/lib/fs'

const games = loadAllGames()
const names = loadText('games', 'eng')
const sword = games.find((game) => game.id === 'swsh-sw')!
console.log(names[sword.id]?.name, '→ set', sword.gameSet ?? sword.id) // Sword → set swsh
```

## Data of one game set

Merged data applies a game set's mods (roster, overrides, set-specific text) to base data. Only sets
with mods have any (`listModdedGameSets()`; 8.0.0: `champions`). For every other set, base data is
the answer.

```ts
import { listModdedGameSets, loadGameSet } from '@pokepc/dataset/lib/fs'

console.log(listModdedGameSets()) // ['champions']
const champions = loadGameSet('champions', { locales: ['eng'] })
const garchomp = champions.records.pokemon?.find((p) => p.id === 'garchomp')
console.log(garchomp?.learnset?.length, champions.text.eng?.moves?.earthquake?.desc)
```

`champions.records` holds only Champions Pokémon, moves, abilities and items; moves Champions does
not let Pokémon use have `usable: false`. Outside Node, merge data you already loaded with
`mergeGameSet` from `@pokepc/dataset/lib/merge`, or fetch the merged files:

- `<api>/games/{set}/pokemon/{id}.json` (ids: `<api>/mods/{set}/roster.json`)
- `<api>/games/{set}/{moves|abilities|items|battle-states}.json`
- `<api>/games/{set}/i18n/{locale}/{kind}.json`

## Pokédexes

Pokédex records list entries in dex order; names are in `data/i18n/<locale>/pokedexes.json`. Entries
with `meta` describe game-exclusive forms that have no Pokémon record (Pokopia's Mosslax): their
text is under `entries.<meta.id>` in the same text file.

```ts
import { loadAllPokedexes, loadText } from '@pokepc/dataset/lib/fs'

const dexText = loadText('pokedexes', 'eng')
const pokemonText = loadText('pokemon', 'eng')
const pokopia = loadAllPokedexes().find((dex) => dex.id === 'pokopia')!
const rows = pokopia.entries.map((entry) =>
  entry.meta ? dexText.pokopia?.entries?.[entry.meta.id]?.name : pokemonText[entry.pid]?.name,
)
console.log(dexText.pokopia?.name, rows.slice(0, 3))
```

## Box presets

Presets are per game set: classic ones in `data/boxpresets/classic/<set>.json`, modern ones listed
in `data/boxpresets/modern/<set>.json` with one file each. Names, descriptions and box titles are in
`data/i18n/<locale>/boxpresets/<variant>/<set>.json`, keyed by preset id; `boxes` is aligned with
the preset's boxes (`null` for untitled boxes).

```ts
import { loadBoxPresetText, loadModernBoxPresets } from '@pokepc/dataset/lib/fs'

const text = loadBoxPresetText('modern', 'swsh', 'eng')
for (const preset of loadModernBoxPresets('swsh')) {
  console.log(text[preset.id]?.name, preset.boxes.length)
}
```

## Storing ids compactly

`data/codes/{pokemon,moves,ribbons,marks}.json` assign each id a stable integer that never changes
meaning, for storing moves as integer arrays or ribbons and Pokédex registrations as bitmaps.

```ts
import { loadCodeMap } from '@pokepc/dataset/lib/fs'

const codes = new Map(loadCodeMap('pokemon').map((entry) => [entry.id, entry.code]))
console.log(codes.get('pikachu'))
```

## Validating data you fetch

Every file has a schema; schemas are strict, so unexpected fields fail.

```ts
import { pokemonSchema, textFileSchemas } from '@pokepc/dataset/lib/schemas'

export async function fetchPikachu(api: string) {
  const pikachu = pokemonSchema.parse(await (await fetch(`${api}/pokemon/pikachu.json`)).json())
  const text = textFileSchemas.pokemon.parse(
    await (await fetch(`${api}/i18n/eng/pokemon.json`)).json(),
  )
  return { ...pikachu, name: text.pikachu?.name }
}
```

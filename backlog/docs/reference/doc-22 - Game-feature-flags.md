---
id: doc-22
title: Game feature flags
type: specification
created_date: '2026-10-11 02:33'
updated_date: '2026-10-11 02:33'
---
Game records declare mechanic flags in `features` (`gameFeaturesSchema` in `src/lib/schemas.ts`).
Every flag is required, so a new flag means curating all `data/games/*.json` records. For
storage-only apps (Box, Ranch, Bank, HOME), a mechanic flag means the app preserves that data.

## eggs

`features.eggs` is true when the game can hold Pokémon Eggs in its party or storage. It does not
mean the game can breed or hatch them: My Pokémon Ranch and Pokémon Box keep Eggs without hatching
them. Games, DLC and the sets and supersets that group them share the value, and an Egg needs a
party or storage, which `tests/data-integrity-tests/games.test.ts` checks.

| Value | Games                                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| true  | GSC, RSE, FRLG, Pokémon Box RS, DPPt, HGSS, My Pokémon Ranch, BW, B2W2, XY, ORAS, SM, USUM, SwSh and DLC, BDSP, SV and DLC |
| false | RBY, Colosseum, XD, Pokémon Bank, LGPE, GO, HOME, Legends: Arceus, Legends: Z-A and DLC, Champions, Pokopia, Winds/Waves    |

Verification (2026-10-11):

- **Core series from Gen 2 to Gen 9** breed through the Day Care, Nursery or picnics and keep Eggs
  in the party and boxes. RBY predates Eggs.
- **Pokémon HOME and Pokémon Bank** refuse Eggs: HOME shows "You can't leave a Pokémon Egg in
  Pokémon HOME!" and Bank "You cannot deposit an Egg." (Bulbapedia, Pokémon Egg).
  [Serebii's Bank storage page](https://www.serebii.net/bank/storage.shtml) states "Eggs cannot be
  placed within the box", and Poké Transporter refuses Eggs.
- **My Pokémon Ranch** accepts Eggs, which do not hatch there; Hayley trades Mew for an Egg at the
  maximum level (Bulbapedia, My Pokémon Ranch and Pokémon Egg; Serebii forums report depositing an
  Egg).
- **Pokémon Box RS** stores PK3 slots, which carry the Egg flag
  ([PKHeX SAV3RSBox](https://github.com/kwsch/PKHeX/blob/master/PKHeX.Core/Saves/SAV3RSBox.cs)),
  and its bonus Eggs (Swablu, Zigzagoon, Skitty, Pichu) are kept in Box and moved to a cartridge to
  hatch (Bulbapedia, Pokémon Box Ruby & Sapphire).
- **Colosseum and XD** cannot receive Eggs from the GBA games; Colosseum's trade help says Eggs
  "cannot be accepted" (Bulbapedia, Trade; Serebii's XD FAQ).
- **Pokémon GO** keeps Eggs in a separate incubator inventory, outside Pokémon storage, so the flag
  is false.
- **LGPE, Legends: Arceus, Legends: Z-A and Champions** have no Eggs or breeding (Z-A: VGC and
  GamesRadar guides; Champions: Game8). Pokopia has no Pokémon storage.
- **Winds/Waves** is unreleased (announced 2026-02-27 for 2027) and no official source mentions
  Eggs. It stays false until release; revisit then.

Bulbapedia refuses automated requests, so its pages were read through search excerpts rather than
fetched directly. Recheck them by hand when a value is disputed.

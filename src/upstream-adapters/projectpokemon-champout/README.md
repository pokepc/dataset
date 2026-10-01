# champscript

Parses the Project Pokémon `champout` dump of Pokémon Champions and maintains the `champions` game
set: `mods/champions/` (roster, overrides, Champions text) and the base facts Champions owns
(upstream ids, move mechanics, battle states, names in locales base lacks). Conversion rules are in
Backlog doc-2 ("Champions").

## Maintainer workflow

Run manually after an upstream update; it is not part of `pnpm build`.

1. Update the submodule: `git submodule update --remote src/upstreams/projectpokemon-champout`.
2. Run `pnpm champions:update`. It parses the dump, adds PokéAPI ids (network, cached under
   `.local/`), rewrites `mods/champions/` and updates base files, then merges the set and checks
   that it reproduces the dump. It prints "No changes." when the dump brings nothing new.
3. Run `pnpm format`, review the diff (new overrides, unset abilities, text) and run `pnpm test`.
4. A Pokémon, move, ability or item missing from base stops the run: add its curated base record
   first (and run `pnpm codes:sync`), then rerun. Ability lists that cannot be mapped onto base
   slots also stop it.
5. Commit the submodule bump with the data changes.

Unmatched PokéAPI resources are reported and stored as `pokeApiId: null`, never guessed.

## Datasets

### Champions

This is how to find the data we need:

- Battle State: src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/btl_state_syn.json. Name
  and descriptions are in the same file, and they share the same prefix in LabelName e.g.
  `BTR_STATE_SYN_115*\*`
- Move names: src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/wazaname.json
- Move descriptions and data: src/upstreams/projectpokemon-champout/rom-txt/esp/wazainfo_syn.json
- Move targets: src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/wazatarget.json
- Move classifications:
  src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/wazaclassification.json
- Ability names: src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/tokusei.json
- Ability descriptions and data:
  src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/tokuseiinfo_syn.json
- Item names: src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/itemname.json,
  src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/itemname_plural.json
- Item descriptions and data:
  src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/iteminfo_syn.json
- Ability names: src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/seikaku.json
- Type names: src/upstreams/projectpokemon-champout/rom-txt/{LANG_CODE}/typename.json
- Pokemon names: src/upstreams/projectpokemon-champout/rom-txt/usa/monsname_syn.json
- Pokemon form names: src/upstreams/projectpokemon-champout/rom-txt/usa/zkn_form_syn.json
- Localized Pokemon weights: src/upstreams/projectpokemon-champout/rom-txt/usa/zkn_weight.json
  (height not available, since it is not important for combats)

Master data (metadata):

- Items: src/upstreams/projectpokemon-champout/masterdata/item.json
- Moves: src/upstreams/projectpokemon-champout/masterdata/waza.json
- Pokemon move learnsets: src/upstreams/projectpokemon-champout/masterdata/waza_learn.json
- Pokemon data: src/upstreams/projectpokemon-champout/masterdata/personal.json

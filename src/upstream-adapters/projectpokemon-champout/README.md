# champscript

Data collector and dumper for the Champions data dumps

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

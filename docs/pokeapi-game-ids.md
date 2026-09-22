# PokéAPI game IDs

Every `data/games/*.json` record has two nullable positive integer references:

- `pokeApiGameVersionId`: the ID of the exact PokéAPI `/version/{id}` resource.
- `pokeApiGameVersionGroupId`: the ID of the exact `/version-group/{id}` resource.

These match
[PokéAPI's version and version-group resources](https://pokeapi.co/docs/v2#games-section). There is
no separate PokéAPI `game` resource. IDs identify upstream records; they do not establish encounter
coverage, availability, or storage compatibility.

| Local record                         | Version ID | Version group ID |
| ------------------------------------ | ---------- | ---------------- |
| Red (`rb-r`)                         | 1          | 1                |
| Red & Blue (`rb`)                    | null       | 1                |
| Yellow (`y`)                         | 3          | 2                |
| Red, Blue & Yellow (`rby`)           | null       | null             |
| The Isle of Armor (`swsh-islearmor`) | null       | 21               |
| Mega Dimension (`lza-megadimension`) | 48         | 31               |

Sets and paired DLCs represent multiple versions, so their version ID is null. Supersets span
multiple groups and have both fields null. Unsupported records also have null references. Each
individual game's group ID comes from its upstream group membership.

For paired DLC encounters, consumers must still resolve the specific upstream version to its base
game. For example, Isle of Armor versions 35 and 50 belong to group 21, but refer to Sword and
Shield respectively. The group ID alone must not apply either version's exclusive encounters to both
games. Japanese Gen 1 versions are distinct upstream resources and are not aliased to our
international Red/Blue records.

## One-off population script

```bash
pnpm games:pokeapi-ids                 # Preview all mappings
pnpm games:pokeapi-ids --write         # Populate and format game JSON files
pnpm games:pokeapi-ids --refresh       # Preview using fresh upstream metadata
```

The script uses Bun and the existing cached PokéAPI client. It fetches version groups, derives their
member version IDs, and matches exact names with explicit aliases for naming differences. Numeric
IDs are read from upstream metadata rather than hardcoded. `--refresh` can be combined with
`--write`. Use `POKEPC_DATASET_DIR` to select another dataset; cache configuration uses the existing
`POKEAPI_CACHE_DIR`, `POKEAPI_CACHE`, and `POKEAPI_REFRESH_CACHE` environment variables.

All candidates are validated and formatted with the repository's Oxfmt configuration before writing.
Unrelated fields are preserved. Conflicting existing non-null references stop the migration for
manual review. Repeating it against the same metadata produces no further changes.

The shared game schema also provides the `Pkds.Game` TypeScript type and public OpenAPI game schema;
both include these fields. These mappings remain available for other PokéAPI integrations; the
[availability CLI](pokemon-availability-cli.md) now uses only Bulbapedia's availability lists. The
migration itself does not change Pokémon availability.

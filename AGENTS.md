# Dataset guidance

Before editing Pokémon availability data, schemas, parsers, or editor behavior, read the
[canonical availability field definitions](docs/pokemon-availability.md). This reference defines
acquisition, storage, shiny fields, form exceptions, and the current Champions export restriction.
Use it instead of terminology in older audits or remembered rules.

The [availability CLI guide](docs/pokemon-availability-cli.md) documents source mappings, curated
rules, unresolved coverage, and offline validation.

Adding, renaming or removing a Pokémon, ribbon, mark or move changes the append-only code maps in
`data/codes/`. Read the [code map rules](docs/codes.md), run `pnpm codes:sync` and never edit or
reorder an existing code.

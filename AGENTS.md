# Dataset guidance

Project docs and decisions live in [Backlog.md](https://github.com/MrLesk/Backlog.md) under
`backlog/`. Start with the [project overview](backlog/docs/doc-1%20-%20Project-overview.md); the
`*-next` directories are the v8 model described in
[v8 data-next architecture](backlog/docs/doc-2%20-%20v8-data-next-architecture.md). Create and
update records with the `backlog` CLI rather than editing their files.

Before editing Pokémon availability data, schemas, parsers, or editor behavior, read the
[canonical availability field definitions](backlog/docs/reference/doc-7%20-%20Pok%C3%A9mon-availability-fields.md).
This reference defines acquisition, storage, shiny fields, form exceptions, and the current
Champions export restriction. Use it instead of terminology in older audits or remembered rules.

The [availability CLI guide](backlog/docs/guides/doc-11%20-%20Pok%C3%A9mon-availability-CLI.md)
documents source mappings, curated rules, unresolved coverage, and offline validation.

Adding, renaming or removing a Pokémon, ribbon, mark or move changes the append-only code maps in
`data/codes/`. Read the [code map rules](backlog/docs/reference/doc-3%20-%20Code-maps.md), run
`pnpm codes:sync` and never edit or reorder an existing code.

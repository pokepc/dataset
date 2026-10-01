---
id: doc-1
title: Project overview
type: readme
created_date: '2026-09-30 23:58'
updated_date: '2026-10-01 17:17'
---
`@pokepc/dataset` is the public Pokémon dataset behind [PokéPC](https://pokepc.net): static JSON
data for Pokémon, games, Pokédexes, box presets and related metadata, plus TypeScript helpers, Zod
schemas and an OpenAPI description. It ships as an npm package and as a static JSON API on GitHub
Pages. Usage, layout and contributor commands are in the root `README.md`; this page describes the
current state and shape of the project and indexes the maintained docs and decisions.

## State (October 2026)

- Stable line: **v8** (8.0.0, released 2026-10-01 on npm and `/v8/`, `/latest/`). `data/` and `src/lib` are the per-game-set,
  fully translated model of
  [decision-2](../decisions/decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md):
  base records without text, per-locale text and game set mods (Champions). Specification:
  [v8 architecture](doc-2%20-%20v8-data-next-architecture.md); consumer migration:
  [`docs/migrating-to-v8.md`](../../docs/migrating-to-v8.md). Milestone `m-0`.
- Previous line: **v7** (7.5.0), maintained on the `7.x` branch; still on npm `^7` and `/v7/`.
- Recent: append-only numeric code maps for storage-efficient consumers
  ([decision-1](../decisions/decision-1%20-%20Append-only-numeric-code-maps-for-stored-ids.md)),
  versioned Pages deployment
  ([decision-3](../decisions/decision-3%20-%20Versioned-GitHub-Pages-deployment-per-stable-major.md)),
  v8 locale codes ([decision-4](../decisions/decision-4%20-%20v8-locale-codes-and-language-records.md)),
  merged static output only for game sets with mods
  ([decision-5](../decisions/decision-5%20-%20Merged-static-API-output-only-for-game-sets-with-mods.md)),
  and a series of researched availability, form and evolution audits.

## Repository shape

| Path                     | Contents                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `data/`                  | v8 dataset: base collection files at the root, one file per entity in `pokemon/` (1,595), `games/` (78), `pokedexes/` (64); `indices/` order them; `boxpresets/`, `metadata/`, `codes/`; `i18n/<locale>/` text and prose; `mods/champions/` |
| `src/lib/`               | Library (`@pokepc/dataset/lib/*`): Zod schemas, types, enums, Node loaders, `mergeGameSet`, search, code-map helpers |
| `docs/`                  | Consumer docs shipped in the package (`migrating-to-v8.md`)                                       |
| `src/upstream-adapters/` | Importers and parsers: Bulbapedia availability, locations, PokéAPI, Champions game dumps         |
| `src/upstreams/`         | Upstream snapshots; Project Pokémon `champout` is a Git submodule                                |
| `src/openapi/`, `src/pages/` | OpenAPI document, Swagger shell and the multi-version Pages builder                          |
| `src/scripts/`           | `codes:sync`, Champions roster and storage helpers                                                |
| `apps/editor/`           | Local maintainer editor (React Router, Vite, Tailwind) for `data/`                               |
| `tests/`                 | Data-integrity tests, package smoke test, and a guard that blocks network access during tests     |
| `backlog/`               | Backlog.md tasks, decisions and docs (this page)                                                 |

## Pipelines

- **Curation**: most of `data/` is hand-curated or patched by tools. The availability CLI
  (`pnpm pokemon:availability`) parses Bulbapedia lists and patches Pokémon files;
  `pnpm locations:import` merges location sources; the editor edits records with schema validation.
- **Generation**: `pnpm champions:update` (manual) rewrites `mods/champions/` from the Champions game
  dump and PokéAPI; `pnpm generate:pokemon-prose` writes AI-generated species prose per locale.
- **Build and publish**: `pnpm build` (tsdown library to `build/`, format); `pnpm build:pages` adds
  merged `/games/{set}/` data to the static API. Tags
  `x.y.z` publish to npm with provenance; Pages rebuilds on `main` changes and after each publish.
- **Quality gates**: `pnpm format:check`, `typecheck`, `test` (offline, fixtures only). PR checks run
  on pull requests; publish and Pages workflows repeat them.

## Docs

Reference (data contract):

- [Code maps](reference/doc-3%20-%20Code-maps.md)
- [Game lifecycle dates](reference/doc-4%20-%20Game-lifecycle-dates.md)
- [Location catalog](reference/doc-5%20-%20Location-catalog.md)
- [PokéAPI game IDs](reference/doc-6%20-%20Pok%C3%A9API-game-IDs.md)
- [Pokémon availability fields](reference/doc-7%20-%20Pok%C3%A9mon-availability-fields.md) — canonical;
  supersedes audit terminology
- [Pokémon evolution methods](reference/doc-8%20-%20Pok%C3%A9mon-evolution-methods.md)
- [Pokémon form transitions](reference/doc-9%20-%20Pok%C3%A9mon-form-transitions.md)

Guides:

- [Dataset editor](guides/doc-10%20-%20Dataset-editor.md)
- [Pokémon availability CLI](guides/doc-11%20-%20Pok%C3%A9mon-availability-CLI.md)
- [v7 to v8 migration guide](guides/doc-21%20-%20v7-to-v8-migration-guide.md) — points to the published
  `docs/migrating-to-v8.md`

Audits (dated research snapshots; reference docs win on conflicts). Supporting JSON/CSV artifacts
live beside them in `audits/`:

- [Generation 6–9 availability](audits/doc-12%20-%20Generation-6%E2%80%939-availability-audit.md)
- [GO legendary and mythical acquisition](audits/doc-13%20-%20GO-legendary-and-mythical-acquisition-audit.md)
- [Ordinary and battle form availability](audits/doc-14%20-%20Ordinary-and-battle-form-availability-audit.md)
- [Pokémon ability history](audits/doc-15%20-%20Pok%C3%A9mon-ability-history.md) — also defines
  `legacyAbilities`
- [Pokémon evolution](audits/doc-16%20-%20Pok%C3%A9mon-evolution-audit.md)
- [Form changes](audits/doc-17%20-%20Form-change-audit-%E2%80%94-2026-09-22.md)
- [Special-form availability](audits/doc-18%20-%20Special-form-availability-research.md)
- [Storage games: Box RS, Ranch and Bank](audits/doc-19%20-%20Pok%C3%A9mon-Box-RS-My-Pok%C3%A9mon-Ranch-and-Pok%C3%A9mon-Bank.md)
- [Vivillon availability](audits/doc-20%20-%20Vivillon-availability-audit.md)

## Conventions

- The repository is public: keep docs self-contained with public links.
- Code-map entries are append-only; run `pnpm codes:sync` after adding, renaming or removing
  Pokémon, ribbons, marks or moves.
- Tests must never reach the network; use fixtures, mocks or loopback servers.
- Maintained guidance lives in `backlog/docs`; durable choices in `backlog/decisions`.

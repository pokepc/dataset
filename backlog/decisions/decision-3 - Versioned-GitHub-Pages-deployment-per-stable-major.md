---
id: decision-3
title: Versioned GitHub Pages deployment per stable major
date: '2026-10-01 00:01'
status: accepted
---
## Context

The static JSON API and OpenAPI docs on GitHub Pages used to serve only the latest default-branch
build. Breaking releases (such as v8, see
[decision-2](decision-2%20-%20v8-version-data-per-game-set-with-full-translations-data-next.md))
would break every client that fetches the JSON directly.

## Decision

Deploy one complete site containing several dataset builds, each a full copy rather than a
redirect:

| Path               | Source                              |
| ------------------ | ----------------------------------- |
| `/dataset/`        | Latest default-branch build         |
| `/dataset/latest/` | Highest stable SemVer tag           |
| `/dataset/vN/`     | Highest stable tag for each major N |

Retained majors live in `pages-versions.json` (unique integers ≥ 6). Every `openapi.json` lists all
deployed servers with its own first. Each source is built in isolation from its own code and frozen
lockfile (`src/pages/`, `pnpm build:pages:versions`); prereleases are excluded, and tag/package
mismatches or missing releases fail the build. `versions.json` records the deployed refs.

Implemented; the public contract is documented in the README's "Static API" section.

## Consequences

- Releasing a new major advances `/latest/`; adding the major to `pages-versions.json` exposes
  `/vN/`, and removing one drops its path on the next deployment.
- Pages deployments rebuild every retained source, so they need Git, Bun, network access and longer
  CI time.
- CI pins the root source with `--root-sha` so a concurrent push cannot mix configuration and build.

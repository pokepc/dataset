---
id: m-0
title: "v8 game-set data model"
---

## Description

Ship 8.0.0 with the base + mods data model (decision-2, doc-2) and remove the `-next` directories: `data-next/` and `src/lib-next` become `data/` and `src/lib`.

v8 is breaking in structure (file layout, text moved into per-locale files), but existing properties such as `id`, `nid`, `gen` and the code maps keep their names and meanings.

Done when 8.0.0 is published to npm, `/v8/` and `/latest/` on GitHub Pages serve the new layout, and v7 remains available from npm 7.x and `/v7/`. `main` is the v8 workspace; v7 fixes go to the `7.x` branch.

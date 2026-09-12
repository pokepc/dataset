# PokéPC dataset editor

Local maintainer UI for this repository's `data/`. No external dataset-directory configuration is
required.

Install dependencies with `pnpm install` from the repository root. Then start the editor from
`apps/editor`:

```sh
pnpm dev
```

The editor runs on `http://127.0.0.1:3003`. From the repository root, use `pnpm dev:editor` to start
this app. Workspace startup commands are documented in the
[root README](../../README.md#dataset-editor).

Read the [editor guide](../../docs/editor.md) for file-safety rules, checks and disposable fixtures.

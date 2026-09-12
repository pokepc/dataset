# Dataset editor

Read [the editor guide](../../docs/editor.md) before changing behavior. This is trusted local
maintainer tooling for the repository's `data/`; use disposable copies for write verification.

- This repository is public. Keep documentation self-contained, use public links, and avoid private
  tracker references, nonpublic repositories, and developer-specific paths.
- Preserve the existing UI and editing contracts; retain the CDN image URLs.
- Reuse the local dataset package through its public exports. Filesystem work belongs in
  `app/lib/*.server.ts`; routes delegate to those modules.
- Validate writes and preserve sibling records, preset variants, index order and stored cell flags.
- Keep tests beside `app/lib` code. Run `pnpm test:editor`, `pnpm typecheck:editor`, and
  `pnpm test:e2e:editor` from the root for persistence or routing changes.
- Do not edit generated `.react-router` types or build outputs. Keep the Git index unchanged.

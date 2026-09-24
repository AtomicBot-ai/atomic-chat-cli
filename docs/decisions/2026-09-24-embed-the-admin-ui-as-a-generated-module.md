---
date: 2026-09-24
title: "Embed the admin UI as a generated module"
---

# 2026-09-24 — Embed the admin UI as a generated module

- **Context:** `atc` ships as one binary, and the daemon serves a web admin: a React SPA built by Vite into
  static files (`packages/admin-ui/dist`). Those files have to travel inside the binary, be served with
  correct types and caching, and not turn every `npm test` or `build:bin` into a Vite build. The core
  already solved the same problem for the app's static assets with `scripts/import-app-static.mjs`, which
  writes a `static-assets.generated.ts` module. The runtime-agnostic rule (no `Bun.*`, the same code under
  Node in tests and inside the Bun binary) applies.
- **Decision:** `scripts/embed-admin-assets.mjs` walks `packages/admin-ui/dist` and writes
  `src/admin/static-assets.generated.ts`: `ADMIN_ASSETS: Record<path, { type, gz }>` with each file gzipped
  (level 9) and base64-encoded, plus `ADMIN_BUILD_ID`, a sha256 prefix over paths and contents. When there is
  no built SPA it embeds `resources/admin-placeholder.html` with the build id `placeholder` — a page that
  signs in with the URL token and shows `/api/status` — so tests and `build:bin` never need Vite.
  `src/admin/static.ts` decodes an asset on first request with `node:zlib`, caches the buffer, serves
  `index.html` for any path that is not a file (the router owns the URL space), marks hashed file names
  `immutable`, sets `Content-Security-Policy: default-src 'self'` and reports the build id in an
  `x-atc-admin-build` header and in `atc version`. The generated file is gitignored and excluded from lint
  and coverage; `npm run build:bin` runs `embed:ui` first, and the release runs `build:ui` before it.
- **Consequences:** The binary is self-contained: no resource folder to lose, and self-update replaces one
  file. Unit and contract tests, and a developer's `build:bin`, run without the UI toolchain; the daemon
  contract test asserts the placeholder is served. The price is size — base64 adds a third on top of gzip —
  and memory for the decoded assets in the daemon (a few megabytes, cached once). A stale generated file is
  a real failure mode: a binary can carry an old SPA if `embed:ui` was skipped, which is why the npm script
  chains it and the build id is visible in `atc version`, the response header and `/api/status`. The
  placeholder page is part of the product surface (it is what a source build shows) and must keep working
  with the login flow. Changing the embedding (for example to Bun's embedded files) would touch `static.ts`
  and the script only.
- **Alternatives:** *A resources folder beside the binary*: breaks "one file", complicates the installer and
  self-update, and lets the SPA and the binary drift apart — rejected. *`Bun.embeddedFiles` / `bun build`
  asset imports*: Bun-only, so it breaks the runtime-agnostic rule and every test under Node — rejected.
  *Serving the SPA from a CDN or a GitHub release at runtime*: fails on offline servers and adds a
  supply-chain dependency for a page that holds an admin session — rejected. *Plain base64 without gzip*:
  simpler, but three to four times the size for text assets — rejected.
- **Owner:** team.
- **Links:** `scripts/embed-admin-assets.mjs`; `src/admin/static.ts`; `resources/admin-placeholder.html`;
  `.gitignore` (`src/admin/static-assets.generated.ts`); `eslint.config.js` (`**/*.generated.ts`
  ignored); `test/contract/daemon.test.ts` ("serves the placeholder page"); the core's
  `scripts/import-app-static.mjs`; `docs/admin-ui.md`.

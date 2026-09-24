---
date: 2026-09-24
title: "Use Bun as the package manager"
---

# 2026-09-24 — Use Bun as the package manager

- **Context:** The scaffold plan named Bun as the package manager (`bun.lock`, `bun install
  --frozen-lockfile`), as in the core. The scaffold shipped with npm and `package-lock.json` instead, without a
  record: the core was not on npm yet and came in as a `file:` link to a checkout of its
  `feat/atc-host-exports` branch (`.core/`, `scripts/prepare-core.mjs`), which was easier to develop with
  npm. Once the core was published and pinned as `@atomic-chat/core` `0.5.1`, that link and the script were
  removed and the reason went with them. What remained was two tools for one job: Bun was already required to
  compile the binary and run `bun test test/runtime-compat`, CI installed both, and the two repositories kept
  lock files in different formats.
- **Decision:** Bun 1.3.10 installs dependencies: `bun.lock` is committed, `bun install` locally, `bun install
  --frozen-lockfile` in every CI and release job. Node 22 stays the development and test runtime and scripts
  still run as `npm run …`, exactly as in the core; nothing in the code changes (the runtime-agnostic rule is
  about the code, not the installer).
- **Consequences:** One tool installs and compiles, so a release build is `bun install --frozen-lockfile &&
  npm run build:ui && npm run build:bin:all`, the same shape as the core's. `bun.lock` was produced by Bun's
  own migration of `package-lock.json`: the resolved versions are identical (the npm aliases
  `string-width-cjs`, `strip-ansi-cjs`, `wrap-ansi-cjs` are recorded under their real names). The root
  `prepare` script (`embed:ui`) runs on `bun install` as it did on `npm install`. Bun does not run the
  install scripts of dependencies unless they are trusted: `esbuild` and `fsevents`, the only ones today, are
  on its default list (`bun pm untrusted` reports none); a new dependency with an install script needs a
  `trustedDependencies` entry. The `gate` and `ui` CI jobs now set up Bun as well. A core bump is `bun add
  --exact @atomic-chat/core@<version>`; a local core checkout is attached with `bun link`, which leaves
  `package.json` and `bun.lock` untouched, and a plain `bun install` keeps the link — `bun install --force`
  restores the pinned version.
- **Alternatives:** *Stay on npm and record why*: two installers and a lock format that differs from the
  core for no remaining reason — rejected. *pnpm*: a third tool neither repository uses — rejected. *`bun
  run` for scripts as well*: possible, but the core runs its scripts through `npm run`, the workspace scripts
  call `npm run --workspace`, and one convention across the two repositories is worth more — not now.
- **Owner:** team.
- **Links:** `bun.lock`; `package.json`; `.github/workflows/ci.yml`, `.github/workflows/release.yml`;
  `Makefile`; `.prettierignore`; `README.md` (Development); `AGENTS.md` §4; `docs/testing.md`;
  `docs/release.md` (The core pin); the core's `AGENTS.md` and `.github/workflows/ci.yml`.

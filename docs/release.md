# Releasing

One command tags a release; the pushed tag builds every binary, checksums them and publishes a GitHub
release with the installers as assets. A published version is never replaced.

## The command

```bash
npm run release -- patch --push        # 0.1.0 → 0.1.1, commit, tag v0.1.1, push branch + tag
npm run release -- minor               # bump and tag only; prints the push command
npm run release -- 1.2.3 --push        # an explicit version (the current one only tags HEAD)
make release                           # patch; VERSION=minor / major / X.Y.Z
```

`scripts/release.mjs` refuses a dirty tree, a version below the current one and a tag that already exists
locally or on `origin`. It rewrites the one version line in `package.json` and in `src/version.ts`
(`ATC_VERSION`; a unit test keeps the two equal), commits `release: vX.Y.Z`, creates an annotated tag and,
with `--push`, runs `git push --follow-tags origin HEAD`. Follow the run with
`gh run list --workflow release.yml`.

## What the workflow does (`.github/workflows/release.yml`)

Triggered by a `v*` tag, or by hand (`workflow_dispatch`) for the version already in `package.json` on a
branch. Three jobs, one at a time (`concurrency: release`):

1. **version** — reads `package.json`, refuses a tag that does not match it and a release that already
   exists.
2. **gates** — `ci.yml` through `workflow_call`: lint, typecheck, format, generated docs check, the UI
   build and tests, and the test matrix on ubuntu x64/arm64, macOS, Windows x64/arm64 including
   `build:bin` and the binary e2e. Nothing ships that did not pass on every runner.
3. **publish** — on ubuntu: `bun install --frozen-lockfile`, `build:ui`, `build:bin:all` (Bun cross-compiles
   all six targets; `ATC_GIT_SHA` is baked in), a check that the Linux x64 binary reports the version, then
   the assets are named, checksummed and published with `gh release create --generate-notes --latest`.

## Assets

| Asset | From |
| --- | --- |
| `atc-<version>-<triple>[.exe]` × 6 | `dist/bin/atc-<triple>` renamed with the version. Triples: `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-pc-windows-msvc`, `aarch64-pc-windows-msvc`, `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu` (`TARGETS` in `scripts/build-binaries.mjs`). |
| `SHA256SUMS` | `sha256sum atc-*` over the renamed binaries. The installers and the updater verify against it. |
| `install.sh`, `install.ps1` | Copied from `scripts/`; served at `releases/latest/download/install.sh` so the one-liner in the README works. |

Binaries are built with `--minify-syntax --minify-whitespace --sourcemap` (identifiers kept, so stack
traces name functions) and `--define __ATC_GIT_SHA__ / __ATC_BUILD_DATE__`, which `atc version` reports.

## Installers

`scripts/install.sh` (Linux, macOS; `sh`, `curl` or `wget`) and `scripts/install.ps1` (Windows PowerShell)
do the same thing: resolve the release (`ATC_VERSION=vX.Y.Z` pins one, default latest), download
`SHA256SUMS`, pick the asset matching this machine's triple, download and verify it, and install it
atomically — copy beside the target and rename over it on POSIX (never overwrite the inode a running `atc`
executes from); on Windows a running `atc.exe` is moved aside as `atc.exe.old-<stamp>` and cleaned up on
the next install. Defaults: `~/.local/bin/atc` and `%LOCALAPPDATA%\atc\atc.exe`. The install directory is
added to `PATH` (rc file with the marker `# added by atc installer`, or the user PATH on Windows) unless
`ATC_NO_PATH=1`. `ATC_INSTALL_DIR` and `ATC_REPO` override the location and the repository.

## Self-update

`atc update --check` works: it reads `https://api.github.com/repos/AtomicBot-ai/atomic-chat-cli/releases/latest`,
compares semver (pre-releases sort before releases) and prints whether a newer version exists.
`atc update` without `--check` is a stub until iteration 6; the hint is to re-run the installer. The pure
parts are already in `src/update/`: `semver.ts`, `checksums.ts` (the `SHA256SUMS` parser), `replace-plan.ts`
(`assetNameFor(version, platform, arch)` — the same naming as the workflow — and `planReplace`: POSIX
renames over the running inode; Windows moves the running file aside first), `release.ts` (the lookup).

## Signing and notarisation

Future work (iteration 8), following `atomic-agent`'s scheme: macOS code signing and notarisation, Windows
Authenticode. Until then macOS Gatekeeper and SmartScreen may warn on first run of a downloaded binary;
the checksum in `SHA256SUMS` is the integrity check.

## The core pin

`atc` embeds the core as the npm package `@atomic-chat/core` (repo `atomic-chat-core`, published by its
release workflow) at an **exact** version, never a caret: the protocol and version checks make a silently
newer core unsafe.

```jsonc
// package.json
"dependencies": { "@atomic-chat/core": "0.5.1" }
```

To bump the core: `bun add --exact @atomic-chat/core@<version>`, run `npm run verify`, and commit the bump
(`package.json` and `bun.lock`) on its own. To develop against a local core checkout, build it there, run
`bun link` in it and `bun link @atomic-chat/core` here (only `node_modules` changes), and `bun install
--force` to go back to the pinned version. The core's `attachToOwner` refuses a version mismatch between the running daemon and the
attaching command, so a core bump is always followed by an `atc` release, and the first `atc start` after an
upgrade replaces an idle old daemon.

The core's release workflow publishes to npm when its `NPM_TOKEN` secret is set; otherwise a maintainer
publishes from a clean `main` checkout with `npm publish --access public --otp=<code>`.

---
date: 2026-09-24
title: "Adopt atomic-chat-core as an embedded library and single binary"
---

# 2026-09-24 — Adopt atomic-chat-core as an embedded library and single binary

- **Context:** `atomic-chat-core` (0.4.0) is the headless inference core of Atomic Chat: engines, models,
  the OpenAI-compatible `/v1` server, a control API on loopback, and an owner model for a data folder
  (`AtomicCore.create({ ownerScope: 'cli', … })` takes `instance.lock`, writes `control-token`, spawns
  engines as children). The desktop app consumes it as a downloaded sidecar binary driven from Rust; the
  core also has its own small CLI in `src/cli/`, meant as a development tool. A server CLI needs the same
  engines, models and server, installed as one file on headless Linux, Windows and macOS boxes, plus what a
  server needs and the core deliberately does not have: a web admin, hardware facts from `nvidia-smi`, OS
  services, self-update, and the privileged steps of managed runtimes. The core's public exports were `.`,
  `./client` and `./contracts`; its data-folder rules, lock read side, attach-or-spawn and models/downloads
  code were internal. The two repositories are separate and stay separate; the desktop app and `atc` are
  products for different audiences with no runtime link (decisions D1, D2, D3, D6 of the plan).
- **Decision:** `atc` embeds `atomic-chat-core` as an npm dependency at an **exact pin** and compiles into
  **one binary per platform** with `bun build --compile` (`scripts/build-binaries.mjs`, six targets,
  `dist/bin/atc-<triple>`). The daemon runs the core in-process; commands attach to the daemon through the
  core's own `attachToOwner`. The core's data folder for the CLI scope, `<system data>/atomic-chat-cli/data`,
  is kept so models never collide with the app's, and `atc/` inside it holds what only `atc` owns. `atc` is
  the only user-facing CLI; the core's `src/cli/` stays a dev tool. `atc` never copies core logic: a missing
  capability is an export request in the core. This iteration added, on the core branch
  `feat/atc-host-exports`, the entry points `./host` (config, lock read side, owner attach, telemetry),
  `./models`, `./downloads`, the browser-safe hardware types in `./contracts`, and a public
  `CoreClient.request`. That branch was merged and released as `@atomic-chat/core@0.5.1` (2026-09-24);
  `package.json` pins the exact npm version.
- **Consequences:** One file to install, checksum, update and later sign. A core upgrade on a server is an
  `atc` release: bump the pin, verify, release — there is no independent core upgrade path, by design. The
  pin must be exact: `attachToOwner` refuses a version mismatch between a running daemon and an attaching
  command, so a caret range could silently break attach. The core has to be published to npm (prepared on
  the branch; the publish happens after merge); until then CI clones and builds the ref on every run. The
  `AtomicCore` facade exposes no hardware, backends, disk or environments methods, so the daemon reaches its
  own core over loopback with `HttpCoreLink` for those. The core's runtime-agnostic rule (Node-compatible
  API only, no `Bun.*`) is inherited wholesale, together with its gate script and eslint rules, because the
  same code runs under Node in tests and inside the Bun binary. The core's own CLI daemon can own the same
  folder; `atc/run/daemon.json` (instance id) tells the two apart until the core's lock record carries a
  `host` field. A long-lived core branch is a risk: each ref bump is its own commit, and if the branch
  stalls the fallback is a temporary copy of the ~150 lines of owner/lock read-side code — the one exception
  the rule would tolerate, and only until the branch lands.
- **Alternatives:** *Sidecar*: spawn the core's released binary as the desktop app does. Two files and two
  release trains to keep in step, the app's Rust supervisor to re-implement in TypeScript, and no way to
  call library code (downloads, `model.yml`) — rejected; it would have allowed upgrading the core alone,
  which nobody asked for. *Copy the core's modules* into `atc`: immediate drift on wire and on-disk
  contracts — rejected. *Grow the core's CLI* into the product: server concerns (admin, services,
  elevation, self-update) do not belong in the core, and the core's CLI defaults (port 6767, no admin)
  differ from what the app and the docs promise — rejected (D3).
- **Owner:** team.
- **Links:** plan `cli-woolly-turing.md` D1–D3, D6, D7, §9 (the core change checklist); `package.json`
  (`dependencies`); `scripts/build-binaries.mjs`;
  `src/daemon/daemon.ts`; `src/core-link/attach.ts`; core branch `feat/atc-host-exports` commit `213d13f`
  "Expose host, models and downloads entry points for external hosts"; core ADRs 2026-09-15 "Core is
  TypeScript on a Node-compatible API, packaged with Bun" and 2026-09-17 "Isolate app and CLI core owners".

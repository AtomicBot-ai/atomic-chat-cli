# Roadmap

The scaffold (iteration 1, 2026-09-24) ships the command tree, the daemon, the admin server and the
build/release pipeline; every command that is not implemented yet is a stub that exits 3 and names its
iteration. This file is the plan behind those stubs. `src/cli/not-implemented.ts` is the machine-readable
half of it: a test keeps the registry and the command tree in sync, and `docs/commands.md` shows the
status of every command. Iterations are ordered by what unlocks the product's one promise — *one command
puts an engine, a model and an OpenAI-compatible API on a server* — and each names what it depends on.

## Where things stand

Working today: `start`, `stop`, `restart`, `status`, `logs`, `admin` (token login, live dashboard),
`config`, `doctor`, `update --check`, `version`, `completion`, the hidden `daemon` and `host-step exec`.
The daemon boots the core in-process, pushes hardware facts to it, serves the web admin and runs the
host-step loop. See [`architecture.md`](architecture.md) for how the pieces fit.

Stubbed: `serve`, `run`, `models *`, `engines *`, `setup`, `hardware *`, `api *`, `tui`, `service *`,
`update` (apply), `logs --follow`, `status --watch`, `config engine.*`.

## Iterations

### Iteration 2 — serve, run, the API

The product's core promise. **Goal:** `atc serve <model>` on a clean server ends with a working
`http://127.0.0.1:1337/v1`.

- `serve`: ensure an engine pack (the core's `POST /backends/:provider/install`, chosen from the pushed
  hardware facts), pull the model when it is not installed (iteration 3's installer; until then a
  Hugging Face `owner/repo` through the core's `downloadHfModel`), start the daemon, load the model,
  start the public API, print the URL. Returns once the model answers; the daemon keeps running.
- `run`: the same in the foreground for Docker and systemd; `--no-model` runs the daemon alone; SIGTERM
  unloads and stops cleanly.
- `api start|stop|status` over the core's `/server` routes; `api.autoStart` and `models.autoLoad` honoured
  at daemon start (`PublicServerKeeper`).
- Replace an idle daemon of an older `atc`/core after an upgrade instead of refusing to attach.
- `status --watch`, `logs --follow`, `config engine.<provider>.<key>` forwarded to `PATCH /settings/:provider`.
- **Done when:** the e2e suite serves a small GGUF through the compiled binary on all five CI platforms and
  a `curl` to `/v1/chat/completions` answers; `atc run` survives a SIGTERM without orphaning the engine.

### Iteration 3 — models

**Goal:** models come from the catalog or Hugging Face, with progress, and stay manageable.

- `CatalogClient` over `atomic-chat-model-catalog` (`catalog.json.gz`, MiniSearch index) and
  `atomic-chat-conf/models/recommended.json` (hardware tiers), cached under `<data>/atc/cache/` with ETag
  and a one-hour TTL, offline fallback.
- `ModelResolver`: `owner/repo`, `owner/repo:file.gguf`, catalog alias, `auto` by VRAM tier; `--quant`.
- `ModelInstaller` on the core's `Downloader` and `ModelRegistry` (`@atomic-chat/core/models`,
  `/downloads`): disk preflight through `POST /disk/available`, resume, sha256, `model.yml`, optional
  `mmproj`; progress on the terminal and as `atc:download` events for the admin and the TUI.
- `models search|pull|list|rm|info|load|unload`; `api key show|set|rotate|clear` (the key is the core's
  `server.api_key` setting; a non-loopback API without a key is refused unless `--insecure-no-key`).
- **Done when:** `atc models pull` resumes an interrupted download and refuses a wrong checksum;
  `atc serve <alias>` works from a catalog alias; the admin's Models page lists installed models.

### Iteration 4 — engines, setup, the managed runtime

**Goal:** `atc setup` prepares a machine, including TensorRT-LLM through Docker, with consent and
privileges handled honestly.

- `engines list|install|status|rm` over the core's backend routes; `hardware show|refresh` with AMD
  (`rocm-smi`, sysfs) and Intel probing added to NVIDIA.
- `setup`: probe → plan → consent → operation, following the core's `/environments` routes; relogin and
  reboot states resume on the next `atc` start.
- Real elevation strategies: `sudo` on a terminal, `pkexec` in a desktop session, UAC on Windows; the
  helper (`atc host-step exec`) runs the recipes the core exports, verifies their digests, and never
  touches the control API.
- `doctor`: Docker/WSL and driver checks.
- **Depends on the core:** the `feat/tenzor-rt` branch merged over 0.5.x, `provisionerFor()` implemented,
  recipes with digests and step parameters exported through `@atomic-chat/core/host`, a `managedRuntimes`
  option on `AtomicCore.create` for host facts. `atc` will target that core version exactly.
- **Done when:** on an Ubuntu box with an NVIDIA card, `atc setup --tensorrt` ends in `ready` after one
  `sudo` prompt and one re-login, and `atc serve --engine tensorrt-llm <checkpoint>` answers.

### Iteration 5 — the admin pages and the terminal UI

**Goal:** two interactive front ends over the same daemon, for two kinds of people: the browser for
those who avoid terminals, the TUI for those who live in them.

Admin pages, lifted from the desktop web-app where possible (`docs/admin-ui.md`):

- API Server (state, start/stop, key, trusted hosts), Models (installed, hub, downloads with progress),
  Engines (packs, optimal, install); `PATCH /api/config`; a password login so the admin may listen on a
  non-loopback address when a server has no SSH access.

The terminal UI, `atc tui` (see the design below).

- **Done when:** a model can be pulled and loaded from both the browser and the TUI, with live progress,
  and neither front end offers anything that has no plain-command equivalent.

### Iteration 6 — service, update, doctor

- `service install|uninstall|status|start|stop`: systemd (user and system), launchd, a Windows logon task,
  with a wrapper-based Windows service to follow.
- `update` applies: download the asset for this platform, verify against `SHA256SUMS`, replace the binary
  (rename on POSIX, move-aside on Windows), re-exec, tell a managed service to restart.
- `doctor` completes (proxy reachability, engine and model sanity), coverage floors in CI.
- **Done when:** a fresh server goes from the installer to a service that survives a reboot, and
  `atc update` upgrades it in place.

### Iteration 7 — the admin's setup wizard, logs, settings, hardware

- The managed-runtime wizard in the browser (`SetupState` stepper on live operations), the daemon log with
  live tail, settings (proxy, telemetry, tokens), the hardware page with live GPU usage.
- **Done when:** iteration 4's setup can be driven end to end from the browser, including the
  elevation prompt shown as instructions when it cannot be automated.

### Iteration 8 — signing and notarisation

- Sign the macOS binaries and notarise them, sign the Windows binaries, on the same recipe atomic-agent
  uses; the installer verifies the signature before swapping the binary in.

## The terminal UI

`atc tui` is a full-screen, keyboard-driven screen on [Ink](https://github.com/vadimdemedes/ink) (React
for the terminal), the stack atomic-agent's TUI is built on. It is the third front end over the daemon,
never the only one: everything it does exists as a plain command, bare `atc` keeps printing help, and
without a terminal it exits with a usage error that names `atc status --json` and `atc admin`. The
decision and its limits are in
[the ADR](decisions/2026-09-24-add-an-optional-terminal-ui.md).

### What it looks like

```
┌ atc 0.2.0 · core 0.6.0 · daemon up 2h 14m · gpu RTX 4090 24 GiB ───────────────── ? help  q quit ┐
│ Overview   Models   Downloads   Logs   Setup                                                    │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ● API        http://0.0.0.0:1337/v1        key required        12 req/min                        │
│ ● Model      Qwen3-8B Q4_K_M               llamacpp-upstream   :8001   ctx 32768                 │
│ ○ Admin      http://127.0.0.1:1338                                                               │
│                                                                                                  │
│ Downloads    gemma-3-12b Q4_K_M  ████████████░░░░░░░░  61%  8.1 GiB / 13.2 GiB   42 MiB/s  2m10s │
│                                                                                                  │
│ Recent       14:02 session started  Qwen3-8B                                                     │
│              14:01 backend installed  b6000/cuda-cu12.4-x64                                      │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ↑↓ move  ⏎ open  l load  u unload  p pull  s start api  S stop api  r refresh                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Header:** versions, daemon uptime, the GPU the prober found. **Tabs:** Overview, Models, Downloads,
  Logs, Setup (the last appears once iteration 4 lands). **Footer:** the keys that apply to the focused
  element, always visible.
- **Overview:** the same cards as the admin dashboard, in the same order and words, so a person moving
  between the two never relearns anything: API, loaded models, admin address, active downloads, recent
  events.
- **Models:** installed models with size, quantisation, loaded state and port; `l`/`u` load and unload,
  `p` opens a pull prompt (catalog search with the same resolver as `models pull`), `d` deletes after a
  confirmation. A pull shows a progress bar, rate and ETA in place and moves to Downloads.
- **Downloads:** every transfer with progress, pause and cancel (`x`), errors with the same hints the CLI
  prints.
- **Logs:** the daemon log tail with level colours, `f` toggles follow, `/` filters.
- **Setup:** the managed-runtime wizard as a stepper (the `SetupState` machine from
  `src/engines/managed-environment.ts`); when a step needs elevation it shows the exact command to run
  in another shell and waits, exactly like the CLI's `manual` strategy.

### How it is built

- `src/tui/`: an Ink app with one screen component per tab, a small store fed by `CoreLink` and
  `SseEvents` (snapshot first, then events; `resync` refetches), and the same `ModelInstaller` and
  catalog seams the commands use. No URL, token or HTTP outside `src/core-link/`.
- Rendering: box-drawing frames, a 16-colour palette with truecolour when the terminal advertises it,
  graceful fallback to plain ASCII when `NO_COLOR` or `TERM=dumb`, layout that reflows on resize down
  to 80 columns and hides the sidebar below that.
- Keys follow the footer; `?` opens a help overlay; `q` and `Esc` leave without stopping anything.
- Tests: the Ink app under `ink-testing-library` with a fake `CoreLink` (as atomic-agent tests its TUI),
  plus a runtime-compat case that proves raw-mode stdin and resize events under the Bun runtime the
  binary ships with, and under Windows Terminal.
- Cost: React and Ink in the binary (a few MB next to the embedded SPA); accepted in the ADR.

## Cross-cutting work

- **Core changes still needed** (each a branch and a PR into `main`, then an exact pin bump here): a `host`
  field in the lock record so a client can tell an `atc` daemon from the core CLI's without
  `daemon.json`; the managed-runtime seams listed under iteration 4; `mmproj` in `downloadHfModel`.
- **Core release automation:** the `NPM_TOKEN` secret in the core repository makes its release workflow
  publish `@atomic-chat/core` by itself.
- **Core CI stability:** three runner flakes (Bun 1.3.10 segfault in `bun test` on macOS, the diffusion
  service test under coverage, the llama runtime load timeout on Windows arm) cost several reruns per
  release; raise those timeouts or retry those cases.
- **Windows service:** Bun binaries are not SCM-aware; a wrapper (WinSW or NSSM) or a small native shim
  is a decision for iteration 6.

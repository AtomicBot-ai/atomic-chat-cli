# Architecture

How `atc` is put together: processes, the data folder, ports and tokens, the daemon's life, the admin's
security model, and how a privileged host step runs. The code is the source of truth; where this page and
the code disagree, fix the page.

## Processes

```
 person ──▶ atc <command>       short-lived: parse argv, attach to the daemon, print, exit (seconds)
              │  re-execs itself as `atc daemon` (process.execPath) when nobody owns the data folder
              ▼
 atc daemon                     long-lived, one per data folder, outlives every command
 ├─ AtomicCore (in-process)     ownerScope 'cli'; control API /atomic/v1 on loopback, Bearer control-token,
 │    └─ engines (children)     SSE /events; llama-server & co as child processes;
 │                              public OpenAI-compatible API /v1 on :1337 (the core's public server)
 ├─ AdminServer  :1338          BFF + embedded SPA; admin-token → HttpOnly cookie;
 │                              /api/core/* proxy (the control-token stays here); SSE relay /api/events
 ├─ host agent                  hardware probe → PUT /hardware/override; HostStepExecutor
 │                              (pending_host_step → request file → helper → receipt)
 └─ run files                   <data>/atc/run/daemon.json, <data>/atc/logs/daemon.log, graceful shutdown
 privileged helper = the same binary: `atc host-step exec <request.json>` under root / sudo / pkexec / UAC
```

| Process | Lifetime | Responsibilities |
| --- | --- | --- |
| `atc <command>` | seconds | Parse, resolve paths and config, `attach` (or spawn) the daemon, hold a lease while it works, print one result, exit with a code. Never holds a URL or token outside `src/core-link/`. |
| `atc daemon` (hidden) | until `atc stop`, `POST /shutdown` or a signal | Owns the data folder through the core's lock. Runs the core in-process, the admin server, the hardware push, the host-step loop; writes `daemon.json`; cleans up on exit. Spawned by `start` and `admin` (later `serve`); run in the foreground by a service or `atc run`. |
| engines | per session | Children of the daemon, journalled by the core in `processes.json`; a later owner reaps orphans. |
| `atc host-step exec` (hidden) | seconds | The privileged half of a managed-runtime step: file in, file out, no network. |

Crashes: the daemon is the core; they fall together. Recovery is the core's model — the next command
respawns, the new owner reaps orphans, managed operations recover from the core's store. There is no
supervisor in the scaffold; real supervision is `atc service` (iteration 6) or the container runtime.

## The data folder

`<data>` is the core's CLI-scope folder, `<system data>/atomic-chat-cli/data`, resolved by the core's own
rules (`resolveCliDataFolder` from `@atomic-chat/core/host`): `--data-folder` > `ATC_DATA_FOLDER` > the
default. `assertCliDataFolder` refuses the desktop app's folder. The chosen path is not stored in the config
(the config lives inside it). `src/config/paths.ts` builds `AtcPaths`; the core's `dataLayout` covers the
rest.

```
<data>/atomic-core/{instance.lock, control-token, settings.json, credentials.json, processes.json, logs/, …}   the core
<data>/llamacpp/models/<id>/model.yml                                    models (the client — atc — writes these; iteration 3)
<data>/<provider>/backends/<version>/<backend>/                          engine packs installed by the core
<data>/atc/config.json            atc settings, 0644, tmp + rename; unknown keys preserved
<data>/atc/secrets.json           0600: hfToken, adminPassword
<data>/atc/run/daemon.json        {schema_version, pid, instance_id, state, atc_version, core_version, control_url, admin_url, started_at}
<data>/atc/run/admin-token        0600: 32 random bytes, base64url
<data>/atc/run/host-steps/        <step_id>.request.json, <step_id>.result.json, journal.json
<data>/atc/logs/daemon.log        the daemon's stderr (the spawner appends; rotation by log.* is iteration 2)
<data>/atc/cache/                 catalog and recommendation caches (iteration 3)
```

The managed-runtime store is not here: it is the core's shared per-user root, and the core's decision.

## Ports and tokens

| Listener | Default | Bound to | Credential | Who holds it |
| --- | --- | --- | --- | --- |
| Core control API `/atomic/v1` | random port | loopback | `control-token` (Bearer) | The core writes it (0600). The daemon reads it from the facade; commands read it through `attachToOwner`. **Never** leaves the machine's processes: not in the browser, not in the helper, not in a log. |
| Public API `/v1` | 1337 | `api.host` (127.0.0.1) | API key, a core setting (`server.api_key`) | Clients of the model. `api.requireKey` refuses a non-loopback bind without a key (iteration 2). |
| Admin `/`, `/api/*` | 1338 (`0` = random, published in `daemon.json`) | loopback only | `admin-token` → session cookie | The daemon writes the token (0600); `atc admin` puts it in a URL fragment once; the browser keeps only the cookie. |

Two things reach the outside: the public API for model clients and the admin for people. The control API
and its token stay behind both, mirroring the desktop app's Rust bridge.

## A command attaches, or spawns

`src/core-link/attach.ts`, on top of the core's `attachToOwner`, `inspectLock`, `waitForPublishedOwner`:

1. `attachToOwner({ layout, clientName: 'atc', launch: false })`. A ready owner answers with its
   `CoreClient` and lock record; the core checks scope and version itself.
2. `CORE_NOT_RUNNING` and the command did not ask to launch → `ATC_DAEMON_NOT_RUNNING` with the hint
   `atc start`.
3. Otherwise `inspectLock`: if nobody owns the folder, spawn `atc daemon --data-folder <data>
   --control-port 0 [--no-admin] [--admin-port N] …` detached, `windowsHide`, stdin ignored, stdout and
   stderr appended to `atc/logs/daemon.log` (a file, never a pipe the parent could close), then `unref`.
   If someone is already starting, just wait. Readiness is the core's lock: `waitForPublishedOwner`, 20 s.
4. Attach again, then read `atc/run/daemon.json`. Missing, or an `instance_id` that differs from the lock →
   `ATC_DAEMON_FOREIGN`: the owner is a core that is not an `atc` daemon (typically the core's own CLI
   daemon on the same folder, which has no admin and no host-step loop).
5. Build `HttpCoreLink` with `SseEvents` (snapshot, `/events` from the snapshot's cursor, backoff reconnect,
   re-snapshot on `resync` or on an `instance_id` change).

A command that changes state runs inside `link.withLease(name, work)`: `POST /clients`, heartbeat at the
interval the core returns, `DELETE` on exit. Components inside the daemon never register as clients —
otherwise `atc stop` would always need `--force`. `atc stop` posts `/shutdown { client_id, force? }` under
its own lease, waits up to 30 s for the lock to change hands, and only with `--kill` sends `SIGKILL`
(`taskkill /T /F` on Windows).

## Daemon startup

`src/daemon/daemon.ts`, `startDaemon()`:

1. `AtomicCore.create({ ownerScope: 'cli', dataFolder, controlPort, env, logger, telemetry: { host: 'atc',
   hostVersion, enabled } })` — takes `instance.lock`, writes `control-token`, starts the control API.
2. `RelayHub` (the admin's event ring) and the daemon's own `HttpCoreLink` over a `CoreClient` with the
   facade's token and `InProcessEvents` (the emitter, not SSE to itself). The facade exposes no hardware,
   backends, disk or environments methods, so the daemon calls its own core over loopback for those.
3. `HostStepExecutor` is wired: every core event is republished to the relay; `environment:operation`
   events go to the executor; a 2-second timer polls for results of manual steps.
4. Hardware push: `probeHardware` (`nvidia-smi`, `/proc/cpuinfo` / `sysctl` / `Win32_VideoController`)
   → `PUT /hardware/override { gpus, cpu_extensions, os_type, source: 'atc-prober' }`. The core never
   probes GPUs itself and does not persist the override, so this runs on every start (and on
   `atc hardware refresh`, iteration 4). A failed probe is a warning: the core will pick a CPU engine.
5. Admin, unless `--no-admin` or `admin.autoStart=false`: `ensureAdminToken`, then `AdminServer.start` on
   `admin.host:admin.port`. A non-loopback host is refused (`ATC_ADMIN_BIND_FAILED`, iteration 5).
6. `writeDaemonRecord(atc/run/daemon.json)` — from now on commands accept this owner as an `atc` daemon.
7. `runDaemon` prints the core's ready line plus `admin_url` as one JSON line on stdout, then waits on
   `Promise.race([io.waitForShutdown(shutdown), core.stopped])`. Shutdown: `core.shutdown()`, stop the
   poll, unsubscribe, close the admin, remove `daemon.json` (only if it is still ours), exit 0.

Not in the scaffold: auto-starting the public API and `models.autoLoad` (iteration 2), log rotation for
the daemon file (the `fileSink` exists), a supervisor.

## The admin security model

`src/admin/`. The browser is the least trusted party; the daemon is the only holder of the control token.

- **Login.** `atc admin` prints `http://127.0.0.1:1338/#token=<admin-token>` and opens it. The SPA posts the
  fragment once to `POST /api/session { token }` (constant-time compare) and gets an `atc_session` cookie:
  `HttpOnly; SameSite=Strict; Path=/`, in-memory, 24 h idle expiry, all sessions gone on restart. The
  token never appears in a query string, a `Referer` or a log. `Authorization: Bearer <admin-token>` is
  accepted too, for scripts and tests. `atc admin token --rotate` replaces the token.
- **Gates** (`gates.ts`, before any handler, in the control server's style): peer address must be loopback
  (403), `Host` must be a loopback name — DNS-rebinding defence (421); a mutating request must carry
  `X-Atc-Admin: 1` and an `Origin` equal to our own `Host` (403) — a cross-site form or fetch has neither.
  Bodies are capped at 8 MiB. The SPA is served with `Content-Security-Policy: default-src 'self'`.
- **Routes** (`bff.ts`): `GET /api/status`, `POST|DELETE /api/session`, `GET /api/config` (`PATCH` is
  iteration 5), `GET /api/events` (SSE), `ANY /api/core/*` → the control API with the daemon's token, but only
  on the allowlist: reads of `/health /snapshot /sessions /server /backends /hardware /environments
  /settings /telemetry /disk`; writes of model load/unload, server start/stop, backends, hardware override,
  settings, environments, downloads, disk, GGUF validation. `/shutdown`, `/clients`, telemetry consent and
  cloud keys are never reachable from a page. `/api/setup/*`, `/api/logs`, `/api/engines/:p/schema` answer
  501 until their iterations.
- **Events** (`relay.ts`): one stream for the browser — the core's events plus `atc:*` — numbered `r<n>` by
  the relay; `Last-Event-ID` resumes from a 1000-entry ring, older cursors get a `resync`; `: ping` every 15 s.
- **Not on loopback.** `--host 0.0.0.0` / `admin.host` is refused until the password login with rate
  limiting lands (iteration 5); the hint is `ssh -L 1338:127.0.0.1:1338 user@server`. TLS is later still.

## Managed runtimes: host steps and elevation

The core (branch `feat/tenzor-rt`) does everything for a managed runtime — probe, plan, image pull, WSL
import, containers, recovery — except the one privileged step, which it hands to its host as
`pending_host_step { step_id, action, recipe_id, recipe_digest, parameters_digest, nonce,
expected_operation_revision }` and expects back as a `ManagedHostReceipt` on
`POST /environments/operations/:id/host-step-result`. It re-probes before believing the receipt. `atc` is
that host (ADR 2026-09-24 "The CLI is the host for managed runtimes").

Flow, in `src/host/host-step.ts` and `elevator.ts`:

1. The daemon sees `environment:operation`. The executor acts only when `pending_host_step` is set **and**
   `operation.instance_id === core.instanceId` — a desktop app's core owning the same operation must not
   trigger a second prompt.
2. Checks: `action ∈ MANAGED_HOST_ACTIONS` (`linux.install-container-runtime`, `windows.enable-wsl`),
   `expected_operation_revision === operation.revision`, `sha256:` digests, a nonce. A failed check is
   logged and the step is refused.
3. `<step_id>.request.json` is written, and a journal entry `requested` **before** anything runs. A crash
   between the helper and the receipt is repaired from the journal on the next start rather than repeated;
   the core classifies a duplicate by nonce.
4. `Elevator.select(context)` picks a strategy (table below); `Elevator.run` executes it. `root` runs
   `atc host-step exec <request>` directly with inherited stdio; `manual` returns instructions.
5. The helper reads only the file, runs the recipe, writes `<step_id>.result.json { outcome, exit_code,
   log_tail }` and exits. It never opens the control API: a sudo process needs no user token, cannot mix up
   the data-folder root, and receipts have exactly one writer (the daemon).
6. The daemon maps the result to a receipt (journal `ran` → `posted`). A `manual` step stays
   `pending-manual`: `atc status` and the admin's `pending_host_steps` show the exact command
   (`sudo atc host-step exec <file>`), and the 2-second poll posts the receipt when the result file appears.
7. `relogin-required` / `reboot-required` persist nothing extra: the core holds the phase; `atc setup
   --resume <op>` posts `…/resume` (iteration 4).

| Strategy | Chosen when (first match) | Runs | Status |
| --- | --- | --- | --- |
| `root` | euid 0, or an elevated Windows process | the helper directly | works |
| `pkexec` | the daemon, on Linux, with `DISPLAY`/`WAYLAND_DISPLAY` and `pkexec` on PATH | `pkexec atc host-step exec …` (a polkit agent prompts) | iteration 4 |
| `windows-runas` | Windows, in the daemon or with a terminal | `Start-Process -Verb RunAs -Wait` (UAC) | iteration 4 |
| `sudo-tty` | a command (not the daemon) with a terminal and `sudo` | `sudo -k -- atc host-step exec …`, stdio inherited for the password | iteration 4 |
| `manual` | anything else — a headless daemon without a display, no sudo | nothing; the request file stays and the command is printed | works |

Today `Elevator.run` implements `root` and `manual`; the other three throw `ATC_NOT_IMPLEMENTED` with the
manual command as the hint. The helper (`src/host/helper.ts`) answers `failed` with
`MANAGED_ADAPTER_UNAVAILABLE` for every request, because the core ships no recipes yet
(`provisionerFor()` is null on `main`), and `HttpCoreLink.environments.*` turns the core's "no such control
route" into `ATC_NOT_IMPLEMENTED`. `src/host/managed-types.ts` mirrors the branch's contract types until the
branch lands. The journal carries the whole step, so a manual result found after a daemon restart is posted
from the journal alone (`HostStepExecutor.checkPendingResults`).

## The core's role, atc's role

| Concern | The core (`atomic-chat-core`) | `atc` |
| --- | --- | --- |
| Engines | Backend packs: catalog, hardware tiers, install, update, the optimal-pack cache; spawning `llama-server`. | Chooses and asks (`atc engines`, iteration 4); pushes the hardware facts the core cannot measure. |
| Models | `model.yml`, registry, GGUF metadata, sessions, load/unload; the downloader and HF helpers as a library. | Installs models on the client side like the desktop app does: resolve, disk check, download, `model.yml` (iteration 3, over `@atomic-chat/core/models` and `/downloads`). |
| Public API | The `/v1` server, its settings (`server.api_key`, `enable_on_startup`). | Where and how to expose it: `api.*` config, `atc api`, `atc serve` (iteration 2). |
| Environments | The managed-runtime state machine, store, image pulls, WSL import, recovery. | Consent UI and the privileged step (above). |
| Settings | Engine parameters (`GET/PATCH /settings/:provider`), telemetry consent. | `atc`'s own `config.json`; `config set telemetry.enabled` also reaches the core (iteration 2). |
| Ownership | The lock, the token, attach semantics, client leases, shutdown. | `daemon.json` to tell an `atc` daemon from the core's CLI daemon; spawn with a log file. |

The rule in `AGENTS.md` §8 follows from this table: `atc` never copies core logic; a missing capability is
an export request in the core branch.

## What is stubbed

`src/cli/not-implemented.ts` is the registry: `PLANNED` maps each stub command to an iteration, and
`PLANNED_PARTIAL` names the stubbed features of working commands (`logs --follow`, `update apply`,
`config engine.*`, `host-step recipes`). A unit test keeps the registry and the command tree in agreement,
and `docs/commands.md` (generated) shows the status of every command. The iteration map: **I2** daemon
lifecycle, `serve`/`run`, `api start|stop`; **I3** models and API keys; **I4** engines, `setup`, managed
environments, elevation; **I5** admin pages (API, models, engines) and non-loopback consent; **I6** service,
update apply, doctor completion; **I7** admin setup wizard, logs, settings, hardware; **I8** signing and
notarisation.

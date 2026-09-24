# atc — the Atomic Chat server CLI

`atc` puts an inference engine and a model on a server — Linux, Windows or macOS, usually headless — and
exposes them over an OpenAI-compatible API on `http://127.0.0.1:1337/v1`. It embeds
[`atomic-chat-core`](https://github.com/AtomicBot-ai/atomic-chat-core) as a library and ships as one binary
per platform; the same daemon serves a web admin on `127.0.0.1:1338` for people who would rather not use a
terminal. `atc` and the Atomic Chat desktop app are separate products for different audiences: they share
the core (and the core's per-user managed-runtime root) and nothing else.

> **Status: scaffold.** The command tree, help texts, config, daemon lifecycle, admin server, build and
> release pipeline are real. Commands marked **stub** parse their flags and print their help, but running
> one exits with code 3 (`ATC_NOT_IMPLEMENTED`) and names the iteration that implements it.
> [`docs/commands.md`](docs/commands.md) is generated from the command specs and is the authoritative list.

## Quick start on a server

```sh
curl -fsSL https://github.com/AtomicBot-ai/atomic-chat-cli/releases/latest/download/install.sh | sh
```

On Windows, in PowerShell: `irm https://github.com/AtomicBot-ai/atomic-chat-cli/releases/latest/download/install.ps1 | iex`.

The installer downloads the release's `SHA256SUMS`, picks the binary for this machine, verifies it, puts it
in `~/.local/bin/atc` (`%LOCALAPPDATA%\atc\atc.exe` on Windows) and adds that directory to `PATH`.
`ATC_INSTALL_DIR`, `ATC_VERSION` (a tag, e.g. `v0.1.0`), `ATC_NO_PATH=1` and `ATC_REPO` override the defaults.

```sh
atc doctor                     # versions, data folder, config, ports 1337/1338, PATH, GPU driver
atc serve Qwen/Qwen3-8B-GGUF   # engine → model → daemon → API URL     (stub in this build: exit 3)
```

What runs today:

```sh
atc start            # the daemon (core + web admin) in the background; it outlives this command
atc status           # pid, versions, API endpoint, loaded models, admin URL   (--json for one document)
atc admin            # prints http://127.0.0.1:1338/#token=… and opens a browser
atc stop             # graceful; --force while other commands are attached, --kill after the timeout
```

## Commands

| Group | Command | What it does | Status |
| --- | --- | --- | --- |
| Run | `atc serve [model]` | Engine, model download, daemon, load, API — one step | stub (iteration 2) |
| Run | `atc run [model]` | The same in the foreground, for containers and systemd | stub (iteration 2) |
| Run | `atc start` / `stop` / `restart` | The background daemon: core + web admin | works |
| Run | `atc status` | Daemon, API endpoint, loaded models, admin URL | works (`--watch` is a stub) |
| Run | `atc logs` | Tail of the daemon log | works (`-f` is a stub) |
| Models & engines | `atc models search\|pull\|list\|rm\|info\|load\|unload` | Catalog and Hugging Face; install on the CLI side | stub (iteration 3) |
| Models & engines | `atc engines list\|install\|status\|rm` | Engine packs (llama.cpp builds) the core runs | stub (iteration 4) |
| Models & engines | `atc setup` | Hardware → engine → optional managed runtime (TensorRT-LLM via Docker) | stub (iteration 4) |
| Models & engines | `atc hardware show\|refresh` | What the prober sees and what it told the core | stub (iteration 4) |
| Access | `atc api start\|stop\|status` | The OpenAI-compatible API on the running core | stub (iteration 2) |
| Access | `atc api key show\|set\|rotate\|clear` | The API key (a core setting) | stub (iteration 3) |
| Access | `atc admin [open\|status\|token]` | Login URL, where the admin listens, token rotation | works |
| Access | `atc tui` | Interactive terminal screen over the daemon: status, models, downloads, logs | stub (iteration 5) |
| System | `atc config get\|set\|unset\|list\|path` | `atc` settings | works (`engine.*` keys are a stub) |
| System | `atc doctor` | Diagnostic table with hints | works (GPU: NVIDIA only; Docker check skipped) |
| System | `atc service install\|uninstall\|status\|start\|stop` | The daemon as an OS service | stub (iteration 6) |
| System | `atc update` | Self-update from GitHub Releases | `--check` works; applying is a stub (iteration 6) |
| System | `atc version`, `atc completion <shell>` | Versions; bash/zsh/fish/powershell completion | works |

Hidden: `atc daemon` (the foreground daemon that `start` spawns) and `atc host-step exec <request.json>`
(the privileged helper for managed runtimes).

Global flags go anywhere on the line: `--json`, `-v/--verbose`, `-q/--quiet`, `-y/--yes`,
`--data-folder <path>`, `--no-color`, `-h/--help`, `--version`. With `--json` a command prints exactly one
JSON document on stdout; an error is `{"error":{"code","message","details?","hint?"}}` on stderr.

Exit codes: `0` success, `1` runtime error, `2` usage (also bare `atc` and bare groups such as `atc models`),
`3` not implemented in this build, `130` interrupted.

## Where data lives

```
<data> = <system data>/atomic-chat-cli/data      --data-folder or ATC_DATA_FOLDER override it
<data>/atomic-core/           the core: instance.lock, control-token (0600), settings.json, processes.json, logs/
<data>/llamacpp/models/       GGUF models, one folder with model.yml each (both llama.cpp providers)
<data>/<provider>/backends/   engine packs the core installs
<data>/atc/                   what only atc owns
  config.json                 settings (0644, written atomically; unknown keys are kept)
  secrets.json                0600: hfToken, adminPassword
  run/daemon.json             pid, instance_id, atc/core versions, control_url, admin_url, started_at
  run/admin-token             0600: the admin login token
  run/host-steps/             <step_id>.request.json, <step_id>.result.json, journal.json
  logs/daemon.log             the daemon's stderr
  cache/                      catalog and recommendation caches (iteration 3)
```

`<system data>` is `$XDG_DATA_HOME` or `~/.local/share` on Linux, `~/Library/Application Support` on macOS
and `%APPDATA%` on Windows — the core's own rule, so the core and `atc` always agree. The desktop app's data
folder is refused: the two products never share models, settings or a lock.

## Configuration

Precedence: command flags > `ATC_<SECTION>_<KEY>` environment variables > `<data>/atc/config.json` >
defaults. `atc config list` shows every key with its value and where it came from.

```sh
atc config set api.port 1337              # written to config.json
ATC_API_HOST=0.0.0.0 atc status           # api.host from the environment for this run
atc config set models.autoLoad qwen3-8b,gemma-4b
atc config path
```

Keys are `serve.*`, `api.*`, `admin.*`, `engines.*`, `models.*`, `managed.*`, `proxy.*`, `update.*`,
`telemetry.*`, `log.*` (the table is `src/config/schema.ts`). Engine parameters
(`engine.<provider>.<key>`) belong to the core's settings; forwarding them through `atc config` is a stub.
A config file written by a newer `atc` is refused with a hint rather than half-read.

## The web admin

```sh
atc admin                    # http://127.0.0.1:1338/#token=<admin token>, opened in a browser
atc admin status             # where it listens
atc admin token --rotate     # new token; old login links stop working
```

The admin listens on loopback only. The token in the URL fragment is exchanged once for an `HttpOnly`
cookie, so it never reaches a query string or a log. The core's control token never leaves the daemon: the
page talks to `/api/*` and the daemon proxies an allowlist of control routes. From another machine, forward
the port instead of exposing it:

```sh
ssh -L 1338:127.0.0.1:1338 user@server
```

`--host 0.0.0.0` is refused until the password login lands (iteration 5).

## Development

Prerequisites: Node 22 and npm (the package manager; `package-lock.json` is committed) and Bun 1.3.10 (only
to compile the binary and to run `bun test test/runtime-compat`). The core comes from npm as
`@atomic-chat/core` at an exact version.

```sh
npm install                  # the core from npm and the admin-ui workspace
npm test                     # unit + contract projects on Node
npm run build:bin            # embeds the admin SPA (or the placeholder) and compiles dist/bin/atc-<triple>
npm run verify               # lint, typecheck, format, tests, build, UI, binary, e2e, runtime-compat
```

To develop against a local core checkout, build it there (`npm run build`) and `npm install <path>`; put the
exact version back before committing. `node dist/bin.js …` runs the CLI from source after `npm run build`; `npm run dev` in
`packages/admin-ui` runs the SPA against a daemon started with `atc admin --no-open`.

Note: the core's own CLI defaults its public API to port 6767; `atc` uses 1337, like the desktop app.

## Documentation

- [`AGENTS.md`](AGENTS.md) — working in this repository: map, rules, checklists
- [`docs/architecture.md`](docs/architecture.md) — processes, ports and tokens, the data folder, host steps
- [`docs/commands.md`](docs/commands.md) — every command with its help text (generated)
- [`docs/testing.md`](docs/testing.md) — test layers, helpers, CI
- [`docs/release.md`](docs/release.md) — releasing, installers, self-update, the core pin
- [`docs/admin-ui.md`](docs/admin-ui.md) — the web admin SPA
- [`docs/decisions/INDEX.md`](docs/decisions/INDEX.md) — engineering decisions

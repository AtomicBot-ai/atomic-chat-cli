---
date: 2026-09-25
title: "Name the product Atomic Server and align the commands with the app"
---

# 2026-09-25 — Name the product Atomic Server and align the commands with the app

- **Context:** After v0.1.0 the product had five names: "Atomic Server" in the terminal UI, "the Atomic
  Chat server CLI" in the README and help, `atc` on the command line, `atomic-chat-cli` for the
  repository and the data folder, `@atomicbot-ai/atc` for the package — and the desktop app offers a
  command of its own it calls `atomic-chat-cli`. The planned command tree also had three near-synonyms
  (`serve`, `run`, `start`), a `run` that meant "the server in the foreground" where Ollama users and the
  desktop app's Run button mean "start a model", `models load` / `unload` for what the app calls Run and
  Stop, and a `setup` command whose only work was preparing TensorRT-LLM. The user-facing word for the
  background process was "daemon". Nothing of this had shipped beyond stubs, so renaming cost nothing.
- **Decision:** The product is **Atomic Server**; the command stays **`atc`**; `atomic-chat-cli` and
  the package name are technical only. [`docs/concepts.md`](../concepts.md) is the vocabulary and wins
  over any other text. Commands follow the desktop app: `atc run <model>` starts a downloaded model on the
  active engine of the running server and does nothing else (a missing model, server or engine is an
  error naming the command to run first); `atc unload <model>` stops it; `stop` belongs to the server
  alone. `serve` and `models load` / `unload` are removed; the server in the foreground is `atc start
  --foreground`; `setup` is removed — installing an engine prepares what it needs (`atc engines install
  tensorrt-llm` provisions the container runtime), and `status` shows what is set up. The background
  process is "the server" in every user-facing text ("daemon" stays in code and error codes). No engine
  ships in the binary. The core owns the hardware facts and the choice of engine build (a core branch
  moves the GPU probe there; until it lands `atc` keeps pushing its probe). Where an engine runs — a
  process or a container — is the engine's concern, invisible in commands.
- **Consequences:** The stub registry, help, `docs/commands.md`, completion and the terminal UI follow
  the new tree. The config loses the `serve` section: `serve.engine` and the duplicate `engines.provider`
  become `engines.default` (the engine last chosen); context size and GPU layers are engine settings the
  core owns (`atc config engine.<engine>.<key>`, iteration 2); `CONFIG_VERSION` 2 migrates old files.
  The roadmap's product promise becomes "install an engine, pull a model, run it" — three commands, not
  one — which is what the app does too. Error codes keep their names (`ATC_DAEMON_*`) as an interface.
  `managed.*` settings stay until iteration 4 decides how an engine's container is configured.
- **Alternatives:** *Rename the command to `atomic`*: matches the brand, but a long name for a command
  typed all day, a clash risk with other `atomic` tools, and new installers — rejected. *`atc stop
  <model>` like `ollama stop`*: one command with two meanings, and a forgotten argument stops the whole
  server — rejected. *Keep `serve` as "all in one"*: hides three steps that each can fail differently;
  the app does not do it either — rejected. *Keep `setup`*: a command for one engine's preparation —
  rejected, it belongs to installing that engine.
- **Owner:** team.
- **Links:** `docs/concepts.md`; `src/commands/`, `src/cli/not-implemented.ts`, `src/config/schema.ts`,
  `src/config/migrations.ts`; the desktop app's strings in `Atomic-Chat/web-app/src/locales/en/`
  (Run, Stop, "Unload from memory", Engine, Backend, Local API Server).

<!--
Supersedes: the serve/run/setup parts of docs/roadmap.md as of 2026-09-25
-->

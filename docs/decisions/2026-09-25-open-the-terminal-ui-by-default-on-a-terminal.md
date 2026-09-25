---
date: 2026-09-25
title: "Open the terminal UI by default on a terminal"
---

# 2026-09-25 — Open the terminal UI by default on a terminal

- **Context:** [Add an optional terminal UI](2026-09-24-add-an-optional-terminal-ui.md) planned `atc tui` on
  Ink for iteration 5, opt-in, with bare `atc` printing help, and rejected a TUI-by-default "like
  atomic-agent" because scripts and service units run bare `atc`. Misha asked for the terminal to feel
  modern and convenient now: a person at a keyboard should land on a live screen, not on help text. The
  objection holds only where there is no terminal, and that is exactly what the process can check:
  systemd, cron, `docker run` without `-t`, pipes and `--json` all lack an interactive stdin/stdout.
- **Decision:** Bare `atc` opens the terminal UI when stdin and stdout are both a terminal, `TERM` is not
  `dumb`, and neither `--json`, `--help` nor `--version` is given (`opensTui`, `src/cli/default-command.ts`);
  otherwise it prints help and exits 2 as before. `atc tui` is the explicit entry and fails with a usage
  error naming `atc status --json` and `atc admin` when there is no terminal. The UI ships now as a frame
  that grows with the iterations: Overview (the admin dashboard's cards, same words), Logs (tail, follow,
  filter), Config (edit, reset) and Doctor; Models and Downloads arrive with iteration 3, Setup with
  iteration 4, each in its own iteration. Rules that do not change: every action the UI offers is a plain
  command too, and it runs through the same functions (`startDaemon`, `stopDaemon`, `setConfigValue`,
  `runChecks`); the UI reaches the daemon only through `CoreLink`; leaving it (`q`, Esc, Ctrl+C, SIGTERM)
  never stops the daemon. It also holds no lease — `atc stop` from another shell is never refused because
  a screen is open — and never starts a daemon on its own (`s` does, as `atc start`). It follows a daemon
  that restarts: `watchDaemon` checks `health()` and attaches again, since `SseEvents` keeps retrying the
  old port. This supersedes the "bare `atc` keeps printing help" part of the earlier record and narrows the
  "Ink is out" sentence of [Hand-rolled command specs on parseArgs](2026-09-24-hand-rolled-command-specs-on-parseargs.md)
  to "Ink is confined to `src/tui/`".
- **Consequences:** Dependencies, with their reasons: `ink` (the renderer atomic-agent already uses; raw
  keys, resize, alternate screen and window size built in) and `react` (Ink's peer; the same 19.x the admin
  SPA resolves) at runtime; `@types/react`, `eslint-plugin-react-hooks` (the admin's version) and
  `react-devtools-core` for development. The last is only there so Bun can bundle Ink's DEV-only devtools
  import: marked `--external`, Bun hoists the import and the binary fails at start. The binary is built
  with `--production --keep-names` instead of `--minify-syntax --minify-whitespace`: only `--production`
  makes Bun emit the production JSX runtime (`jsx`, not `jsxDEV`) that React's production build provides;
  `--keep-names` and the source map keep stack traces readable. The binary grows by about 1.5 MB (66.0 →
  67.6 MB on macOS arm64). The UI is loaded with a dynamic `import()` from the command, so plain commands
  do not pay for React at start. An Ink frame must never share the terminal with stray writes, so
  `CoreLinkFactory.attach` takes a logger and the UI's goes to its status line. Proven under Node and `bun test` (runtime-compat) and in a real
  pseudo-terminal on the compiled binary (e2e, POSIX); Windows Terminal is checked by hand until CI can
  drive a ConPTY. Bare `atc` on a terminal no longer exits 2 — a script that ran it under `script(1)` or
  `ssh -t` and expected help must now pass `--help`.
- **Alternatives:** *Keep the TUI opt-in and bring `atc tui` forward*: a person still lands on help and has
  to know the command — rejected, it misses the request. *Only prettier line output (spinners, panels,
  clack-style prompts)*: nicer, but no live view of the daemon — not now; it can come on top. *OpenTUI
  or another Bun-native renderer*: faster, but Bun-only (FFI), which breaks the runtime-agnostic rule and
  the Node test runtime — rejected. *Hand-rolled ANSI rendering*: less to bundle, much more to write and
  test — rejected, as before.
- **Owner:** team.
- **Links:** `src/cli/default-command.ts`, `src/main.ts`, `src/commands/tui.ts`, `src/tui/`,
  `src/core-link/watch.ts`, `src/core-link/lifecycle.ts`, `src/config/edit.ts`, `src/daemon/log-follow.ts`,
  `scripts/build-binaries.mjs`; `test/runtime-compat/ink.test.ts`, `test/e2e/tui.test.ts`,
  `test/helpers/fake-terminal.ts`; docs/roadmap.md "The terminal UI".

<!--
Supersedes: 2026-09-24-add-an-optional-terminal-ui.md
-->

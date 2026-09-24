# Add an optional terminal UI

- **Date:** 2026-09-24
- **Status:** accepted
- **Context:** `atc` has two front ends over the same daemon: plain commands (scriptable, `--json`,
  usable without a terminal) and the web admin (for people who would rather not use a terminal at all).
  The record [Hand-rolled command specs on parseArgs](2026-09-24-hand-rolled-command-specs-on-parseargs.md)
  ruled Ink and other TUI frameworks out because a TUI cannot be the only interface of a server tool: under
  systemd, cron, Docker without `-t`, in a pipe or in `--json` there is no terminal. That reasoning stands.
  What it does not cover is a person at a keyboard over SSH, where a live screen is more convenient than
  re-running `atc status`; atomic-agent serves that case with an Ink TUI next to its plain commands.
- **Decision:** Add `atc tui`, a full-screen terminal UI on Ink (React), as a *third* front end in
  iteration 5, next to the admin pages. It opens on an overview (daemon, core, API, GPU) and has screens
  for models (installed, loaded, pull with progress, load/unload), the daemon log and, once iteration 4
  lands, the setup wizard. It talks to the daemon only through `CoreLink` and the SSE event source, like
  the admin BFF, and never reads a token or URL of its own. Without a terminal it exits with a usage error
  that names `atc status --json` and `atc admin`. Every action it offers exists as a plain command; the
  TUI never becomes the only way to do something. Bare `atc` keeps printing help; the TUI is opt-in.
  This narrows the earlier exclusion: plain output stays primary, Ink is confined to `src/tui/` and to
  this one command.
- **Consequences:** React and Ink enter the binary (a few MB; acceptable next to the embedded SPA). Ink's
  raw-mode stdin and resize handling must be proven under the Bun runtime the binary runs on, and under
  Windows terminals, before the iteration is called done; that check belongs to the runtime-compat suite.
  The command is a stub until then (`src/cli/not-implemented.ts`, iteration 5). The core-link and output
  layers are unchanged: the TUI consumes the same `CoreLink`, `SseEvents` and `ModelInstaller` seams as
  the commands and the admin.
- **Alternatives:** *Make the TUI the default like atomic-agent*: bare `atc` is run by scripts and
  service units that expect help or a usage exit, not a screen — rejected. *Curses-style hand-rolled
  rendering*: less to bundle, much more to write and test; Ink is what the team already knows — rejected.
  *Only the web admin*: an SSH session without port forwarding gets nothing interactive — rejected.
- **Owner:** team.
- **Links:** `src/commands/stubs.ts` (`tuiCommand`), `src/cli/not-implemented.ts`; the parseArgs record
  this narrows; atomic-agent `src/tui/` as the reference implementation.

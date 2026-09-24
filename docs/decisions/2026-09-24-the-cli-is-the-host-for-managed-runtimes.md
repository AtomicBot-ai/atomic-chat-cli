---
date: 2026-09-24
title: "The CLI is the host for managed runtimes"
---

# 2026-09-24 — The CLI is the host for managed runtimes

- **Context:** The core's branch `feat/tenzor-rt` adds managed runtimes (TensorRT-LLM through Docker, and
  WSL on Windows): a state machine over `ManagedPhase`, a store in a shared per-user root, image pulls by
  digest, WSL import, containers, watchdog and recovery — everything except the one step that needs
  administrator rights. For that the core publishes `pending_host_step { step_id, action, recipe_id,
  recipe_digest, parameters_digest, nonce, expected_operation_revision }` on the operation and waits for the
  host to post a `ManagedHostReceipt` to `POST /environments/operations/:id/host-step-result`; it re-probes
  the machine before believing the receipt and classifies duplicates by nonce. The desktop app is such a
  host through its Rust side with a polkit agent or UAC. A server has none of that: the daemon has no
  terminal for `sudo`, there is often no display for `pkexec`, containers run as root, and Windows UAC only
  works in an interactive session. `provisionerFor()` is null on the core's `main`, so today every
  environment is `unsupported`; the branch also lags behind `main` (0.4.0).
- **Decision:** The `atc` daemon is the host, and the privileged helper is **the same binary**:
  `atc host-step exec <request.json>`. The exchange between the daemon and the helper is **file-based**:
  `HostStepExecutor` (`src/host/host-step.ts`) reacts to `environment:operation` events only for operations
  whose `instance_id` is this core's, validates the step (known action, matching revision, `sha256:`
  digests, a nonce), writes `<data>/atc/run/host-steps/<step_id>.request.json` and a journal entry
  (`requested`) **before anything runs**, then asks the `Elevator`. `selectStrategy` picks, first match
  wins: `root` (euid 0 or an elevated Windows process) → run the helper directly; `pkexec` (the daemon on
  Linux with a display and `pkexec`); `windows-runas` (Windows, daemon or terminal; `Start-Process -Verb
  RunAs -Wait`); `sudo-tty` (a command with a terminal and `sudo`, never the daemon; `sudo -k -- atc
  host-step exec …` with inherited stdio); otherwise **`manual`**: the request file stays, `atc status` and
  the admin show the exact `sudo atc host-step exec <file>` command, and a 2-second poll finishes the step
  when the result file appears. **The helper never touches the control API**: it reads the request, runs
  the recipe, writes `<step_id>.result.json { outcome, exit_code, log_tail }` and exits. The daemon maps the
  result to the receipt and posts it (journal `ran` → `posted`); it is the single writer of receipts.
  `relogin-required` and `reboot-required` persist nothing extra — the core holds the phase and `atc setup
  --resume <op>` posts `…/resume`. In this build `Elevator.run` implements `root` and `manual`; `sudo-tty`,
  `pkexec` and `windows-runas` throw `ATC_NOT_IMPLEMENTED` with the manual command as the hint (iteration
  4), and the helper answers `failed` with `MANAGED_ADAPTER_UNAVAILABLE` because no recipe ships yet.
- **Consequences:** The privileged process has the smallest possible surface: a file in, a file out, no
  token (a sudo process needs no user credential and cannot leak one into `sudo` logs), no data-folder root
  confusion, no second writer for receipts. Headless boxes work through `manual`, containers through `root`,
  and a box with the desktop app's core owning the same operation gets one prompt, not two. The journal
  makes a crash between helper and receipt repairable on the next start instead of repeated; it is one more
  file whose schema must stay compatible. Digests bind the step to what was approved, so a recipe cannot be
  edited locally and still run — which means the recipe text must be **exactly** what the core pinned. What
  the core must still export for this to become real (core checklist, plan §9): recipes as data with
  digests inside the core (`src/runtime/environment/recipes/`), `recipeFor(recipe_id)` and `canonicalDigest`
  through `./host`, `parameters` on `ManagedHostStep` (or a documented derivation such as Linux `{ user }`),
  `AtomicCoreOptions.managedRuntimes { hostFacts: { user, originalUser?, elevatedUser? }, exec }` for the
  Windows probe, the merge of `feat/tenzor-rt` over 0.4.0, and a `host` field in the lock record. Until
  then `src/host/managed-types.ts` mirrors the branch's contract types and becomes re-exports later. An
  elevated `atc` daemon on Windows breaks the WSL import's `originalUser` and is refused by default
  (`--allow-elevated`, later). The journal entry carries the whole step, so a manual result found after a
  daemon restart is posted from the journal alone, without waiting for the core to re-emit the operation.
- **Alternatives:** *A resident root helper or a setuid binary*: a permanent privileged surface and a
  packaging burden on three OSes — rejected. *Give the helper the control token so it posts the receipt
  itself*: two writers, the token in a root process's environment and possibly in `sudo` logs, and the
  helper would have to resolve the data folder — rejected. *Require a polkit agent*, as the app effectively
  does: absent on headless servers — rejected; `pkexec` is one strategy, not the model. *Run the whole
  daemon as root*: every engine and the admin would run privileged, and the WSL import must run as the
  original user — rejected. *Do the privileged work in the core*: the core deliberately hands it out so
  that consent and elevation are the host's UI; the app's ADR says CLI callers see `elevation-required`
  when they cannot run the platform flow — that is exactly what `manual` implements.
- **Owner:** team.
- **Links:** `src/host/elevator.ts`, `src/host/host-step.ts`, `src/host/helper.ts`,
  `src/host/managed-types.ts`, `src/commands/host-step.ts`, `src/daemon/daemon.ts` (the event wiring and the
  2-second poll), `src/core-link/link.ts` (`environments.*`, the "no such route" mapping);
  `docs/architecture.md` "Managed runtimes: host steps and elevation"; the core's
  `feat/tenzor-rt:src/contracts/environment.ts` and `src/runtime/environment/`; the desktop app's ADRs of
  2026-09-22 on managed runtimes; plan §7, §9 items 8–10, §13 questions 3–5, 12.

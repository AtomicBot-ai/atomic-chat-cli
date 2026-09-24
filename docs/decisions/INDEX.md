# Engineering Decisions (ADR)

One decision per file. Append-only: never edit or delete an existing record — if a decision is reversed,
add a new one that says which record it supersedes.

**Adding a record**

1. Copy `_TEMPLATE.md` → `docs/decisions/YYYY-MM-DD-short-slug.md` and fill it in.
2. Add one line to this index.
3. Do **not** paste the record body into `AGENTS.md`.

## Records

- **2026-09-24** — [Adopt atomic-chat-core as an embedded library and single binary](2026-09-24-adopt-atomic-chat-core-as-an-embedded-library-and-single-binary.md) — the core is an exactly pinned dependency compiled into `atc`; never copy its logic, request an export.
- **2026-09-24** — [Embed the admin UI as a generated module](2026-09-24-embed-the-admin-ui-as-a-generated-module.md) — gzipped assets in `static-assets.generated.ts`, a placeholder when the SPA is not built.
- **2026-09-24** — [Hand-rolled command specs on parseArgs](2026-09-24-hand-rolled-command-specs-on-parseargs.md) — help, docs and completion render from one spec; stubs exit 3.
- **2026-09-24** — [Copy and adapt the desktop web app for the admin UI](2026-09-24-copy-and-adapt-the-desktop-web-app-for-the-admin-ui.md) — provenance headers instead of a shared package, with the trigger for revisiting.
- **2026-09-24** — [The CLI is the host for managed runtimes](2026-09-24-the-cli-is-the-host-for-managed-runtimes.md) — the helper is the same binary, file-based request and result, elevation strategies, never the control API.
- **2026-09-24** — [Add an optional terminal UI](2026-09-24-add-an-optional-terminal-ui.md) — `atc tui` on Ink as a second front end over the daemon, plain commands stay primary; narrows the TUI exclusion in the parseArgs record.

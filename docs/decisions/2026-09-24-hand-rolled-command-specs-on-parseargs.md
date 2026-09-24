---
date: 2026-09-24
title: "Hand-rolled command specs on parseArgs"
---

# 2026-09-24 — Hand-rolled command specs on parseArgs

- **Context:** `atc` has about forty commands in four groups, several of them nested (`models pull`,
  `api key rotate`, `admin token`), with strict flags, positionals, a `--json` mode that must print
  exactly one document, grouped `--help`, shell completion for four shells, and a reference document. Most
  of the commands are designed in this iteration and implemented later, so their flags and help must be
  final while their bodies are stubs. The core's rule that every dependency needs a reason applies.
  `atomic-agent` (the reference for CLI style) keeps a `COMMANDS` array and hand-written `HELP` arrays,
  which have drifted from what the parser accepts. Node 22 ships `node:util` `parseArgs` with strict
  validation, short flags, `multiple` and negation (`allowNegative`).
- **Decision:** No CLI library. A command is a `CommandSpec` (`src/cli/command.ts`: `name`, `summary`,
  `description`, `group`, `options` of type string or boolean with `short`, `multiple`, `placeholder`,
  `default`, `positionals` with `required`/`rest`, `subcommands`, `defaultSubcommand`, `examples`,
  `hidden`, `stub`, `run`). `resolveCommand` walks the tree as far as the leading words go, `parseInvocation`
  hands the rest to `parseArgs` in strict mode and turns every mistake into `ATC_USAGE` (exit 2) with a
  `--help` hint. Global flags (`--json`, `-v`, `-q`, `-y`, `--data-folder`, `--no-color`, `-h`, `--version`)
  are stripped once by `splitGlobalFlags` before a command parses its own, and are accepted anywhere on the
  line. **Help (`renderHelp`), `docs/commands.md` (`scripts/gen-command-docs.mjs`, checked in CI) and
  `atc completion <shell>` all render from the same specs**, so nothing can drift. A stub is
  `notImplemented(spec)`: the same parsing and help, then `ATC_NOT_IMPLEMENTED` (exit 3) naming the
  iteration from the `PLANNED` registry in `src/cli/not-implemented.ts`; a unit test asserts the registry
  and the tree agree in both directions. Errors are `AtcError { code, message, details?, hint? }`, rendered
  once (`describeError` / `errorBody`); `--json` puts one document on stdout and `{"error":{…}}` on stderr.
- **Consequences:** Zero runtime dependencies for the CLI layer, and a framework small enough to read in one
  sitting (`command.ts`, `flags.ts`, `help.ts`, `completion.ts`, `context.ts`). Option types are limited to
  what `parseArgs` offers: numbers arrive as strings and each command validates its own (`--port`,
  `--lines`), which is a small tax per command. Completion is static — subcommands and long options at
  every level — with no dynamic model-id completion. Help texts are the specs, so a wording change is a code
  change with a docs regeneration; CI fails when `docs/commands.md` is stale. Adding a command is one spec
  plus one registry line and one contract test. Bare `atc` and bare groups print help and exit 2, the core
  CLI's convention. Ink and other TUI frameworks are out: this is a server tool, and a TUI conflicts with
  `--json` and with logs on stderr. `parseArgs` quirks (negated booleans, `--` passthrough, defaults for
  `multiple`) are pinned by tests rather than hidden behind a library.
- **Alternatives:** *commander / yargs / clipanion / oclif*: each brings its own help renderer and
  completion story that would still need adapting to `--json`, groups and generated docs, plus a dependency
  with a reason to write — rejected for a surface this regular. *atomic-agent's arrays*: the drift between
  `HELP` and the parser is the bug this decision avoids — rejected. *A schema library (zod) for flags and
  config*: the config already uses a hand table for the same reason (one table feeds `config set`, env
  mapping and `/api/config`); to be revisited by an ADR if the field count triples.
- **Owner:** team.
- **Links:** `src/cli/command.ts`, `src/cli/flags.ts`, `src/cli/help.ts`, `src/cli/completion.ts`,
  `src/cli/not-implemented.ts` and its test; `src/errors/errors.ts`; `src/main.ts`;
  `scripts/gen-command-docs.mjs`; `.github/workflows/ci.yml` (`gen-command-docs.mjs --check`);
  `atomic-agent/src/cli/index.ts` (the style reference); plan §3, §4.

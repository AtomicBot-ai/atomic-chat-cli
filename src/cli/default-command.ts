/**
 * What bare `atc` does. On an interactive terminal it opens the terminal UI (`atc tui`); anywhere
 * else — a pipe, systemd, cron, `docker run` without `-t`, `--json` — it prints help and exits 2,
 * so scripts and service units keep the old contract. Pure: table-tested.
 */

import type { GlobalFlags } from './flags.js'

export interface DefaultCommandInput {
  /** argv after the global flags were stripped. */
  rest: readonly string[]
  globals: GlobalFlags
  isTTY: { stdin: boolean; stdout: boolean }
  env: NodeJS.ProcessEnv
}

export function opensTui(input: DefaultCommandInput): boolean {
  if (input.rest.length > 0) return false
  if (input.globals.json || input.globals.help || input.globals.version) return false
  if (!input.isTTY.stdin || !input.isTTY.stdout) return false
  return input.env['TERM'] !== 'dumb'
}

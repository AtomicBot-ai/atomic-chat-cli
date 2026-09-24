/**
 * Getting a privileged step run. The helper is `atc` itself (`atc host-step exec <request>`),
 * re-invoked under whatever this session can offer: nothing (root), `sudo` on a terminal, `pkexec`
 * in a desktop session, UAC on Windows — or none of those, in which case the request file stays
 * where it is and the person is told the exact command to run.
 *
 * The privileged process never talks to the core: it reads the request file, does the work, writes
 * the result file and exits. The unprivileged daemon turns the result into the receipt.
 */

import { AtcError } from '../errors/index.js'
import type { ExecFn } from './exec.js'
import type { HostStepOutcomeKind, ManagedHostAction, Sha256Digest } from './managed-types.js'

export type ElevationStrategy = 'root' | 'sudo-tty' | 'pkexec' | 'windows-runas' | 'manual'

export interface ElevationContext {
  platform: NodeJS.Platform
  isRoot: boolean
  isElevatedWindows: boolean | null
  hasTty: boolean
  hasDisplay: boolean
  hasPkexec: boolean
  hasSudo: boolean
  /** Inside the daemon there is no terminal to prompt on. */
  inDaemon: boolean
}

/** First match wins; see docs/architecture.md "Elevation". */
export function selectStrategy(ctx: ElevationContext): ElevationStrategy {
  if (ctx.platform === 'win32') {
    if (ctx.isElevatedWindows === true) return 'root'
    return ctx.inDaemon || ctx.hasTty ? 'windows-runas' : 'manual'
  }
  if (ctx.isRoot) return 'root'
  if (ctx.inDaemon && ctx.platform === 'linux' && ctx.hasDisplay && ctx.hasPkexec) return 'pkexec'
  if (!ctx.inDaemon && ctx.hasTty && ctx.hasSudo) return 'sudo-tty'
  return 'manual'
}

export interface HostStepRequestFile {
  schema_version: 1
  step_id: string
  operation_id: string
  action: ManagedHostAction
  recipe_id: string
  recipe_digest: Sha256Digest
  parameters_digest: Sha256Digest
  nonce: string
  expected_operation_revision: number
  data_folder: string
  requested_at: number
}

export interface HostStepResultFile {
  schema_version: 1
  step_id: string
  outcome: HostStepOutcomeKind
  exit_code: number | null
  log_tail: string
  finished_at: number
}

export type HostStepOutcome =
  { kind: 'result'; result: HostStepResultFile } | { kind: 'pending'; instructions: string }

export interface Elevator {
  select(ctx: ElevationContext): ElevationStrategy
  run(strategy: ElevationStrategy, requestPath: string): Promise<HostStepOutcome>
}

export interface ElevatorDeps {
  exec: ExecFn
  /** How to re-run this program (`process.execPath` plus a script when running from source). */
  selfCommand: readonly string[]
  readResult: (requestPath: string) => Promise<HostStepResultFile | undefined>
}

/** The command a person runs by hand when no automatic strategy applies. */
export function manualInstructions(
  selfCommand: readonly string[],
  requestPath: string,
  platform: NodeJS.Platform
): string {
  const self = selfCommand.map(quote).join(' ')
  if (platform === 'win32')
    return `From an elevated (Administrator) PowerShell:\n  ${self} host-step exec ${quote(requestPath)}`
  return `sudo ${self} host-step exec ${quote(requestPath)}`
}

function quote(arg: string): string {
  return /[\s"']/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
}

export function createElevator(deps: ElevatorDeps, platform: NodeJS.Platform = process.platform): Elevator {
  const [exe, ...prefix] = deps.selfCommand
  return {
    select: selectStrategy,
    async run(strategy, requestPath) {
      switch (strategy) {
        case 'root': {
          const result = await deps.exec(exe as string, [...prefix, 'host-step', 'exec', requestPath], {
            timeoutMs: 30 * 60_000,
            stdio: 'inherit',
          })
          const file = await deps.readResult(requestPath)
          if (file) return { kind: 'result', result: file }
          return {
            kind: 'result',
            result: {
              schema_version: 1,
              step_id: '',
              outcome: 'failed',
              exit_code: result.code,
              log_tail: result.error ?? result.stderr.slice(-2000),
              finished_at: Date.now(),
            },
          }
        }
        case 'manual':
          return {
            kind: 'pending',
            instructions: manualInstructions(deps.selfCommand, requestPath, platform),
          }
        case 'sudo-tty':
        case 'pkexec':
        case 'windows-runas':
          throw new AtcError('ATC_NOT_IMPLEMENTED', `Elevation through ${strategy} is not implemented yet.`, {
            details: 'planned for iteration 4 (engines, setup, managed environment, elevation)',
            hint: manualInstructions(deps.selfCommand, requestPath, platform),
          })
      }
    },
  }
}

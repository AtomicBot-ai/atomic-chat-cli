/**
 * Wire types of the core's managed-runtime contract, mirrored from
 * `atomic-chat-core@feat/tenzor-rt:src/contracts/environment.ts`. They are not in the core
 * version `atc` embeds yet; once that branch lands, this file becomes re-exports from
 * `atomic-chat-core/contracts` and nothing else changes.
 */

export const MANAGED_HOST_ACTIONS = ['linux.install-container-runtime', 'windows.enable-wsl'] as const
export type ManagedHostAction = (typeof MANAGED_HOST_ACTIONS)[number]

export type Sha256Digest = `sha256:${string}`

export type ManagedPhase =
  | 'checking'
  | 'awaiting-consent'
  | 'preparing-host'
  | 'relogin-required'
  | 'reboot-required'
  | 'preparing-environment'
  | 'pulling-image'
  | 'verifying'
  | 'activating'
  | 'removing'
  | 'ready'
  | 'removed'
  | 'cancelling'
  | 'cancelled'
  | 'failed'

export const TERMINAL_PHASES: readonly ManagedPhase[] = ['ready', 'removed', 'cancelled', 'failed']

/** The pending privileged step. `nonce` is single-use; the digests bind it to what was approved. */
export interface ManagedHostStep {
  step_id: string
  action: ManagedHostAction
  recipe_id: string
  recipe_digest: Sha256Digest
  parameters_digest: Sha256Digest
  nonce: string
  expected_operation_revision: number
}

export type HostStepOutcomeKind = 'completed' | 'declined' | 'relogin-required' | 'reboot-required' | 'failed'

/** What the host reports back. An assertion, not proof: the core re-probes before believing it. */
export interface ManagedHostReceipt {
  step_id: string
  nonce: string
  expected_operation_revision: number
  recipe_digest: Sha256Digest
  parameters_digest: Sha256Digest
  outcome: HostStepOutcomeKind
  receipt_id: string
}

/** The slice of `EnvironmentOperation` the host-step executor reads. */
export interface EnvironmentOperationView {
  operation_id: string
  instance_id: string
  revision: number
  phase: ManagedPhase
  pending_host_step: ManagedHostStep | null
  completed_step_ids: string[]
}

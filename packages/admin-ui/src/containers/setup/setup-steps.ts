/** The managed-environment wizard's steps, in order, and the fixture the page runs on until the setup API exists. */

import type { SetupState } from '@contract'

export interface SetupStep {
  label: string
  title: string
  description: string
  /** The button the user presses at this step; absent while the wizard waits on the host. */
  action?: string
}

/** The happy path, in order. `failed` sits outside it. */
export const SETUP_FLOW: readonly SetupState[] = [
  'not-installed',
  'consent',
  'elevating',
  'installing',
  'relogin-required',
  'reboot-required',
  'ready',
]

export const SETUP_STEPS: Record<SetupState, SetupStep> = {
  'not-installed': {
    label: 'Not installed',
    title: 'No managed environment yet',
    description:
      'atc runs models under its own service account with a dedicated data folder. Nothing is installed on this machine yet.',
    action: 'Install',
  },
  'consent': {
    label: 'Consent',
    title: 'Review what will change',
    description:
      'atc will create a service user, a data folder, and the service that keeps the daemon running after you log out.',
    action: 'Agree and continue',
  },
  'elevating': {
    label: 'Elevating',
    title: 'Waiting for administrator rights',
    description: 'Approve the prompt on the server. The admin keeps polling while the elevation is pending.',
  },
  'installing': {
    label: 'Installing',
    title: 'Installing the managed environment',
    description: 'Creating the account, the folders and the service. This takes a moment.',
  },
  'relogin-required': {
    label: 'Re-login',
    title: 'Log in again',
    description: 'Group membership changed; a new login session is needed before the service can start.',
    action: 'I have logged in again',
  },
  'reboot-required': {
    label: 'Reboot',
    title: 'Reboot required',
    description: 'The operating system needs a restart before the service can start.',
    action: 'I have rebooted',
  },
  'ready': {
    label: 'Ready',
    title: 'Managed environment ready',
    description:
      'The daemon runs under its service account; models, downloads and the API server live there.',
  },
  'failed': {
    label: 'Failed',
    title: 'Setup failed',
    description: 'The last step did not finish. The log says why; retry once the cause is fixed.',
    action: 'Retry',
  },
}

export interface SetupFixture {
  state: SetupState
  detail: string
  log: readonly string[]
}

export const SETUP_FIXTURE: SetupFixture = {
  state: 'consent',
  detail: 'macOS 15 · service user _atc · data folder /Library/Application Support/atc',
  log: ['[fixture] the setup API (/api/setup) lands in iteration 7; this stepper runs on local state'],
}

/**
 * Find the daemon that owns the data folder, or start one. The lock, the token and the handshake
 * are the core's (`atomic-chat-core/host`); what `atc` adds is the spawn with a log file instead
 * of a pipe, and the check that the owner is an `atc` daemon rather than the core CLI's.
 */

import { AtomicCoreError } from '@atomic-chat/core'
import { attachToOwner, inspectLock, waitForPublishedOwner } from '@atomic-chat/core/host'
import { AtcError } from '../errors/index.js'
import type { AtcPaths } from '../config/paths.js'
import type { Logger } from '../output/logger.js'
import { readDaemonRecord } from './daemon-record.js'
import type { DaemonRecord } from './daemon-record.js'
import { SseEvents } from './events.js'
import { HttpCoreLink } from './link.js'
import type { CoreLink } from './link.js'

export const DAEMON_START_TIMEOUT_MS = 20_000
/** The lock goes `ready` inside the core; the atc record follows a moment later. */
export const DAEMON_RECORD_TIMEOUT_MS = 5_000

export interface AttachOptions {
  paths: AtcPaths
  /** Start a daemon when none owns the folder. */
  launch: boolean
  clientName: string
  pid: number
  log: Logger
  spawnDaemon: () => Promise<void>
  timeoutMs?: number
}

export async function attachCore(options: AttachOptions): Promise<CoreLink> {
  const { paths, log } = options
  const layout = paths.layout
  const timeoutMs = options.timeoutMs ?? DAEMON_START_TIMEOUT_MS
  let owner
  try {
    owner = await attachToOwner({
      layout,
      clientName: options.clientName,
      launch: false,
      log: (m) => log.debug(m),
    })
  } catch (error) {
    if (!(error instanceof AtomicCoreError && error.code === 'CORE_NOT_RUNNING')) throw error
    if (!options.launch) {
      throw new AtcError('ATC_DAEMON_NOT_RUNNING', 'No atc daemon is running for this data folder.', {
        details: paths.dataFolder,
        hint: 'start one with `atc start` (or `atc serve <model>`)',
      })
    }
    const state = await inspectLock(layout)
    if (state.kind !== 'owned') {
      log.info('starting the atc daemon')
      await options.spawnDaemon()
    } else log.debug('a daemon is starting; waiting for it')
    await waitForPublishedOwner(layout, { timeoutMs })
    owner = await attachToOwner({
      layout,
      clientName: options.clientName,
      launch: false,
      log: (m) => log.debug(m),
    })
  }
  const record = await waitForDaemonRecord(
    paths.daemonRecord,
    owner.record.instance_id,
    DAEMON_RECORD_TIMEOUT_MS
  )
  if (!record) {
    throw new AtcError(
      'ATC_DAEMON_FOREIGN',
      'The data folder is owned by a core that is not an atc daemon.',
      {
        details: `pid ${owner.record.pid}, core ${owner.record.version} — probably \`atomic-chat-core\`'s own CLI`,
        hint: 'stop it (`atomic-chat-core shutdown`) or use a separate --data-folder',
      }
    )
  }
  return new HttpCoreLink({
    endpoint: {
      baseUrl: `http://${owner.record.control_host}:${owner.record.control_port}`,
      instanceId: owner.record.instance_id,
      version: owner.record.version,
      pid: owner.record.pid,
    },
    client: owner.client,
    events: new SseEvents(owner.client, { log: (m) => log.debug(m) }),
    pid: options.pid,
    log: (m) => log.debug(m),
  })
}

/** The record for this owner, or undefined when none appears in time (a foreign owner never writes one). */
export async function waitForDaemonRecord(
  path: string,
  instanceId: string,
  timeoutMs: number
): Promise<DaemonRecord | undefined> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const record = await readDaemonRecord(path)
    if (record && record.instance_id === instanceId) return record
    if (Date.now() >= deadline) return undefined
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

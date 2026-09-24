/**
 * Following the core's event stream over SSE: snapshot, then `/events` from the snapshot's cursor,
 * reconnect with backoff on a dropped socket, re-snapshot on `resync` (a cursor the replay ring no
 * longer has) and on an instance change (a new core owns the folder: derived state is stale).
 */

import type { CoreClient, CoreEventMessage, CoreSnapshot } from '@atomic-chat/core/client'
import type { CoreEventHandler, CoreEventSource } from './link.js'

export interface SseEventsOptions {
  backoffMs?: readonly number[]
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
  log?: (message: string) => void
}

const DEFAULT_BACKOFF = [500, 1000, 2000, 5000] as const

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      signal.removeEventListener('abort', done)
      clearTimeout(timer)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

export class SseEvents implements CoreEventSource {
  private readonly backoff: readonly number[]
  private readonly wait: NonNullable<SseEventsOptions['sleep']>
  private readonly log: (message: string) => void

  constructor(
    private readonly client: Pick<CoreClient, 'snapshot' | 'events'>,
    options: SseEventsOptions = {}
  ) {
    this.backoff = options.backoffMs ?? DEFAULT_BACKOFF
    this.wait = options.sleep ?? sleep
    this.log = options.log ?? (() => undefined)
  }

  async subscribe(
    handler: CoreEventHandler,
    options: { signal: AbortSignal; onSnapshot?: (s: CoreSnapshot) => void }
  ): Promise<void> {
    const { signal } = options
    let failures = 0
    let instanceId: string | undefined
    while (!signal.aborted) {
      let cursor: string | undefined
      try {
        const snapshot = await this.client.snapshot()
        if (instanceId !== undefined && snapshot.instance_id !== instanceId) {
          handler({ id: '', event: 'resync', data: { reason: 'instance-changed' } })
        }
        instanceId = snapshot.instance_id
        cursor = snapshot.cursor
        options.onSnapshot?.(snapshot)
        failures = 0
        let resync = false
        await this.client.events(
          (message: CoreEventMessage) => {
            if (message.event === 'resync') {
              resync = true
              return
            }
            cursor = message.id
            handler(message)
          },
          { ...(cursor ? { cursor } : {}), signal }
        )
        if (signal.aborted) return
        if (!resync) this.log('event stream ended; reconnecting')
      } catch (error) {
        if (signal.aborted) return
        failures += 1
        const delay = this.backoff[Math.min(failures - 1, this.backoff.length - 1)] as number
        this.log(
          `event stream failed (${String((error as Error).message ?? error)}); retrying in ${delay} ms`
        )
        await this.wait(delay, signal)
      }
    }
  }
}

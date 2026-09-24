/**
 * The daemon's event source: it hosts the core, so it listens to the emitter directly — no SSE to
 * itself, no replay ring to fall behind. Ids match the wire form `<instance_id>:<seq>`.
 */

import type { AtomicCore } from '@atomic-chat/core'
import type { CoreSnapshot } from '@atomic-chat/core/client'
import type { CoreEventHandler, CoreEventSource } from './link.js'

export class InProcessEvents implements CoreEventSource {
  constructor(
    private readonly core: Pick<AtomicCore, 'events'>,
    private readonly snapshot: () => Promise<CoreSnapshot>
  ) {}

  async subscribe(
    handler: CoreEventHandler,
    options: { signal: AbortSignal; onSnapshot?: (s: CoreSnapshot) => void }
  ): Promise<void> {
    if (options.onSnapshot) options.onSnapshot(await this.snapshot())
    const off = this.core.events.onAny((record) =>
      handler({ id: this.core.events.cursor(record.seq), event: record.name, data: record.payload })
    )
    await new Promise<void>((resolve) => {
      if (options.signal.aborted) return resolve()
      options.signal.addEventListener('abort', () => resolve(), { once: true })
    })
    off()
  }
}

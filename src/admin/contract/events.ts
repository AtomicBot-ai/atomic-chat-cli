/** The SSE the admin relays: the core's events plus `atc`'s own, one id sequence for resume. */

import type { CoreEventName } from '@atomic-chat/core/contracts'

export type AtcEventName = 'atc:status' | 'atc:log' | 'atc:host-step' | 'atc:download'

export interface AdminEvent {
  /** Relay sequence, e.g. `r42`; send it back as `Last-Event-ID` to resume. */
  id: string
  event: CoreEventName | AtcEventName | 'resync'
  data: unknown
}

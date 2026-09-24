/**
 * The relay's SSE (`GET /api/events`) as the app's event listeners. A page subscribes to a core
 * event by name, exactly as it listens to `atomic-core://<event>` on desktop; the browser's
 * `EventSource` keeps the connection and resumes with `Last-Event-ID` on its own. `resync` is the
 * relay saying its replay buffer ran out: the snapshot stores refetch (see `useLiveStatus`).
 */

import { useEffect, useRef } from 'react'
import { ADMIN_API } from '@contract'
import type { AdminEvent } from '@contract'
import { useServiceHub } from '@/hooks/useServiceHub'
import { ADMIN_BASE, relative } from './admin-api'

export type AdminEventName = AdminEvent['event']

export interface EventMeta {
  /** The relay sequence (`r42`), or null for a source that sends none. */
  id: string | null
  event: string
}

export type EventHandler<T = unknown> = (data: T, meta: EventMeta) => void

/** What we use of `EventSource`, so a test can hand in a fake. */
export type EventSourceLike = Pick<
  EventSource,
  'addEventListener' | 'removeEventListener' | 'close' | 'readyState'
>
export type EventSourceFactory = new (url: string, init?: EventSourceInit) => EventSourceLike

export interface AdminEventSource {
  /** Deliver `event` to `handler` until the returned function is called. Opens the stream on first use. */
  subscribe<T = unknown>(event: string, handler: EventHandler<T>): () => void
  /** Drop the connection (sign-out). The next `subscribe` opens a new one. */
  close(): void
  /** Whether a stream is open or connecting. */
  readonly open: boolean
}

const CLOSED = 2

function parseData(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function createEventSource(base = ADMIN_BASE, impl?: EventSourceFactory): AdminEventSource {
  const url = `${base}${relative(ADMIN_API.events)}`
  const handlers = new Map<string, Set<EventHandler>>()
  const listeners = new Map<string, (event: Event) => void>()
  let source: EventSourceLike | null = null

  const alive = () => source !== null && source.readyState !== CLOSED

  function resolveImpl(): EventSourceFactory {
    const ctor = impl ?? (globalThis as { EventSource?: EventSourceFactory }).EventSource
    if (!ctor) throw new Error('EventSource is not available in this environment.')
    return ctor
  }

  function attach(name: string) {
    if (!source || listeners.has(name)) return
    const listener = (event: Event) => {
      const message = event as MessageEvent
      const data = parseData(message.data)
      const meta: EventMeta = { id: message.lastEventId || null, event: name }
      for (const handler of handlers.get(name) ?? []) handler(data, meta)
    }
    listeners.set(name, listener)
    source.addEventListener(name, listener)
  }

  function detach(name: string) {
    const listener = listeners.get(name)
    if (listener && source) source.removeEventListener(name, listener)
    listeners.delete(name)
  }

  /** (Re)open when there is no live stream: after `close()`, or after the server refused one (401). */
  function open() {
    if (alive()) return
    listeners.clear()
    const Impl = resolveImpl()
    source = new Impl(url, { withCredentials: true })
    for (const name of handlers.keys()) attach(name)
  }

  return {
    get open() {
      return alive()
    },
    subscribe(name, handler) {
      let set = handlers.get(name)
      if (!set) {
        set = new Set()
        handlers.set(name, set)
      }
      set.add(handler as EventHandler)
      open()
      attach(name)
      return () => {
        set.delete(handler as EventHandler)
        if (set.size === 0) {
          handlers.delete(name)
          detach(name)
        }
      }
    },
    close() {
      if (source) source.close()
      source = null
      listeners.clear()
    },
  }
}

/**
 * Subscribe a component to one or more relay events for as long as it is mounted. The handler may
 * change between renders; the subscription does not.
 */
export function useCoreEvents<T = unknown>(
  event: string | readonly string[],
  handler: EventHandler<T>
): void {
  const hub = useServiceHub()
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  }, [handler])
  const key = typeof event === 'string' ? event : event.join('\n')
  useEffect(() => {
    const events = hub.events()
    const offs = key
      .split('\n')
      .map((name) => events.subscribe<T>(name, (data, meta) => latest.current(data, meta)))
    return () => {
      for (const off of offs) off()
    }
  }, [hub, key])
}

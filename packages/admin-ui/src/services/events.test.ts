import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useLiveStatus } from '@/hooks/useAdminStatus'
import { initializeServiceHubStore } from '@/hooks/useServiceHub'
import { createServiceHub } from '@/services'
import { useStatusStore } from '@/stores/status-store'
import { FakeEventSource } from '@/test/fake-event-source'
import { jsonResponse, statusFixture } from '@/test/fixtures'
import { createEventSource, useCoreEvents } from './events'
import type { EventSourceFactory } from './events'

const Fake = FakeEventSource as unknown as EventSourceFactory

function last(): FakeEventSource {
  const source = FakeEventSource.last
  if (!source) throw new Error('no EventSource was opened')
  return source
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createEventSource', () => {
  it('opens /api/events with credentials on the first subscription and delivers parsed data', () => {
    const events = createEventSource('/api', Fake)
    expect(FakeEventSource.instances).toHaveLength(0)
    expect(events.open).toBe(false)

    const handler = vi.fn()
    events.subscribe('session:started', handler)

    expect(last().url).toBe('/api/events')
    expect(last().withCredentials).toBe(true)
    expect(events.open).toBe(true)

    last().emit('session:started', { model_id: 'qwen', port: 39001 }, 'r7')
    expect(handler).toHaveBeenCalledWith(
      { model_id: 'qwen', port: 39001 },
      { id: 'r7', event: 'session:started' }
    )
  })

  it('shares one stream, stops delivery after unsubscribe, and reopens after close', () => {
    const events = createEventSource('/api', Fake)
    const a = vi.fn()
    const b = vi.fn()

    const offA = events.subscribe('resync', a)
    events.subscribe('atc:log', b)
    expect(FakeEventSource.instances).toHaveLength(1)

    offA()
    last().emit('resync', null)
    expect(a).not.toHaveBeenCalled()

    events.close()
    expect(events.open).toBe(false)
    expect(last().readyState).toBe(FakeEventSource.CLOSED)

    events.subscribe('resync', a)
    expect(FakeEventSource.instances).toHaveLength(2)
    last().emit('resync', null)
    last().emit('atc:log', 'hello')
    expect(a).toHaveBeenCalledTimes(1)
    // The earlier subscriber is carried over to the new stream.
    expect(b).toHaveBeenCalledWith('hello', { id: 'r1', event: 'atc:log' })
  })

  it('reopens when the server closed the stream (a 401 before sign-in)', () => {
    const events = createEventSource('/api', Fake)
    events.subscribe('resync', vi.fn())
    last().close()

    events.subscribe('atc:status', vi.fn())

    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('passes non-JSON data through as text', () => {
    const events = createEventSource('/api', Fake)
    const handler = vi.fn()
    events.subscribe('atc:log', handler)

    last().dispatchEvent(new MessageEvent('atc:log', { data: 'plain text', lastEventId: '' }))

    expect(handler).toHaveBeenCalledWith('plain text', { id: null, event: 'atc:log' })
  })
})

describe('useCoreEvents', () => {
  it('subscribes for the component lifetime and always calls the latest handler', () => {
    initializeServiceHubStore(createServiceHub({ eventSource: Fake }))
    const first = vi.fn()
    const second = vi.fn()

    const { rerender, unmount } = renderHook(
      ({ handler }: { handler: () => void }) => useCoreEvents(['session:started', 'session:died'], handler),
      { initialProps: { handler: first } }
    )
    const source = last()

    source.emit('session:died', { pid: 1 })
    expect(first).toHaveBeenCalledTimes(1)

    rerender({ handler: second })
    source.emit('session:started', { pid: 2 })
    expect(second).toHaveBeenCalledWith({ pid: 2 }, expect.objectContaining({ event: 'session:started' }))
    expect(first).toHaveBeenCalledTimes(1)

    unmount()
    source.emit('session:started', { pid: 3 })
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('a resync refetches the status store', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, statusFixture()))
    vi.stubGlobal('fetch', fetchMock)
    initializeServiceHubStore(createServiceHub({ eventSource: Fake }))

    renderHook(() => useLiveStatus())
    expect(fetchMock).not.toHaveBeenCalled()

    last().emit('resync', null)
    last().emit('session:started', { model_id: 'qwen' })

    await waitFor(() => expect(useStatusStore.getState().status?.daemon.pid).toBe(4242))
    // Two events, one debounced request.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/status')
  })
})

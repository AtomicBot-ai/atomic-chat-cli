import { describe, expect, it } from 'vitest'
import type { CoreEventMessage, CoreSnapshot } from '@atomic-chat/core/client'
import { SseEvents } from './events.js'

const snapshot = (instance: string, cursor: string) =>
  ({ instance_id: instance, cursor }) as unknown as CoreSnapshot

describe('SseEvents', () => {
  it('snapshots, streams from the cursor, re-snapshots on resync and stops on abort', async () => {
    const seen: string[] = []
    const cursors: Array<string | undefined> = []
    const controller = new AbortController()
    let streams = 0
    const client = {
      snapshot: async () => snapshot('i1', `i1:${streams}`),
      events: async (
        onEvent: (m: CoreEventMessage) => void,
        options: { cursor?: string; signal?: AbortSignal }
      ) => {
        cursors.push(options.cursor)
        streams += 1
        if (streams === 1) {
          onEvent({ id: 'i1:5', event: 'session:started', data: {} })
          onEvent({ id: '', event: 'resync', data: {} })
          return
        }
        onEvent({ id: 'i1:7', event: 'session:died', data: {} })
        controller.abort()
      },
    }
    await new SseEvents(client, { sleep: async () => {} }).subscribe((m) => seen.push(`${m.event}@${m.id}`), {
      signal: controller.signal,
    })
    expect(seen).toEqual(['session:started@i1:5', 'session:died@i1:7'])
    expect(cursors).toEqual(['i1:0', 'i1:1'])
  })

  it('retries with backoff after a failure and reports an instance change', async () => {
    const seen: string[] = []
    const waits: number[] = []
    const controller = new AbortController()
    let calls = 0
    const client = {
      snapshot: async () => {
        calls += 1
        if (calls === 1) throw new Error('down')
        return snapshot(calls === 2 ? 'i1' : 'i2', 'c')
      },
      events: async (onEvent: (m: CoreEventMessage) => void) => {
        if (calls === 2) return // stream ended: reconnect
        onEvent({ id: 'i2:1', event: 'core:log', data: {} })
        controller.abort()
      },
    }
    await new SseEvents(client, {
      backoffMs: [7],
      sleep: async (ms) => {
        waits.push(ms)
      },
    }).subscribe((m) => seen.push(m.event), { signal: controller.signal })
    expect(waits).toEqual([7])
    expect(seen).toEqual(['resync', 'core:log'])
  })
})

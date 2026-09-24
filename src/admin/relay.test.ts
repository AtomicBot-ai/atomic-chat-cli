import { describe, expect, it } from 'vitest'
import { RelayHub, sseFrame } from './relay.js'

describe('RelayHub', () => {
  it('numbers, fans out, replays and resyncs', () => {
    const hub = new RelayHub(3)
    const seen: string[] = []
    const off = hub.subscribe((e) => seen.push(e.id))
    hub.publish('atc:status', { a: 1 })
    hub.publish('core:log', {})
    off()
    hub.publish('atc:log', {})
    hub.publish('atc:log', {})
    expect(seen).toEqual(['r1', 'r2'])
    expect(hub.replayAfter('r3').map((e) => e.id)).toEqual(['r4'])
    expect(hub.replayAfter('r4')).toEqual([])
    expect(hub.replayAfter('r0')[0]?.event).toBe('resync')
    expect(hub.replayAfter('zzz')[0]?.event).toBe('resync')
    expect(hub.replayAfter(undefined)).toEqual([])
    expect(sseFrame({ id: 'r1', event: 'atc:status', data: { a: 1 } })).toBe(
      'id: r1\nevent: atc:status\ndata: {"a":1}\n\n'
    )
  })
})

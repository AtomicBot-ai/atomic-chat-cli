import { createServer } from 'node:net'
import { describe, expect, it } from 'vitest'
import { probePort } from './ports.js'

describe('probePort', () => {
  it('tells a busy port from a free one', async () => {
    const server = createServer()
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    const port = (server.address() as { port: number }).port
    expect(await probePort('127.0.0.1', port)).toBe('busy')
    await new Promise<void>((r) => server.close(() => r()))
    expect(await probePort('127.0.0.1', port)).toBe('free')
  })
})

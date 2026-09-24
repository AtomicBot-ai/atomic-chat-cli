/**
 * The few Node behaviours the daemon and the admin depend on, pinned so a runtime change (Node
 * major, Bun release) shows up here first. Runs under vitest and under `bun test`.
 */
import { spawn } from 'node:child_process'
import { createServer, get } from 'node:http'
import { gunzipSync, gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

describe('runtime behaviours', () => {
  it('a detached, unref-ed child does not keep the parent alive and survives it', async () => {
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 200)'], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    expect(child.pid).toBeGreaterThan(0)
    await new Promise((r) => setTimeout(r, 50))
    expect(() => process.kill(child.pid as number, 0)).not.toThrow()
    child.kill()
  })

  it('gzip round-trips base64 payloads (the embedded admin assets)', () => {
    const text = 'x'.repeat(10_000)
    const gz = gzipSync(Buffer.from(text)).toString('base64')
    expect(gunzipSync(Buffer.from(gz, 'base64')).toString()).toBe(text)
  })

  it('streams server-sent events chunk by chunk', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write(': connected\n\n')
      setTimeout(() => res.write('event: x\ndata: 1\n\n'), 20)
      setTimeout(() => res.end(), 60)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    const port = (server.address() as { port: number }).port
    const chunks: string[] = []
    await new Promise<void>((resolve) => {
      get(`http://127.0.0.1:${port}/`, (res) => {
        res.on('data', (c: Buffer) => chunks.push(c.toString()))
        res.on('end', () => resolve())
      })
    })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.join('')).toContain('event: x')
    await new Promise<void>((r) => server.close(() => r()))
  })
})

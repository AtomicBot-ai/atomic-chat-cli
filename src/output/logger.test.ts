import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { recordingIo } from '../io.js'
import { colorsFor } from './color.js'
import { createLogger, fileSink, formatEntry, levelFromFlags, stderrSink, tee } from './logger.js'
import type { LogEntry } from './logger.js'

describe('logger', () => {
  it('filters by level and scopes children', () => {
    const seen: LogEntry[] = []
    const log = createLogger((e) => seen.push(e), { level: 'info', now: () => 1 })
    log.debug('no')
    log.info('yes')
    log.child('admin').warn('scoped', { port: 1 })
    expect(seen.map((e) => [e.level, e.scope, e.message])).toEqual([
      ['info', undefined, 'yes'],
      ['warn', 'admin', 'scoped'],
    ])
    expect(formatEntry(seen[1]!, colorsFor(false))).toBe('[warn] admin: scoped {"port":1}')
  })

  it('maps flags to levels', () => {
    expect(levelFromFlags({ verbose: true, quiet: false })).toBe('debug')
    expect(levelFromFlags({ verbose: true, quiet: true })).toBe('error')
    expect(levelFromFlags({ verbose: false, quiet: false })).toBe('info')
  })

  it('writes JSON lines to stderr in json mode', () => {
    const io = recordingIo()
    createLogger(stderrSink(io, { json: true, colors: colorsFor(false) }), {
      level: 'info',
      now: () => 0,
    }).info('x', { a: 1 })
    expect(JSON.parse(io.err[0]!)).toMatchObject({ level: 'info', message: 'x', a: 1 })
  })

  describe('fileSink', () => {
    const dir = mkdtempSync(join(tmpdir(), 'atc-log-'))
    afterEach(() => rmSync(dir, { recursive: true, force: true }))

    it('appends and rotates by size', () => {
      const path = join(dir, 'd.log')
      const sink = tee(fileSink(path, { maxSizeBytes: 120, maxFiles: 3 }))
      const log = createLogger(sink, { level: 'debug', now: () => 0 })
      for (let i = 0; i < 6; i += 1) log.info(`line ${i} ${'x'.repeat(30)}`)
      const files = readdirSync(dir).sort()
      expect(files).toContain('d.log')
      expect(files).toContain('d.log.1')
      expect(files.length).toBeLessThanOrEqual(3)
      expect(readFileSync(path, 'utf8').trim().split('\n').length).toBeGreaterThanOrEqual(1)
    })
  })
})

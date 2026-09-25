import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { followLog, readLogTail, tailLines } from './log-follow.js'

describe('tailLines', () => {
  it('returns the last lines without a trailing empty one', () => {
    expect(tailLines('a\nb\nc\n', 2)).toEqual(['b', 'c'])
    expect(tailLines('a', 5)).toEqual(['a'])
    expect(tailLines('', 5)).toEqual([])
  })
})

describe('the daemon log', () => {
  let dir: string
  let file: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'atc-log-'))
    file = join(dir, 'daemon.log')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('reads no lines at offset 0 when there is no file yet', async () => {
    expect(await readLogTail(file, 10)).toEqual({ lines: [], offset: 0 })
  })

  it('reads the last lines, dropping the fragment at the start of a partial read', async () => {
    writeFileSync(file, 'first line\nsecond\nthird\n')
    expect(await readLogTail(file, 2)).toEqual({ lines: ['second', 'third'], offset: 24 })
    expect((await readLogTail(file, 10, 12)).lines).toEqual(['third'])
  })

  it('follows appended lines, holds back a partial one, and restarts after a truncation', async () => {
    writeFileSync(file, 'old\n')
    const { offset } = await readLogTail(file, 10)
    const seen: string[][] = []
    let resets = 0
    const controller = new AbortController()
    const done = followLog(file, offset, {
      signal: controller.signal,
      intervalMs: 5,
      onLines: (lines) => seen.push(lines),
      onReset: () => (resets += 1),
    })
    const until = async (predicate: () => boolean) => {
      for (let i = 0; i < 200 && !predicate(); i += 1) await new Promise((r) => setTimeout(r, 5))
    }
    appendFileSync(file, 'one\ntw')
    await until(() => seen.length === 1)
    appendFileSync(file, 'o\n')
    await until(() => seen.length === 2)
    writeFileSync(file, 'new\n')
    await until(() => seen.length === 3)
    controller.abort()
    await done
    expect(seen).toEqual([['one'], ['two'], ['new']])
    expect(resets).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { recordingIo } from '../io.js'
import { colorsFor } from './color.js'
import { createProgress } from './progress.js'

const base = { quiet: false, json: false, verbose: false, colors: colorsFor(false), width: 80 }

describe('progress', () => {
  it('prints a line every 5% off a terminal', () => {
    const io = recordingIo()
    let t = 0
    const p = createProgress(io, { ...base, isTTY: false, now: () => t }).start('pull', 100)
    for (let i = 0; i <= 100; i += 1) {
      t += 10
      p.update(i)
    }
    p.finish()
    const lines = io.err.filter((l) => l.startsWith('pull '))
    expect(lines.length).toBeGreaterThanOrEqual(20)
    expect(lines.length).toBeLessThanOrEqual(21)
    expect(io.err.at(-1)).toMatch(/^✓ pull: done/)
  })

  it('redraws with carriage returns on a terminal', () => {
    const io = recordingIo()
    const p = createProgress(io, { ...base, isTTY: true, now: () => 0 }).start('pull', 10)
    p.update(5)
    expect(io.err[0]!.startsWith('\r')).toBe(true)
    expect(io.err[0]).toContain('50%')
  })

  it('is silent when quiet and emits json lines when json+verbose', () => {
    const quiet = recordingIo()
    createProgress(quiet, { ...base, isTTY: false, quiet: true })
      .start('x', 1)
      .update(1)
    expect(quiet.err).toEqual([])
    const json = recordingIo()
    const p = createProgress(json, { ...base, isTTY: false, json: true, verbose: true, now: () => 0 }).start(
      'x',
      2
    )
    p.update(1)
    p.finish()
    expect(JSON.parse(json.err[0]!)).toMatchObject({ progress: 'x', done: 1, total: 2 })
    expect(JSON.parse(json.err[1]!)).toMatchObject({ progress: 'x', done: 'finished' })
  })
})

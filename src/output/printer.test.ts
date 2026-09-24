import { describe, expect, it } from 'vitest'
import { recordingIo } from '../io.js'
import { colorsFor } from './color.js'
import { Printer } from './printer.js'

const make = (mode: 'human' | 'json', quiet = false) => {
  const io = recordingIo()
  return { io, out: new Printer(io, { mode, quiet, colors: colorsFor(false), width: 80 }) }
}

describe('Printer', () => {
  it('is silent for human helpers in json mode and prints one document', () => {
    const { io, out } = make('json')
    out.line('x')
    out.kv([['a', 'b']])
    out.table([{ header: 'A' }], [['1']])
    out.success('ok')
    out.result({ ok: true }, () => out.line('human'))
    expect(io.out).toEqual(['{\n  "ok": true\n}\n'])
    expect(() => out.json({})).toThrow(/exactly one/)
  })

  it('prints human output and keeps warnings on stderr', () => {
    const { io, out } = make('human')
    out.line('x')
    out.kv([
      ['a', '1'],
      ['long', '2'],
    ])
    out.warn('careful')
    out.json({ ignored: true })
    expect(io.out.join('')).toBe('x\na     1\nlong  2\n')
    expect(io.err).toEqual(['warning: careful\n'])
  })

  it('respects quiet', () => {
    const { io, out } = make('human', true)
    out.success('x')
    out.warn('y')
    out.note('z')
    expect(io.out).toEqual([])
    expect(io.err).toEqual([])
  })
})

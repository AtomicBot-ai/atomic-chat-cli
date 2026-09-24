import { describe, expect, it } from 'vitest'
import { recordingIo } from './io.js'

describe('recordingIo', () => {
  it('records both streams separately and answers questions from its script', async () => {
    const io = recordingIo({ answers: ['yes'] })
    io.stdout('a')
    io.stderr('b')
    expect(io.out).toEqual(['a'])
    expect(io.err).toEqual(['b'])
    expect(await io.question('?')).toBe('yes')
    expect(await io.question('?')).toBe('')
    expect(io.isTTY.stdin).toBe(false)
  })

  it('lets a test override any facet', () => {
    const io = recordingIo({ env: { HOME: '/x' }, columns: 40 })
    expect(io.env['HOME']).toBe('/x')
    expect(io.columns).toBe(40)
  })
})

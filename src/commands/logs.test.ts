import { describe, expect, it } from 'vitest'
import { tailLines } from './logs.js'

describe('tailLines', () => {
  it('returns the last lines without a trailing empty one', () => {
    expect(tailLines('a\nb\nc\n', 2)).toEqual(['b', 'c'])
    expect(tailLines('a', 5)).toEqual(['a'])
    expect(tailLines('', 5)).toEqual([])
  })
})

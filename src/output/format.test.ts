import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, formatPercent, formatRate } from './format.js'

describe('format', () => {
  it('formats bytes with binary units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KiB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GiB')
    expect(formatBytes(-1)).toBe('?')
  })
  it('formats durations coarsely', () => {
    expect(formatDuration(5_000)).toBe('5s')
    expect(formatDuration(65_000)).toBe('1m 5s')
    expect(formatDuration(3_700_000)).toBe('1h 1m')
    expect(formatDuration(90_000_000)).toBe('1d 1h')
  })
  it('formats percent and rate defensively', () => {
    expect(formatPercent(50, 200)).toBe('25%')
    expect(formatPercent(5, 0)).toBe('?%')
    expect(formatRate(1024, 1000)).toBe('1.0 KiB/s')
    expect(formatRate(0, 1000)).toBe('?')
  })
})

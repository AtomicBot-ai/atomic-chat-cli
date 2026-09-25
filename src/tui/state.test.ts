import { describe, expect, it } from 'vitest'
import type { TuiAction, TuiState } from './state.js'
import { initialState, MAX_LOG_LINES, reduce, visibleLogLines } from './state.js'

const apply = (state: TuiState, ...actions: TuiAction[]) => actions.reduce(reduce, state)

describe('reduce', () => {
  it('moves between tabs by number and wraps around with tab-step', () => {
    const s = initialState()
    expect(apply(s, { type: 'tab', tab: 'config' }).tab).toBe('config')
    expect(apply(s, { type: 'tab-step', delta: -1 }).tab).toBe('doctor')
    expect(apply(s, { type: 'tab-step', delta: 1 }, { type: 'tab-step', delta: 1 }).tab).toBe('config')
  })

  it('keeps the last 50 activity lines', () => {
    let s = initialState()
    for (let i = 0; i < 60; i += 1)
      s = reduce(s, { type: 'activity', line: { time: i, level: 'info', text: `${i}` } })
    expect(s.activity).toHaveLength(50)
    expect(s.activity[0]?.text).toBe('10')
  })

  it.each([
    ['follows new lines at the end', true, 0, ['c'], 0],
    ['keeps the same lines in view when paused', false, 2, ['c', 'd'], 4],
  ] as const)('logs: %s', (_name, follow, scroll, appended, expected) => {
    const s = apply(initialState(), { type: 'logs-reset', lines: ['a', 'b'] })
    const paused = { ...s, logs: { ...s.logs, follow, scroll } }
    expect(reduce(paused, { type: 'logs-append', lines: [...appended] }).logs.scroll).toBe(expected)
  })

  it('caps the log buffer and clamps scrolling to what the key handler allows', () => {
    const many = Array.from({ length: MAX_LOG_LINES + 10 }, (_, i) => `${i}`)
    let s = apply(initialState(), { type: 'logs-reset', lines: many })
    expect(s.logs.lines).toHaveLength(MAX_LOG_LINES)
    s = apply(s, { type: 'logs-scroll', by: 100, max: 7 })
    expect(s.logs).toMatchObject({ scroll: 7, follow: false })
    s = apply(s, { type: 'logs-scroll-to', to: 'bottom', max: 7 })
    expect(s.logs).toMatchObject({ scroll: 0, follow: true })
    s = apply(s, { type: 'logs-follow' }, { type: 'logs-scroll-to', to: 'top', max: 3 })
    expect(s.logs).toMatchObject({ scroll: 3, follow: false })
    expect(apply(s, { type: 'logs-follow' }).logs).toMatchObject({ scroll: 0, follow: true })
  })

  it('filters log lines case-insensitively', () => {
    expect(visibleLogLines({ lines: ['[WARN] a', '[info] b'], filter: 'warn' })).toEqual(['[WARN] a'])
    expect(visibleLogLines({ lines: ['x'], filter: '' })).toEqual(['x'])
  })

  it('keeps the config cursor on a row and clears the message when it moves', () => {
    const rows = ['a', 'b'].map((path) => ({
      path,
      type: 'string' as const,
      value: '',
      source: 'default' as const,
      description: '',
      values: undefined,
    }))
    let s = apply(
      initialState(),
      { type: 'config-rows', rows, warnings: [] },
      { type: 'config-move', delta: 5 }
    )
    expect(s.config.cursor).toBe(1)
    s = apply(
      s,
      { type: 'config-message', message: { level: 'info', text: 'saved' } },
      { type: 'config-move', delta: -9 }
    )
    expect(s.config).toMatchObject({ cursor: 0, message: undefined })
    expect(apply(s, { type: 'config-rows', rows: [], warnings: ['w'] }).config).toMatchObject({
      cursor: 0,
      warnings: ['w'],
    })
  })

  it('marks doctor as running until results arrive', () => {
    const s = apply(initialState(), { type: 'doctor-running' })
    expect(s.doctor).toEqual({ running: true, results: undefined })
    expect(apply(s, { type: 'doctor-results', results: [] }).doctor).toEqual({ running: false, results: [] })
  })
})

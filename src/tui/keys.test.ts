import type { CoreSnapshot } from '@atomic-chat/core/client'
import type { Key } from 'ink'
import { describe, expect, it } from 'vitest'
import { footerHints, GLOBAL_HINTS, handleKey, HINTS } from './keys.js'
import type { ConfigRow, TuiAction, TuiState } from './state.js'
import { initialState, reduce, TABS } from './state.js'

const NO_KEY: Key = {
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageDown: false,
  pageUp: false,
  home: false,
  end: false,
  return: false,
  escape: false,
  ctrl: false,
  shift: false,
  tab: false,
  backspace: false,
  delete: false,
  meta: false,
  super: false,
  hyper: false,
  capsLock: false,
  numLock: false,
}
const key = (over: Partial<Key> = {}): Key => ({ ...NO_KEY, ...over })
const view = { bodyRows: 10 }
const apply = (state: TuiState, ...actions: TuiAction[]) => actions.reduce(reduce, state)

const up: TuiAction = {
  type: 'daemon',
  daemon: { kind: 'up', snapshot: {} as CoreSnapshot, record: undefined, pending: [] },
}
const down: TuiAction = { type: 'daemon', daemon: { kind: 'down', error: undefined } }
const rows: ConfigRow[] = [
  { path: 'api.port', type: 'number', value: '1337', source: 'default', description: '', values: undefined },
  {
    path: 'serve.engine',
    type: 'enum',
    value: 'b',
    source: 'file',
    description: '',
    values: ['a', 'b', 'c'],
  },
]

describe('the key table', () => {
  it('has a handler behind every hint, in a state where the hint is shown', () => {
    for (const tab of TABS) {
      for (const hint of [...HINTS[tab], ...GLOBAL_HINTS]) {
        const base = apply(
          initialState(tab),
          { type: 'config-rows', rows, warnings: [] },
          {
            type: 'logs-reset',
            lines: Array.from({ length: 40 }, (_, i) => `${i}`),
          }
        )
        const state = [up, down].map((d) => apply(base, d)).find((s) => !hint.when || hint.when(s)) ?? base
        const result = handleKey(hint.probe.input, key(hint.probe.key), state, view)
        expect(
          result.actions.length + (result.command ? 1 : 0),
          `${tab}: ${hint.keys} ${hint.label}`
        ).toBeGreaterThan(0)
      }
    }
  })

  it('keeps the footer short: ←→ in it, 1-4 and tab in the help only', () => {
    const keys = footerHints(initialState()).map((h) => h.keys)
    expect(keys).toContain('←→')
    expect(keys).not.toContain('1-4')
    expect(keys).not.toContain('tab')
  })

  it('leaves ←→ to the config editor and the log filter while they have the keyboard', () => {
    const editing = apply(
      initialState('config'),
      { type: 'config-rows', rows, warnings: [] },
      { type: 'config-edit', editing: { key: 'api.port', draft: '1' } }
    )
    expect(handleKey('', key({ leftArrow: true }), editing, view)).toEqual({ actions: [] })
    const filtering = apply(initialState('logs'), { type: 'logs-filter', filter: 'x', filtering: true })
    expect(handleKey('', key({ rightArrow: true }), filtering, view)).toEqual({ actions: [] })
  })

  it('shows start only while the daemon is down, stop/restart/admin only while it is up', () => {
    const labels = (s: TuiState) => footerHints(s).map((h) => h.keys)
    expect(labels(apply(initialState(), down))).toContain('s')
    expect(labels(apply(initialState(), down))).not.toContain('S')
    expect(labels(apply(initialState(), up))).toEqual(expect.arrayContaining(['S', 'R', 'a']))
    expect(labels(apply(initialState(), up))).not.toContain('s')
  })
})

describe('handleKey', () => {
  it.each([
    ['q quits', 'q', {}, { command: { name: 'quit' } }],
    ['Esc quits with nothing to undo', '', { escape: true }, { command: { name: 'quit' } }],
    ['3 opens Config', '3', {}, { actions: [{ type: 'tab', tab: 'config' }] }],
    ['shift+tab goes back', '', { tab: true, shift: true }, { actions: [{ type: 'tab-step', delta: -1 }] }],
    ['→ goes to the next screen', '', { rightArrow: true }, { actions: [{ type: 'tab-step', delta: 1 }] }],
    ['← goes to the previous one', '', { leftArrow: true }, { actions: [{ type: 'tab-step', delta: -1 }] }],
    ['? opens help', '?', {}, { actions: [{ type: 'overlay', overlay: { kind: 'help' } }] }],
    [
      'S asks before stopping',
      'S',
      {},
      { actions: [{ type: 'overlay', overlay: { kind: 'confirm', action: 'stop' } }] },
    ],
    ['s does nothing while up', 's', {}, { actions: [] }],
  ] as const)('%s', (_name, input, k, expected) => {
    expect(handleKey(input, key(k), apply(initialState(), up), view)).toMatchObject(expected)
  })

  it('answers a confirmation with the command, and n or Esc closes it', () => {
    const asking = apply(initialState(), up, {
      type: 'overlay',
      overlay: { kind: 'confirm', action: 'restart' },
    })
    expect(handleKey('y', key(), asking, view)).toEqual({
      actions: [{ type: 'overlay', overlay: undefined }],
      command: { name: 'restart' },
    })
    expect(handleKey('n', key(), asking, view).command).toBeUndefined()
    expect(handleKey('', key({ escape: true }), asking, view).actions).toEqual([
      { type: 'overlay', overlay: undefined },
    ])
    expect(handleKey('q', key(), asking, view).command).toBeUndefined()
  })

  it('opens the admin link in a browser only when there is one', () => {
    const withUrl = apply(initialState(), {
      type: 'overlay',
      overlay: { kind: 'admin-link', url: 'http://x/#t', error: undefined },
    })
    expect(handleKey('o', key(), withUrl, view).command).toEqual({ name: 'open-url', url: 'http://x/#t' })
    const withError = apply(initialState(), {
      type: 'overlay',
      overlay: { kind: 'admin-link', url: undefined, error: 'no admin' },
    })
    expect(handleKey('o', key(), withError, view)).toEqual({ actions: [] })
  })

  it('types into the config editor, and Enter saves the draft', () => {
    let s = apply(initialState('config'), { type: 'config-rows', rows, warnings: [] })
    const open = handleKey('', key({ return: true }), s, view)
    expect(open.actions).toEqual([{ type: 'config-edit', editing: { key: 'api.port', draft: '1337' } }])
    s = apply(s, ...open.actions)
    s = apply(s, ...handleKey('', key({ backspace: true }), s, view).actions)
    s = apply(s, ...handleKey('9', key(), s, view).actions)
    expect(s.config.editing?.draft).toBe('1339')
    expect(handleKey('q', key(), s, view).command).toBeUndefined()
    expect(handleKey('', key({ return: true }), s, view).command).toEqual({
      name: 'config-set',
      key: 'api.port',
      raw: '1339',
    })
    expect(handleKey('u', key({ ctrl: true }), s, view).actions).toEqual([
      { type: 'config-edit', editing: { key: 'api.port', draft: '' } },
    ])
  })

  it('moves an enum to its next value at once and resets with u', () => {
    const s = apply(
      initialState('config'),
      { type: 'config-rows', rows, warnings: [] },
      { type: 'config-move', delta: 1 }
    )
    expect(handleKey('', key({ return: true }), s, view).command).toEqual({
      name: 'config-set',
      key: 'serve.engine',
      raw: 'c',
    })
    expect(handleKey('u', key(), s, view).command).toEqual({ name: 'config-unset', key: 'serve.engine' })
  })

  it('pages the log by the rows that fit and never scrolls past the first line', () => {
    const s = apply(initialState('logs'), {
      type: 'logs-reset',
      lines: Array.from({ length: 30 }, (_, i) => `${i}`),
    })
    expect(handleKey('', key({ pageUp: true }), s, view).actions).toEqual([
      { type: 'logs-scroll', by: 8, max: 21 },
    ])
    expect(handleKey('g', key(), s, view).actions).toEqual([{ type: 'logs-scroll-to', to: 'top', max: 21 }])
  })

  it('types a log filter; Esc clears it before it would quit', () => {
    let s = apply(initialState('logs'), ...handleKey('/', key(), initialState('logs'), view).actions)
    s = apply(s, ...handleKey('er', key(), s, view).actions)
    expect(s.logs).toMatchObject({ filter: 'er', filtering: true })
    s = apply(s, ...handleKey('', key({ return: true }), s, view).actions)
    expect(s.logs).toMatchObject({ filter: 'er', filtering: false })
    expect(handleKey('', key({ escape: true }), s, view)).toEqual({
      actions: [{ type: 'logs-filter', filter: '', filtering: false }],
    })
  })
})

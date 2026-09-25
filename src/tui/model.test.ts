import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../config/index.js'
import { configRows, describeEdit, editFor, formatConfigValue, logLevelOf } from './model.js'
import { computeRowWindow } from './row-window.js'
import type { ConfigRow } from './state.js'

describe('config rows', () => {
  it('lists every field with its effective value and source', () => {
    const rows = configRows(
      resolveConfig({ fileText: '{"api":{"port":2000}}', env: { ATC_API_HOST: '0.0.0.0' } })
    )
    expect(rows.find((r) => r.path === 'api.port')).toMatchObject({ value: '2000', source: 'file' })
    expect(rows.find((r) => r.path === 'api.host')).toMatchObject({ value: '0.0.0.0', source: 'env' })
    expect(rows.find((r) => r.path === 'api.trustedHosts')).toMatchObject({ value: '', source: 'default' })
  })

  it.each([
    [undefined, ''],
    [['a', 'b'], 'a,b'],
    [{ a: 1 }, '{"a":1}'],
    [1337, '1337'],
  ])('formats %j as %j', (value, text) => expect(formatConfigValue(value)).toBe(text))

  const row = (over: Partial<ConfigRow>): ConfigRow => ({
    path: 'k',
    type: 'string',
    value: 'x',
    source: 'default',
    description: '',
    values: undefined,
    ...over,
  })
  it.each([
    ['flips a boolean', row({ type: 'boolean', value: 'true' }), { set: 'false' }],
    ['moves an enum on, wrapping', row({ type: 'enum', value: 'c', values: ['a', 'b', 'c'] }), { set: 'a' }],
    ['edits a number as text', row({ type: 'number', value: '1337' }), { edit: '1337' }],
    ['edits a list as a comma list', row({ type: 'string[]', value: 'a,b' }), { edit: 'a,b' }],
  ])('Enter %s', (_name, r, expected) => expect(editFor(r)).toEqual(expected))
})

describe('helpers', () => {
  it.each([
    ['[warn] atc: slow', 'warn'],
    ['[error] boom', 'error'],
    ['[debug] x', 'debug'],
    ['{"ready":true}', undefined],
  ])('the level of %j is %j', (line, level) => expect(logLevelOf(line)).toBe(level))

  it('describes a saved edit', () => {
    expect(describeEdit('api.port', 1338)).toBe('api.port = 1338')
    expect(describeEdit('serve.model', undefined)).toBe('serve.model = null')
  })

  it.each([
    [0, 0, 5, { start: 0, count: 0, hiddenBefore: 0, hiddenAfter: 0 }],
    [3, 2, 5, { start: 0, count: 3, hiddenBefore: 0, hiddenAfter: 0 }],
    [10, 2, 5, { start: 0, count: 5, hiddenBefore: 0, hiddenAfter: 5 }],
    [10, 7, 5, { start: 3, count: 5, hiddenBefore: 3, hiddenAfter: 2 }],
    [10, 99, 5, { start: 5, count: 5, hiddenBefore: 5, hiddenAfter: 0 }],
  ])('computeRowWindow(%i rows, cursor %i, %i high)', (total, cursor, max, expected) =>
    expect(computeRowWindow(total, cursor, max)).toEqual(expected)
  )
})

/** Pure derivations for the screens: config rows, the edit a key press means, log colouring. */

import { FIELDS, getAt } from '../config/index.js'
import type { ResolvedConfig } from '../config/index.js'
import type { ConfigRow, Level } from './state.js'

/** A value the way `atc config get` prints it; lists as the comma list `config set` accepts. */
export function formatConfigValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(',')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function configRows(resolved: ResolvedConfig): ConfigRow[] {
  return FIELDS.map((field) => ({
    path: field.path,
    type: field.type,
    value: formatConfigValue(getAt(resolved.values, field.path)),
    source: resolved.sources[field.path] ?? 'default',
    description: field.description,
    values: field.values,
  }))
}

/**
 * What Enter on a row does: a boolean flips and an enum moves to its next value at once (the text
 * handed to `config set`); anything else opens the inline editor on the current text.
 */
export function editFor(row: ConfigRow): { set: string } | { edit: string } {
  if (row.type === 'boolean') return { set: row.value === 'true' ? 'false' : 'true' }
  if (row.type === 'enum' && row.values && row.values.length > 0) {
    const next = (row.values.indexOf(row.value) + 1) % row.values.length
    return { set: row.values[next] as string }
  }
  return { edit: row.value }
}

/** The level of a daemon log line (`[warn] scope: …`), for its colour. */
export function logLevelOf(line: string): Level | 'debug' | undefined {
  const match = /^\[(debug|info|warn|error)\]/.exec(line)
  if (!match) return undefined
  return match[1] as Level | 'debug'
}

/** `api.port = 1338`: the one-line summary of a saved change. */
export function describeEdit(key: string, value: unknown): string {
  return `${key} = ${JSON.stringify(value ?? null)}`
}

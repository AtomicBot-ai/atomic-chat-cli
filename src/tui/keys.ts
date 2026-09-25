/**
 * Every key the terminal UI answers to, in one table (`HINTS`) that the footer and the help screen
 * render from, and `handleKey`, which turns a press into state actions and at most one command for
 * the controller. Pure; a test proves every hint in the table does something.
 */

import type { Key } from 'ink'
import { editFor } from './model.js'
import type { ConfirmAction, TabId, TuiAction, TuiState } from './state.js'
import { TABS, visibleLogLines } from './state.js'

export type TuiCommand =
  | { name: 'quit' }
  | { name: 'start' }
  | { name: 'stop' }
  | { name: 'restart' }
  | { name: 'refresh' }
  | { name: 'admin-link' }
  | { name: 'open-url'; url: string }
  | { name: 'config-set'; key: string; raw: string }
  | { name: 'config-unset'; key: string }
  | { name: 'doctor' }

export interface KeyResult {
  actions: TuiAction[]
  command?: TuiCommand
}

/** What the handler needs to know about the layout: how many rows the screen body has. */
export interface KeyView {
  bodyRows: number
}

/** Log lines that fit under the Logs screen's status line. */
export const logRows = (view: KeyView) => Math.max(1, view.bodyRows - 1)

export interface KeyHint {
  keys: string
  label: string
  /** A press that triggers it, for the test that keeps this table honest. */
  probe: { input: string; key?: Partial<Key> }
  /** Shown in the footer only when this holds. */
  when?: (state: TuiState) => boolean
  /** Listed in the help only, to keep the footer short. */
  helpOnly?: true
}

const up = (s: TuiState) => s.daemon.kind === 'up'
const down = (s: TuiState) => s.daemon.kind === 'down'

export const GLOBAL_HINTS: KeyHint[] = [
  { keys: '←→', label: 'screens', probe: { input: '', key: { rightArrow: true } } },
  { keys: '1-4', label: 'jump to', probe: { input: '2' }, helpOnly: true },
  { keys: 'tab', label: 'next', probe: { input: '', key: { tab: true } }, helpOnly: true },
  { keys: '?', label: 'help', probe: { input: '?' } },
  { keys: 'q', label: 'quit', probe: { input: 'q' } },
]

export const HINTS: Record<TabId, KeyHint[]> = {
  overview: [
    { keys: 's', label: 'start daemon', probe: { input: 's' }, when: down },
    { keys: 'S', label: 'stop', probe: { input: 'S' }, when: up },
    { keys: 'R', label: 'restart', probe: { input: 'R' }, when: up },
    { keys: 'a', label: 'admin link', probe: { input: 'a' }, when: up },
    { keys: 'r', label: 'refresh', probe: { input: 'r' } },
  ],
  logs: [
    { keys: '↑↓', label: 'scroll', probe: { input: '', key: { upArrow: true } } },
    { keys: 'PgUp/PgDn', label: 'page', probe: { input: '', key: { pageUp: true } } },
    { keys: 'g/G', label: 'top/end', probe: { input: 'g' } },
    { keys: 'f', label: 'follow', probe: { input: 'f' } },
    { keys: '/', label: 'filter', probe: { input: '/' } },
  ],
  config: [
    { keys: '↑↓', label: 'move', probe: { input: '', key: { downArrow: true } } },
    { keys: '⏎', label: 'change', probe: { input: '', key: { return: true } } },
    { keys: 'u', label: 'reset to default', probe: { input: 'u' } },
  ],
  doctor: [{ keys: 'r', label: 'run again', probe: { input: 'r' } }],
}

export function footerHints(state: TuiState): KeyHint[] {
  return [...HINTS[state.tab], ...GLOBAL_HINTS].filter((h) => !h.helpOnly && (!h.when || h.when(state)))
}

const none: KeyResult = { actions: [] }
const act = (...actions: TuiAction[]): KeyResult => ({ actions })
const run = (command: TuiCommand, ...actions: TuiAction[]): KeyResult => ({ actions, command })
const confirm = (action: ConfirmAction) => act({ type: 'overlay', overlay: { kind: 'confirm', action } })
const isBackspace = (key: Key) => key.backspace || key.delete
const isText = (input: string, key: Key) => input.length > 0 && !key.ctrl && !key.meta && !key.escape

function overlayKey(input: string, key: Key, state: TuiState): KeyResult {
  const overlay = state.overlay
  const close = act({ type: 'overlay', overlay: undefined })
  if (!overlay) return none
  if (overlay.kind === 'confirm') {
    if (input === 'y' || input === 'Y')
      return run({ name: overlay.action }, { type: 'overlay', overlay: undefined })
    if (input === 'n' || input === 'N' || key.escape || input === 'q') return close
    return none
  }
  if (overlay.kind === 'admin-link' && input === 'o' && overlay.url)
    return run({ name: 'open-url', url: overlay.url }, { type: 'overlay', overlay: undefined })
  if (key.escape || key.return || input === 'q' || input === '?') return close
  return none
}

function editKey(input: string, key: Key, state: TuiState): KeyResult {
  const editing = state.config.editing
  if (!editing) return none
  if (key.escape) return act({ type: 'config-edit', editing: undefined })
  if (key.return)
    return run(
      { name: 'config-set', key: editing.key, raw: editing.draft },
      { type: 'config-edit', editing: undefined }
    )
  if (isBackspace(key))
    return act({ type: 'config-edit', editing: { ...editing, draft: editing.draft.slice(0, -1) } })
  if (key.ctrl && input === 'u') return act({ type: 'config-edit', editing: { ...editing, draft: '' } })
  if (isText(input, key))
    return act({ type: 'config-edit', editing: { ...editing, draft: editing.draft + input } })
  return none
}

function filterKey(input: string, key: Key, state: TuiState): KeyResult {
  const { filter } = state.logs
  if (key.escape) return act({ type: 'logs-filter', filter: '', filtering: false })
  if (key.return) return act({ type: 'logs-filter', filter, filtering: false })
  if (isBackspace(key)) return act({ type: 'logs-filter', filter: filter.slice(0, -1), filtering: true })
  if (isText(input, key)) return act({ type: 'logs-filter', filter: filter + input, filtering: true })
  return none
}

function tabKey(input: string, key: Key, state: TuiState, view: KeyView): KeyResult {
  const page = Math.max(1, logRows(view) - 1)
  switch (state.tab) {
    case 'overview':
      if (input === 's' && down(state)) return run({ name: 'start' })
      if (input === 'S' && up(state)) return confirm('stop')
      if (input === 'R' && up(state)) return confirm('restart')
      if (input === 'a' && up(state)) return run({ name: 'admin-link' })
      if (input === 'r') return run({ name: 'refresh' })
      return none
    case 'logs': {
      const max = Math.max(0, visibleLogLines(state.logs).length - logRows(view))
      if (key.upArrow || input === 'k') return act({ type: 'logs-scroll', by: 1, max })
      if (key.downArrow || input === 'j') return act({ type: 'logs-scroll', by: -1, max })
      if (key.pageUp) return act({ type: 'logs-scroll', by: page, max })
      if (key.pageDown) return act({ type: 'logs-scroll', by: -page, max })
      if (input === 'g' || key.home) return act({ type: 'logs-scroll-to', to: 'top', max })
      if (input === 'G' || key.end) return act({ type: 'logs-scroll-to', to: 'bottom', max })
      if (input === 'f') return act({ type: 'logs-follow' })
      if (input === '/') return act({ type: 'logs-filter', filter: state.logs.filter, filtering: true })
      return none
    }
    case 'config': {
      if (key.upArrow || input === 'k') return act({ type: 'config-move', delta: -1 })
      if (key.downArrow || input === 'j') return act({ type: 'config-move', delta: 1 })
      const row = state.config.rows[state.config.cursor]
      if (!row) return none
      if (key.return) {
        const edit = editFor(row)
        return 'set' in edit
          ? run({ name: 'config-set', key: row.path, raw: edit.set })
          : act({ type: 'config-edit', editing: { key: row.path, draft: edit.edit } })
      }
      if (input === 'u') return run({ name: 'config-unset', key: row.path })
      return none
    }
    case 'doctor':
      return input === 'r' ? run({ name: 'doctor' }) : none
  }
}

export function handleKey(input: string, key: Key, state: TuiState, view: KeyView): KeyResult {
  if (state.overlay) return overlayKey(input, key, state)
  if (state.config.editing && state.tab === 'config') return editKey(input, key, state)
  if (state.logs.filtering && state.tab === 'logs') return filterKey(input, key, state)

  const digit = Number(input)
  if (Number.isInteger(digit) && digit >= 1 && digit <= TABS.length)
    return act({ type: 'tab', tab: TABS[digit - 1] as TabId })
  if (key.tab) return act({ type: 'tab-step', delta: key.shift ? -1 : 1 })
  // ←→ go round the screens; the editors above keep them while they have the keyboard.
  if (key.leftArrow) return act({ type: 'tab-step', delta: -1 })
  if (key.rightArrow) return act({ type: 'tab-step', delta: 1 })
  if (input === '?') return act({ type: 'overlay', overlay: { kind: 'help' } })
  if (input === 'q') return run({ name: 'quit' })
  if (key.escape) {
    // Esc first undoes what is on screen (a log filter); with nothing to undo, it leaves.
    if (state.tab === 'logs' && state.logs.filter !== '')
      return act({ type: 'logs-filter', filter: '', filtering: false })
    return run({ name: 'quit' })
  }
  return tabKey(input, key, state, view)
}

/** The daemon log: its tail, following new lines, with a filter. */

import { Box, Text } from 'ink'
import { logLevelOf } from '../model.js'
import type { LogsState } from '../state.js'
import { visibleLogLines } from '../state.js'
import type { Role } from '../theme.js'
import { useTone } from '../theme.js'

const LEVEL_ROLES: Record<string, Role | undefined> = { error: 'error', warn: 'warn', debug: 'muted' }

/** The slice of `lines` that fits `rows`, `scroll` lines up from the end (clamped). */
export function logWindow(lines: string[], scroll: number, rows: number): { start: number; end: number } {
  const size = Math.max(1, rows)
  const top = Math.max(0, lines.length - size)
  const offset = Math.min(Math.max(0, scroll), top)
  const end = lines.length - offset
  return { start: Math.max(0, end - size), end }
}

export function LogsScreen({ logs, path, height }: { logs: LogsState; path: string; height: number }) {
  const tone = useTone()
  const visible = visibleLogLines(logs)
  const rows = Math.max(1, height - 1 - (logs.filtering ? 1 : 0))
  const { start, end } = logWindow(visible, logs.scroll, rows)
  const status = [
    logs.follow
      ? 'following'
      : `paused${end < visible.length ? ` · ${visible.length - end} newer below` : ''}`,
    logs.filter ? `filter "${logs.filter}" · ${visible.length} of ${logs.lines.length} lines` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end" {...tone('muted')}>{`${path} · ${status}`}</Text>
      {visible.length === 0 ? (
        <Text {...tone('muted')}>
          {logs.lines.length === 0
            ? 'the log is empty; the daemon writes it once it runs'
            : 'no line matches the filter'}
        </Text>
      ) : (
        visible.slice(start, end).map((line, i) => {
          const role = LEVEL_ROLES[logLevelOf(line) ?? '']
          return (
            <Text key={start + i} wrap="truncate-end" {...(role ? tone(role) : {})}>
              {line === '' ? ' ' : line}
            </Text>
          )
        })
      )}
      {logs.filtering ? (
        <Text>
          <Text bold {...tone('accent')}>
            /
          </Text>
          {` ${logs.filter}`}
          <Text inverse> </Text>
          <Text {...tone('muted')}> ⏎ keep · esc clear</Text>
        </Text>
      ) : null}
    </Box>
  )
}

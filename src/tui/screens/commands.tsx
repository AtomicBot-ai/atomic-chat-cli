/**
 * Every command, grouped as in `atc --help`, with whether it works yet; Enter shows a command's full
 * help, the same text `atc <command> --help` prints. The screen runs nothing: commands run in a shell.
 */

import { Box, Text } from 'ink'
import type { CommandRow } from '../command-list.js'
import { helpLines } from '../command-list.js'
import { computeRowWindow } from '../row-window.js'
import type { CommandsState } from '../state.js'
import { useTone } from '../theme.js'

/** Wide enough for "iteration 2" and a space before it. */
const STATUS_WIDTH = 12

type Line = { kind: 'heading'; text: string } | { kind: 'command'; row: CommandRow; index: number }

function linesOf(rows: CommandRow[]): Line[] {
  const out: Line[] = []
  rows.forEach((row, index) => {
    if (row.depth === 0 && (index === 0 || rows[index - 1]?.group !== row.group))
      out.push({ kind: 'heading', text: row.group })
    out.push({ kind: 'command', row, index })
  })
  return out
}

function Help({
  row,
  state,
  width,
  height,
}: {
  row: CommandRow
  state: CommandsState
  width: number
  height: number
}) {
  const tone = useTone()
  const lines = helpLines(row, width)
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end" {...tone('muted')}>
        {`atc ${row.path.join(' ')} --help · ${row.status} · esc back`}
      </Text>
      {lines.slice(state.scroll, state.scroll + height - 1).map((line, i) => (
        <Text key={state.scroll + i} wrap="truncate-end">
          {line === '' ? ' ' : line}
        </Text>
      ))}
    </Box>
  )
}

export function CommandsScreen({
  rows,
  state,
  width,
  height,
}: {
  rows: CommandRow[]
  state: CommandsState
  width: number
  height: number
}) {
  const tone = useTone()
  const current = rows[state.cursor]
  if (state.open && current) return <Help row={current} state={state} width={width} height={height} />
  const lines = linesOf(rows)
  const at = lines.findIndex((l) => l.kind === 'command' && l.index === state.cursor)
  // One line under the list: the selected command's run hint.
  const window = computeRowWindow(lines.length, Math.max(0, at), height - 1)
  const nameWidth = Math.max(...rows.map((r) => r.path.join(' ').length + r.depth * 2))
  return (
    <Box flexDirection="column">
      {lines.slice(window.start, window.start + window.count).map((line, i) => {
        if (line.kind === 'heading')
          return (
            <Text key={`h${window.start + i}`} bold>
              {line.text}
            </Text>
          )
        const { row, index } = line
        const selected = index === state.cursor
        const name = `${'  '.repeat(row.depth)}${row.path.join(' ')}`
        const status = row.status === 'works' ? 'ok' : row.status === 'group' ? 'muted' : 'warn'
        // Fixed name and status columns; only the summary gives way (flex items shrink by default).
        return (
          <Box key={row.path.join(' ')}>
            <Box width={nameWidth + 2} flexShrink={0}>
              <Text inverse={selected}>{`${selected ? '›' : ' '} ${name}`.padEnd(nameWidth + 2)}</Text>
            </Box>
            <Box flexGrow={1} flexShrink={1} marginLeft={1}>
              <Text wrap="truncate-end">{row.spec.summary}</Text>
            </Box>
            <Box width={STATUS_WIDTH} flexShrink={0} justifyContent="flex-end">
              <Text {...tone(status)}>{row.status}</Text>
            </Box>
          </Box>
        )
      })}
      <Text wrap="truncate-end" {...tone('muted')}>
        {current ? `run it in a shell: atc ${current.path.join(' ')}  ·  ⏎ full help` : ''}
      </Text>
    </Box>
  )
}

/** Every config field with its value and where it comes from; Enter changes one, `u` resets it. */

import { Box, Text } from 'ink'
import { computeRowWindow } from '../row-window.js'
import type { ConfigRow, ConfigState } from '../state.js'
import type { Role } from '../theme.js'
import { useTone } from '../theme.js'

const SOURCE_ROLES: Record<ConfigRow['source'], Role> = {
  default: 'muted',
  file: 'accent',
  env: 'warn',
  flag: 'warn',
}

function RowLine({
  row,
  selected,
  draft,
  keyWidth,
  valueWidth,
}: {
  row: ConfigRow
  selected: boolean
  draft: string | undefined
  keyWidth: number
  valueWidth: number
}) {
  const tone = useTone()
  const value = row.value === '' ? '—' : row.value
  const shown = value.length > valueWidth ? `${value.slice(0, Math.max(1, valueWidth - 1))}…` : value
  return (
    <Box>
      <Text
        inverse={selected && draft === undefined}
      >{`${selected ? '›' : ' '} ${row.path.padEnd(keyWidth)}`}</Text>
      {draft !== undefined ? (
        <Text>
          {' '}
          {draft}
          <Text inverse> </Text>
        </Text>
      ) : (
        <>
          <Text>{` ${shown.padEnd(valueWidth)} `}</Text>
          <Text {...tone(SOURCE_ROLES[row.source])}>{row.source}</Text>
        </>
      )}
    </Box>
  )
}

export function ConfigScreen({
  config,
  width,
  height,
}: {
  config: ConfigState
  width: number
  height: number
}) {
  const tone = useTone()
  const { rows, cursor, editing, message, warnings } = config
  if (rows.length === 0) return <Text {...tone('muted')}>reading the config…</Text>
  const keyWidth = Math.max(...rows.map((r) => r.path.length))
  const valueWidth = Math.max(8, width - keyWidth - 16)
  // Two lines under the list: the field's description and the last message.
  const window = computeRowWindow(rows.length, cursor, height - 2 - (warnings.length > 0 ? 1 : 0))
  const current = rows[cursor]
  return (
    <Box flexDirection="column">
      {rows.slice(window.start, window.start + window.count).map((row, i) => {
        const index = window.start + i
        return (
          <RowLine
            key={row.path}
            row={row}
            selected={index === cursor}
            draft={editing && editing.key === row.path ? editing.draft : undefined}
            keyWidth={keyWidth}
            valueWidth={valueWidth}
          />
        )
      })}
      <Text wrap="truncate-end" {...tone('muted')}>
        {editing
          ? '⏎ save · esc cancel · lists are comma-separated'
          : current
            ? `${current.description}${current.values ? ` (${current.values.join(', ')})` : ''}${
                current.source === 'env' ? ' — set by an environment variable' : ''
              }`
            : ''}
      </Text>
      {message ? (
        <Text wrap="truncate-end" {...tone(message.level === 'info' ? 'ok' : message.level)}>
          {message.text}
        </Text>
      ) : (
        <Text> </Text>
      )}
      {warnings.length > 0 ? (
        <Text wrap="truncate-end" {...tone('warn')}>
          {warnings.join('; ')}
        </Text>
      ) : null}
    </Box>
  )
}

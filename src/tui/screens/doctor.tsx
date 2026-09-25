/** `atc doctor` on a screen: the same checks, marks and hints. */

import { Box, Text } from 'ink'
import type { CheckStatus } from '../../doctor/index.js'
import { Spinner } from '../components/index.js'
import type { DoctorState } from '../state.js'
import type { Role } from '../theme.js'
import { useTone } from '../theme.js'

const MARKS: Record<CheckStatus, { text: string; role: Role }> = {
  ok: { text: 'ok  ', role: 'ok' },
  warn: { text: 'warn', role: 'warn' },
  fail: { text: 'FAIL', role: 'error' },
  skip: { text: 'skip', role: 'muted' },
}

export function DoctorScreen({ doctor, height }: { doctor: DoctorState; height: number }) {
  const tone = useTone()
  if (!doctor.results)
    return (
      <Text>
        <Spinner /> running the checks…
      </Text>
    )
  // Hints only when every check still fits with them; the marks and messages come first.
  const hints = doctor.results.length + doctor.results.filter((r) => r.hint).length <= height - 1
  const lines = doctor.results.flatMap((r) => {
    const mark = MARKS[r.status]
    const head = (
      <Text key={r.id} wrap="truncate-end">
        <Text {...tone(mark.role)}>{mark.text}</Text>
        {`  ${r.title}: ${r.message}`}
      </Text>
    )
    return r.hint && hints
      ? [
          head,
          <Text key={`${r.id}-hint`} wrap="truncate-end" {...tone('muted')}>
            {`      → ${r.hint}`}
          </Text>,
        ]
      : [head]
  })
  return (
    <Box flexDirection="column">
      {lines.slice(0, Math.max(1, height - 1))}
      {doctor.running ? (
        <Text>
          <Spinner /> running again…
        </Text>
      ) : null}
    </Box>
  )
}

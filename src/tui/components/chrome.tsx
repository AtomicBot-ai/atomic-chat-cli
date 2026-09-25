/** The frame around every screen: header, tab bar, status line and the key footer. */

import { Box, Text, useAnimation } from 'ink'
import { formatDuration } from '../../output/index.js'
import { ATC_VERSION, CORE_VERSION } from '../../version.js'
import type { KeyHint } from '../keys.js'
import { MARK, PRODUCT_NAME } from './brand.js'
import type { ActivityLine, TabId, TuiState } from '../state.js'
import { TAB_TITLES, TABS } from '../state.js'
import { useTone } from '../theme.js'

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function Spinner() {
  const { frame } = useAnimation({ interval: 80 })
  const tone = useTone()
  return <Text {...tone('accent')}>{SPINNER[frame % SPINNER.length]}</Text>
}

function daemonSummary(state: TuiState, now: number): string {
  const daemon = state.daemon
  if (daemon.kind === 'connecting') return 'connecting'
  if (daemon.kind === 'down') return 'daemon stopped'
  const startedAt = daemon.record?.started_at
  return startedAt === undefined ? 'daemon up' : `daemon up ${formatDuration(now - startedAt)}`
}

export function Header({ state, now, width }: { state: TuiState; now: number; width: number }) {
  const tone = useTone()
  const core = state.daemon.kind === 'up' ? state.daemon.snapshot.version : CORE_VERSION
  return (
    <Box width={width} justifyContent="space-between">
      <Text wrap="truncate-end">
        <Text bold>{`${MARK} ${PRODUCT_NAME}`}</Text>
        <Text {...tone('muted')}>{` · atc ${ATC_VERSION} · core ${core} · `}</Text>
        <Text {...tone(state.daemon.kind === 'up' ? 'ok' : 'muted')}>{daemonSummary(state, now)}</Text>
      </Text>
      {width >= 80 ? <Text {...tone('muted')}>? help q quit</Text> : null}
    </Box>
  )
}

export function TabBar({ tab }: { tab: TabId }) {
  const tone = useTone()
  return (
    <Box>
      {TABS.map((id, index) => (
        <Box key={id} marginRight={1}>
          {id === tab ? (
            <Text inverse bold {...tone('accent')}>{` ${index + 1} ${TAB_TITLES[id]} `}</Text>
          ) : (
            <Text {...tone('muted')}>{` ${index + 1} ${TAB_TITLES[id]} `}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}

function clock(time: number): string {
  const d = new Date(time)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function StatusLine({ busy, last }: { busy: string | undefined; last: ActivityLine | undefined }) {
  const tone = useTone()
  if (busy)
    return (
      <Text wrap="truncate-end">
        <Spinner /> {busy}…
      </Text>
    )
  if (!last) return <Text> </Text>
  const role = last.level === 'info' ? 'muted' : last.level
  return (
    <Text wrap="truncate-end" {...tone(role)}>
      {`${clock(last.time)} ${last.text}`}
    </Text>
  )
}

export function Footer({ hints, width }: { hints: KeyHint[]; width: number }) {
  const tone = useTone()
  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        {hints.map((hint, index) => (
          <Text key={hint.keys + hint.label}>
            {index > 0 ? '  ' : ''}
            <Text bold {...tone('accent')}>
              {hint.keys}
            </Text>
            <Text {...tone('muted')}>{` ${hint.label}`}</Text>
          </Text>
        ))}
      </Text>
    </Box>
  )
}

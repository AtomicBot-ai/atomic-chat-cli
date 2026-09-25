/**
 * Who this is: the Atomic Chat logo in half blocks and the product's name, as a welcome box on the
 * Overview (the way Claude Code greets you) and as one line in the header everywhere else.
 */

import { Box, Text } from 'ink'
import { formatDuration } from '../../output/index.js'
import { ATC_VERSION, CORE_VERSION } from '../../version.js'
import type { DaemonView } from '../state.js'
import type { Role } from '../theme.js'
import { useTone } from '../theme.js'

export const PRODUCT_NAME = 'Atomic Server'
export const TAGLINE = 'Local models behind an OpenAI-compatible API'
/** The logo in one character, for the compact header. */
export const MARK = '✳'

/** A run of logo cells; `bar` marks the "/" bar that lies on top of the others in the real logo. */
type Piece = readonly [text: string, bar?: true]

/**
 * `Atomic-Chat/web-app/public/images/atomic-chat-logo.png`, thinned and sampled to 16×8 half blocks.
 * The "/" bar is painted brighter than the other three, as it sits above them in the 3D mark.
 */
export const LOGO: readonly (readonly Piece[])[] = [
  [['       ▄▄']],
  [['  ▄█▄  ██  '], ['▄█▄', true]],
  [['   ▀█████'], ['███▀', true]],
  [[' ▄▄▄███'], ['█████', true], ['▄▄▄']],
  [[' ▀▀▀█'], ['████', true], ['███▀▀▀']],
  [['   '], ['▄████', true], ['████▄']],
  [['  '], ['▀█▀', true], ['  ██  ▀█▀']],
  [['       ▀▀']],
]
export const LOGO_WIDTH = 16

/** Rows the welcome box takes: the logo and its two borders. */
export const WELCOME_ROWS = LOGO.length + 2

export function Logo() {
  const tone = useTone()
  return (
    <Box flexDirection="column" width={LOGO_WIDTH} flexShrink={0}>
      {LOGO.map((row, i) => (
        <Text key={i}>
          {row.map(([text, bar], j) =>
            bar ? (
              <Text key={j} bold>
                {text}
              </Text>
            ) : (
              <Text key={j} {...tone('muted')}>
                {text}
              </Text>
            )
          )}
        </Text>
      ))}
    </Box>
  )
}

function daemonLine(daemon: DaemonView, now: number): { mark: string; role: Role; text: string } {
  if (daemon.kind === 'connecting') return { mark: '○', role: 'muted', text: 'connecting to the daemon…' }
  if (daemon.kind === 'down') return { mark: '○', role: 'muted', text: 'daemon stopped' }
  const started = daemon.record?.started_at
  const api = daemon.snapshot.server
  return {
    mark: '●',
    role: 'ok',
    text: [
      started === undefined ? 'daemon up' : `daemon up ${formatDuration(now - started)}`,
      api.running ? `API http://${api.host}:${api.port}${api.prefix}` : 'API stopped',
    ].join(' · '),
  }
}

function Key({ name, label }: { name: string; label: string }) {
  const tone = useTone()
  return (
    <>
      <Text bold {...tone('accent')}>
        {name}
      </Text>
      <Text {...tone('muted')}>{` ${label}  `}</Text>
    </>
  )
}

export function WelcomeBox({
  daemon,
  dataFolder,
  now,
  width,
}: {
  daemon: DaemonView
  dataFolder: string
  now: number
  width: number
}) {
  const tone = useTone()
  const core = daemon.kind === 'up' ? daemon.snapshot.version : CORE_VERSION
  const line = daemonLine(daemon, now)
  const border = tone('muted').color
  return (
    <Box
      borderStyle="round"
      {...(border ? { borderColor: border } : {})}
      paddingX={1}
      width={width}
      flexShrink={0}
    >
      <Logo />
      <Box flexDirection="column" marginLeft={4} flexGrow={1}>
        <Text> </Text>
        <Text bold>{PRODUCT_NAME}</Text>
        <Text {...tone('muted')} wrap="truncate-end">
          {TAGLINE}
        </Text>
        <Text> </Text>
        <Text wrap="truncate-end">{`atc ${ATC_VERSION} · core ${core}`}</Text>
        <Text wrap="truncate-end">
          <Text {...tone(line.role)}>{line.mark}</Text> {line.text}
        </Text>
        <Text {...tone('muted')} wrap="truncate-end">{`data ${dataFolder}`}</Text>
        <Text wrap="truncate-end">
          {daemon.kind === 'down' ? <Key name="s" label="start the daemon" /> : null}
          {daemon.kind === 'up' ? <Key name="a" label="web admin" /> : null}
          <Key name="?" label="keys" />
          <Key name="q" label="quit" />
        </Text>
      </Box>
    </Box>
  )
}

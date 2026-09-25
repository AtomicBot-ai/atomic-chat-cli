/** What covers a screen for a moment: the key help, a yes/no question, the admin login link. */

import { Box, Text } from 'ink'
import type { KeyHint } from '../keys.js'
import { GLOBAL_HINTS, HINTS } from '../keys.js'
import type { ConfirmAction, Overlay } from '../state.js'
import { TAB_TITLES, TABS } from '../state.js'
import { useTone } from '../theme.js'

function HintLine({ title, hints }: { title: string; hints: KeyHint[] }) {
  const tone = useTone()
  return (
    <Text wrap="truncate-end">
      <Text bold>{title.padEnd(10)}</Text>
      {hints.map((h, i) => (
        <Text key={h.keys + h.label}>
          {i > 0 ? '  ' : ''}
          <Text {...tone('accent')}>{h.keys}</Text> {h.label}
        </Text>
      ))}
    </Text>
  )
}

/** Fits the nine lines a screen keeps under the welcome box on a 24-row terminal. */
export function HelpOverlay() {
  const tone = useTone()
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">
        <Text bold>Keys</Text>
        <Text {...tone('muted')}> · esc or ? closes · q leaves, the daemon keeps running</Text>
      </Text>
      <HintLine title="Anywhere" hints={GLOBAL_HINTS} />
      {TABS.map((tab) => (
        <HintLine key={tab} title={TAB_TITLES[tab]} hints={HINTS[tab]} />
      ))}
      <Text> </Text>
      <Text {...tone('muted')} wrap="wrap">
        Every action here is also a plain command: atc start, stop, restart, admin, config set, doctor.
      </Text>
    </Box>
  )
}

const QUESTIONS: Record<ConfirmAction, { question: string; detail: string }> = {
  stop: {
    question: 'Stop the daemon?',
    detail: 'It unloads the models and stops the API and the web admin (the same as `atc stop`).',
  },
  restart: {
    question: 'Restart the daemon?',
    detail: 'Models are unloaded and the API goes away for a moment (the same as `atc restart`).',
  },
}

export function ConfirmOverlay({ action }: { action: ConfirmAction }) {
  const tone = useTone()
  const { question, detail } = QUESTIONS[action]
  return (
    <Box flexDirection="column">
      <Text bold {...tone('warn')}>
        {question}
      </Text>
      <Text wrap="wrap">{detail}</Text>
      <Text> </Text>
      <Text>
        <Text bold {...tone('accent')}>
          y
        </Text>{' '}
        yes{'  '}
        <Text bold {...tone('accent')}>
          n
        </Text>{' '}
        no
      </Text>
    </Box>
  )
}

export function AdminLinkOverlay({ url, error }: { url: string | undefined; error: string | undefined }) {
  const tone = useTone()
  return (
    <Box flexDirection="column">
      <Text bold>Web admin</Text>
      {url ? <Text wrap="wrap">{url}</Text> : <Text {...tone('error')}>{error ?? 'no admin link'}</Text>}
      {url ? <Text {...tone('muted')}>The link signs the browser in; keep it private.</Text> : null}
      <Text {...tone('muted')} wrap="wrap">
        From another machine, forward the port first: ssh -L 1338:127.0.0.1:1338 user@server
      </Text>
      <Text> </Text>
      <Text>
        {url ? (
          <>
            <Text bold {...tone('accent')}>
              o
            </Text>{' '}
            open in a browser{'  '}
          </>
        ) : null}
        <Text bold {...tone('accent')}>
          esc
        </Text>{' '}
        close
      </Text>
    </Box>
  )
}

export function OverlayView({ overlay }: { overlay: Overlay }) {
  switch (overlay.kind) {
    case 'help':
      return <HelpOverlay />
    case 'confirm':
      return <ConfirmOverlay action={overlay.action} />
    case 'admin-link':
      return <AdminLinkOverlay url={overlay.url} error={overlay.error} />
  }
}

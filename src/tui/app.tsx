/**
 * The terminal UI: header, tabs, the current screen (or an overlay over it), the status line and
 * the key footer, sized to the terminal. State lives in one reducer; the controller feeds it and
 * carries out what the keys ask for.
 */

import { Box, Text, useApp, useInput, useWindowSize } from 'ink'
import { useEffect, useReducer, useRef, useState } from 'react'
import {
  Footer,
  Header,
  OverlayView,
  StatusLine,
  TabBar,
  WELCOME_ROWS,
  WelcomeBox,
} from './components/index.js'
import type { TuiControllerLike } from './controller.js'
import { footerHints, handleKey } from './keys.js'
import { ConfigScreen, DoctorScreen, LogsScreen, OverviewScreen } from './screens/index.js'
import type { TabId, TuiAction, TuiState } from './state.js'
import { initialState, reduce } from './state.js'
import type { Theme } from './theme.js'
import { ThemeContext, useTone } from './theme.js'

/** Tab bar, the body's top and bottom border, status line, footer: everything but the header. */
const FRAME_ROWS = 5
/** Below this the frame cannot hold a screen; the app says so instead of garbling. */
export const MIN_ROWS = 12
export const MIN_COLUMNS = 40
/** The welcome box needs this much room and still leaves every screen 9 lines. */
export const WELCOME_MIN_ROWS = 24
export const WELCOME_MIN_COLUMNS = 64

export interface Layout {
  /** The logo and name on top, else the one-line header. */
  welcome: boolean
  bodyRows: number
}

/**
 * Only the terminal's size decides the frame — never the tab or an overlay — so switching screens
 * never moves anything; a resize is the one thing that changes it.
 */
export function layoutFor(columns: number, rows: number): Layout {
  const welcome = rows >= WELCOME_MIN_ROWS && columns >= WELCOME_MIN_COLUMNS
  return { welcome, bodyRows: rows - FRAME_ROWS - (welcome ? WELCOME_ROWS : 1) }
}

export interface AppProps {
  initialTab: TabId
  theme: Theme
  createController: (dispatch: (action: TuiAction) => void) => TuiControllerLike
  now: () => Date
  dataFolder: string
  logPath: string
}

function Body({
  state,
  props,
  now,
  width,
  height,
}: {
  state: TuiState
  props: AppProps
  now: number
  width: number
  height: number
}) {
  if (state.overlay) return <OverlayView overlay={state.overlay} />
  switch (state.tab) {
    case 'overview':
      return <OverviewScreen daemon={state.daemon} dataFolder={props.dataFolder} now={now} height={height} />
    case 'logs':
      return <LogsScreen logs={state.logs} path={props.logPath} height={height} />
    case 'config':
      return <ConfigScreen config={state.config} width={width} height={height} />
    case 'doctor':
      return <DoctorScreen doctor={state.doctor} height={height} />
  }
}

function Frame({ state, props, now }: { state: TuiState; props: AppProps; now: number }) {
  const tone = useTone()
  const { columns, rows } = useWindowSize()
  if (rows < MIN_ROWS || columns < MIN_COLUMNS)
    return (
      <Text
        {...tone('warn')}
      >{`The terminal is too small (${columns}×${rows}); make it at least ${MIN_COLUMNS}×${MIN_ROWS}, or press q.`}</Text>
    )
  const { welcome, bodyRows } = layoutFor(columns, rows)
  const bodyWidth = columns - 4
  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {welcome ? (
        <WelcomeBox daemon={state.daemon} dataFolder={props.dataFolder} now={now} width={columns} />
      ) : (
        <Header state={state} now={now} width={columns} />
      )}
      <TabBar tab={state.tab} />
      <Box
        flexDirection="column"
        borderStyle="round"
        {...(tone('muted').color ? { borderColor: tone('muted').color } : {})}
        paddingX={1}
        height={bodyRows + 2}
        overflow="hidden"
      >
        <Body state={state} props={props} now={now} width={bodyWidth} height={bodyRows} />
      </Box>
      <StatusLine busy={state.busy} last={state.activity.at(-1)} />
      <Footer hints={footerHints(state)} width={columns} />
    </Box>
  )
}

export function App(props: AppProps) {
  const [state, dispatch] = useReducer(reduce, props.initialTab, initialState)
  const { exit } = useApp()
  const { columns, rows } = useWindowSize()
  const controller = useRef<TuiControllerLike | undefined>(undefined)
  const [now, setNow] = useState(() => props.now().getTime())
  const { createController, now: clock } = props

  useEffect(() => {
    const c = createController(dispatch)
    controller.current = c
    c.start()
    return () => c.dispose()
  }, [createController])

  // Uptimes tick once a second.
  useEffect(() => {
    const timer = setInterval(() => setNow(clock().getTime()), 1000)
    return () => clearInterval(timer)
  }, [clock])

  // Doctor runs the first time its screen opens.
  const doctorPending = state.tab === 'doctor' && !state.doctor.results && !state.doctor.running
  useEffect(() => {
    if (doctorPending) void controller.current?.run({ name: 'doctor' })
  }, [doctorPending])

  // Keys arrive faster than frames (typing, a paste): each press must see what the previous one
  // did, so the handler works on the latest state, advanced here, not on the last rendered one.
  const latest = useRef(state)
  latest.current = state
  useInput((input, key) => {
    const { bodyRows } = layoutFor(columns, rows)
    const result = handleKey(input, key, latest.current, { bodyRows })
    for (const action of result.actions) {
      latest.current = reduce(latest.current, action)
      dispatch(action)
    }
    if (result.command?.name === 'quit') exit()
    else if (result.command) void controller.current?.run(result.command)
  })

  return (
    <ThemeContext.Provider value={props.theme}>
      <Frame state={state} props={props} now={now} />
    </ThemeContext.Provider>
  )
}

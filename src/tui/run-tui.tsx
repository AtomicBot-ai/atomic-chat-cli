/**
 * Put the terminal UI on a terminal and wait for it to close. Ink owns the terminal meanwhile:
 * raw mode, the alternate screen (the shell's scrollback comes back untouched on exit), resize.
 * Leaving — `q`, Esc, Ctrl+C or a SIGTERM — never stops the daemon.
 */

import { render } from 'ink'
import { EXIT } from '../errors/index.js'
import type { AtcIo, TerminalStreams } from '../io.js'
import { App } from './app.js'
import type { TuiDeps } from './controller.js'
import { TuiController } from './controller.js'
import type { TabId } from './state.js'

export interface RunTuiOptions {
  terminal: TerminalStreams
  deps: TuiDeps
  screen: TabId
  color: boolean
  dataFolder: string
  waitForShutdown: AtcIo['waitForShutdown']
}

export async function runTui(options: RunTuiOptions): Promise<number> {
  const { terminal, deps } = options
  const createController = (dispatch: ConstructorParameters<typeof TuiController>[1]) =>
    new TuiController(deps, dispatch)
  const instance = render(
    <App
      initialTab={options.screen}
      theme={{ color: options.color }}
      createController={createController}
      now={deps.now}
      dataFolder={options.dataFolder}
      logPath={deps.paths.daemonLog}
    />,
    {
      stdin: terminal.stdin,
      stdout: terminal.stdout,
      stderr: terminal.stderr,
      exitOnCtrlC: true,
      alternateScreen: true,
      // A terminal was checked for by the caller; `CI=1` in its environment must not turn the
      // live screen into a single frame written at exit.
      interactive: true,
    }
  )
  let signalled = false
  void options.waitForShutdown(async () => {
    signalled = true
    instance.unmount()
  })
  await instance.waitUntilExit()
  return signalled ? EXIT.INTERRUPTED : EXIT.OK
}

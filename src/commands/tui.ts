/**
 * `atc tui`, and bare `atc` on an interactive terminal (`opensTui`): the full-screen terminal UI.
 * The UI itself is loaded only here, so no other command pays for React and Ink at start-up.
 */

import { adminLoginUrl, ensureAdminToken } from '../admin/index.js'
import { AtcError, defineCommand } from '../cli/index.js'
import { readTextFile, resolveConfig } from '../config/index.js'
import { CHECKS, runChecks } from '../doctor/index.js'
import { HostStepJournal } from '../host/index.js'
import { colorEnabled } from '../output/index.js'

const SCREENS = ['overview', 'logs', 'config', 'doctor'] as const
type Screen = (typeof SCREENS)[number]

export const tuiCommand = defineCommand({
  name: 'tui',
  summary: 'Full-screen terminal UI over the daemon (what bare `atc` opens on a terminal)',
  description:
    'A live screen for people at a keyboard: the daemon, the core, the API and loaded models, the daemon log, the config and doctor, with keys to start, stop and restart the daemon and change settings. Bare `atc` opens it on an interactive terminal. It needs a terminal; in scripts use `atc status --json`, in a browser `atc admin`. Every action it offers is also a plain command, and leaving it never stops the daemon.',
  group: 'access',
  options: {
    screen: {
      type: 'string',
      description: 'Open on a screen: overview, logs, config, doctor',
      placeholder: 'name',
      default: 'overview',
    },
  },
  examples: ['atc', 'atc tui --screen logs'],
  run: async (inv, ctx) => {
    const screen = inv.values['screen'] as string
    if (!SCREENS.includes(screen as Screen))
      throw new AtcError('ATC_USAGE', `Unknown screen '${screen}'.`, { hint: `one of ${SCREENS.join(', ')}` })
    const terminal = ctx.io.terminal
    if (!terminal || ctx.flags.json)
      throw new AtcError('ATC_USAGE', 'The terminal UI needs an interactive terminal.', {
        hint: 'in scripts use `atc status --json`; for a browser, `atc admin`',
      })
    const { paths, io } = ctx
    const loadConfig = async () =>
      resolveConfig({ fileText: await readTextFile(paths.configFile), env: io.env })
    const { runTui } = await import('../tui/index.js')
    return runTui({
      terminal,
      screen: screen as Screen,
      color: colorEnabled({ isTTY: io.isTTY.stdout, env: io.env, noColor: ctx.flags.noColor }),
      dataFolder: paths.dataFolder,
      waitForShutdown: io.waitForShutdown,
      deps: {
        paths,
        attach: (options) => ctx.core.attach(options),
        loadConfig,
        runDoctor: async () => {
          const config = await loadConfig()
          return runChecks(CHECKS, {
            paths,
            host: ctx.host,
            env: io.env,
            apiPort: config.values.api.port,
            adminPort: config.values.admin.port,
          })
        },
        pendingHostSteps: async () =>
          (await new HostStepJournal(paths.hostStepsJournal).load())
            .filter((e) => e.state === 'pending-manual')
            .map((e) => ({
              step_id: e.step_id,
              instructions: e.instructions ?? '',
              updated_at: e.updated_at,
            })),
        loginUrl: async (adminUrl) => adminLoginUrl(adminUrl, await ensureAdminToken(paths.adminToken)),
        openUrl: io.openUrl,
        now: ctx.now,
      },
    })
  },
})

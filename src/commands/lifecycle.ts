/** `start`, `stop`, `restart`, `status`: the background daemon from a command's point of view. */

import { AtcError, defineCommand } from '../cli/index.js'
import type { CommandContext } from '../cli/index.js'
import {
  attachIfRunning,
  describeDaemon,
  readDaemonRecord,
  startDaemon,
  stopDaemon,
  waitForRelease,
} from '../core-link/index.js'
import type { CoreLink, DaemonDescription } from '../core-link/index.js'
import { formatDuration } from '../output/index.js'

const attached = (ctx: CommandContext): Promise<CoreLink | undefined> =>
  attachIfRunning((o) => ctx.core.attach(o))

const describe = (ctx: CommandContext, link: CoreLink): Promise<DaemonDescription> =>
  describeDaemon(link, ctx.paths.daemonRecord, ctx.now)

function printStatus(ctx: CommandContext, s: DaemonDescription): void {
  ctx.out.kv([
    ['daemon', `running (pid ${s.pid}${s.uptime_ms !== null ? `, up ${formatDuration(s.uptime_ms)}` : ''})`],
    ['versions', `atc ${s.atc_version ?? '?'}, core ${s.core_version}`],
    ['data folder', s.data_folder],
    [
      'API',
      s.api.running
        ? `http://${s.api.host}:${s.api.port}${s.api.prefix}${s.api.requires_api_key ? ' (key required)' : ''}`
        : 'stopped',
    ],
    ['admin', s.admin_url ?? (s.state === 'starting' ? 'starting' : 'off')],
    [
      'models',
      s.sessions.length
        ? s.sessions.map((x) => `${x.model_id} (${x.provider}, :${x.port})`).join(', ')
        : 'none loaded',
    ],
  ])
}

export const startCommand = defineCommand({
  name: 'start',
  summary: 'Start the atc daemon (core + web admin) in the background',
  group: 'run',
  options: {
    'admin': { type: 'boolean', description: 'Serve the web admin (--no-admin to skip)', default: true },
    'admin-port': { type: 'string', description: 'Admin port for this daemon', placeholder: 'port' },
  },
  run: async (inv, ctx) => {
    const existing = await attached(ctx)
    if (existing) {
      const s = await describe(ctx, existing)
      ctx.out.result({ started: false, ...s }, () => {
        ctx.out.note('the daemon is already running')
        printStatus(ctx, s)
      })
      return 0
    }
    const args: string[] = []
    if (inv.values['admin'] === false) args.push('--no-admin')
    if (typeof inv.values['admin-port'] === 'string') args.push('--admin-port', inv.values['admin-port'])
    const link = await startDaemon((o) => ctx.core.attach(o), ctx.paths, args)
    const s = await describe(ctx, link)
    ctx.out.result({ started: true, ...s }, () => {
      ctx.out.success('daemon started')
      printStatus(ctx, s)
      ctx.out.note('it keeps running after this command; `atc stop` ends it')
    })
    return 0
  },
})

export const stopCommand = defineCommand({
  name: 'stop',
  summary: 'Stop the daemon: unload models, stop the API and the admin',
  group: 'run',
  options: {
    force: { type: 'boolean', description: 'Stop even while other atc commands are attached' },
    kill: { type: 'boolean', description: 'After a graceful stop times out, kill the process' },
  },
  run: async (inv, ctx) => {
    const link = await attached(ctx)
    if (!link) {
      ctx.out.result({ stopped: false, running: false }, () => ctx.out.note('the daemon is not running'))
      return 0
    }
    const instanceId = link.endpoint.instanceId
    let released = await stopDaemon(link, ctx.paths, {
      client: 'atc stop',
      force: inv.values['force'] === true,
      now: ctx.now,
    })
    if (!released && inv.values['kill'] === true) {
      const record = await readDaemonRecord(ctx.paths.daemonRecord)
      if (record) {
        ctx.log.warn(`graceful stop timed out; killing pid ${record.pid}`)
        if (process.platform === 'win32')
          await ctx.host.exec('taskkill', ['/PID', String(record.pid), '/T', '/F'])
        else process.kill(record.pid, 'SIGKILL')
        released = await waitForRelease(ctx.paths, instanceId, ctx.now, 5_000)
      }
    }
    if (!released)
      throw new AtcError('ATC_DAEMON_ALREADY_RUNNING', 'The daemon did not stop in time.', {
        hint: 'retry with --kill',
      })
    ctx.out.result({ stopped: true }, () => ctx.out.success('daemon stopped'))
    return 0
  },
})

export const restartCommand = defineCommand({
  name: 'restart',
  summary: 'Stop the daemon if it runs, then start it',
  group: 'run',
  run: async (inv, ctx) => {
    const stop = await stopCommand.run!({ ...inv, path: ['stop'], values: {}, spec: stopCommand }, ctx)
    if (stop !== 0) return stop
    return startCommand.run!({ ...inv, path: ['start'], values: {}, spec: startCommand }, ctx)
  },
})

export const statusCommand = defineCommand({
  name: 'status',
  summary: 'Show the daemon, the API endpoint, loaded models and the admin URL',
  group: 'run',
  options: { watch: { type: 'boolean', description: 'Refresh every 2 seconds until interrupted' } },
  run: async (inv, ctx) => {
    if (inv.values['watch'] === true) {
      throw new AtcError('ATC_NOT_IMPLEMENTED', '`atc status --watch` is not implemented yet.', {
        details: 'planned for iteration 2',
      })
    }
    const link = await attached(ctx)
    if (!link) {
      ctx.out.result({ running: false, data_folder: ctx.paths.dataFolder }, () => {
        ctx.out.kv([
          ['daemon', 'not running'],
          ['data folder', ctx.paths.dataFolder],
        ])
        ctx.out.note('start it with `atc start`, or `atc serve <model>`')
      })
      return 0
    }
    const s = await describe(ctx, link)
    ctx.out.result(s, () => printStatus(ctx, s))
    return 0
  },
})

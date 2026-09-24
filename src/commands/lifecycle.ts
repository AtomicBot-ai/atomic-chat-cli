/** `start`, `stop`, `restart`, `status`: the background daemon from a command's point of view. */

import { inspectLock } from '@atomic-chat/core/host'
import { AtcError, defineCommand } from '../cli/index.js'
import type { CommandContext } from '../cli/index.js'
import { readDaemonRecord } from '../core-link/index.js'
import type { CoreLink } from '../core-link/index.js'
import { formatDuration } from '../output/index.js'

async function attached(ctx: CommandContext): Promise<CoreLink | undefined> {
  try {
    return await ctx.core.attach({ launch: false })
  } catch (error) {
    if (error instanceof AtcError && error.code === 'ATC_DAEMON_NOT_RUNNING') return undefined
    throw error
  }
}

async function describe(ctx: CommandContext, link: CoreLink) {
  const [snapshot, record] = await Promise.all([link.snapshot(), readDaemonRecord(ctx.paths.daemonRecord)])
  return {
    running: true as const,
    pid: snapshot.pid,
    core_version: snapshot.version,
    atc_version: record?.atc_version ?? null,
    instance_id: snapshot.instance_id,
    started_at: record?.started_at ?? null,
    uptime_ms: record ? ctx.now().getTime() - record.started_at : null,
    data_folder: snapshot.data_folder,
    api: snapshot.server,
    admin_url: record?.admin_url ?? null,
    sessions: snapshot.sessions.map((s) => ({ provider: s.provider, model_id: s.model_id, port: s.port })),
    clients: snapshot.clients.map((c) => c.name),
  }
}

function printStatus(ctx: CommandContext, s: Awaited<ReturnType<typeof describe>>): void {
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
    ['admin', s.admin_url ?? 'off'],
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
    const link = await ctx.core.attach({ launch: true, daemonArgs: args })
    const s = await describe(ctx, link)
    ctx.out.result({ started: true, ...s }, () => {
      ctx.out.success('daemon started')
      printStatus(ctx, s)
      ctx.out.note('it keeps running after this command; `atc stop` ends it')
    })
    return 0
  },
})

export const STOP_TIMEOUT_MS = 30_000

export async function waitForRelease(
  ctx: CommandContext,
  instanceId: string,
  timeoutMs = STOP_TIMEOUT_MS
): Promise<boolean> {
  const deadline = ctx.now().getTime() + timeoutMs
  while (ctx.now().getTime() < deadline) {
    const state = await inspectLock(ctx.paths.layout)
    if (state.kind !== 'owned' || state.record.instance_id !== instanceId) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

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
    await link.withLease('atc stop', async (l, clientId) => {
      await l.shutdown({ client_id: clientId, ...(inv.values['force'] === true ? { force: true } : {}) })
    })
    let released = await waitForRelease(ctx, instanceId)
    if (!released && inv.values['kill'] === true) {
      const record = await readDaemonRecord(ctx.paths.daemonRecord)
      if (record) {
        ctx.log.warn(`graceful stop timed out; killing pid ${record.pid}`)
        if (process.platform === 'win32')
          await ctx.host.exec('taskkill', ['/PID', String(record.pid), '/T', '/F'])
        else process.kill(record.pid, 'SIGKILL')
        released = await waitForRelease(ctx, instanceId, 5_000)
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

import { AtcError, defineCommand } from '../cli/index.js'
import { runDaemon } from '../daemon/index.js'

/** Hidden: what `start`/`serve` spawn and what a service runs. */
export const daemonCommand = defineCommand({
  name: 'daemon',
  summary: 'Run the daemon in the foreground (started for you by other commands)',
  hidden: true,
  options: {
    'control-port': {
      type: 'string',
      description: 'Control API port (0 = free port)',
      default: '0',
      placeholder: 'port',
    },
    'control-host': { type: 'string', description: 'Control API host', placeholder: 'host' },
    'admin': { type: 'boolean', description: 'Serve the web admin', default: true },
    'admin-host': { type: 'string', description: 'Admin bind address', placeholder: 'host' },
    'admin-port': { type: 'string', description: 'Admin port (0 = random)', placeholder: 'port' },
    'telemetry': { type: 'string', description: 'on | off (default: from config)', placeholder: 'on|off' },
  },
  run: async (inv, ctx) => {
    const config = await ctx.config()
    const port = (name: string): number | undefined => {
      const raw = inv.values[name]
      if (typeof raw !== 'string') return undefined
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 0 || n > 65535)
        throw new AtcError('ATC_USAGE', `--${name} must be a port number.`)
      return n
    }
    const telemetryFlag = inv.values['telemetry']
    return runDaemon({
      paths: ctx.paths,
      io: ctx.io,
      config,
      host: ctx.host,
      log: ctx.log,
      controlPort: port('control-port') ?? 0,
      ...(typeof inv.values['control-host'] === 'string' ? { controlHost: inv.values['control-host'] } : {}),
      admin: {
        enabled: inv.values['admin'] !== false && config.values.admin.autoStart,
        ...(typeof inv.values['admin-host'] === 'string' ? { host: inv.values['admin-host'] } : {}),
        ...(port('admin-port') !== undefined ? { port: port('admin-port') as number } : {}),
      },
      ...(telemetryFlag === 'on' || telemetryFlag === 'off' ? { telemetry: telemetryFlag === 'on' } : {}),
    })
  },
})

import { readFile } from 'node:fs/promises'
import { AtcError, defineCommand, plannedPartial } from '../cli/index.js'
import { tailLines } from '../daemon/index.js'

export const logsCommand = defineCommand({
  name: 'logs',
  summary: 'Show the daemon log',
  group: 'run',
  options: {
    lines: { type: 'string', short: 'n', description: 'Lines to show', default: '200', placeholder: 'count' },
    follow: { type: 'boolean', short: 'f', description: 'Keep printing new lines' },
  },
  run: async (inv, ctx) => {
    if (inv.values['follow'] === true) {
      throw new AtcError('ATC_NOT_IMPLEMENTED', '`atc logs --follow` is not implemented yet.', {
        details: `planned for ${plannedPartial('logs --follow')}`,
      })
    }
    const count = Number(inv.values['lines'])
    if (!Number.isInteger(count) || count < 1)
      throw new AtcError('ATC_USAGE', '--lines must be a positive number.')
    let text: string
    try {
      text = await readFile(ctx.paths.daemonLog, 'utf8')
    } catch {
      ctx.out.result({ path: ctx.paths.daemonLog, lines: [] }, () =>
        ctx.out.note(`no log yet at ${ctx.paths.daemonLog}`)
      )
      return 0
    }
    const lines = tailLines(text, count)
    ctx.out.result({ path: ctx.paths.daemonLog, lines }, () => {
      for (const line of lines) ctx.out.line(line)
    })
    return 0
  },
})

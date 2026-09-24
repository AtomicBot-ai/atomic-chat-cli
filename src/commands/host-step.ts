import { readFile, writeFile } from 'node:fs/promises'
import { defineCommand } from '../cli/index.js'
import { runHostStepHelper } from '../host/index.js'

const exec = defineCommand({
  name: 'exec',
  summary: 'Run one privileged host step from its request file and write the result beside it',
  positionals: [{ name: 'request', description: 'Path to <step_id>.request.json', required: true }],
  run: async (inv, ctx) => {
    const result = await runHostStepHelper(inv.positionals[0] as string, {
      readFile: (p) =>
        readFile(p, 'utf8').then(
          (t) => t,
          () => undefined
        ),
      writeFile: (p, text) => writeFile(p, text),
      now: () => ctx.now().getTime(),
    })
    ctx.out.result(result, () =>
      ctx.out.line(`${result.step_id}: ${result.outcome}${result.log_tail ? ` — ${result.log_tail}` : ''}`)
    )
    return result.outcome === 'failed' ? 1 : 0
  },
})

/** Hidden: the privileged helper the daemon (or a person, by hand) runs with elevated rights. */
export const hostStepCommand = defineCommand({
  name: 'host-step',
  summary: 'Privileged helper for managed-runtime setup (run by the daemon)',
  hidden: true,
  subcommands: [exec],
})

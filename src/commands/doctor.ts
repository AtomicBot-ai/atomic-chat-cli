import { defineCommand } from '../cli/index.js'
import { CHECKS, runChecks, worstStatus } from '../doctor/index.js'

export const doctorCommand = defineCommand({
  name: 'doctor',
  summary: 'Check the installation: folders, config, ports, PATH, GPU driver',
  group: 'system',
  run: async (_inv, ctx) => {
    const config = await ctx.config()
    const results = await runChecks(CHECKS, {
      paths: ctx.paths,
      host: ctx.host,
      env: ctx.io.env,
      apiPort: config.values.api.port,
      adminPort: config.values.admin.port,
    })
    const worst = worstStatus(results)
    ctx.out.result({ status: worst, checks: results }, () => {
      const mark = {
        ok: ctx.colors.green('ok  '),
        warn: ctx.colors.yellow('warn'),
        fail: ctx.colors.red('FAIL'),
        skip: ctx.colors.dim('skip'),
      }
      for (const r of results) {
        ctx.out.line(`${mark[r.status]}  ${r.title}: ${r.message}`)
        if (r.hint) ctx.out.line(`      ${ctx.colors.dim(`→ ${r.hint}`)}`)
      }
    })
    return worst === 'fail' ? 1 : 0
  },
})

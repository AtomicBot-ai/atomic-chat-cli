import { AtcError, defineCommand, plannedPartial } from '../cli/index.js'
import { checkForUpdate } from '../update/index.js'
import { ATC_VERSION } from '../version.js'

export const updateCommand = defineCommand({
  name: 'update',
  summary: 'Update atc to the latest release',
  group: 'system',
  options: {
    check: { type: 'boolean', description: 'Only report whether a newer release exists' },
    version: {
      type: 'string',
      description: 'Install this version instead of the latest',
      placeholder: 'x.y.z',
    },
  },
  run: async (inv, ctx) => {
    if (inv.values['check'] === true) {
      const result = await checkForUpdate(ctx.io.fetch, ATC_VERSION)
      ctx.out.result(result, () => {
        ctx.out.line(
          result.available
            ? `atc ${result.latest} is available (you have ${result.current}): ${result.url}`
            : `atc ${result.current} is the latest`
        )
      })
      return 0
    }
    throw new AtcError('ATC_NOT_IMPLEMENTED', 'Installing an update is not implemented yet.', {
      details: `planned for ${plannedPartial('update apply')}`,
      hint: 're-run the installer from the release page, or `atc update --check` to see the latest version',
    })
  },
})

/**
 * Questions to the person. Interactive on a terminal; without one, `--yes` answers safe
 * confirmations and dangerous ones alike (the person chose it on the command line), and anything
 * else fails with a code the caller can explain.
 */

import { AtcError } from '../errors/index.js'
import type { AtcIo } from '../io.js'

export interface Prompter {
  confirm(question: string, options?: { danger?: boolean; defaultYes?: boolean }): Promise<boolean>
  select(prompt: string, options: string[], settings?: { defaultIndex?: number }): Promise<number>
  input(prompt: string, options?: { secret?: boolean; defaultValue?: string }): Promise<string>
}

export function createPrompter(io: AtcIo, flags: { yes: boolean; json: boolean }): Prompter {
  const interactive = io.isTTY.stdin && !flags.json
  return {
    async confirm(question, options = {}) {
      if (!interactive) {
        if (flags.yes) return true
        throw new AtcError('ATC_CONSENT_REQUIRED', `${question} — needs a confirmation.`, {
          hint: options.danger
            ? 're-run with --yes to confirm this change'
            : 're-run with --yes, or from a terminal',
        })
      }
      const suffix = options.defaultYes ? '[Y/n]' : '[y/N]'
      const answer = (await io.question(`${question} ${suffix} `)).trim().toLowerCase()
      if (answer === '') return options.defaultYes === true
      return answer === 'y' || answer === 'yes'
    },
    async select(prompt, choices, settings = {}) {
      if (choices.length === 0) throw new AtcError('ATC_INTERNAL', 'nothing to select from')
      if (!interactive) {
        if (settings.defaultIndex !== undefined) return settings.defaultIndex
        throw new AtcError('ATC_USAGE', `${prompt} requires an interactive terminal.`, {
          details: `choices: ${choices.join(', ')}`,
          hint: 'pass the choice as a flag',
        })
      }
      io.stderr(`\n${prompt}\n`)
      choices.forEach((c, i) => io.stderr(`  ${i + 1}. ${c}\n`))
      const answer = (await io.question(`Selection [${(settings.defaultIndex ?? 0) + 1}]: `)).trim()
      const index = answer === '' ? (settings.defaultIndex ?? 0) : Number(answer) - 1
      if (!Number.isInteger(index) || index < 0 || index >= choices.length)
        throw new AtcError('ATC_USAGE', 'Invalid selection.')
      return index
    },
    async input(prompt, options = {}) {
      if (!interactive) {
        if (options.defaultValue !== undefined) return options.defaultValue
        throw new AtcError('ATC_USAGE', `${prompt} requires an interactive terminal.`, {
          hint: 'pass the value as a flag',
        })
      }
      const answer = await io.question(
        `${prompt}${options.defaultValue !== undefined ? ` [${options.defaultValue}]` : ''}: `,
        {
          ...(options.secret ? { secret: true } : {}),
        }
      )
      return answer === '' && options.defaultValue !== undefined ? options.defaultValue : answer
    },
  }
}

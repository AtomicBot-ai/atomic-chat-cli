import { describe, expect, it } from 'vitest'
import { opensTui } from './default-command.js'
import { DEFAULT_GLOBAL_FLAGS } from './flags.js'

const tty = { stdin: true, stdout: true }

describe('opensTui', () => {
  it.each([
    ['bare atc on a terminal', {}, true],
    ['with a command', { rest: ['status'] }, false],
    ['with --json', { globals: { ...DEFAULT_GLOBAL_FLAGS, json: true } }, false],
    ['with --help', { globals: { ...DEFAULT_GLOBAL_FLAGS, help: true } }, false],
    ['with --version', { globals: { ...DEFAULT_GLOBAL_FLAGS, version: true } }, false],
    ['stdout piped', { isTTY: { stdin: true, stdout: false } }, false],
    ['stdin piped', { isTTY: { stdin: false, stdout: true } }, false],
    ['TERM=dumb', { env: { TERM: 'dumb' } }, false],
    [
      '-v and --no-color keep it',
      { globals: { ...DEFAULT_GLOBAL_FLAGS, verbose: true, noColor: true } },
      true,
    ],
  ] as const)('%s', (_name, over, expected) => {
    expect(opensTui({ rest: [], globals: DEFAULT_GLOBAL_FLAGS, isTTY: tty, env: {}, ...over })).toBe(expected)
  })
})

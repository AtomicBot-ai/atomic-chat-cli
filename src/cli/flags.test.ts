import { describe, expect, it } from 'vitest'
import { splitGlobalFlags } from './flags.js'

describe('splitGlobalFlags', () => {
  it.each([
    [['models', 'list', '--json'], { json: true }, ['models', 'list']],
    [['-v', 'serve', 'x', '-y'], { verbose: true, yes: true }, ['serve', 'x']],
    [['--data-folder', '/d', 'status'], { dataFolder: '/d' }, ['status']],
    [['status', '--data-folder=/e'], { dataFolder: '/e' }, ['status']],
    [['run', '--', '--json'], {}, ['run', '--', '--json']],
    [['--no-color', '--quiet'], { noColor: true, quiet: true }, []],
  ] as const)('%j', (argv, expected, rest) => {
    const result = splitGlobalFlags([...argv])
    expect(result.error).toBeUndefined()
    expect(result.rest).toEqual(rest)
    for (const [key, value] of Object.entries(expected)) {
      expect((result.globals as unknown as Record<string, unknown>)[key]).toBe(value)
    }
  })

  it('reports a missing data folder value', () => {
    expect(splitGlobalFlags(['--data-folder']).error).toMatch(/needs a path/)
    expect(splitGlobalFlags(['--data-folder', '--json']).error).toMatch(/needs a path/)
    expect(splitGlobalFlags(['--data-folder=']).error).toMatch(/needs a path/)
  })
})

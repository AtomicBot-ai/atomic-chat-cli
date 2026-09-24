import { describe, expect, it } from 'vitest'
import { defineCommand } from './command.js'
import { completionTable, renderCompletion, SHELLS } from './completion.js'

const root = defineCommand({
  name: 'atc',
  summary: 'x',
  subcommands: [
    defineCommand({
      name: 'models',
      summary: 'x',
      subcommands: [
        defineCommand({
          name: 'pull',
          summary: 'x',
          options: { quant: { type: 'string', description: 'q' } },
          run: async () => 0,
        }),
      ],
    }),
    defineCommand({ name: 'daemon', summary: 'x', hidden: true, run: async () => 0 }),
  ],
})

describe('completion', () => {
  it('builds a table of words per command path without hidden commands', () => {
    const table = Object.fromEntries(completionTable(root))
    expect(table['']).toEqual(['models', '--help', '--json'])
    expect(table['models pull']).toEqual(['--quant', '--help', '--json'])
    expect(table['daemon']).toBeUndefined()
  })

  it.each(SHELLS)('renders a %s script that names every path', (shell) => {
    const script = renderCompletion(root, shell)
    expect(script).toContain('models')
    expect(script).toMatch(/--quant|-l 'quant'/)
  })
})

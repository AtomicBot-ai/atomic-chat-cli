import { describe, expect, it } from 'vitest'
import { ROOT } from '../commands/index.js'
import { walkCommands } from './command.js'
import { PLANNED } from './not-implemented.js'

describe('the stub registry and the command tree agree', () => {
  const stubs = walkCommands(ROOT)
    .filter(({ spec }) => spec.stub)
    .map(({ path }) => path.join(' '))

  it('lists every stub', () => {
    for (const path of stubs) expect(PLANNED, `${path} is a stub but not registered`).toHaveProperty(path)
  })

  it('names only stubs', () => {
    for (const key of Object.keys(PLANNED))
      expect(stubs, `${key} is registered but not a stub`).toContain(key)
  })
})

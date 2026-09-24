import { describe, expect, it } from 'vitest'
import { migrateConfig } from './migrations.js'
import { CONFIG_VERSION } from './schema.js'

describe('migrateConfig', () => {
  it('passes the current version through and assumes version 1 when absent', () => {
    expect(migrateConfig({ version: CONFIG_VERSION, a: 1 })).toEqual({
      raw: { version: CONFIG_VERSION, a: 1 },
    })
    expect(migrateConfig({ a: 1 }).raw['version']).toBe(1)
  })

  it('refuses a newer file with an update hint', () => {
    expect(() => migrateConfig({ version: CONFIG_VERSION + 1 })).toThrow(/this atc understands/)
  })
})

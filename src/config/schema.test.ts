import { describe, expect, it } from 'vitest'
import { defaultConfig, envNameFor, fieldFor, FIELDS, getAt, setAt } from './schema.js'

describe('schema', () => {
  it('derives env names from paths', () => {
    expect(envNameFor(fieldFor('api.port')!)).toBe('ATC_API_PORT')
    expect(envNameFor(fieldFor('serve.nGpuLayers')!)).toBe('ATC_SERVE_N_GPU_LAYERS')
    expect(envNameFor(fieldFor('proxy.ignoreSsl')!)).toBe('ATC_PROXY_IGNORE_SSL')
  })

  it('has unique paths and a default of the right type', () => {
    const paths = FIELDS.map((f) => f.path)
    expect(new Set(paths).size).toBe(paths.length)
    const config = defaultConfig()
    expect(config.api.port).toBe(1337)
    expect(config.admin.port).toBe(1338)
    expect(config.serve.model).toBeUndefined()
  })

  it('gets and sets dotted paths', () => {
    const o: Record<string, unknown> = {}
    setAt(o, 'a.b.c', 1)
    expect(getAt(o, 'a.b.c')).toBe(1)
    setAt(o, 'a.b.c', undefined)
    expect(getAt(o, 'a.b')).toEqual({})
    expect(getAt(o, 'x.y')).toBeUndefined()
  })
})

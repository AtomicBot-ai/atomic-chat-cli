import { describe, expect, it } from 'vitest'
import { proxyAllowed } from './bff.js'

describe('proxyAllowed', () => {
  it.each([
    ['GET', '/snapshot', true],
    ['GET', '/sessions', true],
    ['GET', '/backends/llamacpp-upstream', true],
    ['GET', '/clients', false],
    ['GET', '/cloud/providers', false],
    ['POST', '/models/llamacpp-upstream/x/load', true],
    ['POST', '/server/start', true],
    ['POST', '/shutdown', false],
    ['PUT', '/telemetry', false],
    ['PUT', '/hardware/override', true],
    ['DELETE', '/clients/1', false],
    ['POST', '/environments/default/operations', true],
  ])('%s %s → %s', (method, path, expected) => {
    expect(proxyAllowed(method, path)).toBe(expected)
  })
})

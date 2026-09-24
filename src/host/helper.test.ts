import { describe, expect, it } from 'vitest'
import { parseRequestFile, resultPathFor, runHostStepHelper } from './helper.js'

const request = {
  schema_version: 1,
  step_id: 's1',
  operation_id: 'op1',
  action: 'linux.install-container-runtime',
  recipe_id: 'r',
  recipe_digest: 'sha256:aa',
  parameters_digest: 'sha256:bb',
  nonce: 'n',
  expected_operation_revision: 3,
  data_folder: '/d',
  requested_at: 1,
}

describe('host-step helper', () => {
  it('validates the request file strictly', () => {
    expect(parseRequestFile(JSON.stringify(request)).step_id).toBe('s1')
    expect(() => parseRequestFile('{')).toThrow(/valid JSON/)
    expect(() => parseRequestFile(JSON.stringify({ ...request, action: 'rm -rf' }))).toThrow(/action must be/)
    expect(() => parseRequestFile(JSON.stringify({ ...request, nonce: '' }))).toThrow(/nonce/)
  })

  it('writes a failed result while no recipe ships', async () => {
    const written: Record<string, string> = {}
    const result = await runHostStepHelper('/x/s1.request.json', {
      readFile: async () => JSON.stringify(request),
      writeFile: async (path, text) => {
        written[path] = text
      },
      now: () => 9,
    })
    expect(result).toMatchObject({ step_id: 's1', outcome: 'failed', finished_at: 9 })
    expect(result.log_tail).toContain('MANAGED_ADAPTER_UNAVAILABLE')
    expect(Object.keys(written)).toEqual(['/x/s1.result.json'])
    expect(resultPathFor('/x/s1.request.json')).toBe('/x/s1.result.json')
  })
})

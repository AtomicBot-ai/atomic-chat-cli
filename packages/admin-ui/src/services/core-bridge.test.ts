import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_HEADER } from '@contract'

import { jsonResponse } from '@/test/fixtures'
import { coreRuntime, createHttpInvoke } from './core-bridge'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function call(index = 0) {
  const entry = fetchMock.mock.calls[index]
  if (!entry) throw new Error(`fetch call #${index} was not made`)
  const [url, init] = entry
  return { url: String(url), init: init ?? {}, headers: (init?.headers ?? {}) as Record<string, string> }
}

describe('createHttpInvoke', () => {
  it('maps atomic_core_call to the core proxy and marks mutations with the admin header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { session: { port: 39001 }, created: true }))
    const invoke = createHttpInvoke()

    const result = await invoke('atomic_core_call', {
      method: 'POST',
      path: '/models/llamacpp-upstream/qwen/load',
      body: { overrides: { ctx_len: 8192 } },
    })

    expect(result).toEqual({ session: { port: 39001 }, created: true })
    const { url, init, headers } = call()
    expect(url).toBe('/api/core/models/llamacpp-upstream/qwen/load')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(headers[ADMIN_HEADER]).toBe('1')
    expect(headers['content-type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ overrides: { ctx_len: 8192 } }))
  })

  it('sends a GET without the admin header or a body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { sessions: [] }))

    await createHttpInvoke()('atomic_core_call', { method: 'GET', path: '/sessions', body: null })

    const { url, init, headers } = call()
    expect(url).toBe('/api/core/sessions')
    expect(init.method).toBe('GET')
    expect(headers[ADMIN_HEADER]).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('maps atomic_core_snapshot and atomic_core_status to their admin routes', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, {}))
    const invoke = createHttpInvoke()

    await invoke('atomic_core_snapshot')
    await invoke('atomic_core_status')

    expect(call(0).url).toBe('/api/core/snapshot')
    expect(call(1).url).toBe('/api/status')
    expect(call(0).init.method).toBe('GET')
    expect(call(1).init.method).toBe('GET')
  })

  it('honours another base', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await createHttpInvoke('/admin-api')('atomic_core_snapshot')

    expect(call().url).toBe('/admin-api/core/snapshot')
  })

  it('refuses commands the admin has no counterpart for, without a request', async () => {
    const invoke = createHttpInvoke()

    await expect(invoke('plugin:hardware|get_system_info')).rejects.toMatchObject({
      code: 'ADMIN_UNSUPPORTED_COMMAND',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces the BFF error body as { code, message, details }', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, {
        error: {
          code: 'CORE_MODEL_NOT_FOUND',
          message: 'No such model.',
          details: 'qwen',
          hint: 'pull it first',
        },
      })
    )

    await expect(
      createHttpInvoke()('atomic_core_call', { method: 'POST', path: '/models/llamacpp-upstream/qwen/load' })
    ).rejects.toMatchObject({
      code: 'CORE_MODEL_NOT_FOUND',
      message: 'No such model.',
      details: 'qwen',
      hint: 'pull it first',
      status: 404,
    })
  })

  it('answers undefined for 204 and a generic error for a non-JSON failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(
      createHttpInvoke()('atomic_core_call', { method: 'POST', path: '/server/stop' })
    ).resolves.toBeUndefined()

    fetchMock.mockResolvedValueOnce(new Response('gateway timeout', { status: 504 }))
    await expect(createHttpInvoke()('atomic_core_snapshot')).rejects.toMatchObject({
      code: 'ADMIN_HTTP_ERROR',
      status: 504,
      details: 'gateway timeout',
    })
  })

  it('reports a network failure as ADMIN_UNREACHABLE', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(createHttpInvoke()('atomic_core_status')).rejects.toMatchObject({
      code: 'ADMIN_UNREACHABLE',
      status: 0,
    })
  })
})

describe('coreRuntime', () => {
  it('drives the app runtime through the bridge', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }))

    const result = await coreRuntime('llamacpp-upstream').unload('qwen')

    expect(result).toEqual({ success: true })
    expect(call().url).toBe('/api/core/models/llamacpp-upstream/qwen/unload')
    expect(call().init.method).toBe('POST')
    expect(call().headers[ADMIN_HEADER]).toBe('1')
  })

  it('filters sessions to its provider, as the app does', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        sessions: [
          { model_id: 'legacy', provider: undefined, pid: 1, port: 1 },
          { model_id: 'mlx-one', provider: 'mlx', pid: 2, port: 2 },
        ],
      })
    )

    const loaded = await coreRuntime('llamacpp-upstream').getLoadedModels()

    expect(loaded).toEqual(['legacy'])
    expect(call().url).toBe('/api/core/sessions')
  })
})

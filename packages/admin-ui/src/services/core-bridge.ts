/**
 * The desktop app's `invoke(command, args)` over the admin BFF. `atomic-core-runtime.ts` builds
 * requests for the core's control API and hands them to whatever `invoke` it is given: on desktop
 * that is Tauri's, here it is `fetch` against `/api/core/*`, where the daemon attaches the control
 * token and enforces the route allowlist. Nothing else the app invokes exists here.
 */

import { ADMIN_API } from '@contract'
import { ADMIN_BASE, AdminApiError, relative, request } from './admin-api'
import type { HttpMethod } from './admin-api'
import { createCoreRuntime } from './atomic-core-runtime'
import type { CoreProvider, CoreRuntime, Invoke } from './atomic-core-runtime'

const METHODS: readonly string[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

interface CoreCallArgs {
  method?: unknown
  path?: unknown
  body?: unknown
}

function coreCall(base: string, args: CoreCallArgs): { method: HttpMethod; url: string; body: unknown } {
  const method = typeof args.method === 'string' ? args.method.toUpperCase() : 'GET'
  if (!METHODS.includes(method)) {
    throw new AdminApiError(
      'ADMIN_BAD_REQUEST',
      `Unsupported method "${String(args.method)}" for a core call.`
    )
  }
  if (typeof args.path !== 'string' || !args.path.startsWith('/')) {
    throw new AdminApiError('ADMIN_BAD_REQUEST', 'A core call needs a path that starts with "/".')
  }
  return {
    method: method as HttpMethod,
    url: `${base}${relative(ADMIN_API.core)}${args.path}`,
    body: args.body,
  }
}

/**
 * `atomic_core_call {method, path, body}` → `<base>/core<path>`; `atomic_core_snapshot` →
 * `GET <base>/core/snapshot`; `atomic_core_status` → `GET <base>/status`. Anything else the app
 * invokes is a Tauri command the admin has no counterpart for.
 */
export function createHttpInvoke(base = ADMIN_BASE): Invoke {
  return async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    switch (command) {
      case 'atomic_core_call': {
        const { method, url, body } = coreCall(base, args ?? {})
        return request<T>(method, url, body)
      }
      case 'atomic_core_snapshot':
        return request<T>('GET', `${base}${relative(ADMIN_API.core)}/snapshot`)
      case 'atomic_core_status':
        return request<T>('GET', `${base}${relative(ADMIN_API.status)}`)
      default:
        throw new AdminApiError(
          'ADMIN_UNSUPPORTED_COMMAND',
          `The admin cannot run "${command}"; only core calls reach the daemon.`
        )
    }
  }
}

export interface CoreBridge {
  invoke: Invoke
  /** A raw control-API call through the proxy, for pages that need a route the runtime has no method for. */
  request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T>
  /** The app's typed client for one provider, built once per provider. */
  runtime(provider: CoreProvider): CoreRuntime
}

export function createCoreBridge(base = ADMIN_BASE): CoreBridge {
  const invoke = createHttpInvoke(base)
  const runtimes = new Map<CoreProvider, CoreRuntime>()
  return {
    invoke,
    request: <T>(method: HttpMethod, path: string, body?: unknown) =>
      invoke<T>('atomic_core_call', { method, path, body: body ?? null }),
    runtime(provider) {
      let runtime = runtimes.get(provider)
      if (!runtime) {
        runtime = createCoreRuntime(provider, invoke)
        runtimes.set(provider, runtime)
      }
      return runtime
    },
  }
}

const defaultBridge = createCoreBridge()

/** `createCoreRuntime(provider, createHttpInvoke())`, one instance per provider. */
export function coreRuntime(provider: CoreProvider): CoreRuntime {
  return defaultBridge.runtime(provider)
}

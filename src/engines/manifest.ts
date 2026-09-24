/**
 * Engine packs come from `atomic-chat-conf` manifests, installed by the core
 * (`POST /backends/:provider/install`). `atc engines` only chooses and asks; iteration 4.
 */

export const BACKEND_MANIFEST_URL =
  'https://raw.githubusercontent.com/AtomicBot-ai/atomic-chat-conf/main/backends/manifest.json'
export const TURBOQUANT_MANIFEST_URL =
  'https://raw.githubusercontent.com/AtomicBot-ai/atomic-chat-conf/main/backends/turboquant-manifest.json'

export interface BackendPackRef {
  provider: string
  version: string
  backend: string
}

export interface BackendManifestClient {
  available(provider: string): Promise<BackendPackRef[]>
  installed(provider: string): Promise<BackendPackRef[]>
  optimal(provider: string): Promise<BackendPackRef | undefined>
}

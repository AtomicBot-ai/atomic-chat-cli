/**
 * Where models come from: the curated catalog (`atomic-chat-model-catalog`) and the hardware-tier
 * recommendations (`atomic-chat-conf/models/recommended.json`). The parsers are pure and pinned by
 * fixtures; the fetching client is iteration 3.
 */

import { AtcError } from '../errors/index.js'

export const CATALOG_URL =
  'https://raw.githubusercontent.com/AtomicBot-ai/atomic-chat-model-catalog/main/dist/catalog.json.gz'
export const CATALOG_INDEX_URL =
  'https://raw.githubusercontent.com/AtomicBot-ai/atomic-chat-model-catalog/main/dist/catalog.idx.json.gz'
export const RECOMMENDED_URL =
  'https://raw.githubusercontent.com/AtomicBot-ai/atomic-chat-conf/main/models/recommended.json'
export const CACHE_TTL_MS = 60 * 60 * 1000

export interface RecommendedEntry {
  model_name: string
  quant: string
  mmproj_quant?: string
  description_key?: string
  platforms?: string[]
}

export interface RecommendedTiers {
  schema_version: number
  recommendations: RecommendedEntry[]
  low_spec_recommendations: RecommendedEntry[]
  tiers: Record<string, RecommendedEntry[]>
}

export interface CatalogQuant {
  model_id: string
  path: string
  file_size: string
}

export interface CatalogModel {
  model_name: string
  developer: string
  downloads: number
  quants: CatalogQuant[]
  is_mlx?: boolean
  tags_normalized?: string[]
}

function entries(raw: unknown): RecommendedEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (e): e is Record<string, unknown> =>
        e !== null &&
        typeof e === 'object' &&
        typeof (e as Record<string, unknown>)['model_name'] === 'string'
    )
    .map((e) => ({
      model_name: e['model_name'] as string,
      quant: typeof e['quant'] === 'string' ? e['quant'] : '',
      ...(typeof e['mmproj_quant'] === 'string' ? { mmproj_quant: e['mmproj_quant'] } : {}),
      ...(typeof e['description_key'] === 'string' ? { description_key: e['description_key'] } : {}),
      ...(Array.isArray(e['platforms'])
        ? { platforms: (e['platforms'] as unknown[]).filter((p): p is string => typeof p === 'string') }
        : {}),
    }))
}

export function parseRecommended(json: string): RecommendedTiers {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(json) as Record<string, unknown>
  } catch {
    throw new AtcError('ATC_INTERNAL', 'recommended.json is not valid JSON')
  }
  const tiers: Record<string, RecommendedEntry[]> = {}
  for (const [name, list] of Object.entries((raw['tiers'] as Record<string, unknown>) ?? {}))
    tiers[name] = entries(list)
  return {
    schema_version: typeof raw['schema_version'] === 'number' ? raw['schema_version'] : 1,
    recommendations: entries(raw['recommendations']),
    low_spec_recommendations: entries(raw['low_spec_recommendations']),
    tiers,
  }
}

export function parseCatalog(json: string): CatalogModel[] {
  let raw: { models?: unknown }
  try {
    raw = JSON.parse(json) as { models?: unknown }
  } catch {
    throw new AtcError('ATC_INTERNAL', 'catalog.json is not valid JSON')
  }
  if (!Array.isArray(raw.models)) return []
  return raw.models.filter(
    (m): m is CatalogModel =>
      m !== null && typeof m === 'object' && typeof (m as CatalogModel).model_name === 'string'
  )
}

/** The recommendation tier for a machine: by the largest GPU's VRAM (MiB), else CPU only. */
export function tierForHardware(input: {
  maxVramMib: number | undefined
  unifiedMemoryGib?: number
}): string {
  if (input.unifiedMemoryGib !== undefined) {
    const steps = [8, 16, 24, 32, 48, 64]
    const step = [...steps].reverse().find((s) => input.unifiedMemoryGib! >= s)
    return step === undefined ? 'cpu_only' : step === 64 ? 'unified_64_plus' : `unified_${step}`
  }
  if (input.maxVramMib === undefined || input.maxVramMib <= 0) return 'cpu_only'
  // Cards report a little under their nominal size (a 24 GB card says 24564 MiB): allow half a GiB.
  const gib = input.maxVramMib / 1024 + 0.5
  const steps = [2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 128]
  const step = [...steps].reverse().find((s) => gib >= s)
  return step === undefined ? 'cpu_only' : step === 128 ? 'vram_128_plus' : `vram_${step}`
}

export interface CatalogClient {
  recommended(): Promise<RecommendedTiers>
  catalog(): Promise<CatalogModel[]>
  search(query: string, options?: { limit?: number }): Promise<CatalogModel[]>
}

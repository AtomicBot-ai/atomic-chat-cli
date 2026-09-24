import { describe, expect, it } from 'vitest'
import { parseCatalog, parseRecommended, tierForHardware } from './catalog.js'

describe('catalog parsers', () => {
  it('reads recommended tiers defensively', () => {
    const tiers = parseRecommended(
      JSON.stringify({
        schema_version: 2,
        recommendations: [{ model_name: 'a/b', quant: 'Q4_K_M' }, { bad: true }],
        tiers: { vram_8: [{ model_name: 'c/d', quant: 'Q8', platforms: ['linux', 1] }] },
      })
    )
    expect(tiers.schema_version).toBe(2)
    expect(tiers.recommendations).toEqual([{ model_name: 'a/b', quant: 'Q4_K_M' }])
    expect(tiers.tiers['vram_8']).toEqual([{ model_name: 'c/d', quant: 'Q8', platforms: ['linux'] }])
    expect(() => parseRecommended('{')).toThrow(/valid JSON/)
  })

  it('reads the catalog model list', () => {
    expect(
      parseCatalog(
        JSON.stringify({ models: [{ model_name: 'x', developer: 'y', downloads: 1, quants: [] }, 5] })
      )
    ).toHaveLength(1)
    expect(parseCatalog('{}')).toEqual([])
  })

  it('maps hardware to a tier', () => {
    expect(tierForHardware({ maxVramMib: undefined })).toBe('cpu_only')
    expect(tierForHardware({ maxVramMib: 8192 })).toBe('vram_8')
    expect(tierForHardware({ maxVramMib: 24564 })).toBe('vram_24')
    expect(tierForHardware({ maxVramMib: 200_000 })).toBe('vram_128_plus')
    expect(tierForHardware({ maxVramMib: 1000 })).toBe('cpu_only')
    expect(tierForHardware({ maxVramMib: undefined, unifiedMemoryGib: 36 })).toBe('unified_32')
    expect(tierForHardware({ maxVramMib: undefined, unifiedMemoryGib: 128 })).toBe('unified_64_plus')
  })
})

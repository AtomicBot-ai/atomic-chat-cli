import { describe, expect, it } from 'vitest'
import {
  parseCpuinfoFlags,
  parseNvidiaSmi,
  parseSysctlFeatures,
  parseWindowsVideoControllers,
  probeHardware,
  toOverride,
} from './hardware-prober.js'

describe('hardware parsers', () => {
  it('reads nvidia-smi csv', () => {
    const gpus = parseNvidiaSmi(
      'NVIDIA GeForce RTX 4090, 550.54.14, 24564, 8.9\nNVIDIA RTX A6000, 550.54.14, 49140, 8.6\n'
    )
    expect(gpus).toEqual([
      {
        vendor: 'NVIDIA',
        driver_version: '550.54.14',
        total_memory: 24564,
        nvidia_info: { compute_capability: '8.9' },
      },
      {
        vendor: 'NVIDIA',
        driver_version: '550.54.14',
        total_memory: 49140,
        nvidia_info: { compute_capability: '8.6' },
      },
    ])
    expect(parseNvidiaSmi('')).toEqual([])
  })

  it('reads cpu flags on linux and macOS', () => {
    expect(parseCpuinfoFlags('processor : 0\nflags : fpu sse avx avx2 avx512f\n')).toEqual([
      'avx',
      'avx2',
      'avx512',
    ])
    expect(parseCpuinfoFlags('nothing')).toEqual([])
    expect(
      parseSysctlFeatures('machdep.cpu.features: FPU SSE AVX1.0\nmachdep.cpu.leaf7_features: AVX2 AVX512F')
    ).toEqual(['avx', 'avx2', 'avx512'])
    expect(parseSysctlFeatures('')).toEqual([])
  })

  it('reads Windows video controllers with vendor and device ids', () => {
    const one = parseWindowsVideoControllers(
      JSON.stringify({
        Name: 'RTX',
        AdapterRAM: 4294967296,
        DriverVersion: '32.0',
        PNPDeviceID: 'PCI\\VEN_10DE&DEV_2684&SUBSYS',
      })
    )
    expect(one).toEqual([
      { vendor: 'NVIDIA', driver_version: '32.0', total_memory: 4096, vulkan_info: { device_id: 0x2684 } },
    ])
    expect(parseWindowsVideoControllers('[{"PNPDeviceID":"PCI\\\\VEN_1002&DEV_744C"}]')[0]?.vendor).toBe(
      'AMD'
    )
    expect(parseWindowsVideoControllers('not json')).toEqual([])
  })
})

describe('probeHardware', () => {
  it('combines nvidia-smi and /proc/cpuinfo on linux and notes what it could not read', async () => {
    const probe = await probeHardware({
      platform: 'linux',
      arch: 'x64',
      exec: async (cmd) =>
        cmd === 'nvidia-smi'
          ? { code: 0, stdout: 'GPU, 1.0, 100, 7.5\n', stderr: '', timedOut: false }
          : { code: null, stdout: '', stderr: '', timedOut: false, error: 'ENOENT' },
      readFile: async () => 'flags : avx avx2\n',
    })
    expect(probe.gpus).toHaveLength(1)
    expect(probe.cpu_extensions).toEqual(['avx', 'avx2'])
    expect(toOverride(probe)).toMatchObject({ os_type: 'linux', source: 'atc-prober' })
    const none = await probeHardware({
      platform: 'linux',
      arch: 'x64',
      exec: async () => ({ code: null, stdout: '', stderr: '', timedOut: false, error: 'ENOENT' }),
      readFile: async () => undefined,
    })
    expect(none.gpus).toEqual([])
    expect(none.notes).toContain('nvidia-smi not found')
  })
})

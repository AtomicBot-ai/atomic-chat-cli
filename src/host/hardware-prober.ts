/**
 * What the core cannot see by itself: GPU driver version, compute capability and VRAM, plus CPU
 * instruction sets. The desktop app measures these with NVML/Vulkan; a server has `nvidia-smi`
 * and friends. Parsers are pure and fixture-tested; `probeHardware` only wires them to `exec`.
 */

import type { GpuProbeInfo, HardwareOverrideInput } from '@atomic-chat/core'
import type { ExecFn } from './exec.js'

export type OsType = 'linux' | 'windows' | 'macos'

export interface HardwareProbe {
  gpus: GpuProbeInfo[]
  cpu_extensions: string[]
  os_type: OsType
  source: string
  /** What could not be read, for `atc hardware show` and the log. */
  notes: string[]
}

export const PROBE_SOURCE = 'atc-prober'
export const NVIDIA_SMI_QUERY = [
  '--query-gpu=name,driver_version,memory.total,compute_cap',
  '--format=csv,noheader,nounits',
]

export function osTypeFor(platform: NodeJS.Platform): OsType {
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'macos'
  return 'linux'
}

/** `name, driver_version, memory.total (MiB), compute_cap` per line. */
export function parseNvidiaSmi(csv: string): GpuProbeInfo[] {
  const gpus: GpuProbeInfo[] = []
  for (const line of csv.split(/\r?\n/)) {
    const cells = line.split(',').map((c) => c.trim())
    if (cells.length < 4 || cells[0] === '') continue
    const [, driver, memory, cap] = cells
    const total = Number(memory)
    gpus.push({
      vendor: 'NVIDIA',
      ...(driver ? { driver_version: driver } : {}),
      ...(Number.isFinite(total) ? { total_memory: Math.round(total) } : {}),
      nvidia_info: { ...(cap && /^\d+\.\d+$/.test(cap) ? { compute_capability: cap } : {}) },
    })
  }
  return gpus
}

const CPU_FLAGS = ['avx', 'avx2', 'avx512'] as const

/** `/proc/cpuinfo`: the first `flags` line; `avx512f` counts as `avx512`. */
export function parseCpuinfoFlags(text: string): string[] {
  const line = text.split('\n').find((l) => /^flags\s*:/.test(l))
  if (!line) return []
  const flags = new Set(line.split(':')[1]?.trim().split(/\s+/) ?? [])
  return CPU_FLAGS.filter((f) => flags.has(f) || (f === 'avx512' && flags.has('avx512f')))
}

/** `sysctl machdep.cpu.features machdep.cpu.leaf7_features` on macOS (x86 only; Apple silicon has none). */
export function parseSysctlFeatures(text: string): string[] {
  const upper = text.toUpperCase()
  const out: string[] = []
  if (/\bAVX1\.0\b|\bAVX\b/.test(upper)) out.push('avx')
  if (/\bAVX2\b/.test(upper)) out.push('avx2')
  if (/\bAVX512F\b/.test(upper)) out.push('avx512')
  return out
}

const PCI_VENDORS: Record<string, string> = { '10DE': 'NVIDIA', '1002': 'AMD', '8086': 'Intel' }

/** `Get-CimInstance Win32_VideoController | ConvertTo-Json` (an object or an array). */
export function parseWindowsVideoControllers(json: string): GpuProbeInfo[] {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return []
  }
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
  return list.map((item) => {
    const o = item as Record<string, unknown>
    const pnp = typeof o['PNPDeviceID'] === 'string' ? o['PNPDeviceID'] : ''
    const ven = /VEN_([0-9A-F]{4})/i.exec(pnp)?.[1]?.toUpperCase()
    const dev = /DEV_([0-9A-F]{4})/i.exec(pnp)?.[1]
    const ram = typeof o['AdapterRAM'] === 'number' ? Math.round(o['AdapterRAM'] / (1024 * 1024)) : undefined
    return {
      vendor: ven ? (PCI_VENDORS[ven] ?? `Unknown (vendor_id: ${parseInt(ven, 16)})`) : null,
      ...(typeof o['DriverVersion'] === 'string' ? { driver_version: o['DriverVersion'] } : {}),
      ...(ram !== undefined ? { total_memory: ram } : {}),
      vulkan_info: { device_id: dev ? parseInt(dev, 16) : null },
    }
  })
}

export interface ProbeDeps {
  exec: ExecFn
  platform: NodeJS.Platform
  arch: string
  readFile: (path: string) => Promise<string | undefined>
}

export async function probeHardware(deps: ProbeDeps): Promise<HardwareProbe> {
  const notes: string[] = []
  const os_type = osTypeFor(deps.platform)
  let gpus: GpuProbeInfo[] = []

  const smi = await deps.exec('nvidia-smi', NVIDIA_SMI_QUERY)
  if (smi.code === 0) gpus = parseNvidiaSmi(smi.stdout)
  else notes.push(smi.error ? 'nvidia-smi not found' : `nvidia-smi exited ${smi.code ?? 'by timeout'}`)

  if (gpus.length === 0 && deps.platform === 'win32') {
    const cim = await deps.exec('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,PNPDeviceID | ConvertTo-Json',
    ])
    if (cim.code === 0) gpus = parseWindowsVideoControllers(cim.stdout)
    else notes.push('Win32_VideoController not readable')
  }
  if (gpus.length === 0 && deps.platform === 'linux')
    notes.push('no NVIDIA GPU seen; AMD/Intel probing lands in iteration 4')

  let cpu_extensions: string[] = []
  if (deps.platform === 'linux') {
    const cpuinfo = await deps.readFile('/proc/cpuinfo')
    if (cpuinfo !== undefined) cpu_extensions = parseCpuinfoFlags(cpuinfo)
    else notes.push('/proc/cpuinfo not readable')
  } else if (deps.platform === 'darwin') {
    const sysctl = await deps.exec('sysctl', ['machdep.cpu.features', 'machdep.cpu.leaf7_features'])
    cpu_extensions = sysctl.code === 0 ? parseSysctlFeatures(sysctl.stdout) : []
  } else if (deps.platform === 'win32' && deps.arch === 'x64') {
    cpu_extensions = ['avx', 'avx2']
    notes.push('cpu extensions assumed avx/avx2 on Windows x64; pass --cpu-extensions to override')
  }

  return { gpus, cpu_extensions, os_type, source: PROBE_SOURCE, notes }
}

export function toOverride(probe: HardwareProbe): HardwareOverrideInput {
  return {
    gpus: probe.gpus,
    cpu_extensions: probe.cpu_extensions,
    os_type: probe.os_type,
    source: probe.source,
  }
}

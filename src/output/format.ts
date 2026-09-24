/** Human formatting helpers shared by the printer, progress and status output. */

const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '?'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${UNITS[unit]}`
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '?'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export function formatPercent(done: number, total: number): string {
  if (!(total > 0)) return '?%'
  return `${Math.min(100, Math.floor((done / total) * 100))}%`
}

/** `1.2 MiB/s`, or `?` when nothing moved yet. */
export function formatRate(bytes: number, ms: number): string {
  if (!(ms > 0) || !(bytes > 0)) return '?'
  return `${formatBytes((bytes * 1000) / ms)}/s`
}

/** Small display helpers for the status pages. */

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—'
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const seconds = total % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString()
}

export function formatClock(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false })
}

export function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value ? 'yes' : 'no'
}

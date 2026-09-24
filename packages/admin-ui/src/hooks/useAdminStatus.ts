import { useCoreEvents } from '@/services/events'
import { useStatusStore } from '@/stores/status-store'

/** The relay events after which `/api/status` may answer differently, plus the relay's own `resync`. */
export const STATUS_EVENTS = [
  'resync',
  'session:started',
  'session:unloaded',
  'session:died',
  'server:started',
  'server:stopped',
  'server:bind-failed',
  'atc:status',
  'atc:host-step',
] as const

export function useAdminStatus() {
  const status = useStatusStore((state) => state.status)
  const loading = useStatusStore((state) => state.loading)
  const error = useStatusStore((state) => state.error)
  const unauthorized = useStatusStore((state) => state.unauthorized)
  const updatedAt = useStatusStore((state) => state.updatedAt)
  const refresh = useStatusStore((state) => state.refresh)
  return { status, loading, error, unauthorized, updatedAt, refresh }
}

/** Keeps the status store live for as long as the caller is mounted (the signed-in shell). */
export function useLiveStatus() {
  const refreshSoon = useStatusStore((state) => state.refreshSoon)
  useCoreEvents(STATUS_EVENTS, () => refreshSoon())
}

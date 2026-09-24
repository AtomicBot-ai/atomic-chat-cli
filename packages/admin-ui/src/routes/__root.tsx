import { Link, createRootRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AdminShell } from '@/containers/AdminShell'
import { SignIn } from '@/containers/SignIn'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { useServiceHub } from '@/hooks/useServiceHub'
import type { BootstrapResult } from '@/services/session'
import { useStatusStore } from '@/stores/status-store'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const hub = useServiceHub()
  const { status, unauthorized } = useAdminStatus()
  const [boot, setBoot] = useState<BootstrapResult | null>(null)

  // Trade the `#token=` fragment for a session (once), then ask for the first status. A 401 there
  // is the sign-in screen; anything else is the shell, with the error on the dashboard.
  useEffect(() => {
    let active = true
    void hub
      .session()
      .bootstrap()
      .then(async (result) => {
        await useStatusStore.getState().refresh()
        if (active) setBoot(result)
      })
    return () => {
      active = false
    }
  }, [hub])

  if (boot === null && !status) return <Splash />
  if (unauthorized && !status) return <SignIn refused={boot === 'refused'} />
  return <AdminShell />
}

function Splash() {
  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      Connecting to atc…
    </div>
  )
}

function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">There is no such page in the admin.</p>
      <Link to="/" className="text-sm underline underline-offset-4">
        Back to the dashboard
      </Link>
    </div>
  )
}

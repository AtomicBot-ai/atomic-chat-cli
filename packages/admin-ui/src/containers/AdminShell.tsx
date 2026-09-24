import { Link, Outlet } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import {
  Cpu,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  ScrollText,
  Server,
  Settings,
  Sun,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAdminStatus, useLiveStatus } from '@/hooks/useAdminStatus'
import { useServiceHub } from '@/hooks/useServiceHub'
import { useTheme } from '@/hooks/useTheme'
import { useStatusStore } from '@/stores/status-store'

interface NavItem {
  to: LinkProps['to']
  label: string
  icon: LucideIcon
  exact?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/api', label: 'API Server', icon: Server },
  { to: '/models', label: 'Models', icon: Package },
  { to: '/engines', label: 'Engines', icon: Cpu },
  { to: '/setup', label: 'Setup', icon: Wrench },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/hardware', label: 'Hardware', icon: HardDrive },
]

/** The signed-in frame: sidebar, header with the versions, and the page. Keeps the status live. */
export function AdminShell() {
  useLiveStatus()
  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
          atc
        </span>
        <span className="font-semibold">admin</span>
      </div>
      <nav className="flex-1 space-y-1 p-2" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={label}
            to={to}
            activeOptions={{ exact }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground"
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}

function Header() {
  const { status } = useAdminStatus()
  const { theme, toggle } = useTheme()
  const hub = useServiceHub()

  const signOut = async () => {
    try {
      await hub.session().logout()
    } finally {
      useStatusStore.getState().reset()
      useStatusStore.setState({ unauthorized: true })
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-6">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Version label="atc" value={status?.atc.version} />
        <span aria-hidden>·</span>
        <Version label="core" value={status?.core.version} />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut />
          Sign out
        </Button>
      </div>
    </header>
  )
}

function Version({ label, value }: { label: string; value?: string }) {
  return (
    <span>
      {label} <span className="font-mono text-foreground">{value ?? '—'}</span>
    </span>
  )
}

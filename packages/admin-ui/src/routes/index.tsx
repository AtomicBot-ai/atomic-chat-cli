import { createFileRoute } from '@tanstack/react-router'
import { Activity, Boxes, Cpu, ListChecks, RefreshCw, Server, Shield } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AdminStatus } from '@contract'

import { PageHeader } from '@/components/PageHeader'
import { StatusCard, StatusList, StatusRow } from '@/components/StatusCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { useNow } from '@/hooks/useNow'
import { formatClock, formatDuration, formatTime, yesNo } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  const { status, loading, error, updatedAt, refresh } = useAdminStatus()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="What the daemon, the core and the API server are doing right now."
        actions={
          <>
            {updatedAt ? (
              <span className="text-xs text-muted-foreground">Updated {formatClock(updatedAt)}</span>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden />
              Refresh
            </Button>
          </>
        }
      />
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          {error}
        </div>
      ) : null}
      {status ? <StatusCards status={status} /> : <LoadingCards />}
    </div>
  )
}

function StatusCards({ status }: { status: AdminStatus }) {
  const now = useNow(1000)
  const { atc, core, daemon, admin, api, sessions, pending_host_steps: steps } = status
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <StatusCard title="Daemon" description="The atc process behind this admin" icon={Activity}>
        <StatusList>
          <StatusRow label="PID" value={daemon.pid} mono />
          <StatusRow label="Started" value={formatTime(daemon.started_at)} />
          <StatusRow label="Uptime" value={formatDuration(now - daemon.started_at)} />
          <StatusRow label="Data folder" value={daemon.data_folder} mono />
        </StatusList>
      </StatusCard>

      <StatusCard title="Core" description="atomic-chat-core, the inference host" icon={Cpu}>
        <StatusList>
          <StatusRow label="Version" value={core.version} />
          <StatusRow label="Instance" value={core.instance_id} mono />
          <StatusRow label="PID" value={core.pid} mono />
          <StatusRow label="Protocol" value={core.protocol} />
          <StatusRow label="Uptime" value={formatDuration(core.uptime_ms)} />
        </StatusList>
      </StatusCard>

      <StatusCard
        title="API server"
        description="The OpenAI-compatible endpoint"
        icon={Server}
        badge={
          <Badge variant={api.running ? 'success' : 'secondary'}>{api.running ? 'Running' : 'Stopped'}</Badge>
        }
      >
        <StatusList>
          <StatusRow label="Address" value={`${api.host}:${api.port}`} mono />
          <StatusRow label="Prefix" value={api.prefix} mono />
          <StatusRow label="API key required" value={yesNo(api.requires_api_key)} />
          <StatusRow label="PID" value={api.pid ?? '—'} mono />
        </StatusList>
      </StatusCard>

      <StatusCard
        title="Loaded models"
        description={`${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
        icon={Boxes}
      >
        {sessions.length === 0 ? (
          <Empty>No model is loaded.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((session) => (
              <li
                key={`${session.provider}/${session.model_id}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs" title={session.model_id}>
                    {session.model_id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    port {session.port} · pid {session.pid}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Badge variant="outline">{session.provider}</Badge>
                  {session.is_embedding ? <Badge variant="secondary">embedding</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </StatusCard>

      <StatusCard
        title="Pending host steps"
        description="Things only you can do on the server"
        icon={ListChecks}
        badge={steps.length > 0 ? <Badge variant="warning">{steps.length}</Badge> : undefined}
      >
        {steps.length === 0 ? (
          <Empty>Nothing pending.</Empty>
        ) : (
          <ul className="space-y-3">
            {steps.map((step) => (
              <li key={step.step_id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{step.step_id}</span>
                  <span>{formatTime(step.updated_at)}</span>
                </div>
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">
                  {step.instructions}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </StatusCard>

      <StatusCard title="Admin" description="This page, and the atc build serving it" icon={Shield}>
        <StatusList>
          <StatusRow label="atc" value={atc.version} />
          <StatusRow label="Git" value={atc.git_sha ?? '—'} mono />
          <StatusRow label="Built" value={atc.build_date ?? '—'} />
          <StatusRow label="Admin build" value={atc.admin_ui} mono />
          <StatusRow label="Listening on" value={admin.url} mono />
        </StatusList>
      </StatusCard>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>
}

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-44" />
      ))}
    </div>
  )
}

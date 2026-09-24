import { createFileRoute } from '@tanstack/react-router'
import { Server } from 'lucide-react'

import { PlaceholderPage } from '@/components/PlaceholderPage'
import { StatusCard, StatusList, StatusRow } from '@/components/StatusCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { yesNo } from '@/lib/format'

export const Route = createFileRoute('/api/')({
  component: ApiServerPage,
})

function ApiServerPage() {
  const { status } = useAdminStatus()
  const api = status?.api
  return (
    <PlaceholderPage
      title="API Server"
      description="The OpenAI-compatible endpoint the core serves for other apps on this machine or the LAN."
      iteration={5}
      note="Start, stop, the API key and the inspector are controlled from here then."
    >
      <StatusCard
        title="Current state"
        icon={Server}
        badge={
          api ? (
            <Badge variant={api.running ? 'success' : 'secondary'}>
              {api.running ? 'Running' : 'Stopped'}
            </Badge>
          ) : undefined
        }
      >
        {api ? (
          <StatusList>
            <StatusRow label="Host" value={api.host} mono />
            <StatusRow label="Port" value={api.port} mono />
            <StatusRow label="Prefix" value={api.prefix} mono />
            <StatusRow label="API key required" value={yesNo(api.requires_api_key)} />
            <StatusRow label="PID" value={api.pid ?? '—'} mono />
          </StatusList>
        ) : (
          <Skeleton className="h-28" />
        )}
      </StatusCard>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled>Start</Button>
        <Button variant="outline" disabled>
          Stop
        </Button>
        <Button variant="outline" disabled>
          Rotate API key
        </Button>
        <Button variant="ghost" disabled>
          Inspector
        </Button>
        <span className="text-xs text-muted-foreground">Controls: iteration 5</span>
      </div>
    </PlaceholderPage>
  )
}

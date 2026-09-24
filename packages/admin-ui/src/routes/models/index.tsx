import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { PlaceholderPage } from '@/components/PlaceholderPage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/models/')({
  component: ModelsPage,
})

type Tab = 'installed' | 'hub' | 'downloads'

const TABS: ReadonlyArray<{ id: Tab; label: string; blurb: string }> = [
  { id: 'installed', label: 'Installed', blurb: 'Models in the data folder, with load and unload.' },
  { id: 'hub', label: 'Hub', blurb: 'The curated catalog and Hugging Face search.' },
  { id: 'downloads', label: 'Downloads', blurb: 'Pulls in flight, with progress and cancel.' },
]

function ModelsPage() {
  const [tab, setTab] = useState<Tab>('installed')
  const { status } = useAdminStatus()
  const sessions = status?.sessions ?? []
  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0]

  return (
    <PlaceholderPage
      title="Models"
      description="What is on disk, what can be pulled, and what is downloading."
      iteration={5}
      note="Installing, pulling from the hub and download management arrive together."
    >
      <div role="tablist" aria-label="Models" className="flex gap-1 border-b">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === tab}
            onClick={() => setTab(entry.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              entry.id === tab
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-4">
        <p className="text-sm text-muted-foreground">{active.blurb}</p>
        {tab === 'installed' && sessions.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {sessions.map((session) => (
              <li key={`${session.provider}/${session.model_id}`}>
                <Badge variant="outline" className="font-mono">
                  {session.model_id}
                </Badge>{' '}
                <span className="text-xs text-muted-foreground">loaded on port {session.port}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="border-dashed shadow-none">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-2/5 rounded bg-muted" />
                  <Badge variant="secondary">iteration 5</Badge>
                </div>
                <div className="h-3 w-4/5 rounded bg-muted" />
                <div className="h-3 w-3/5 rounded bg-muted" />
                <div className="h-8 w-24 rounded-full bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PlaceholderPage>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { PlaceholderPage } from '@/components/PlaceholderPage'
import { Card, CardContent } from '@/components/ui/card'
import { formatClock } from '@/lib/format'
import { useCoreEvents } from '@/services/events'

export const Route = createFileRoute('/logs')({
  component: LogsPage,
})

interface LogLine {
  at: number
  text: string
}

const MAX_LINES = 200

/** A best-effort tail of the relay's `atc:log` events; the log API itself is iteration 7. */
function LogsPage() {
  const [lines, setLines] = useState<LogLine[]>([])
  useCoreEvents('atc:log', (data) => {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    setLines((current) => [...current.slice(-(MAX_LINES - 1)), { at: Date.now(), text }])
  })

  return (
    <PlaceholderPage
      title="Logs"
      description="The daemon's log: what atc and the core wrote, newest last."
      iteration={7}
      note="Reading the log file, filtering by level and following the core's log land with the log API."
    >
      <Card>
        <CardContent className="p-0">
          <pre className="max-h-[60vh] min-h-40 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap">
            {lines.length === 0
              ? 'Waiting for atc:log events on /api/events…'
              : lines.map((line) => `[${formatClock(line.at)}] ${line.text}`).join('\n')}
          </pre>
        </CardContent>
      </Card>
    </PlaceholderPage>
  )
}

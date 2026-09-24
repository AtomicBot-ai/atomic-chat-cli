import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/PlaceholderPage'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/hardware')({
  component: HardwarePage,
})

function HardwarePage() {
  return (
    <PlaceholderPage
      title="Hardware"
      description="CPU, memory, GPUs and the device each engine will use."
      iteration={7}
      note="Detection, the memory budget and the per-engine device pick come with the hardware page."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {['CPU', 'Memory', 'GPUs'].map((title) => (
          <Card key={title} className="border-dashed shadow-none">
            <CardContent className="space-y-2 p-4">
              <div className="text-sm font-medium">{title}</div>
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PlaceholderPage>
  )
}

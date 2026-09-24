import { createFileRoute } from '@tanstack/react-router'

import { PlaceholderPage } from '@/components/PlaceholderPage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/engines/')({
  component: EnginesPage,
})

const ENGINES = [
  { id: 'llamacpp-upstream', name: 'llama.cpp', blurb: 'GGUF models on CPU, CUDA, Vulkan or Metal.' },
  { id: 'mlx', name: 'MLX', blurb: 'Apple silicon, MLX-format models.' },
  {
    id: 'foundation-models',
    name: 'Foundation Models',
    blurb: "Apple's on-device model, when the OS has it.",
  },
] as const

function EnginesPage() {
  return (
    <PlaceholderPage
      title="Engines"
      description="The inference backends the core can run, their installed builds and their settings."
      iteration={5}
      note="Installed builds, updates and the per-engine settings schema arrive with the engine API."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {ENGINES.map((engine) => (
          <Card key={engine.id} className="border-dashed shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {engine.name}
                <Badge variant="outline" className="font-mono font-normal">
                  {engine.id}
                </Badge>
              </CardTitle>
              <CardDescription>{engine.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">No engine data yet.</CardContent>
          </Card>
        ))}
      </div>
    </PlaceholderPage>
  )
}

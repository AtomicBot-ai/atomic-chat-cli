import { Construction } from 'lucide-react'
import type { ReactNode } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

interface PlaceholderPageProps {
  title: string
  description: string
  /** The iteration of the atc plan this page's real content lands in. */
  iteration: number
  /** What that iteration brings here; defaults to "this page is a shell until then". */
  note?: string
  /** What the page can already show; the "planned" note follows it. */
  children?: ReactNode
}

/** A page whose backing API is not there yet: whatever is real, then a note naming the iteration. */
export function PlaceholderPage({ title, description, iteration, note, children }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      {children}
      <Card className="border-dashed shadow-none">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Construction className="size-4 shrink-0" aria-hidden />
          <span>
            Planned for <strong className="font-medium text-foreground">iteration {iteration}</strong>.{' '}
            {note ?? 'This page is a shell until then.'}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

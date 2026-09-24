import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatusCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  badge?: ReactNode
  className?: string
  children: ReactNode
}

/** One dashboard tile: a titled card with an optional icon and a badge in the corner. */
export function StatusCard({ title, description, icon: Icon, badge, className, children }: StatusCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
        {badge}
      </CardHeader>
      <CardContent className="p-4 pt-2 text-sm">{children}</CardContent>
    </Card>
  )
}

export function StatusList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-border">{children}</dl>
}

interface StatusRowProps {
  label: string
  value: ReactNode
  /** Paths, ids and hashes: monospace and a hover title with the full text. */
  mono?: boolean
}

export function StatusRow({ label, value, mono }: StatusRowProps) {
  const shown = value === null || value === undefined || value === '' ? '—' : value
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn('min-w-0 truncate text-right', mono && 'font-mono text-xs')}
        title={typeof shown === 'string' ? shown : undefined}
      >
        {shown}
      </dd>
    </div>
  )
}

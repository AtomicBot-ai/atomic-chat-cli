import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { AdminConfigField, AdminConfigView } from '@contract'

import { PlaceholderPage } from '@/components/PlaceholderPage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useServiceHub } from '@/hooks/useServiceHub'
import { describeError } from '@/services/admin-api'

export const Route = createFileRoute('/settings/')({
  component: SettingsPage,
})

type Source = AdminConfigField['source']

const SOURCE_VARIANT: Record<Source, 'outline' | 'secondary' | 'warning' | 'default'> = {
  default: 'outline',
  file: 'secondary',
  env: 'warning',
  flag: 'default',
}

const SECRET = /(token|secret|password|api[_-]?key)/i

function SettingsPage() {
  const hub = useServiceHub()
  const [view, setView] = useState<AdminConfigView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    hub
      .config()
      .fetch()
      .then(
        (next) => {
          if (!active) return
          setView(next)
          setError(null)
        },
        (err: unknown) => {
          if (active) setError(describeError(err))
        }
      )
    return () => {
      active = false
    }
  }, [hub])

  const sections = useMemo(() => groupBySection(view?.fields ?? []), [view])

  return (
    <PlaceholderPage
      title="Settings"
      description="atc's own configuration as resolved right now: defaults, the config file, the environment and flags."
      iteration={7}
      note="Editing lands with the settings page; until then this view is read-only."
    >
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          {error}
        </div>
      ) : null}
      {!view && !error ? <Skeleton className="h-40" /> : null}
      {sections.map(({ section, fields }) => (
        <Card key={section}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="font-mono text-base">{section}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Key</th>
                  <th className="px-4 py-2 font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((field) => (
                  <tr key={field.path}>
                    <td className="px-4 py-2 font-mono text-xs">{field.path}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {renderValue(valueAt(view?.values, field.path), field.path)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={SOURCE_VARIANT[field.source]}>{field.source}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {field.type}
                      {field.values ? ` (${field.values.join(' | ')})` : ''}
                    </td>
                    <td className="hidden px-4 py-2 text-xs text-muted-foreground md:table-cell">
                      {field.description}
                      {field.default !== undefined ? (
                        <span className="block">
                          default: <code>{renderValue(field.default, field.path)}</code>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </PlaceholderPage>
  )
}

function groupBySection(fields: AdminConfigField[]): Array<{ section: string; fields: AdminConfigField[] }> {
  const groups = new Map<string, AdminConfigField[]>()
  for (const field of fields) {
    const dot = field.path.indexOf('.')
    const section = dot > 0 ? field.path.slice(0, dot) : 'general'
    const list = groups.get(section) ?? []
    list.push(field)
    groups.set(section, list)
  }
  return [...groups].map(([section, list]) => ({ section, fields: list }))
}

function valueAt(values: unknown, path: string): unknown {
  let current = values
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function renderValue(value: unknown, path: string): string {
  if (value === undefined || value === null) return '—'
  if (SECRET.test(path) && value !== '') return '••••••••'
  if (typeof value === 'string') return value === '' ? '""' : value
  return JSON.stringify(value)
}

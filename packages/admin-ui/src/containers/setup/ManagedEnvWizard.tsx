import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import type { SetupState } from '@contract'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SETUP_FLOW, SETUP_STEPS } from '@/containers/setup/setup-steps'
import { cn } from '@/lib/utils'

const BUSY: ReadonlySet<SetupState> = new Set<SetupState>(['elevating', 'installing'])

type StepStatus = 'done' | 'active' | 'pending' | 'failed'

export interface ManagedEnvWizardProps {
  state: SetupState
  /** One line about this machine: OS, service user, data folder. */
  detail?: string
  log?: readonly string[]
  /** The step's button ("Install", "Agree and continue", "Retry"). */
  onAction?: () => void
  onReset?: () => void
  disabled?: boolean
}

/** The managed-environment stepper: every `SetupState` the contract names, one at a time. */
export function ManagedEnvWizard({ state, detail, log, onAction, onReset, disabled }: ManagedEnvWizardProps) {
  const step = SETUP_STEPS[state]
  const failed = state === 'failed'
  const current = SETUP_FLOW.indexOf(state)

  return (
    <Card>
      <CardHeader className="space-y-4 p-4">
        <ol className="flex flex-wrap items-center gap-y-2" aria-label="Setup progress">
          {SETUP_FLOW.map((flowState, index) => {
            const status: StepStatus = failed
              ? 'failed'
              : index < current
                ? 'done'
                : index === current
                  ? 'active'
                  : 'pending'
            return (
              <li
                key={flowState}
                className="flex items-center"
                aria-current={status === 'active' ? 'step' : undefined}
              >
                <StepDot index={index} status={status} />
                <span
                  className={cn(
                    'ml-1.5 text-xs',
                    status === 'active' ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {SETUP_STEPS[flowState].label}
                </span>
                {index < SETUP_FLOW.length - 1 ? (
                  <span className="mx-2 h-px w-4 bg-border" aria-hidden />
                ) : null}
              </li>
            )
          })}
        </ol>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {failed ? <AlertTriangle className="size-5 text-destructive" aria-hidden /> : null}
              {BUSY.has(state) ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              ) : null}
              {step.title}
            </CardTitle>
            <CardDescription className="mt-1">{step.description}</CardDescription>
          </div>
          <Badge variant={failed ? 'destructive' : state === 'ready' ? 'success' : 'outline'}>{state}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
        {log && log.length > 0 ? (
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
            {log.join('\n')}
          </pre>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {step.action ? (
            <Button onClick={onAction} disabled={disabled || !onAction}>
              {step.action}
            </Button>
          ) : null}
          {onReset && state !== SETUP_FLOW[0] ? (
            <Button variant="ghost" onClick={onReset} disabled={disabled}>
              Start over
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function StepDot({ index, status }: { index: number; status: StepStatus }) {
  return (
    <span
      className={cn(
        'flex size-5 items-center justify-center rounded-full border text-[10px] font-medium',
        status === 'done' && 'border-primary bg-primary text-primary-foreground',
        status === 'active' && 'border-primary text-primary',
        status === 'pending' && 'border-border text-muted-foreground',
        status === 'failed' && 'border-destructive/50 text-muted-foreground'
      )}
    >
      {status === 'done' ? <Check className="size-3" aria-hidden /> : index + 1}
    </span>
  )
}

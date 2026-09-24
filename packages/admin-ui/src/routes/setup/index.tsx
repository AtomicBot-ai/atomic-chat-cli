import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { SetupState } from '@contract'

import { PlaceholderPage } from '@/components/PlaceholderPage'
import { Button } from '@/components/ui/button'
import { ManagedEnvWizard } from '@/containers/setup/ManagedEnvWizard'
import { SETUP_FIXTURE, SETUP_FLOW } from '@/containers/setup/setup-steps'

export const Route = createFileRoute('/setup/')({
  component: SetupPage,
})

function SetupPage() {
  const [state, setState] = useState<SetupState>(SETUP_FIXTURE.state)

  const advance = () =>
    setState((current) => {
      if (current === 'failed') return SETUP_FLOW[0]
      const index = SETUP_FLOW.indexOf(current)
      return index >= 0 && index < SETUP_FLOW.length - 1 ? SETUP_FLOW[index + 1] : current
    })

  return (
    <PlaceholderPage
      title="Setup"
      description="The managed environment: a service account, its data folder and the service that keeps the daemon running."
      iteration={7}
      note="Until the setup API exists the stepper below runs on fixture data; the buttons only move the fixture."
    >
      <ManagedEnvWizard
        state={state}
        detail={SETUP_FIXTURE.detail}
        log={SETUP_FIXTURE.log}
        onAction={advance}
        onReset={() => setState(SETUP_FLOW[0])}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Fixture state:</span>
        {SETUP_FLOW.map((flowState) => (
          <Button
            key={flowState}
            size="xs"
            variant={flowState === state ? 'default' : 'outline'}
            onClick={() => setState(flowState)}
          >
            {flowState}
          </Button>
        ))}
        <Button
          size="xs"
          variant={state === 'failed' ? 'destructive' : 'outline'}
          onClick={() => setState('failed')}
        >
          failed
        </Button>
      </div>
    </PlaceholderPage>
  )
}

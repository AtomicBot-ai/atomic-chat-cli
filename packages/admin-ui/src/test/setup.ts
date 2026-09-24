import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import { useServiceStore } from '@/hooks/useServiceHub'
import { useStatusStore } from '@/stores/status-store'
import { FakeEventSource } from './fake-event-source'

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
  useStatusStore.getState().reset()
  useServiceStore.setState({ serviceHub: null })
  FakeEventSource.reset()
})

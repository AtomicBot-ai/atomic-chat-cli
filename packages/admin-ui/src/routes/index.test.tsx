import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { initializeServiceHubStore } from '@/hooks/useServiceHub'
import { createServiceHub } from '@/services'
import type { EventSourceFactory } from '@/services/events'
import { useStatusStore } from '@/stores/status-store'
import { FakeEventSource } from '@/test/fake-event-source'
import { jsonResponse, statusFixture } from '@/test/fixtures'
import { Route } from './index'

const Dashboard = Route.options.component as ComponentType

describe('Dashboard', () => {
  beforeEach(() => {
    initializeServiceHubStore(
      createServiceHub({ eventSource: FakeEventSource as unknown as EventSourceFactory })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the daemon, core, API server, sessions, host steps and build from the store', () => {
    act(() => useStatusStore.setState({ status: statusFixture(), loading: false, updatedAt: Date.now() }))

    render(<Dashboard />)

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('4242')).toBeInTheDocument()
    expect(screen.getByText('/srv/atc-data')).toBeInTheDocument()
    expect(screen.getByText('0.4.0')).toBeInTheDocument()
    expect(screen.getByText('inst-42')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('0.0.0.0:1337')).toBeInTheDocument()
    expect(screen.getByText('qwen3-8b-q4')).toBeInTheDocument()
    expect(screen.getByText('llamacpp-upstream')).toBeInTheDocument()
    expect(screen.getByText('Run: sudo atc setup --continue')).toBeInTheDocument()
    expect(screen.getByText('build-deadbeef')).toBeInTheDocument()
    expect(screen.getByText('http://127.0.0.1:1338')).toBeInTheDocument()
  })

  it('shows the empty states and a stopped server', () => {
    act(() =>
      useStatusStore.setState({
        status: statusFixture({
          sessions: [],
          pending_host_steps: [],
          api: {
            running: false,
            host: '127.0.0.1',
            port: 1337,
            prefix: '/v1',
            requires_api_key: false,
            pid: null,
          },
        }),
      })
    )

    render(<Dashboard />)

    expect(screen.getByText('Stopped')).toBeInTheDocument()
    expect(screen.getByText('No model is loaded.')).toBeInTheDocument()
    expect(screen.getByText('Nothing pending.')).toBeInTheDocument()
  })

  it('shows skeletons before the first status and the error when the fetch failed', () => {
    act(() => useStatusStore.setState({ status: null, loading: true }))
    render(<Dashboard />)
    expect(screen.queryByText('Running')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled()

    act(() => useStatusStore.setState({ loading: false, error: 'The admin API did not answer: boom' }))

    expect(screen.getByRole('alert')).toHaveTextContent('did not answer')
    expect(screen.getByRole('button', { name: /refresh/i })).toBeEnabled()
  })

  it('refreshes through the hub on demand', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(200, statusFixture({ core: { ...statusFixture().core, version: '0.5.0' } }))
      )
    vi.stubGlobal('fetch', fetchMock)
    act(() => useStatusStore.setState({ status: statusFixture() }))
    render(<Dashboard />)
    expect(screen.getByText('0.4.0')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => expect(screen.getByText('0.5.0')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/status', expect.objectContaining({ method: 'GET' }))
  })
})

import { describe, expect, it } from 'vitest'
import { INITIAL_SETUP_STATE, setupTransition } from './managed-environment.js'
import type { SetupEvent } from './managed-environment.js'

describe('setupTransition', () => {
  it('walks the happy path with a relogin in the middle', () => {
    const events: SetupEvent[] = [
      { type: 'probe', availability: 'setup-required' },
      { type: 'consent' },
      { type: 'phase', phase: 'preparing-host' },
      { type: 'phase', phase: 'relogin-required' },
      { type: 'resume' },
      { type: 'phase', phase: 'pulling-image' },
      { type: 'phase', phase: 'ready' },
    ]
    const states = events.reduce<string[]>(
      (acc, e) => [...acc, setupTransition(acc.at(-1) as never, e)],
      [INITIAL_SETUP_STATE]
    )
    expect(states).toEqual([
      'not-installed',
      'consent',
      'installing',
      'elevating',
      'relogin-required',
      'installing',
      'installing',
      'ready',
    ])
  })

  it('handles declines, blocks and cancellation', () => {
    expect(setupTransition('consent', { type: 'decline' })).toBe('not-installed')
    expect(setupTransition('installing', { type: 'decline' })).toBe('installing')
    expect(setupTransition('not-installed', { type: 'probe', availability: 'unsupported' })).toBe('failed')
    expect(setupTransition('ready', { type: 'probe', availability: 'setup-required' })).toBe('ready')
    expect(setupTransition('installing', { type: 'phase', phase: 'cancelled' })).toBe('not-installed')
    expect(setupTransition('installing', { type: 'phase', phase: 'cancelling' })).toBe('installing')
    expect(setupTransition('failed', { type: 'resume' })).toBe('installing')
  })
})

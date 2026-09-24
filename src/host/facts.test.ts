import { describe, expect, it } from 'vitest'
import { hostFacts } from './facts.js'

const base = {
  arch: 'x64',
  env: {},
  hasTty: false,
  euid: 1000,
  username: 'u',
  homedir: '/home/u',
  hostname: 'h',
  onPath: () => false,
}

describe('hostFacts', () => {
  it('sees root, sudo and a display on linux', () => {
    const f = hostFacts({
      ...base,
      platform: 'linux',
      euid: 0,
      env: { DISPLAY: ':0' },
      onPath: (n) => n === 'sudo',
    })
    expect(f).toMatchObject({
      isRoot: true,
      hasDisplay: true,
      hasSudo: true,
      hasPkexec: false,
      isElevatedWindows: null,
    })
  })

  it('has no euid or sudo on windows and keeps elevation unknown until probed', () => {
    const f = hostFacts({ ...base, platform: 'win32', euid: null, onPath: () => true })
    expect(f).toMatchObject({ isRoot: false, hasSudo: false, hasPkexec: false, isElevatedWindows: null })
    expect(
      hostFacts({ ...base, platform: 'win32', euid: null, isElevatedWindows: true }).isElevatedWindows
    ).toBe(true)
  })

  it('treats macOS as always having a display', () => {
    expect(hostFacts({ ...base, platform: 'darwin' }).hasDisplay).toBe(true)
  })
})

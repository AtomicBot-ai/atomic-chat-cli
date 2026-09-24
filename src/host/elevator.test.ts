import { describe, expect, it } from 'vitest'
import { createElevator, manualInstructions, selectStrategy } from './elevator.js'
import type { ElevationContext } from './elevator.js'

const linux: ElevationContext = {
  platform: 'linux',
  isRoot: false,
  isElevatedWindows: null,
  hasTty: false,
  hasDisplay: false,
  hasPkexec: false,
  hasSudo: true,
  inDaemon: true,
}

describe('selectStrategy', () => {
  it.each<[string, Partial<ElevationContext>, string]>([
    ['root wins everywhere', { isRoot: true }, 'root'],
    ['headless daemon falls back to manual', {}, 'manual'],
    ['desktop daemon uses pkexec', { hasDisplay: true, hasPkexec: true }, 'pkexec'],
    ['a command on a terminal uses sudo', { inDaemon: false, hasTty: true }, 'sudo-tty'],
    ['a command without sudo is manual', { inDaemon: false, hasTty: true, hasSudo: false }, 'manual'],
    ['a command without a terminal is manual', { inDaemon: false, hasTty: false }, 'manual'],
    ['elevated windows is root', { platform: 'win32', isElevatedWindows: true }, 'root'],
    ['windows daemon asks UAC', { platform: 'win32', isElevatedWindows: false }, 'windows-runas'],
    [
      'windows command without terminal is manual',
      { platform: 'win32', isElevatedWindows: false, inDaemon: false },
      'manual',
    ],
  ])('%s', (_name, over, expected) => {
    expect(selectStrategy({ ...linux, ...over })).toBe(expected)
  })
})

describe('createElevator', () => {
  it('runs the helper as root and reads its result file', async () => {
    const calls: string[][] = []
    const elevator = createElevator(
      {
        exec: async (cmd, args) => {
          calls.push([cmd, ...args])
          return { code: 0, stdout: '', stderr: '', timedOut: false }
        },
        selfCommand: ['/bin/atc'],
        readResult: async () => ({
          schema_version: 1,
          step_id: 's',
          outcome: 'completed',
          exit_code: 0,
          log_tail: '',
          finished_at: 1,
        }),
      },
      'linux'
    )
    const outcome = await elevator.run('root', '/tmp/s.request.json')
    expect(calls).toEqual([['/bin/atc', 'host-step', 'exec', '/tmp/s.request.json']])
    expect(outcome).toMatchObject({ kind: 'result', result: { outcome: 'completed' } })
  })

  it('hands back instructions for manual, and names the strategy that is not built yet', async () => {
    const elevator = createElevator(
      {
        exec: async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }),
        selfCommand: ['/bin/atc'],
        readResult: async () => undefined,
      },
      'linux'
    )
    const manual = await elevator.run('manual', '/tmp/s.request.json')
    expect(manual).toEqual({
      kind: 'pending',
      instructions: 'sudo /bin/atc host-step exec /tmp/s.request.json',
    })
    await expect(elevator.run('sudo-tty', '/tmp/s.request.json')).rejects.toMatchObject({
      code: 'ATC_NOT_IMPLEMENTED',
    })
    expect(manualInstructions(['C:\\atc.exe'], 'C:\\r j.json', 'win32')).toContain('Administrator')
  })
})

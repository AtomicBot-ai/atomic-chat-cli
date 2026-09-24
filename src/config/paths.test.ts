import { describe, expect, it } from 'vitest'
import type { DataFolderEnv } from '@atomic-chat/core/host'
import { resolveAtcPaths } from './paths.js'

const linux = (env: NodeJS.ProcessEnv = {}): DataFolderEnv => ({
  platform: 'linux',
  env,
  homedir: '/home/u',
  exists: () => false,
  readFile: () => undefined,
})

describe('resolveAtcPaths', () => {
  it('defaults to the core CLI folder and derives the atc files', () => {
    const paths = resolveAtcPaths(linux())
    expect(paths.dataFolder).toBe('/home/u/.local/share/atomic-chat-cli/data')
    expect(paths.configFile).toBe('/home/u/.local/share/atomic-chat-cli/data/atc/config.json')
    expect(paths.daemonRecord).toBe('/home/u/.local/share/atomic-chat-cli/data/atc/run/daemon.json')
    expect(paths.layout.core.instanceLock).toBe(
      '/home/u/.local/share/atomic-chat-cli/data/atomic-core/instance.lock'
    )
  })

  it('prefers the flag over the environment', () => {
    expect(resolveAtcPaths(linux({ ATC_DATA_FOLDER: '/from-env' })).dataFolder).toBe('/from-env')
    expect(resolveAtcPaths(linux({ ATC_DATA_FOLDER: '/from-env' }), '/from-flag').dataFolder).toBe(
      '/from-flag'
    )
  })

  it("refuses the desktop app's folder", () => {
    expect(() => resolveAtcPaths(linux(), '/home/u/.local/share/Atomic Chat/data')).toThrow(
      /application data folder/
    )
  })
})

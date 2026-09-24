/**
 * Where everything lives. The data folder is the core's CLI-scope folder (`<system data>/
 * atomic-chat-cli/data`, never the desktop app's), resolved by the core's own rules so both agree;
 * `atc/` inside it holds what only `atc` owns. Pure: the environment is injected.
 */

import { join } from 'node:path'
import { assertCliDataFolder, dataLayout, resolveCliDataFolder } from '@atomic-chat/core/host'
import type { DataFolderEnv, DataLayout } from '@atomic-chat/core/host'
import { AtcError } from '../errors/index.js'

/** `atc`'s own override; the core's `ATOMIC_CORE_DATA_FOLDER` is only consulted by the assert. */
export const ATC_DATA_FOLDER_ENV = 'ATC_DATA_FOLDER'

export interface AtcPaths {
  dataFolder: string
  /** The core's layout of the same folder. */
  layout: DataLayout
  atcDir: string
  configFile: string
  secretsFile: string
  runDir: string
  daemonRecord: string
  adminToken: string
  hostStepsDir: string
  hostStepsJournal: string
  logsDir: string
  daemonLog: string
  cacheDir: string
}

export function atcPathsFor(dataFolder: string): AtcPaths {
  const atcDir = join(dataFolder, 'atc')
  const runDir = join(atcDir, 'run')
  const logsDir = join(atcDir, 'logs')
  return {
    dataFolder,
    layout: dataLayout(dataFolder),
    atcDir,
    configFile: join(atcDir, 'config.json'),
    secretsFile: join(atcDir, 'secrets.json'),
    runDir,
    daemonRecord: join(runDir, 'daemon.json'),
    adminToken: join(runDir, 'admin-token'),
    hostStepsDir: join(runDir, 'host-steps'),
    hostStepsJournal: join(runDir, 'host-steps', 'journal.json'),
    logsDir,
    daemonLog: join(logsDir, 'daemon.log'),
    cacheDir: join(atcDir, 'cache'),
  }
}

/** `--data-folder` > `ATC_DATA_FOLDER` > the core's CLI default; the app's folder is refused. */
export function resolveAtcPaths(env: DataFolderEnv, override?: string): AtcPaths {
  const fromEnv = env.env[ATC_DATA_FOLDER_ENV]
  const folder = override ?? (fromEnv && fromEnv.trim() !== '' ? fromEnv : resolveCliDataFolder(env))
  try {
    assertCliDataFolder(folder, env)
  } catch (error) {
    throw new AtcError('ATC_CONFIG_INVALID', (error as Error).message, {
      hint: 'pass --data-folder with a folder of its own',
    })
  }
  return atcPathsFor(folder)
}

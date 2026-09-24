/** Facts about the machine and the session `atc` runs in, gathered once and injected everywhere. */

import { hostname, userInfo } from 'node:os'
import type { AtcIo } from '../io.js'
import { findOnPath } from './exec.js'

export interface HostFacts {
  platform: NodeJS.Platform
  arch: string
  /** Effective uid, null on Windows. */
  euid: number | null
  isRoot: boolean
  /** Null when not on Windows or not yet probed. */
  isElevatedWindows: boolean | null
  hasTty: boolean
  /** A graphical session (`DISPLAY`/`WAYLAND_DISPLAY`), where a polkit agent can prompt. */
  hasDisplay: boolean
  hasSudo: boolean
  hasPkexec: boolean
  username: string
  homedir: string
  hostname: string
}

export interface FactsInput {
  platform: NodeJS.Platform
  arch: string
  env: NodeJS.ProcessEnv
  hasTty: boolean
  euid: number | null
  username: string
  homedir: string
  hostname: string
  onPath: (name: string) => boolean
  isElevatedWindows?: boolean | null
}

export function hostFacts(input: FactsInput): HostFacts {
  const win = input.platform === 'win32'
  return {
    platform: input.platform,
    arch: input.arch,
    euid: input.euid,
    isRoot: !win && input.euid === 0,
    isElevatedWindows: win ? (input.isElevatedWindows ?? null) : null,
    hasTty: input.hasTty,
    hasDisplay: Boolean(input.env['DISPLAY'] || input.env['WAYLAND_DISPLAY']) || input.platform === 'darwin',
    hasSudo: !win && input.onPath('sudo'),
    hasPkexec: input.platform === 'linux' && input.onPath('pkexec'),
    username: input.username,
    homedir: input.homedir,
    hostname: input.hostname,
  }
}

export function nodeHostFacts(io: AtcIo): HostFacts {
  const user = userInfo()
  return hostFacts({
    platform: process.platform,
    arch: process.arch,
    env: io.env,
    hasTty: io.isTTY.stdin && io.isTTY.stderr,
    euid: typeof process.geteuid === 'function' ? process.geteuid() : null,
    username: user.username,
    homedir: user.homedir,
    hostname: hostname(),
    onPath: (name) => findOnPath(name, io.env, process.platform) !== undefined,
  })
}

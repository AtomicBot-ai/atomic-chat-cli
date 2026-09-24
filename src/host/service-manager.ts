/**
 * Running the daemon as an OS service. This iteration ships the unit templates (snapshot-tested)
 * and the interface; installing them is iteration 6. Windows has no SCM-aware Bun binary, so the
 * plan there is a logon task first and a service wrapper later.
 */

import { AtcError } from '../errors/index.js'

export interface ServiceOptions {
  /** `atc` by default; a second data folder gets its own name. */
  name: string
  execPath: string
  dataFolder: string
  /** System-wide (root, `/etc/systemd/system`) rather than the current user. */
  system: boolean
  user: string
}

export type ServiceStatus = 'installed' | 'absent' | 'unknown'

export interface ServiceManager {
  install(options: ServiceOptions): Promise<void>
  uninstall(options: ServiceOptions): Promise<void>
  status(options: ServiceOptions): Promise<ServiceStatus>
}

export function systemdUnit(o: ServiceOptions): string {
  return [
    '[Unit]',
    'Description=Atomic Chat server (atc)',
    'After=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `ExecStart=${o.execPath} run --no-model --data-folder ${o.dataFolder}`,
    `ExecStop=${o.execPath} stop --data-folder ${o.dataFolder}`,
    'Restart=on-failure',
    'RestartSec=5',
    'KillMode=mixed',
    'TimeoutStopSec=45',
    ...(o.system ? [`User=${o.user}`] : []),
    '',
    '[Install]',
    `WantedBy=${o.system ? 'multi-user.target' : 'default.target'}`,
    '',
  ].join('\n')
}

export function launchdPlist(o: ServiceOptions): string {
  const label = `ai.atomic.${o.name}`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${label}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${o.execPath}</string>`,
    '    <string>run</string>',
    '    <string>--no-model</string>',
    '    <string>--data-folder</string>',
    `    <string>${o.dataFolder}</string>`,
    '  </array>',
    '  <key>RunAtLoad</key><true/>',
    '  <key>KeepAlive</key><true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n')
}

/** A logon task: the closest thing to a service a plain executable gets without a wrapper. */
export function schtasksCreateArgs(o: ServiceOptions): string[] {
  return [
    '/Create',
    '/F',
    '/SC',
    'ONLOGON',
    '/RL',
    'LIMITED',
    '/TN',
    o.name,
    '/TR',
    `"${o.execPath}" run --no-model --data-folder "${o.dataFolder}"`,
  ]
}

export function servicePathFor(platform: NodeJS.Platform, o: ServiceOptions, home: string): string {
  if (platform === 'linux')
    return o.system
      ? `/etc/systemd/system/${o.name}.service`
      : `${home}/.config/systemd/user/${o.name}.service`
  if (platform === 'darwin')
    return o.system
      ? `/Library/LaunchDaemons/ai.atomic.${o.name}.plist`
      : `${home}/Library/LaunchAgents/ai.atomic.${o.name}.plist`
  return `schtasks:${o.name}`
}

export function notImplementedServiceManager(): ServiceManager {
  const fail = () =>
    Promise.reject(
      new AtcError('ATC_NOT_IMPLEMENTED', 'Service installation is not implemented yet.', {
        details: 'planned for iteration 6 (service, update, doctor completion)',
      })
    )
  return { install: fail, uninstall: fail, status: fail }
}

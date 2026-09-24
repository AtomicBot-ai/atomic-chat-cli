import { describe, expect, it } from 'vitest'
import {
  launchdPlist,
  notImplementedServiceManager,
  schtasksCreateArgs,
  servicePathFor,
  systemdUnit,
} from './service-manager.js'

const o = { name: 'atc', execPath: '/usr/local/bin/atc', dataFolder: '/srv/atc', system: false, user: 'atc' }

describe('service templates', () => {
  it('renders a user systemd unit and a system one with User=', () => {
    const user = systemdUnit(o)
    expect(user).toContain('ExecStart=/usr/local/bin/atc run --no-model --data-folder /srv/atc')
    expect(user).toContain('WantedBy=default.target')
    expect(user).not.toContain('User=')
    const system = systemdUnit({ ...o, system: true })
    expect(system).toContain('User=atc')
    expect(system).toContain('WantedBy=multi-user.target')
  })

  it('renders a launchd plist and schtasks arguments', () => {
    expect(launchdPlist(o)).toContain('<string>ai.atomic.atc</string>')
    expect(launchdPlist(o)).toContain('<key>KeepAlive</key><true/>')
    expect(schtasksCreateArgs(o)).toContain('ONLOGON')
  })

  it('knows where each platform keeps the definition', () => {
    expect(servicePathFor('linux', o, '/home/u')).toBe('/home/u/.config/systemd/user/atc.service')
    expect(servicePathFor('linux', { ...o, system: true }, '/home/u')).toBe('/etc/systemd/system/atc.service')
    expect(servicePathFor('darwin', o, '/Users/u')).toBe('/Users/u/Library/LaunchAgents/ai.atomic.atc.plist')
    expect(servicePathFor('win32', o, 'C:\\u')).toBe('schtasks:atc')
  })

  it('is a stub for now', async () => {
    await expect(notImplementedServiceManager().install(o)).rejects.toMatchObject({
      code: 'ATC_NOT_IMPLEMENTED',
    })
  })
})

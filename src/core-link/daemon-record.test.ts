import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readDaemonRecord, removeDaemonRecord, writeDaemonRecord } from './daemon-record.js'

const dir = mkdtempSync(join(tmpdir(), 'atc-rec-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('daemon record', () => {
  it('round-trips and only removes its own', async () => {
    const path = join(dir, 'run', 'daemon.json')
    const record = {
      schema_version: 1 as const,
      pid: 1,
      instance_id: 'i1',
      atc_version: '0',
      core_version: '0',
      control_url: 'http://x',
      admin_url: null,
      started_at: 0,
    }
    await writeDaemonRecord(path, record)
    expect(await readDaemonRecord(path)).toEqual(record)
    await removeDaemonRecord(path, 'other')
    expect(await readDaemonRecord(path)).toEqual(record)
    await removeDaemonRecord(path, 'i1')
    expect(await readDaemonRecord(path)).toBeUndefined()
    expect(await readDaemonRecord(join(dir, 'missing'))).toBeUndefined()
  })
})

/**
 * `<data>/atc/run/daemon.json`: what the `atc` daemon publishes about itself beyond the core's
 * lock — its admin address and versions — and the proof that the owner of the folder is an `atc`
 * daemon at all, not the core's own CLI daemon on the same folder (which has no admin server and
 * no host-step loop). A record whose `instance_id` differs from the lock's is stale.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DaemonRecord {
  schema_version: 1
  pid: number
  instance_id: string
  atc_version: string
  core_version: string
  control_url: string
  admin_url: string | null
  started_at: number
}

export async function readDaemonRecord(path: string): Promise<DaemonRecord | undefined> {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as Partial<DaemonRecord>
    if (raw.schema_version !== 1 || typeof raw.instance_id !== 'string' || typeof raw.pid !== 'number')
      return undefined
    return raw as DaemonRecord
  } catch {
    return undefined
  }
}

export async function writeDaemonRecord(path: string, record: DaemonRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${record.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`)
  await rename(tmp, path)
}

export async function removeDaemonRecord(path: string, instanceId: string): Promise<void> {
  const current = await readDaemonRecord(path)
  if (current && current.instance_id !== instanceId) return // a newer daemon already owns the file
  await rm(path, { force: true })
}

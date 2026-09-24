/**
 * Reading and writing `config.json` and `secrets.json`: atomic (tmp + rename), secrets at 0600,
 * unknown keys round-tripped.
 */

import { mkdir, readFile, rename, writeFile, chmod } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AtcConfig } from './schema.js'

async function writeAtomic(path: string, text: string, mode: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, text, { mode })
  await rename(tmp, path)
  await chmod(path, mode).catch(() => undefined)
}

export async function readTextFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

/** The document as written: the typed config merged over the preserved unknown keys. */
export function configDocument(config: AtcConfig, extra: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = structuredClone(extra)
  for (const [section, value] of Object.entries(config)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const existing = merged[section]
      merged[section] = {
        ...(existing && typeof existing === 'object' ? (existing as object) : {}),
        ...(value as object),
      }
    } else merged[section] = value
  }
  return merged
}

export async function writeConfigFile(
  path: string,
  config: AtcConfig,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await writeAtomic(path, `${JSON.stringify(configDocument(config, extra), null, 2)}\n`, 0o644)
}

export interface AtcSecrets {
  hfToken?: string
  adminPassword?: string
}

export async function readSecrets(path: string): Promise<AtcSecrets> {
  const text = await readTextFile(path)
  if (text === undefined) return {}
  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    return {
      ...(typeof raw['hfToken'] === 'string' ? { hfToken: raw['hfToken'] } : {}),
      ...(typeof raw['adminPassword'] === 'string' ? { adminPassword: raw['adminPassword'] } : {}),
    }
  } catch {
    return {}
  }
}

export async function writeSecrets(path: string, secrets: AtcSecrets): Promise<void> {
  await writeAtomic(path, `${JSON.stringify(secrets, null, 2)}\n`, 0o600)
}

/**
 * Config file versions. A file newer than this build is refused rather than half-read; an older
 * one is migrated forward step by step, each step a pure function of the raw document.
 */

import { AtcError } from '../errors/index.js'
import { CONFIG_VERSION } from './schema.js'

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/** Key N migrates a version-N document to N+1. Empty until the schema changes. */
export const MIGRATIONS: Record<number, Migration> = {}

export function migrateConfig(raw: Record<string, unknown>): {
  raw: Record<string, unknown>
  migratedFrom?: number
} {
  const version = typeof raw['version'] === 'number' ? raw['version'] : 1
  if (version > CONFIG_VERSION) {
    throw new AtcError(
      'ATC_CONFIG_INVALID',
      `The config file is version ${version}; this atc understands ${CONFIG_VERSION}.`,
      {
        hint: 'update atc (`atc update`) or move the file aside',
      }
    )
  }
  if (version === CONFIG_VERSION) return { raw: { ...raw, version } }
  let current = { ...raw, version }
  for (let v = version; v < CONFIG_VERSION; v += 1) {
    const step = MIGRATIONS[v]
    if (!step) throw new AtcError('ATC_CONFIG_MIGRATION_FAILED', `No migration from config version ${v}.`)
    current = { ...step(current), version: v + 1 }
  }
  return { raw: current, migratedFrom: version }
}

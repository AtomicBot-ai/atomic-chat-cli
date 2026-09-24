/** A fresh data folder per test, with the `atc/` layout, removed afterwards. */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { atcPathsFor } from '../../src/config/index.js'
import type { AtcPaths } from '../../src/config/index.js'

export function tmpDataFolder(prefix = 'atc-data-'): { paths: AtcPaths; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), prefix))
  return {
    paths: atcPathsFor(join(root, 'data')),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

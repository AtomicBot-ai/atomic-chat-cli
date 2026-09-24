/**
 * No test touches the real data folder: both `atc` and the core resolve it from these variables,
 * set once per worker to a fresh temporary directory (atomic-agent's state-dir trick).
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const folder = mkdtempSync(join(tmpdir(), 'atc-test-'))
process.env['ATC_DATA_FOLDER'] = join(folder, 'data')
process.env['ATOMIC_CORE_DATA_FOLDER'] = join(folder, 'app-data')

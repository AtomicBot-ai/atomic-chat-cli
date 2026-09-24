import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { adminLoginUrl, ensureAdminToken, readAdminToken, rotateAdminToken, tokensMatch } from './token.js'

const dir = mkdtempSync(join(tmpdir(), 'atc-token-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('admin token', () => {
  it('creates once, keeps, rotates, and stays private', async () => {
    const path = join(dir, 'run', 'admin-token')
    const first = await ensureAdminToken(path)
    expect(first.length).toBeGreaterThanOrEqual(43)
    expect(await ensureAdminToken(path)).toBe(first)
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600)
    const rotated = await rotateAdminToken(path)
    expect(rotated).not.toBe(first)
    expect(await readAdminToken(path)).toBe(rotated)
    expect(tokensMatch(rotated, rotated)).toBe(true)
    expect(tokensMatch(first, rotated)).toBe(false)
    expect(tokensMatch(undefined, rotated)).toBe(false)
    expect(adminLoginUrl('http://127.0.0.1:1338/', 't')).toBe('http://127.0.0.1:1338/#token=t')
  })
})

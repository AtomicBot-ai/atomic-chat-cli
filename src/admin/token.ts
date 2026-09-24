/**
 * The admin token: 32 random bytes in `<data>/atc/run/admin-token` (0600). `atc admin` puts it in
 * the URL fragment, the SPA trades it for a cookie once, and it never appears in a query string or
 * a server log.
 */

import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const ADMIN_TOKEN_BYTES = 32

export function generateAdminToken(): string {
  return randomBytes(ADMIN_TOKEN_BYTES).toString('base64url')
}

export async function readAdminToken(path: string): Promise<string | undefined> {
  try {
    const text = (await readFile(path, 'utf8')).trim()
    return text.length >= 32 ? text : undefined
  } catch {
    return undefined
  }
}

export async function writeAdminToken(path: string, token: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${token}\n`, { mode: 0o600 })
  await chmod(path, 0o600).catch(() => undefined)
}

export async function ensureAdminToken(path: string): Promise<string> {
  const existing = await readAdminToken(path)
  if (existing) return existing
  const token = generateAdminToken()
  await writeAdminToken(path, token)
  return token
}

export async function rotateAdminToken(path: string): Promise<string> {
  const token = generateAdminToken()
  await writeAdminToken(path, token)
  return token
}

export function adminLoginUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/#token=${token}`
}

/** Constant-time comparison so a token cannot be guessed byte by byte. */
export function tokensMatch(presented: string | undefined, expected: string): boolean {
  if (!presented || presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

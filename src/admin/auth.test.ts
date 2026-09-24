import { describe, expect, it } from 'vitest'
import { parseCookies, sessionCookie, SessionStore } from './auth.js'

describe('SessionStore', () => {
  it('validates live sessions, expires idle ones, revokes all', () => {
    let t = 0
    const store = new SessionStore(() => t, 100)
    const id = store.create()
    expect(store.validate(id)).toBe(true)
    t = 50
    expect(store.validate(id)).toBe(true)
    t = 200
    expect(store.validate(id)).toBe(false)
    const other = store.create()
    store.revokeAll()
    expect(store.validate(other)).toBe(false)
    expect(store.validate(undefined)).toBe(false)
  })
})

describe('cookies', () => {
  it('parses and formats', () => {
    expect(parseCookies('a=1; atc_session=x%20y; broken')).toEqual({ a: '1', atc_session: 'x y' })
    expect(sessionCookie('abc')).toBe('atc_session=abc; Path=/; HttpOnly; SameSite=Strict')
    expect(sessionCookie('abc', { secure: true })).toContain('; Secure')
  })
})

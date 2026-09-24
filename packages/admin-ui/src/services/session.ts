/**
 * The browser's session with the daemon. `atc admin` prints `http://127.0.0.1:1338/#token=<token>`;
 * the SPA trades the token for an HttpOnly cookie once and scrubs it from the URL, so it never sits
 * in the history or a bookmark. Without a token, the sign-in screen accepts one pasted in.
 */

import type { AdminApi } from './admin-api'

export type BootstrapResult = 'signed-in' | 'refused' | 'none'

export interface SessionService {
  login(token: string): Promise<void>
  logout(): Promise<void>
  /** The `#token=` fragment, read once and removed from the URL; null when there is none. */
  consumeHashToken(): string | null
  /** On load: sign in with the fragment token if there is one. Memoised, so StrictMode's double effect is one login. */
  bootstrap(): Promise<BootstrapResult>
}

export function consumeHashToken(win: Pick<Window, 'location' | 'history'> = window): string | null {
  const match = /(?:^#|&)token=([^&]+)/.exec(win.location.hash)
  if (!match) return null
  let token = match[1]
  try {
    token = decodeURIComponent(token)
  } catch {
    /* keep it as typed */
  }
  win.history.replaceState(null, '', `${win.location.pathname}${win.location.search}`)
  return token
}

export function createSessionService(api: AdminApi, onSignedOut?: () => void): SessionService {
  let pending: Promise<BootstrapResult> | null = null
  return {
    login: (token) => api.login(token.trim()),
    async logout() {
      try {
        await api.logout()
      } finally {
        onSignedOut?.()
      }
    },
    consumeHashToken: () => consumeHashToken(),
    bootstrap() {
      pending ??= (async () => {
        const token = consumeHashToken()
        if (!token) return 'none'
        try {
          await api.login(token)
          return 'signed-in'
        } catch {
          return 'refused'
        }
      })()
      return pending
    },
  }
}

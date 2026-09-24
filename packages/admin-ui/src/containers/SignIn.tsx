import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useServiceHub } from '@/hooks/useServiceHub'
import { describeError } from '@/services/admin-api'
import { useStatusStore } from '@/stores/status-store'

interface SignInProps {
  /** The `#token=` in the URL was refused: say so instead of a blank form. */
  refused?: boolean
}

export function SignIn({ refused = false }: SignInProps) {
  const hub = useServiceHub()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    refused ? 'The token in the link was refused. Run `atc admin` again for a fresh one.' : null
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = token.trim()
    if (!value) return
    setBusy(true)
    setError(null)
    try {
      await hub.session().login(value)
      await useStatusStore.getState().refresh()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="size-5" aria-hidden />
            Sign in to atc admin
          </CardTitle>
          <CardDescription>This browser has no session with the daemon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              On the server, run <code className="rounded bg-muted px-1.5 py-0.5">atc admin</code>.
            </li>
            <li>Open the link it prints. It carries a one-time token that signs this browser in.</li>
          </ol>
          <form onSubmit={submit} className="space-y-3">
            <label htmlFor="admin-token" className="block text-muted-foreground">
              Or paste the token here
            </label>
            <div className="flex gap-2">
              <Input
                id="admin-token"
                name="token"
                autoComplete="off"
                spellCheck={false}
                placeholder="admin token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !token.trim()}>
                Sign in
              </Button>
            </div>
            {error ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

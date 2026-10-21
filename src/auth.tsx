import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CoupleMark } from './components/Brand.tsx'
import { Button, Field, fieldClass } from './components/ui.tsx'
import { cloudReady, FINANCE_OK, signIn, supabase } from './lib/cloud.ts'
import { openRoutine } from './routine/door.ts'

export function HouseGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      const active = Boolean(data.session)
      setSignedIn(active)
      setUnlocked(active && sessionStorage.getItem(FINANCE_OK) === '1')
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(password)
      sessionStorage.setItem(FINANCE_OK, '1')
      setUnlocked(true)
    } catch {
      setError('Senha incorreta.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return <p className="grid min-h-screen place-items-center bg-paper px-6 text-sm text-ink-soft">Abrindo a casa…</p>
  }

  if (!cloudReady) {
    return (
      <p className="grid min-h-screen place-items-center bg-paper px-6 text-center text-sm text-ink-soft">
        A casa ainda não está ligada na internet.
      </p>
    )
  }

  if (!signedIn || !unlocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-6">
        <form onSubmit={(event) => void submit(event)} className="w-full max-w-sm">
          <CoupleMark />
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            A senha é a mesma para você e para o Vinicius. O que um lançar, o outro vê.
          </p>
          <div className="mt-6">
            <Field label="Senha da casa">
              <input
                className={fieldClass}
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
          <Button type="submit" className="mt-4 w-full" disabled={busy || password.length === 0}>
            Entrar
          </Button>
          <button type="button" onClick={openRoutine} className="mt-4 w-full text-sm font-medium text-ink-soft hover:text-ink">
            Cantinho da rotina
          </button>
        </form>
      </div>
    )
  }

  return children
}

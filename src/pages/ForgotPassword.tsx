import { useState, useCallback } from 'react'
import { authApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Turnstile } from '@/components/ui/Turnstile'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthError } from '@/components/auth/AuthError'
import { AuthSuccessCard } from '@/components/auth/AuthSuccessCard'

interface ForgotPasswordProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export function ForgotPassword({ onNavigate }: ForgotPasswordProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const handleTurnstileVerify = useCallback((token: string) => { setTurnstileToken(token); }, [])

  function validateEmail() {
    if (!email.trim()) {
      setEmailError('Inserisci la tua email')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Formato email non valido')
    } else {
      setEmailError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await authApi.forgotPassword(email, turnstileToken)

    if (result.success) {
      setSubmitted(true)
    } else {
      setError(result.message || 'Errore durante la richiesta')
    }

    setLoading(false)
  }

  if (submitted) {
    return (
      <AuthShell>
        <AuthSuccessCard
          icon="✉️"
          title="Controlla la tua email"
          message={
            <>
              Se l'indirizzo email esiste nel nostro sistema, riceverai un link per reimpostare la
              password. Controlla anche la cartella spam.
            </>
          }
          action={
            <button
              type="button"
              onClick={() => { onNavigate('login'); }}
              className="text-sm text-primary-400 hover:text-primary-300 font-medium"
            >
              ← Torna al login
            </button>
          }
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl sm:text-2xl font-bold text-white text-center">Password dimenticata?</h1>
      <p className="text-sm text-gray-400 text-center mt-1 mb-6">
        Inserisci la tua email e ti invieremo un link per reimpostare la password.
      </p>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-5">
        {error && <AuthError message={error} />}

        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
          onBlur={validateEmail}
          placeholder="La tua email"
          required
          error={emailError || undefined}
        />

        <Turnstile onVerify={handleTurnstileVerify} />

        <Button type="submit" size="xl" disabled={loading || !email} className="w-full" isLoading={loading}>
          Invia link di reset
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => { onNavigate('login'); }}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Torna al login
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

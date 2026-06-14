import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthError } from '@/components/auth/AuthError'
import { AuthSuccessCard } from '@/components/auth/AuthSuccessCard'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { validatePassword } from '@/utils/password-policy'

interface ResetPasswordProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

const REDIRECT_SECONDS = 5

export function ResetPassword({ onNavigate }: ResetPasswordProps) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    if (!token) {
      setError('Token mancante. Richiedi un nuovo link di reset.')
    }
  }, [token])

  // Visible countdown on success → auto-redirect to login (cancellable via explicit button).
  useEffect(() => {
    if (!success) return
    if (countdown <= 0) {
      onNavigate('login')
      return
    }
    const t = setTimeout(() => { setCountdown(c => c - 1) }, 1000)
    return () => { clearTimeout(t) }
  }, [success, countdown, onNavigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Le password non corrispondono')
      return
    }

    const policy = validatePassword(password)
    if (!policy.valid) {
      setError(policy.message ?? 'Password non valida')
      return
    }

    setLoading(true)

    const result = await authApi.resetPassword(token ?? '', password)

    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.message || 'Errore durante il reset della password')
    }

    setLoading(false)
  }

  if (success) {
    return (
      <AuthShell>
        <AuthSuccessCard
          icon="✓"
          title="Password aggiornata!"
          message={
            <>
              La tua password è stata reimpostata con successo. Verrai reindirizzato al login tra{' '}
              <b className="text-white">{countdown}s</b>.
            </>
          }
          action={
            <Button type="button" size="lg" className="w-full" onClick={() => { onNavigate('login'); }}>
              Vai al login
            </Button>
          }
        />
      </AuthShell>
    )
  }

  if (!token) {
    return (
      <AuthShell>
        <AuthSuccessCard
          tone="danger"
          icon="⚠"
          title="Link non valido"
          message="Il link di reset non è valido o è scaduto. Richiedi un nuovo link."
          action={
            <Button type="button" size="lg" className="w-full" onClick={() => { onNavigate('forgot-password'); }}>
              Richiedi nuovo link
            </Button>
          }
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl sm:text-2xl font-bold text-white text-center">Nuova password</h1>
      <p className="text-sm text-gray-400 text-center mt-1 mb-6">
        Scegli una password sicura per il tuo account.
      </p>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-5">
        {error && <AuthError message={error} />}

        <div>
          <Input
            label="Nuova password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); }}
            placeholder="Almeno 8 caratteri"
            required
            autoComplete="new-password"
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <Input
          label="Conferma password"
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); }}
          placeholder="Ripeti la password"
          required
          autoComplete="new-password"
        />

        <Button
          type="submit"
          size="xl"
          disabled={loading || !password || !confirmPassword}
          className="w-full"
          isLoading={loading}
        >
          Reimposta password
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

import { useState, useCallback, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useApiFieldErrors } from '@/hooks/useApiFieldErrors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Turnstile } from '@/components/ui/Turnstile'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthError } from '@/components/auth/AuthError'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { validatePassword } from '@/utils/password-policy'

interface RegisterProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

type RegisterField = 'email' | 'username' | 'password' | 'confirmPassword'

export function Register({ onNavigate }: RegisterProps) {
  const { register } = useAuth()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const handleTurnstileVerify = useCallback((token: string) => { setTurnstileToken(token); }, [])
  const { fieldErrors, generalError, applyApiErrors, clearFieldError, setFieldErrors, resetErrors } =
    useApiFieldErrors<RegisterField>()

  function validateField(field: RegisterField) {
    setFieldErrors(prev => {
      const next = { ...prev }
      if (field === 'email') {
        if (!email.trim()) next.email = 'Inserisci la tua email'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Formato email non valido'
        else next.email = undefined
      }
      if (field === 'username') {
        if (!username.trim()) next.username = 'Inserisci un username'
        else if (username.length < 3) next.username = 'Minimo 3 caratteri'
        else if (username.length > 20) next.username = 'Massimo 20 caratteri'
        else next.username = undefined
      }
      if (field === 'password') {
        next.password = validatePassword(password).message
      }
      if (field === 'confirmPassword') {
        if (confirmPassword && confirmPassword !== password) next.confirmPassword = 'Le password non corrispondono'
        else next.confirmPassword = undefined
      }
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    resetErrors()

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Le password non corrispondono' })
      return
    }

    setIsLoading(true)

    const result = await register(email, username, password, confirmPassword, turnstileToken)

    if (result.success) {
      if (inviteToken) {
        onNavigate('inviteDetail', { token: inviteToken })
      } else {
        onNavigate('login')
      }
    } else {
      applyApiErrors(result, 'Errore durante la registrazione')
    }

    setIsLoading(false)
  }

  return (
    <AuthShell
      logo="🏆"
      brandVariant="gold"
      beforeCard={inviteToken ? (
        <div className="bg-accent-500/10 border border-accent-500/40 rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2.5 text-sm text-accent-400">
          <span aria-hidden="true" className="text-base">✉️</span>
          <span>Sei stato invitato a una lega! Registrati per accettare l'invito.</span>
        </div>
      ) : undefined}
    >
      <h1 className="font-display text-xl sm:text-2xl font-bold text-white text-center">Crea il tuo account</h1>
      <p className="text-sm text-gray-400 text-center mt-1 mb-6">Unisciti alla lega dei tuoi amici</p>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-5">
        {generalError && <AuthError message={generalError} />}

        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={e => { setEmail(e.target.value); clearFieldError('email') }}
          onBlur={() => { validateField('email'); }}
          placeholder="mario@email.com"
          required
          error={fieldErrors.email}
        />

        <Input
          label="Username"
          type="text"
          value={username}
          onChange={e => { setUsername(e.target.value); clearFieldError('username') }}
          onBlur={() => { validateField('username'); }}
          placeholder="MisterRossi"
          required
          minLength={3}
          maxLength={20}
          error={fieldErrors.username}
        />

        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
            onBlur={() => { validateField('password'); }}
            placeholder="••••••••"
            required
            minLength={8}
            error={fieldErrors.password}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <Input
          label="Conferma Password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword') }}
          onBlur={() => { validateField('confirmPassword'); }}
          placeholder="••••••••"
          required
          error={fieldErrors.confirmPassword}
        />

        <Turnstile onVerify={handleTurnstileVerify} />

        <Button type="submit" size="xl" variant="accent" className="w-full" isLoading={isLoading}>
          Crea Account
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-400">
          Hai già un account?{' '}
          <button
            type="button"
            onClick={() => { onNavigate('login'); }}
            className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
          >
            Accedi
          </button>
        </p>
      </div>
    </AuthShell>
  )
}

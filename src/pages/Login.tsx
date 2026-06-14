import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useApiFieldErrors } from '@/hooks/useApiFieldErrors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthError } from '@/components/auth/AuthError'

interface LoginProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

type LoginField = 'emailOrUsername' | 'password'

export function Login({ onNavigate }: LoginProps) {
  const { login } = useAuth()
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { fieldErrors, generalError, applyApiErrors, clearFieldError, setFieldErrors, resetErrors } =
    useApiFieldErrors<LoginField>()

  function validateField(field: LoginField) {
    setFieldErrors(prev => {
      const next = { ...prev }
      if (field === 'emailOrUsername') {
        next.emailOrUsername = emailOrUsername.trim() ? undefined : 'Inserisci email o username'
      }
      if (field === 'password') {
        next.password = password ? undefined : 'Inserisci la password'
      }
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    resetErrors()
    setIsLoading(true)

    const result = await login(emailOrUsername, password)

    if (result.success) {
      onNavigate('dashboard')
    } else {
      applyApiErrors(result, 'Errore durante il login')
    }

    setIsLoading(false)
  }

  return (
    <AuthShell
      afterCard={
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => { onNavigate('rules'); }}
            className="text-sm text-gray-400 hover:text-primary-400 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Leggi le regole del gioco
          </button>
        </div>
      }
    >
      <h1 className="font-display text-xl sm:text-2xl font-bold text-white text-center">Bentornato</h1>
      <p className="text-sm text-gray-400 text-center mt-1 mb-6">Accedi al tuo account</p>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-5">
        {generalError && <AuthError message={generalError} />}

        <Input
          label="Email o Username"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={emailOrUsername}
          onChange={e => { setEmailOrUsername(e.target.value); clearFieldError('emailOrUsername') }}
          onBlur={() => { validateField('emailOrUsername'); }}
          placeholder="mario@email.com"
          required
          error={fieldErrors.emailOrUsername}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
          onBlur={() => { validateField('password'); }}
          placeholder="••••••••"
          required
          error={fieldErrors.password}
        />

        <div className="text-right">
          <button
            type="button"
            onClick={() => { onNavigate('forgot-password'); }}
            className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
          >
            Password dimenticata?
          </button>
        </div>

        <Button type="submit" size="xl" className="w-full" isLoading={isLoading}>
          Accedi
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-400">
          Non hai un account?{' '}
          <button
            type="button"
            onClick={() => { onNavigate('register'); }}
            className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
          >
            Registrati ora
          </button>
        </p>
      </div>
    </AuthShell>
  )
}

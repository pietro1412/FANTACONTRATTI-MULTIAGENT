import { useState, useCallback, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Turnstile } from '../components/ui/Turnstile'

interface RegisterProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface FieldErrors {
  email?: string
  username?: string
  password?: string
  confirmPassword?: string
}

export function Register({ onNavigate }: RegisterProps) {
  const { register } = useAuth()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Le password non corrispondono' })
      return
    }

    setIsLoading(true)

    const result = await register(email, username, password, confirmPassword, turnstileToken)

    if (result.success) {
      if (inviteToken) {
        // Redirect to invite acceptance after registration
        onNavigate('inviteDetail', { token: inviteToken })
      } else {
        onNavigate('login')
      }
    } else {
      // Parse validation errors from API response
      if (result.errors && result.errors.length > 0) {
        const newFieldErrors: FieldErrors = {}
        result.errors.forEach(err => {
          const field = err.path?.[0] as keyof FieldErrors
          if (field && !newFieldErrors[field]) {
            newFieldErrors[field] = err.message
          }
        })
        setFieldErrors(newFieldErrors)

        // If no field-specific errors, show generic message
        if (Object.keys(newFieldErrors).length === 0) {
          setError(result.message || 'Errore durante la registrazione')
        }
      } else {
        setError(result.message || 'Errore durante la registrazione')
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Background pattern */}
      <div className="absolute inset-0 pitch-overlay opacity-30"></div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center mx-auto mb-4 shadow-glow-gold">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">Unisciti a Fantacontratti</h1>
          <p className="text-base text-gray-400">Crea il tuo account e inizia a competere</p>
        </div>

        {/* Invite banner */}
        {inviteToken && (
          <div className="bg-accent-500/10 border border-accent-500/30 rounded-xl p-4 mb-4 text-center">
            <p className="text-accent-400 font-semibold">Sei stato invitato a una lega!</p>
            <p className="text-sm text-gray-400 mt-1">Registrati per accettare l'invito</p>
          </div>
        )}

        {/* Card */}
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-4 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className={`min-h-[56px] transition-all duration-200 ${error ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              {error && (
                <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-lg text-base">
                  {error}
                </div>
              )}
            </div>

            <Input
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="mario@email.com"
              required
              error={fieldErrors.email}
            />

            <Input
              label="Username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="MisterRossi"
              required
              minLength={3}
              maxLength={20}
              error={fieldErrors.username}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              error={fieldErrors.password}
            />

            <Input
              label="Conferma Password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              error={fieldErrors.confirmPassword}
            />

            <p className="text-sm text-gray-400 bg-surface-300 p-3 rounded-lg">
              La password deve contenere almeno 8 caratteri, una lettera maiuscola e un numero.
            </p>

            <Turnstile onVerify={handleTurnstileVerify} />

            <Button type="submit" size="xl" variant="accent" className="w-full" isLoading={isLoading}>
              Crea Account
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-base text-gray-400">
              Hai già un account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
              >
                Accedi
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          © 2024 Fantacontratti. Tutti i diritti riservati.
        </p>
      </div>
    </div>
  )
}

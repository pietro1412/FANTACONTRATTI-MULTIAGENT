import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

interface LoginProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface FieldErrors {
  emailOrUsername?: string
  password?: string
}

export function Login({ onNavigate }: LoginProps) {
  const { login } = useAuth()
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setIsLoading(true)

    const result = await login(emailOrUsername, password)

    if (result.success) {
      onNavigate('dashboard')
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
          setError(result.message || 'Errore durante il login')
        }
      } else {
        setError(result.message || 'Errore durante il login')
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-6">
      {/* Background pattern */}
      <div className="absolute inset-0 pitch-overlay opacity-30"></div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-6 shadow-glow">
            <span className="text-5xl">⚽</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Fantacontratti</h1>
          <p className="text-lg text-gray-400">Dynasty Fantasy Football</p>
        </div>

        {/* Card */}
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Accedi al tuo account</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className={`min-h-[56px] transition-all duration-200 ${error ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              {error && (
                <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-lg text-base">
                  {error}
                </div>
              )}
            </div>

            <Input
              label="Email o Username"
              type="text"
              value={emailOrUsername}
              onChange={e => setEmailOrUsername(e.target.value)}
              placeholder="mario@email.com"
              required
              error={fieldErrors.emailOrUsername}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              error={fieldErrors.password}
            />

            <div className="text-right">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
              >
                Password dimenticata?
              </button>
            </div>

            <Button type="submit" size="xl" className="w-full" isLoading={isLoading}>
              Accedi
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-base text-gray-400">
              Non hai un account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
              >
                Registrati ora
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

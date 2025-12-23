import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

interface RegisterProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export function Register({ onNavigate }: RegisterProps) {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Le password non corrispondono')
      return
    }

    setIsLoading(true)

    const result = await register(email, username, password, confirmPassword)

    if (result.success) {
      onNavigate('login')
    } else {
      setError(result.message || 'Errore durante la registrazione')
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
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center mx-auto mb-4 shadow-glow-gold">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Unisciti a Fantacontratti</h1>
          <p className="text-base text-gray-400">Crea il tuo account e inizia a competere</p>
        </div>

        {/* Card */}
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-lg text-base">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="mario@email.com"
              required
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
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />

            <Input
              label="Conferma Password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <p className="text-sm text-gray-400 bg-surface-300 p-3 rounded-lg">
              La password deve contenere almeno 8 caratteri, una lettera maiuscola e un numero.
            </p>

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

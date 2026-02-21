import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3003')

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Token mancante. Richiedi un nuovo link di reset.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError('Le password non corrispondono')
      return
    }

    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri')
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError('La password deve contenere almeno una lettera maiuscola')
      return
    }

    if (!/[0-9]/.test(password)) {
      setError('La password deve contenere almeno un numero')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        // Redirect to login after 3 seconds
        setTimeout(() => { void navigate('/login') }, 3000)
      } else {
        setError(data.error || 'Errore durante il reset della password')
      }
    } catch {
      setError('Errore di connessione al server')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-surface-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-secondary-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Password aggiornata!</h1>
          <p className="text-gray-400 mb-6">
            La tua password è stata reimpostata con successo. Verrai reindirizzato al login...
          </p>
          <Link
            to="/login"
            className="text-primary-400 hover:text-primary-300 font-medium"
          >
            Vai al login
          </Link>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-surface-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-danger-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Link non valido</h1>
          <p className="text-gray-400 mb-6">
            Il link di reset non è valido o è scaduto. Richiedi un nuovo link.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Richiedi nuovo link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface-200 rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Reimposta password</h1>
          <p className="text-gray-400">
            Inserisci la tua nuova password.
          </p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-6">
          {error && (
            <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Nuova password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              placeholder="Almeno 8 caratteri"
              required
              autoComplete="new-password"
            />
            <p className="text-gray-500 text-xs mt-1">
              Deve contenere almeno 8 caratteri, una maiuscola e un numero
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Conferma password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); }}
              placeholder="Ripeti la password"
              required
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full"
          >
            {loading ? 'Aggiornamento...' : 'Reimposta password'}
          </Button>

          <div className="text-center">
            <Link
              to="/login"
              className="text-gray-400 hover:text-white text-sm"
            >
              Torna al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Turnstile } from '../components/ui/Turnstile'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3003')

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken })
      })

      const data = await response.json()

      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Errore durante la richiesta')
      }
    } catch {
      setError('Errore di connessione al server')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-300 px-4">
        <div className="max-w-md w-full bg-surface-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-secondary-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Controlla la tua email</h1>
          <p className="text-gray-400 mb-6">
            Se l'indirizzo email esiste nel nostro sistema, riceverai un link per reimpostare la password.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Non hai ricevuto l'email? Controlla la cartella spam o riprova tra qualche minuto.
          </p>
          <Link
            to="/login"
            className="text-primary-400 hover:text-primary-300 font-medium"
          >
            Torna al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-300 px-4">
      <div className="max-w-md w-full bg-surface-200 rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Password dimenticata?</h1>
          <p className="text-gray-400">
            Inserisci la tua email e ti invieremo un link per reimpostare la password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="La tua email"
              required
              autoComplete="email"
            />
          </div>

          <Turnstile onVerify={handleTurnstileVerify} />

          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full"
          >
            {loading ? 'Invio in corso...' : 'Invia link di reset'}
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

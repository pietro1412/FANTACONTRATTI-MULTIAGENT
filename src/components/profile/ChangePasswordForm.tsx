import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { useToast } from '@/components/ui/Toast'
import { userApi } from '@/services/api'
import { validatePassword } from '@/utils/password-policy'

const EMPTY = { currentPassword: '', newPassword: '', confirmNewPassword: '' }

/** Sicurezza · cambio password: Input condiviso, policy unica + strength meter. */
export function ChangePasswordForm() {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [data, setData] = useState(EMPTY)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function reset() {
    setData(EMPTY)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!data.currentPassword || !data.newPassword || !data.confirmNewPassword) {
      setError('Tutti i campi sono obbligatori')
      return
    }

    const policy = validatePassword(data.newPassword)
    if (!policy.valid) {
      setError(policy.message ?? 'Password non valida')
      return
    }

    if (data.newPassword !== data.confirmNewPassword) {
      setError('Le password non corrispondono')
      return
    }

    setIsSubmitting(true)
    const result = await userApi.changePassword(data)
    setIsSubmitting(false)

    if (result.success) {
      toast.success('Password modificata con successo!')
      reset()
      setShowForm(false)
    } else {
      setError(result.message || 'Errore nel cambio password')
    }
  }

  return (
    <section className="bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="micro-label text-gray-400">Sicurezza · cambio password</h3>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => { setShowForm(true) }}>
            Cambia Password
          </Button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          {error && (
            <div className="bg-danger-500/15 border border-danger-500/40 text-danger-400 px-3 py-2.5 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}

          <Input
            label="Password attuale"
            type="password"
            autoComplete="current-password"
            value={data.currentPassword}
            onChange={(e) => { setData(d => ({ ...d, currentPassword: e.target.value })) }}
            placeholder="Inserisci la password attuale"
          />

          <div>
            <Input
              label="Nuova password"
              type="password"
              autoComplete="new-password"
              value={data.newPassword}
              onChange={(e) => { setData(d => ({ ...d, newPassword: e.target.value })) }}
              placeholder="Nuova password"
            />
            <PasswordStrengthMeter password={data.newPassword} />
          </div>

          <Input
            label="Conferma nuova password"
            type="password"
            autoComplete="new-password"
            value={data.confirmNewPassword}
            onChange={(e) => { setData(d => ({ ...d, confirmNewPassword: e.target.value })) }}
            placeholder="Ripeti la nuova password"
          />

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvataggio...' : 'Salva Password'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowForm(false); reset() }}
            >
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500">
          Per motivi di sicurezza, ti consigliamo di cambiare la password periodicamente.
        </p>
      )}
    </section>
  )
}

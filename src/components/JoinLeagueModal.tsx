import { useState } from 'react'
import { leagueApi } from '../services/api'
import { Modal, ModalBody } from '@/components/ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface LeagueInfo {
  id: string
  name: string
  description: string | null
  status: string
  maxParticipants: number
  currentParticipants: number
  adminUsername: string
}

interface JoinLeagueModalProps {
  isOpen: boolean
  league: LeagueInfo | null
  onClose: () => void
  onSuccess: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'In preparazione', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  ACTIVE: { label: 'Attiva', color: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30' },
  COMPLETED: { label: 'Completata', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

export function JoinLeagueModal({ isOpen, league, onClose, onSuccess }: JoinLeagueModalProps) {
  const [teamName, setTeamName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!league) return null

  const status = STATUS_LABELS[league.status] || STATUS_LABELS.DRAFT
  const availableSpots = league.maxParticipants - league.currentParticipants

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (teamName.trim().length < 2) {
      setError('Il nome squadra deve avere almeno 2 caratteri')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const res = await leagueApi.requestJoin(league.id, teamName.trim())

    if (res.success) {
      setSuccess(true)
    } else {
      setError(res.message || 'Errore nell\'invio della richiesta')
    }

    setIsSubmitting(false)
  }

  function handleClose() {
    if (success) {
      onSuccess()
    }
    setTeamName('')
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" showCloseButton={!success}>
      {success ? (
        // Success State
        <ModalBody>
          <div className="py-4 text-center">
            <div className="w-20 h-20 rounded-full bg-secondary-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Richiesta Inviata!</h2>
            <p className="text-gray-400 mb-6">
              La tua richiesta di partecipazione a <span className="text-primary-400 font-semibold">{league.name}</span> è stata inviata.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              L'amministratore della lega riceverà la tua richiesta e potrà approvarla o rifiutarla.
              Riceverai una notifica quando la richiesta sarà elaborata.
            </p>
            <Button onClick={handleClose} className="w-full">
              Chiudi
            </Button>
          </div>
        </ModalBody>
      ) : (
        // Form State
        <>
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-surface-300/80 to-surface-300/40 border-b border-surface-50/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-700 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Richiedi Partecipazione</h2>
                <p className="text-xs text-gray-400">Invia richiesta all'admin della lega</p>
              </div>
            </div>
          </div>

          {/* League Info */}
          <div className="px-6 py-4 border-b border-surface-50/20">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-2xl">🏆</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-white truncate">{league.name}</h3>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                {league.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">{league.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Admin: <span className="text-primary-400">{league.adminUsername}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {league.currentParticipants}/{league.maxParticipants} partecipanti
                  </span>
                </div>
              </div>
            </div>
            {availableSpots <= 3 && availableSpots > 0 && (
              <div className="mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400">
                  <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Solo {availableSpots} post{availableSpots === 1 ? 'o' : 'i'} disponibil{availableSpots === 1 ? 'e' : 'i'}!
                </p>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={(e) => { void handleSubmit(e) }} className="p-6">
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Nome della tua squadra
              </label>
              <Input
                type="text"
                value={teamName}
                onChange={(e) => { setTeamName(e.target.value); }}
                placeholder="Es. FC Campioni, Inter Stars..."
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Scegli un nome unico per la tua squadra nella lega
              </p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
                <p className="text-sm text-danger-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || teamName.trim().length < 2}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Invio...
                  </div>
                ) : (
                  'Invia Richiesta'
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              La richiesta sarà inviata all'admin che deciderà se approvarla
            </p>
          </form>
        </>
      )}
    </Modal>
  )
}

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { LeagueCrest } from '@/components/ui/LeagueCrest'
import { Monogram } from '@/components/ui/Monogram'
import { RoleTag } from '@/components/league/attention'
import { getTimeRemaining } from '@/utils/time-remaining'
import { inviteApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Navigation } from '@/components/Navigation'

interface InviteDetailProps {
  token: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface InviteData {
  token: string
  email: string
  expiresAt: string
  createdAt: string
  inviter: {
    username: string
    profilePhoto: string | null
  }
  league: {
    id: string
    name: string
    description: string | null
    status: string
    createdAt: string
    config: {
      minParticipants: number
      maxParticipants: number
      initialBudget: number
      slots: {
        goalkeeper: number
        defender: number
        midfielder: number
        forward: number
      }
    }
    admin: {
      username: string
      teamName: string
      profilePhoto: string | null
    } | null
    members: Array<{
      id: string
      role: string
      teamName: string
      username: string
      profilePhoto: string | null
    }>
    currentMembers: number
    availableSpots: number
  }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'In preparazione', color: 'bg-accent-500/15 text-accent-400 border border-accent-500/30' },
  ACTIVE: { label: 'Attiva', color: 'bg-secondary-500/15 text-secondary-400 border border-secondary-500/30' },
  COMPLETED: { label: 'Completata', color: 'bg-surface-100 text-gray-400 border border-surface-50/40' },
}

const ROLE_SLOTS: Array<{ key: keyof InviteData['league']['config']['slots']; label: string; cls: string }> = [
  { key: 'goalkeeper', label: 'P', cls: 'bg-accent-500/[0.14] text-accent-400 border-accent-500/40' },
  { key: 'defender', label: 'D', cls: 'bg-primary-500/[0.14] text-primary-400 border-primary-500/40' },
  { key: 'midfielder', label: 'C', cls: 'bg-secondary-500/[0.14] text-secondary-400 border-secondary-500/40' },
  { key: 'forward', label: 'A', cls: 'bg-danger-500/[0.14] text-danger-400 border-danger-500/40' },
]

export function InviteDetail({ token, onNavigate }: InviteDetailProps) {
  const { toast } = useToast()
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null)
  const [teamName, setTeamName] = useState('')
  const [teamNameError, setTeamNameError] = useState<string | null>(null)

  useEffect(() => {
    void loadInvite()
  }, [token])

  async function loadInvite() {
    setIsLoading(true)
    setError(null)

    const res = await inviteApi.getDetails(token)

    if (res.success && res.data) {
      setInvite(res.data)
    } else {
      setError(res.message || 'Invito non trovato')
    }

    setIsLoading(false)
  }

  async function handleAccept() {
    if (!invite) return

    // Validate team name
    if (teamName.trim().length < 2) {
      setTeamNameError('Il nome squadra deve avere almeno 2 caratteri')
      return
    }

    setTeamNameError(null)
    setActionLoading('accept')
    const res = await inviteApi.accept(token, teamName.trim())

    if (res.success) {
      onNavigate('leagueDetail', { leagueId: invite.league.id })
    } else {
      toast.error(res.message || 'Errore nell\'accettare l\'invito')
    }

    setActionLoading(null)
  }

  async function handleReject() {
    if (!invite) return

    setActionLoading('reject')
    const res = await inviteApi.reject(token)

    if (res.success) {
      onNavigate('dashboard')
    } else {
      toast.error(res.message || 'Errore nel rifiutare l\'invito')
    }

    setActionLoading(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="inviteDetail" onNavigate={onNavigate} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
            <p className="mt-6 text-lg text-gray-400">Caricamento invito...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="inviteDetail" onNavigate={onNavigate} />
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="bg-surface-200 rounded-2xl border border-danger-500/30 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-display font-bold text-white mb-2">Invito non valido</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => { onNavigate('dashboard'); }}>
              Torna alla Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const timeRemaining = getTimeRemaining(invite.expiresAt)
  const status = (STATUS_LABELS[invite.league.status] || STATUS_LABELS.DRAFT)!

  return (
    <div className="min-h-screen">
      <Navigation currentPage="inviteDetail" onNavigate={onNavigate} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => { onNavigate('dashboard'); }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Torna alla Dashboard
          </button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-white mb-2">Sei stato invitato!</h1>
          <p className="text-gray-400">
            <span className="text-primary-400">{invite.inviter.username}</span> ti ha invitato a unirti alla lega
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - League Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* League Card */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              {/* Hero lega */}
              <div className="bg-gradient-to-r from-primary-500/15 to-transparent p-6 border-b border-surface-50/20">
                <div className="flex items-center gap-4">
                  <LeagueCrest name={invite.league.name} size="lg" />
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white">{invite.league.name}</h2>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Banner "invitato da" */}
              <div className="px-6 pt-6">
                <div className="flex items-center gap-3 bg-accent-500/[0.08] border border-accent-500/30 rounded-xl px-4 py-3">
                  <Monogram name={invite.inviter.username} size="md" />
                  <p className="text-sm text-gray-300">
                    Sei stato invitato da <span className="font-semibold text-white">{invite.inviter.username}</span> a unirti alla lega
                  </p>
                </div>
              </div>

              {/* Descrizione */}
              {invite.league.description && (
                <div className="px-6 pt-4">
                  <p className="text-sm text-gray-300 leading-relaxed">{invite.league.description}</p>
                </div>
              )}

              {/* League Stats */}
              <div className="p-6">
                <h3 className="micro-label mb-4">Configurazione Lega</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="stat-number text-2xl text-accent-400">{invite.league.config.initialBudget}</p>
                    <p className="text-xs text-gray-400 mt-1">Budget Iniziale</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="stat-number text-2xl text-white">
                      {invite.league.config.slots.goalkeeper + invite.league.config.slots.defender +
                        invite.league.config.slots.midfielder + invite.league.config.slots.forward}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Slot Rosa</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="stat-number text-2xl text-secondary-400">
                      {invite.league.currentMembers}/{invite.league.config.maxParticipants}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Partecipanti</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="stat-number text-2xl text-primary-400">{invite.league.availableSpots}</p>
                    <p className="text-xs text-gray-400 mt-1">Posti Liberi</p>
                  </div>
                </div>

                {/* Slot Breakdown */}
                <div className="mt-6">
                  <h4 className="micro-label mb-3">Slot per Ruolo</h4>
                  <div className="flex flex-wrap gap-3">
                    {ROLE_SLOTS.map(slot => (
                      <div key={slot.key} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${slot.cls}`}>
                        <span className="w-6 h-6 rounded-full bg-surface-300 flex items-center justify-center text-xs font-bold">{slot.label}</span>
                        <span className="text-sm font-mono font-medium">{invite.league.config.slots[slot.key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
              <div className="flex items-baseline gap-2 mb-4">
                <h3 className="micro-label">Manager nella lega</h3>
                <span className="ml-auto text-xs font-mono text-gray-500">
                  {invite.league.currentMembers} / {invite.league.config.maxParticipants}
                </span>
              </div>
              <div className="space-y-2">
                {invite.league.members.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2 border-b border-surface-50/10 last:border-0"
                  >
                    <Monogram name={member.teamName || member.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-white truncate">{member.teamName}</p>
                      <p className="text-xs text-gray-400 truncate">DG: {member.username}</p>
                    </div>
                    <RoleTag role={member.role} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-6">
            {/* Action Card */}
            <div className="bg-surface-200 rounded-2xl border border-secondary-500/35 ring-1 ring-secondary-500/[0.08] p-6 sticky top-24">
              <h4 className="text-base font-display font-bold text-white mb-1">Unisciti alla lega</h4>
              <p className="text-xs text-gray-400 mb-5">Scegli il nome della tua squadra per entrare.</p>

              {/* Expiration */}
              <div className={`mb-5 p-4 rounded-xl ${
                timeRemaining.isUrgent
                  ? 'bg-danger-500/10 border border-danger-500/30'
                  : 'bg-surface-300'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-4 h-4 ${timeRemaining.isUrgent ? 'text-danger-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`micro-label ${timeRemaining.isUrgent ? 'text-danger-400' : ''}`}>
                    Scadenza invito
                  </span>
                </div>
                <p className={`text-lg font-display font-bold ${timeRemaining.isUrgent ? 'text-danger-400' : 'text-white'}`}>
                  {timeRemaining.text}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(invite.expiresAt).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {/* Team Name Input */}
              <div className="mb-5">
                <label className="micro-label block mb-2">
                  Nome della tua squadra
                </label>
                <Input
                  type="text"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value)
                    if (teamNameError) setTeamNameError(null)
                  }}
                  placeholder="Es. FC Campioni, Inter Stars..."
                  className={teamNameError ? 'border-danger-500' : ''}
                />
                {teamNameError && (
                  <p className="text-xs text-danger-400 mt-1">{teamNameError}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Scegli un nome unico per la tua squadra nella lega
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={() => void handleAccept()}
                  disabled={actionLoading !== null || teamName.trim().length < 2}
                >
                  {actionLoading === 'accept' ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Accettando...
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Accetta e unisciti
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => void handleReject()}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'reject' ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                      Rifiutando...
                    </div>
                  ) : (
                    'Rifiuta invito'
                  )}
                </Button>
              </div>

              {/* Posti liberi */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-50/20">
                <span className="text-sm text-gray-400">Posti liberi</span>
                <span className="stat-number text-base text-accent-400">{invite.league.availableSpots}</span>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                Accettando, entrerai nella lega come DG
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

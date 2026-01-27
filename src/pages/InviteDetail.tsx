import { useState, useEffect } from 'react'
import { inviteApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'

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
  DRAFT: { label: 'In preparazione', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  ACTIVE: { label: 'Attiva', color: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30' },
  COMPLETED: { label: 'Completata', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

function getTimeRemaining(expiresAt: string): { text: string; isUrgent: boolean; days: number } {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { text: 'Scaduto', isUrgent: true, days: 0 }
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days >= 1) {
    return { text: `${days} giorn${days === 1 ? 'o' : 'i'} e ${hours} ore`, isUrgent: days < 2, days }
  } else {
    return { text: `${hours} ore`, isUrgent: true, days: 0 }
  }
}

export function InviteDetail({ token, onNavigate }: InviteDetailProps) {
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null)
  const [teamName, setTeamName] = useState('')
  const [teamNameError, setTeamNameError] = useState<string | null>(null)

  useEffect(() => {
    loadInvite()
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
      alert(res.message || 'Errore nell\'accettare l\'invito')
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
      alert(res.message || 'Errore nel rifiutare l\'invito')
    }

    setActionLoading(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
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
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="inviteDetail" onNavigate={onNavigate} />
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="bg-surface-200 rounded-2xl border border-danger-500/30 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Invito non valido</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => onNavigate('dashboard')}>
              Torna alla Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const timeRemaining = getTimeRemaining(invite.expiresAt)
  const status = STATUS_LABELS[invite.league.status] || STATUS_LABELS.DRAFT
  const totalSlots = invite.league.config.slots.goalkeeper + invite.league.config.slots.defender +
    invite.league.config.slots.midfielder + invite.league.config.slots.forward

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="inviteDetail" onNavigate={onNavigate} />

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Torna alla Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Sei stato invitato!</h1>
          <p className="text-gray-400">
            <span className="text-primary-400">{invite.inviter.username}</span> ti ha invitato a unirti alla lega
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - League Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* League Card */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500/20 to-primary-600/10 p-6 border-b border-surface-50/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                      <span className="text-3xl">🏆</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{invite.league.name}</h2>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
                {invite.league.description && (
                  <p className="mt-4 text-gray-300">{invite.league.description}</p>
                )}
              </div>

              {/* League Stats */}
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Configurazione Lega</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-accent-400">{invite.league.config.initialBudget}</p>
                    <p className="text-xs text-gray-400 mt-1">Budget Iniziale</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{totalSlots}</p>
                    <p className="text-xs text-gray-400 mt-1">Slot Rosa</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-secondary-400">
                      {invite.league.currentMembers}/{invite.league.config.maxParticipants}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Partecipanti</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-primary-400">{invite.league.availableSpots}</p>
                    <p className="text-xs text-gray-400 mt-1">Posti Liberi</p>
                  </div>
                </div>

                {/* Slot Breakdown */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Slot per Ruolo</h4>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-white">P</span>
                      <span className="text-sm text-amber-400 font-medium">{invite.league.config.slots.goalkeeper}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white">D</span>
                      <span className="text-sm text-blue-400 font-medium">{invite.league.config.slots.defender}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white">C</span>
                      <span className="text-sm text-emerald-400 font-medium">{invite.league.config.slots.midfielder}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-xs font-bold text-white">A</span>
                      <span className="text-sm text-red-400 font-medium">{invite.league.config.slots.forward}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Partecipanti ({invite.league.currentMembers})
              </h3>
              <div className="space-y-3">
                {invite.league.members.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-surface-300/50 rounded-xl"
                  >
                    <div className="relative">
                      {member.profilePhoto ? (
                        <img
                          src={member.profilePhoto}
                          alt={member.username}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                          {member.username[0].toUpperCase()}
                        </div>
                      )}
                      {member.role === 'ADMIN' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 1l2.928 6.856L20 8.485l-5 4.428 1.325 7.087L10 16.5 3.675 20l1.325-7.087-5-4.428 7.072-.629L10 1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{member.teamName}</p>
                      <p className="text-xs text-gray-400 truncate">DG: {member.username}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      member.role === 'ADMIN'
                        ? 'bg-accent-500/20 text-accent-400'
                        : 'bg-surface-300 text-gray-400'
                    }`}>
                      {member.role === 'ADMIN' ? 'Presidente' : 'DG'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-6">
            {/* Action Card */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6 sticky top-24">
              {/* Inviter */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-surface-50/20">
                {invite.inviter.profilePhoto ? (
                  <img
                    src={invite.inviter.profilePhoto}
                    alt={invite.inviter.username}
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center text-white font-bold text-lg">
                    {invite.inviter.username[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Invitato da</p>
                  <p className="text-sm font-semibold text-white">{invite.inviter.username}</p>
                </div>
              </div>

              {/* Expiration */}
              <div className={`mb-6 p-4 rounded-xl ${
                timeRemaining.isUrgent
                  ? 'bg-danger-500/10 border border-danger-500/30'
                  : 'bg-surface-300'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-4 h-4 ${timeRemaining.isUrgent ? 'text-danger-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-xs font-medium ${timeRemaining.isUrgent ? 'text-danger-400' : 'text-gray-400'}`}>
                    Scadenza invito
                  </span>
                </div>
                <p className={`text-lg font-bold ${timeRemaining.isUrgent ? 'text-danger-400' : 'text-white'}`}>
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
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-300 mb-2">
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
                  className="w-full"
                  onClick={handleAccept}
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
                      Accetta Invito
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={handleReject}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'reject' ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                      Rifiutando...
                    </div>
                  ) : (
                    'Rifiuta Invito'
                  )}
                </Button>
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

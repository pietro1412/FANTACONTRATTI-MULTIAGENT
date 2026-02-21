import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { userApi, inviteApi } from '../services/api'

interface PendingInvite {
  id: string
  token: string
  leagueId: string
  leagueName: string
  leagueDescription: string | null
  leagueStatus: string
  currentMembers: number
  maxMembers: number
  invitedBy: string
  expiresAt: string
  createdAt: string
}

interface PendingInvitesProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

function getTimeRemaining(expiresAt: string): { text: string; isUrgent: boolean } {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { text: 'Scaduto', isUrgent: true }
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days >= 1) {
    return { text: `${days}g`, isUrgent: days < 2 }
  } else if (hours >= 1) {
    return { text: `${hours}h`, isUrgent: hours < 6 }
  } else {
    const minutes = Math.floor(diffMs / (1000 * 60))
    return { text: `${minutes}m`, isUrgent: true }
  }
}

export function PendingInvites({ onNavigate }: PendingInvitesProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadInvites()
    // Poll every 60 seconds for new invites
    const interval = setInterval(() => { void loadInvites() }, 60000)
    return () => { clearInterval(interval); }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => { document.removeEventListener('mousedown', handleClickOutside); }
  }, [])

  async function loadInvites() {
    setIsLoading(true)
    const res = await userApi.getMyPendingInvites()
    if (res.success && res.data) {
      setInvites(res.data)
    }
    setIsLoading(false)
  }

  async function handleAccept(invite: PendingInvite) {
    setActionLoading(invite.id)
    const res = await inviteApi.accept(invite.token)
    if (res.success) {
      // Remove from list and navigate to the league
      setInvites(prev => prev.filter(i => i.id !== invite.id))
      setIsOpen(false)
      onNavigate('leagueDetail', { leagueId: invite.leagueId })
    } else {
      toast.error(res.message || 'Errore nell\'accettare l\'invito')
    }
    setActionLoading(null)
  }

  async function handleReject(invite: PendingInvite) {
    setActionLoading(invite.id)
    const res = await inviteApi.reject(invite.token)
    if (res.success) {
      setInvites(prev => prev.filter(i => i.id !== invite.id))
    } else {
      toast.error(res.message || 'Errore nel rifiutare l\'invito')
    }
    setActionLoading(null)
  }

  const count = invites.length

  // Don't render anything if no invites
  if (count === 0 && !isLoading) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Badge Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); }}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-surface-300/50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
        title={`${count} invit${count === 1 ? 'o' : 'i'} pendenti`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {/* Badge counter */}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-secondary-500 rounded-full shadow-lg shadow-secondary-500/40 animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-200 border border-surface-50/30 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-surface-300/80 to-surface-300/40 border-b border-surface-50/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-semibold text-white">Inviti Pendenti</span>
              </div>
              {count > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-secondary-500/20 text-secondary-400 rounded-full">
                  {count}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
              </div>
            ) : invites.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                Nessun invito pendente
              </div>
            ) : (
              <div className="py-2">
                {invites.map(invite => {
                  const timeRemaining = getTimeRemaining(invite.expiresAt)
                  const isProcessing = actionLoading === invite.id

                  return (
                    <div
                      key={invite.id}
                      className="px-4 py-3 border-b border-surface-50/10 last:border-0 hover:bg-surface-300/30 transition-colors"
                    >
                      {/* League info */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate">
                            {invite.leagueName}
                          </h4>
                          <p className="text-xs text-gray-400">
                            Invitato da <span className="text-primary-300">{invite.invitedBy}</span>
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            timeRemaining.isUrgent
                              ? 'bg-danger-500/20 text-danger-400'
                              : 'bg-surface-300 text-gray-400'
                          }`}
                        >
                          {timeRemaining.text}
                        </span>
                      </div>

                      {/* League stats */}
                      <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {invite.currentMembers}/{invite.maxMembers}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          invite.leagueStatus === 'DRAFT'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-secondary-500/20 text-secondary-400'
                        }`}>
                          {invite.leagueStatus === 'DRAFT' ? 'In preparazione' : invite.leagueStatus}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { void handleAccept(invite) }}
                            disabled={isProcessing}
                            className="flex-1 px-3 py-1.5 text-xs font-medium bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? (
                              <span className="flex items-center justify-center gap-1">
                                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                              </span>
                            ) : (
                              'Accetta'
                            )}
                          </button>
                          <button
                            onClick={() => { void handleReject(invite) }}
                            disabled={isProcessing}
                            className="flex-1 px-3 py-1.5 text-xs font-medium bg-surface-300 hover:bg-surface-400 text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Rifiuta
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setIsOpen(false)
                            onNavigate('inviteDetail', { token: invite.token })
                          }}
                          className="w-full px-3 py-1.5 text-xs font-medium text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Vedi Dettagli
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

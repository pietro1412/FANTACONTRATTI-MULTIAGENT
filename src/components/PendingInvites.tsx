import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { LeagueCrest } from '@/components/ui/LeagueCrest'
import { getTimeRemaining } from '@/utils/time-remaining'
import { userApi, inviteApi } from '@/services/api'

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

  function handleAccept(invite: PendingInvite) {
    // L'accettazione richiede il nome squadra (obbligatorio lato backend):
    // si apre la pagina di dettaglio dove l'utente lo inserisce e conferma.
    setIsOpen(false)
    onNavigate('inviteDetail', { token: invite.token })
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
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-200 border border-surface-50/30 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-surface-300 border-b border-surface-50/20">
            <svg className="w-4 h-4 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="micro-label">Inviti in sospeso</span>
            {count > 0 && (
              <span className="ml-auto px-2 py-0.5 text-[10px] font-mono font-semibold bg-accent-500/10 text-accent-400 border border-accent-500/35 rounded-full">
                {count} {count === 1 ? 'nuovo' : 'nuovi'}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
              </div>
            ) : invites.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                Nessun invito pendente
              </div>
            ) : (
              <div>
                {invites.map(invite => {
                  const timeRemaining = getTimeRemaining(invite.expiresAt)
                  const isProcessing = actionLoading === invite.id

                  return (
                    <div
                      key={invite.id}
                      className="px-4 py-3 border-b border-surface-50/10 last:border-0 hover:bg-surface-300/30 transition-colors"
                    >
                      {/* League info */}
                      <div className="flex items-center gap-3 mb-3">
                        <LeagueCrest name={invite.leagueName} size="sm" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-display font-bold text-white truncate">
                            {invite.leagueName}
                          </h4>
                          <p className="text-xs text-gray-400 truncate">
                            da <span className="text-gray-300">{invite.invitedBy}</span> · {invite.currentMembers}/{invite.maxMembers} manager
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-[10px] font-mono font-bold px-2 py-1 rounded-md border ${
                            timeRemaining.isUrgent
                              ? 'bg-danger-500/10 text-danger-400 border-danger-500/40'
                              : 'bg-accent-500/10 text-accent-400 border-accent-500/40'
                          }`}
                        >
                          {timeRemaining.text}
                        </span>
                      </div>

                      {/* Actions (touch target >= 44px) */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { handleAccept(invite) }}
                          disabled={isProcessing}
                          className="flex-1 h-11 text-sm font-display font-bold bg-gradient-to-b from-secondary-500 to-secondary-600 hover:from-secondary-400 hover:to-secondary-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Accetta
                        </button>
                        <button
                          onClick={() => { void handleReject(invite) }}
                          disabled={isProcessing}
                          className="flex-1 h-11 text-sm font-display font-semibold text-danger-400 bg-danger-500/[0.06] border border-danger-500/40 hover:bg-danger-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Rifiuta
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

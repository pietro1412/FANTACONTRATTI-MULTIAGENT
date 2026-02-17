import { useState, useEffect, useRef } from 'react'
import { tradeApi, leagueApi } from '../services/api'
import { getTeamLogo } from '../utils/teamLogos'

interface NotificationsProps {
  leagueId: string
  isAdmin?: boolean
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
}

interface TradeOffer {
  id: string
  sender?: { id: string; username: string }
  offeredPlayerDetails?: Player[]
  requestedPlayerDetails?: Player[]
  offeredBudget: number
  requestedBudget: number
  expiresAt?: string
  createdAt: string
}

interface JoinRequest {
  id: string
  teamName: string
  joinedAt: string
  user: {
    id: string
    username: string
    email: string
    profilePhoto: string | null
  }
}

// Helper per calcolare il tempo rimanente
function getTimeRemaining(expiresAt: string | undefined): { text: string; isUrgent: boolean } {
  if (!expiresAt) return { text: '', isUrgent: false }

  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { text: 'Scaduta', isUrgent: true }
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { text: `${days}g ${hours % 24}h`, isUrgent: false }
  } else if (hours >= 1) {
    return { text: `${hours}h ${minutes}m`, isUrgent: hours < 6 }
  } else {
    return { text: `${minutes}m`, isUrgent: true }
  }
}

// Helper per ottenere il colore del ruolo
function getRoleColor(position: string): string {
  switch (position) {
    case 'P': return 'text-amber-400'
    case 'D': return 'text-blue-400'
    case 'C': return 'text-emerald-400'
    case 'A': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

// Helper per formattare la data
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes}m fa`
  } else if (diffHours < 24) {
    return `${diffHours}h fa`
  } else {
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}g fa`
  }
}

export function Notifications({ leagueId, isAdmin, onNavigate }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'trades' | 'requests'>('trades')
  const [offers, setOffers] = useState<TradeOffer[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotifications()
    // Poll every 30 seconds for new notifications
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [leagueId, isAdmin])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifications() {
    setIsLoading(true)

    // Load trade offers
    const tradeRes = await tradeApi.getReceived(leagueId)
    if (tradeRes.success && tradeRes.data) {
      setOffers(tradeRes.data as TradeOffer[])
    }

    // Load join requests if admin
    if (isAdmin) {
      const joinRes = await leagueApi.getPendingRequests(leagueId)
      if (joinRes.success && joinRes.data) {
        setJoinRequests(joinRes.data as JoinRequest[])
      }
    }

    setIsLoading(false)
  }

  function handleViewOffer(offerId: string) {
    setIsOpen(false)
    onNavigate('trades', { leagueId, highlight: offerId })
  }

  function handleViewAllTrades() {
    setIsOpen(false)
    onNavigate('trades', { leagueId })
  }

  function handleViewJoinRequests(e: React.MouseEvent) {
    e.stopPropagation()
    setIsOpen(false)
    // Use setTimeout to ensure dropdown is closed before navigation
    setTimeout(() => {
      onNavigate('adminPanel', { leagueId, tab: 'members' })
    }, 0)
  }

  const tradeCount = offers.length
  const requestCount = joinRequests.length
  const totalCount = tradeCount + requestCount

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-surface-300/50"
        title="Notifiche"
        aria-label="Notifiche"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Badge */}
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-danger-500 rounded-full animate-pulse">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-200 border border-surface-50/30 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header with tabs if admin */}
          <div className="px-4 py-3 bg-gradient-to-r from-surface-300 to-transparent border-b border-surface-50/20">
            {isAdmin && requestCount > 0 ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('trades')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'trades'
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-gray-400 hover:text-white hover:bg-surface-400/50'
                  }`}
                >
                  Offerte {tradeCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-primary-500/30 rounded-full">{tradeCount}</span>}
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'requests'
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-gray-400 hover:text-white hover:bg-surface-400/50'
                  }`}
                >
                  Richieste {requestCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-accent-500/30 rounded-full">{requestCount}</span>}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Offerte Ricevute</h3>
                {tradeCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-accent-500/20 text-accent-400 rounded-full">
                    {tradeCount} nuova{tradeCount > 1 ? 'e' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : activeTab === 'trades' ? (
              // Trade offers tab
              offers.length === 0 ? (
                <div className="py-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-500 text-sm">Nessuna offerta in sospeso</p>
                </div>
              ) : (
                offers.map(offer => {
                  const timeRemaining = getTimeRemaining(offer.expiresAt)
                  return (
                    <div
                      key={offer.id}
                      onClick={() => handleViewOffer(offer.id)}
                      className="p-3 border-b border-surface-50/10 last:border-b-0 hover:bg-surface-300/50 cursor-pointer transition-colors"
                    >
                      {/* Sender & Time */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent-500/20 flex items-center justify-center">
                            <span className="text-accent-400 font-bold text-xs">
                              {(offer.sender?.username?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-white text-sm">{offer.sender?.username}</span>
                        </div>
                        {timeRemaining.text && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            timeRemaining.isUrgent
                              ? 'bg-danger-500/20 text-danger-400'
                              : 'bg-surface-300 text-gray-400'
                          }`}>
                            {timeRemaining.text}
                          </span>
                        )}
                      </div>

                      {/* Preview */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* What you receive */}
                        <div className="space-y-1">
                          <p className="text-[10px] text-secondary-400 font-medium uppercase">Ricevi</p>
                          {offer.offeredPlayerDetails?.slice(0, 2).map(p => (
                            <div key={p.id} className="flex items-center gap-1.5">
                              <img src={getTeamLogo(p.team)} alt="" className="w-4 h-4 object-contain" width={16} height={16} />
                              <span className={`font-medium ${getRoleColor(p.position)}`}>{p.position}</span>
                              <span className="text-gray-300 truncate">{p.name}</span>
                            </div>
                          ))}
                          {(offer.offeredPlayerDetails?.length || 0) > 2 && (
                            <p className="text-gray-500">+{(offer.offeredPlayerDetails?.length || 0) - 2} altri</p>
                          )}
                          {offer.offeredBudget > 0 && (
                            <p className="text-accent-400">+{offer.offeredBudget} crediti</p>
                          )}
                          {!offer.offeredPlayerDetails?.length && offer.offeredBudget === 0 && (
                            <p className="text-gray-400 italic">Nulla</p>
                          )}
                        </div>

                        {/* What you give */}
                        <div className="space-y-1">
                          <p className="text-[10px] text-danger-400 font-medium uppercase">Cedi</p>
                          {offer.requestedPlayerDetails?.slice(0, 2).map(p => (
                            <div key={p.id} className="flex items-center gap-1.5">
                              <img src={getTeamLogo(p.team)} alt="" className="w-4 h-4 object-contain" width={16} height={16} />
                              <span className={`font-medium ${getRoleColor(p.position)}`}>{p.position}</span>
                              <span className="text-gray-300 truncate">{p.name}</span>
                            </div>
                          ))}
                          {(offer.requestedPlayerDetails?.length || 0) > 2 && (
                            <p className="text-gray-500">+{(offer.requestedPlayerDetails?.length || 0) - 2} altri</p>
                          )}
                          {offer.requestedBudget > 0 && (
                            <p className="text-accent-400">+{offer.requestedBudget} crediti</p>
                          )}
                          {!offer.requestedPlayerDetails?.length && offer.requestedBudget === 0 && (
                            <p className="text-gray-400 italic">Nulla</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            ) : (
              // Join requests tab (admin only)
              joinRequests.length === 0 ? (
                <div className="py-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 text-sm">Nessuna richiesta in attesa</p>
                </div>
              ) : (
                joinRequests.map(request => (
                  <div
                    key={request.id}
                    onClick={handleViewJoinRequests}
                    className="p-3 border-b border-surface-50/10 last:border-b-0 hover:bg-surface-300/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center flex-shrink-0">
                        {request.user.profilePhoto ? (
                          <img src={request.user.profilePhoto} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-sm">
                            {request.user.username[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm truncate">{request.user.username}</span>
                          <span className="text-[10px] text-gray-500">{formatDate(request.joinedAt)}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          Vuole unirsi come <span className="text-accent-400 font-medium">{request.teamName}</span>
                        </p>
                      </div>

                      {/* Arrow */}
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

          {/* Footer */}
          {((activeTab === 'trades' && offers.length > 0) || (activeTab === 'requests' && joinRequests.length > 0)) && (
            <div className="px-4 py-2 bg-surface-300/50 border-t border-surface-50/20">
              <button
                onClick={activeTab === 'trades' ? handleViewAllTrades : handleViewJoinRequests}
                className="w-full text-center text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors"
              >
                {activeTab === 'trades' ? 'Vedi tutte le offerte' : 'Gestisci richieste'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

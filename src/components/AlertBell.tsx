import { useState, useEffect, useRef } from 'react'
import { alertsApi, PlayerAlertData } from '../services/api'
import { getTeamLogo } from '../utils/teamLogos'

interface AlertBellProps {
  leagueId: string
  onNavigate?: (page: string, params?: Record<string, string>) => void
}

// Helper to get severity color
function getSeverityColor(severity: string): { bg: string; text: string; border: string } {
  switch (severity) {
    case 'DANGER':
      return { bg: 'bg-danger-500/20', text: 'text-danger-400', border: 'border-danger-500/30' }
    case 'WARNING':
      return { bg: 'bg-accent-500/20', text: 'text-accent-400', border: 'border-accent-500/30' }
    default:
      return { bg: 'bg-primary-500/20', text: 'text-primary-400', border: 'border-primary-500/30' }
  }
}

// Helper to get alert type icon
function getAlertTypeIcon(type: string): string {
  switch (type) {
    case 'INJURY':
      return '\u{1F3E5}' // Hospital emoji
    case 'SUSPENSION':
      return '\u{1F6AB}' // No entry emoji
    case 'FORM_UP':
      return '\u{1F4C8}' // Chart increasing
    case 'FORM_DOWN':
      return '\u{1F4C9}' // Chart decreasing
    case 'GOAL_SCORED':
      return '\u{26BD}' // Soccer ball
    case 'STARTED_MATCH':
      return '\u{1F3C3}' // Running person
    case 'BENCHED':
      return '\u{1FA91}' // Chair
    case 'NOT_CALLED':
      return '\u{274C}' // Red X
    case 'TRANSFER':
      return '\u{2708}' // Airplane
    case 'PRICE_CHANGE':
      return '\u{1F4B0}' // Money bag
    default:
      return '\u{1F514}' // Bell
  }
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Ora'
  if (diffMinutes < 60) return `${diffMinutes}m fa`
  if (diffHours < 24) return `${diffHours}h fa`
  if (diffDays < 7) return `${diffDays}g fa`
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

// Helper for position color
function getPositionColor(position: string): string {
  switch (position) {
    case 'P': return 'text-amber-400'
    case 'D': return 'text-blue-400'
    case 'C': return 'text-emerald-400'
    case 'A': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

export function AlertBell({ leagueId, onNavigate }: AlertBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [alerts, setAlerts] = useState<PlayerAlertData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load alerts on mount and periodically
  useEffect(() => {
    loadAlerts()
    loadUnreadCount()

    // Poll every 2 minutes for new alerts (only when tab is visible)
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadUnreadCount()
      }
    }, 120000)

    // Also reload when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadUnreadCount()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [leagueId])

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

  async function loadAlerts() {
    setIsLoading(true)
    setError(null)
    try {
      const response = await alertsApi.getAlerts(leagueId, { limit: 10 })
      if (response.success && response.data) {
        setAlerts(response.data.alerts)
        setUnreadCount(response.data.unreadCount)
      }
    } catch (err) {
      setError('Errore nel caricamento')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadUnreadCount() {
    try {
      const response = await alertsApi.getUnreadCount(leagueId)
      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount)
      }
    } catch {
      // Silent fail for count refresh
    }
  }

  async function handleMarkAsRead(alertId: string) {
    try {
      await alertsApi.markAsRead(leagueId, alertId)
      // Update local state
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, isRead: true, readAt: new Date().toISOString() } : a
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Silent fail
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await alertsApi.markAllAsRead(leagueId)
      // Update local state
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // Silent fail
    }
  }

  function handleToggle() {
    if (!isOpen) {
      loadAlerts() // Refresh when opening
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-surface-300/50"
        title="Alert Giocatori"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-primary-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-200 border border-surface-50/30 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-surface-300 to-transparent border-b border-surface-50/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">Alert Giocatori</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-primary-500/20 text-primary-400 rounded-full">
                  {unreadCount} non lett{unreadCount === 1 ? 'o' : 'i'}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                Segna tutti letti
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : error ? (
              <div className="py-8 text-center">
                <p className="text-danger-400 text-sm">{error}</p>
                <button
                  onClick={loadAlerts}
                  className="mt-2 text-xs text-primary-400 hover:text-primary-300"
                >
                  Riprova
                </button>
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-gray-500 text-sm">Nessun alert</p>
                <p className="text-gray-600 text-xs mt-1">
                  Aggiungi giocatori alla watchlist per ricevere alert
                </p>
              </div>
            ) : (
              alerts.map(alertData => {
                const severityColors = getSeverityColor(alertData.alert.severity)
                const icon = getAlertTypeIcon(alertData.alert.type)
                const player = alertData.alert.player

                return (
                  <div
                    key={alertData.id}
                    onClick={() => !alertData.isRead && handleMarkAsRead(alertData.id)}
                    className={`p-3 border-b border-surface-50/10 last:border-b-0 hover:bg-surface-300/50 cursor-pointer transition-colors ${
                      !alertData.isRead ? 'bg-surface-300/20' : ''
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-start gap-2 mb-1.5">
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg ${severityColors.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-sm">{icon}</span>
                      </div>

                      {/* Title and time */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${severityColors.text}`}>
                            {alertData.alert.title}
                          </span>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">
                            {formatRelativeTime(alertData.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Unread indicator */}
                      {!alertData.isRead && (
                        <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>

                    {/* Player info */}
                    <div className="flex items-center gap-1.5 mb-1 ml-10">
                      <img
                        src={getTeamLogo(player.team)}
                        alt=""
                        className="w-4 h-4 object-contain"
                        width={16}
                        height={16}
                      />
                      <span className={`font-medium text-xs ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                      <span className="text-sm text-white truncate">
                        {player.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({player.quotation})
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-xs text-gray-400 ml-10 line-clamp-2">
                      {alertData.alert.message}
                    </p>

                    {/* Match info if available */}
                    {alertData.alert.matchInfo && (
                      <p className="text-[10px] text-gray-500 mt-1 ml-10">
                        {alertData.alert.matchInfo}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && onNavigate && (
            <div className="px-4 py-2 bg-surface-300/50 border-t border-surface-50/20">
              <button
                onClick={() => {
                  setIsOpen(false)
                  onNavigate('alerts', { leagueId })
                }}
                className="w-full text-center text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors"
              >
                Vedi tutti gli alert
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

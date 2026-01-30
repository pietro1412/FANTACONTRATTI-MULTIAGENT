import { useState, useEffect, useRef } from 'react'
import { feedbackApi } from '../services/api'

interface FeedbackNotification {
  id: string
  type: string
  feedbackId: string
  feedbackTitle: string
  feedbackStatus: string
  createdAt: string
}

interface FeedbackBadgeProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

const statusConfig: Record<string, { label: string; color: string }> = {
  APERTA: { label: 'Aperta', color: 'bg-amber-500/20 text-amber-400' },
  IN_LAVORAZIONE: { label: 'In Lavorazione', color: 'bg-blue-500/20 text-blue-400' },
  RISOLTA: { label: 'Risolta', color: 'bg-emerald-500/20 text-emerald-400' },
}

export function FeedbackBadge({ onNavigate }: FeedbackBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<FeedbackNotification[]>([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotifications()
    // Poll every 2 minutes for new notifications (only when tab is visible)
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadNotifications()
      }
    }, 120000)

    // Also reload when tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadNotifications()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

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
    try {
      const res = await feedbackApi.getUnreadNotifications()
      if (res.success && res.data) {
        setNotifications(res.data.notifications || [])
        setCount(res.data.count || 0)
      }
    } catch (err) {
      console.error('Failed to load feedback notifications:', err)
    }
    setIsLoading(false)
  }

  async function handleMarkAllRead() {
    await feedbackApi.markAllNotificationsRead()
    setNotifications([])
    setCount(0)
  }

  function handleViewFeedback(feedbackId: string) {
    setIsOpen(false)
    onNavigate('feedbackHub', { feedbackId })
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case 'STATUS_CHANGE':
        return 'Stato aggiornato'
      case 'NEW_RESPONSE':
        return 'Nuova risposta'
      default:
        return 'Aggiornamento'
    }
  }

  // Don't render anything if no notifications
  if (count === 0 && !isLoading) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-surface-300/50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
        title={`${count} notific${count === 1 ? 'a' : 'he'} segnalazioni`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        {/* Badge counter */}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-purple-500 rounded-full shadow-lg shadow-purple-500/40 animate-pulse">
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
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="text-sm font-semibold text-white">Segnalazioni</span>
              </div>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Segna tutte lette
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                Nessuna notifica
              </div>
            ) : (
              <div className="py-2">
                {notifications.map(notification => {
                  const statusCfg = statusConfig[notification.feedbackStatus] || statusConfig.APERTA

                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleViewFeedback(notification.feedbackId)}
                      className="w-full px-4 py-3 border-b border-surface-50/10 last:border-0 hover:bg-surface-300/30 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-purple-400">
                          {getTypeLabel(notification.type)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-white truncate">
                        {notification.feedbackTitle}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notification.createdAt).toLocaleDateString('it-IT', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-surface-300/30 border-t border-surface-50/20">
            <button
              onClick={() => {
                setIsOpen(false)
                onNavigate('feedbackHub')
              }}
              className="w-full px-3 py-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              Vedi tutte le segnalazioni
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { feedbackApi } from '../services/api'

interface FeedbackItem {
  id: string
  title: string
  category: string
  status: string
  leagueName: string | null
  responseCount: number
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

interface FeedbackListProps {
  isAdmin?: boolean
  onSelectFeedback: (id: string) => void
  selectedId?: string
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  APERTA: { label: 'Aperta', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  IN_LAVORAZIONE: { label: 'In Lavorazione', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  RISOLTA: { label: 'Risolta', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
}

const categoryConfig: Record<string, { label: string; icon: string }> = {
  BUG: { label: 'Bug', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  SUGGERIMENTO: { label: 'Suggerimento', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  DOMANDA: { label: 'Domanda', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ALTRO: { label: 'Altro', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
}

export function FeedbackList({ isAdmin, onSelectFeedback, selectedId }: FeedbackListProps) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    void loadFeedback()
  }, [isAdmin, statusFilter, page])

  async function loadFeedback() {
    setIsLoading(true)
    try {
      const options: { status?: string; page: number; limit: number } = {
        page,
        limit: 10,
      }
      if (statusFilter) {
        options.status = statusFilter
      }

      const res = isAdmin
        ? await feedbackApi.getAll(options)
        : await feedbackApi.getMyFeedback(options)

      if (res.success && res.data) {
        setFeedback(res.data.feedback || [])
        setTotalPages(res.data.pagination?.totalPages || 1)
      }
    } catch (err) {
      console.error('Failed to load feedback:', err)
    }
    setIsLoading(false)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400">Filtra per stato:</span>
        {['', 'APERTA', 'IN_LAVORAZIONE', 'RISOLTA'].map(status => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(status)
              setPage(1)
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-purple-500 text-white'
                : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
            }`}
          >
            {status ? statusConfig[status]?.label : 'Tutte'}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-gray-400">Nessuna segnalazione trovata</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feedback.map(item => {
            const statusCfg = statusConfig[item.status] || statusConfig.APERTA
            const categoryCfg = categoryConfig[item.category] || categoryConfig.ALTRO
            const isSelected = selectedId === item.id

            return (
              <button
                key={item.id}
                onClick={() => { onSelectFeedback(item.id); }}
                className={`w-full p-4 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'bg-purple-500/10 border-purple-500/50'
                    : 'bg-surface-300/30 border-surface-50/20 hover:border-surface-50/40 hover:bg-surface-300/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryCfg.icon} />
                    </svg>
                    <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded ${statusCfg.bgColor} ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>{formatDate(item.createdAt)}</span>
                  {item.leagueName && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {item.leagueName}
                    </span>
                  )}
                  {item.responseCount > 0 && (
                    <span className="flex items-center gap-1 text-purple-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      {item.responseCount} rispost{item.responseCount === 1 ? 'a' : 'e'}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => { setPage(p => Math.max(1, p - 1)); }}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm bg-surface-300/50 text-gray-400 rounded-lg hover:bg-surface-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Precedente
          </button>
          <span className="text-sm text-gray-400">
            Pagina {page} di {totalPages}
          </span>
          <button
            onClick={() => { setPage(p => Math.min(totalPages, p + 1)); }}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm bg-surface-300/50 text-gray-400 rounded-lg hover:bg-surface-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Successiva
          </button>
        </div>
      )}
    </div>
  )
}

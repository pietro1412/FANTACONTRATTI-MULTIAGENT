import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { feedbackApi } from '../services/api'

interface FeedbackResponse {
  id: string
  content: string
  statusChange: string | null
  adminUsername: string
  createdAt: string
}

interface FeedbackData {
  id: string
  title: string
  description: string
  category: string
  status: string
  pageContext: string | null
  githubIssueId: number | null
  githubIssueUrl: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  user: { id: string; username: string }
  league: { id: string; name: string } | null
  responses: FeedbackResponse[]
}

interface FeedbackDetailProps {
  feedbackId: string
  isAdmin?: boolean
  onBack?: () => void
  onUpdated?: () => void
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

export function FeedbackDetail({ feedbackId, isAdmin, onBack, onUpdated }: FeedbackDetailProps) {
  const { toast } = useToast()
  const [feedback, setFeedback] = useState<FeedbackData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Admin response form
  const [responseContent, setResponseContent] = useState('')
  const [responseStatus, setResponseStatus] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void loadFeedback()
  }, [feedbackId])

  async function loadFeedback() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await feedbackApi.getById(feedbackId)
      if (res.success && res.data) {
        setFeedback(res.data as FeedbackData)
      } else {
        setError(res.message || 'Errore nel caricamento')
      }
    } catch (_err) {
      setError('Errore di connessione')
    }
    setIsLoading(false)
  }

  async function handleSubmitResponse() {
    if (!responseContent.trim()) return

    setIsSubmitting(true)
    try {
      const res = await feedbackApi.addResponse(
        feedbackId,
        responseContent.trim(),
        responseStatus as 'APERTA' | 'IN_LAVORAZIONE' | 'RISOLTA' | undefined
      )
      if (res.success) {
        setResponseContent('')
        setResponseStatus('')
        void loadFeedback()
        onUpdated?.()
      } else {
        toast.error(res.message || 'Errore nell\'invio della risposta')
      }
    } catch (_err) {
      toast.error('Errore di connessione')
    }
    setIsSubmitting(false)
  }

  async function handleChangeStatus(newStatus: string) {
    try {
      const res = await feedbackApi.updateStatus(feedbackId, newStatus as 'APERTA' | 'IN_LAVORAZIONE' | 'RISOLTA')
      if (res.success) {
        void loadFeedback()
        onUpdated?.()
      } else {
        toast.error(res.message || 'Errore nell\'aggiornamento dello stato')
      }
    } catch (_err) {
      toast.error('Errore di connessione')
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !feedback) {
    return (
      <div className="py-12 text-center">
        <svg className="w-12 h-12 mx-auto text-danger-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-gray-400">{error || 'Segnalazione non trovata'}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 text-sm bg-surface-300 text-gray-300 rounded-lg hover:bg-surface-400"
          >
            Torna alla lista
          </button>
        )}
      </div>
    )
  }

  const defaultStatus = { label: 'Aperta', color: 'text-amber-400', bgColor: 'bg-amber-500/20' }
  const defaultCategory = { label: 'Altro', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' }
  const statusCfg = statusConfig[feedback.status] ?? defaultStatus
  const categoryCfg = categoryConfig[feedback.category] ?? defaultCategory

  return (
    <div className="space-y-6">
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna alla lista
        </button>
      )}

      {/* Header */}
      <div className="bg-surface-300/30 rounded-xl p-6 border border-surface-50/20">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${statusCfg.bgColor} flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${statusCfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryCfg.icon} />
              </svg>
            </div>
            <div>
              <span className="text-xs text-gray-500">{categoryCfg.label}</span>
              <h2 className="text-lg font-bold text-white">{feedback.title}</h2>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-lg ${statusCfg.bgColor} ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>

        <p className="text-gray-300 whitespace-pre-wrap mb-4">{feedback.description}</p>

        <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
          <span>Inviata il {formatDate(feedback.createdAt)}</span>
          {isAdmin && (
            <span>Da: <span className="text-white">{feedback.user.username}</span></span>
          )}
          {feedback.league && (
            <span>Lega: <span className="text-primary-400">{feedback.league.name}</span></span>
          )}
          {feedback.pageContext && (
            <span>Pagina: <span className="text-gray-400">{feedback.pageContext}</span></span>
          )}
          {feedback.resolvedAt && (
            <span className="text-emerald-400">Risolta il {formatDate(feedback.resolvedAt)}</span>
          )}
        </div>

        {/* Admin status controls */}
        {isAdmin && feedback.status !== 'RISOLTA' && (
          <div className="mt-4 pt-4 border-t border-surface-50/20">
            <span className="text-xs text-gray-500 mb-2 block">Cambia stato:</span>
            <div className="flex gap-2">
              {['APERTA', 'IN_LAVORAZIONE', 'RISOLTA'].map(status => {
                if (status === feedback.status) return null
                const cfg = statusConfig[status] ?? defaultStatus
                return (
                  <button
                    key={status}
                    onClick={() => { void handleChangeStatus(status) }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${cfg.bgColor} ${cfg.color} hover:opacity-80 transition-opacity`}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Responses Timeline */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Risposte ({feedback.responses.length})
        </h3>

        {feedback.responses.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm bg-surface-300/20 rounded-xl">
            Nessuna risposta ancora
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.responses.map((response, index) => (
              <div key={response.id} className="relative">
                {/* Timeline line */}
                {index < feedback.responses.length - 1 && (
                  <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-surface-50/20" />
                )}

                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-surface-300/30 rounded-xl p-4 border border-surface-50/20">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-medium text-purple-400">{response.adminUsername}</span>
                      <span className="text-xs text-gray-500">{formatDate(response.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{response.content}</p>
                    {response.statusChange && (
                      <div className="mt-2 pt-2 border-t border-surface-50/20">
                        <span className={`text-xs px-2 py-0.5 rounded ${statusConfig[response.statusChange]?.bgColor ?? ''} ${statusConfig[response.statusChange]?.color ?? ''}`}>
                          Stato cambiato a: {statusConfig[response.statusChange]?.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Response Form */}
      {isAdmin && (
        <div className="bg-surface-300/30 rounded-xl p-4 border border-surface-50/20">
          <h4 className="text-sm font-semibold text-white mb-3">Aggiungi Risposta</h4>
          <textarea
            value={responseContent}
            onChange={e => { setResponseContent(e.target.value); }}
            placeholder="Scrivi una risposta..."
            rows={4}
            className="w-full px-4 py-3 bg-surface-300/50 border border-surface-50/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none mb-3"
          />
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Cambia stato (opzionale):</label>
              <select
                value={responseStatus}
                onChange={e => { setResponseStatus(e.target.value); }}
                className="w-full px-3 py-2 bg-surface-300/50 border border-surface-50/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">Nessun cambio</option>
                <option value="IN_LAVORAZIONE">In Lavorazione</option>
                <option value="RISOLTA">Risolta</option>
              </select>
            </div>
            <button
              onClick={() => void handleSubmitResponse()}
              disabled={isSubmitting || !responseContent.trim()}
              className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Invia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

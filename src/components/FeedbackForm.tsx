import { useState } from 'react'
import { feedbackApi } from '../services/api'

interface FeedbackFormProps {
  leagueId?: string
  pageContext?: string
  onSuccess?: () => void
  onCancel?: () => void
}

type FeedbackCategory = 'BUG' | 'SUGGERIMENTO' | 'DOMANDA' | 'ALTRO'

const categoryOptions: { value: FeedbackCategory; label: string; icon: string; description: string }[] = [
  { value: 'BUG', label: 'Problema/Bug', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', description: 'Ho trovato un errore o qualcosa non funziona' },
  { value: 'SUGGERIMENTO', label: 'Suggerimento', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', description: 'Ho un\'idea per migliorare l\'app' },
  { value: 'DOMANDA', label: 'Domanda', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', description: 'Ho bisogno di aiuto o chiarimenti' },
  { value: 'ALTRO', label: 'Altro', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', description: 'Altro tipo di feedback' },
]

export function FeedbackForm({ leagueId, pageContext, onSuccess, onCancel }: FeedbackFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('BUG')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Il titolo e\' obbligatorio')
      return
    }

    if (!description.trim()) {
      setError('La descrizione e\' obbligatoria')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await feedbackApi.submit({
        title: title.trim(),
        description: description.trim(),
        category,
        leagueId,
        pageContext,
      })

      if (res.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess?.()
        }, 1500)
      } else {
        setError(res.message || 'Errore nell\'invio della segnalazione')
      }
    } catch (err) {
      setError('Errore di connessione')
    }

    setIsSubmitting(false)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Segnalazione Inviata!</h3>
        <p className="text-sm text-gray-400">Grazie per il tuo feedback. Ti notificheremo quando ci saranno aggiornamenti.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Tipo di segnalazione</label>
        <div className="grid grid-cols-2 gap-3">
          {categoryOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setCategory(opt.value); }}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                category === opt.value
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-surface-50/20 bg-surface-300/30 hover:border-surface-50/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg className={`w-4 h-4 ${category === opt.value ? 'text-purple-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} />
                </svg>
                <span className={`text-sm font-medium ${category === opt.value ? 'text-white' : 'text-gray-300'}`}>
                  {opt.label}
                </span>
              </div>
              <p className="text-xs text-gray-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="feedback-title" className="block text-sm font-medium text-gray-300 mb-2">
          Titolo <span className="text-danger-400">*</span>
        </label>
        <input
          type="text"
          id="feedback-title"
          value={title}
          onChange={e => { setTitle(e.target.value); }}
          placeholder="Descrivi brevemente il problema o suggerimento"
          maxLength={200}
          className="w-full px-4 py-3 bg-surface-300/50 border border-surface-50/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
        />
        <p className="text-xs text-gray-500 mt-1 text-right">{title.length}/200</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="feedback-description" className="block text-sm font-medium text-gray-300 mb-2">
          Descrizione <span className="text-danger-400">*</span>
        </label>
        <textarea
          id="feedback-description"
          value={description}
          onChange={e => { setDescription(e.target.value); }}
          placeholder="Fornisci tutti i dettagli utili: cosa stavi facendo, cosa ti aspettavi, cosa e' successo invece..."
          maxLength={5000}
          rows={6}
          className="w-full px-4 py-3 bg-surface-300/50 border border-surface-50/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1 text-right">{description.length}/5000</p>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-danger-500/10 border border-danger-500/30 rounded-xl">
          <p className="text-sm text-danger-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-surface-300 hover:bg-surface-400 text-gray-300 font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !description.trim()}
          className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Invio...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Invia Segnalazione
            </>
          )}
        </button>
      </div>
    </form>
  )
}

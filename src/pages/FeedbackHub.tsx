import { useEffect, useState } from 'react'
import { leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { FeedbackForm } from '../components/FeedbackForm'
import { FeedbackList } from '../components/FeedbackList'
import { FeedbackDetail } from '../components/FeedbackDetail'
import { useAuth } from '../hooks/useAuth'

interface PatchNote {
  id: string
  version: string
  date: string
  title: string
  description: string
  type: 'feature' | 'fix' | 'improvement'
  issueNumber?: number
}

interface FeedbackHubProps {
  leagueId: string
  feedbackId?: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

// Hardcoded patch notes
const PATCH_NOTES: PatchNote[] = [
  {
    id: 'predeploy-backup',
    version: '1.x',
    date: '2026-02-03',
    title: 'Sistema di backup automatico pre-deploy',
    description: 'Implementato sistema di backup automatico che salva i dati critici (statistiche giocatori, rose, contratti, membri lega) prima di ogni deploy in produzione. Include script di recovery per ripristino rapido in caso di problemi.',
    type: 'feature',
  },
  {
    id: 'fix-player-stats-accuracy',
    version: '1.x',
    date: '2026-02-03',
    title: 'Statistiche giocatori accurate',
    description: 'Corretta la fonte dati per le statistiche dei giocatori. Ora le presenze, minuti, gol e assist vengono calcolati dalla tabella PlayerMatchRating (dati partita per partita da API-Football) invece che dal blob apiFootballStats, garantendo dati sempre accurati e aggiornati.',
    type: 'fix',
  },
  {
    id: 'fix-rinnovi-regole',
    version: '1.x',
    date: '2026-01-31',
    title: 'FIX IMPORTANTE: Regole Rinnovo Contratti',
    description: 'Corretto bug nelle regole di rinnovo contratti. ORA FUNZIONA COSÌ: l\'ingaggio può sempre essere aumentato, ma la DURATA può essere estesa SOLO SE prima si aumenta l\'ingaggio. Esempio: da (4M, 3s) NON si può andare a (4M, 4s), ma SI può andare a (5M, 3s) o (5M, 4s). Aggiunto anche pulsante "Reset Modifica" per annullare le modifiche e ricominciare.',
    type: 'fix',
  },
  {
    id: '0',
    version: '1.x',
    date: '2026-01-30',
    title: 'Rimossa voce Indennizzi dalla formula budget',
    description: 'La formula nella pagina Contratti ora mostra correttamente: Budget Iniziale - Ingaggi - Tagli = Residuo (es: 196M - 158M - 0M = 38M). La voce "+Indennizzi" e\' stata rimossa perche\' gia\' inclusa nel budget.',
    type: 'fix',
    issueNumber: 217,
  },
  {
    id: '1',
    version: '1.x',
    date: '2026-01-30',
    title: 'Pulsanti Salva/Consolida visibili su mobile',
    description: 'I pulsanti Salva e Consolida nella pagina Contratti/Rinnovi sono ora sempre visibili su mobile, posizionati in alto sopra la tabella.',
    type: 'fix',
  },
  {
    id: '2',
    version: '1.x',
    date: '2026-01-30',
    title: 'Foto giocatore nella modale statistiche',
    description: 'La modale delle statistiche del giocatore nella pagina Contratti/Rinnovi ora mostra correttamente la foto del giocatore.',
    type: 'fix',
  },
  {
    id: '3',
    version: '1.x',
    date: '2026-01-30',
    title: 'Foto giocatori nella pagina Contratti',
    description: 'Aggiunte le foto dei giocatori nella pagina Contratti/Rinnovi, come già presenti nella pagina Giocatori.',
    type: 'feature',
    issueNumber: 214,
  },
  {
    id: '4',
    version: '1.x',
    date: '2026-01-30',
    title: 'Sistema Segnalazioni',
    description: 'I manager possono ora segnalare problemi e suggerimenti direttamente dalla pagina Feedback Hub e ricevere notifiche quando vengono risolti.',
    type: 'feature',
    issueNumber: 218,
  },
]

const typeConfig = {
  feature: {
    label: 'Nuova Funzionalita',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  fix: {
    label: 'Bug Fix',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  improvement: {
    label: 'Miglioramento',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
}

type Tab = 'news' | 'my-feedback' | 'all-feedback'

export function FeedbackHub({ leagueId, feedbackId: initialFeedbackId, onNavigate }: FeedbackHubProps) {
  const { user } = useAuth()
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [leagueName, setLeagueName] = useState<string>()
  const [teamName, setTeamName] = useState<string>()
  const [activeTab, setActiveTab] = useState<Tab>('news')
  const [showForm, setShowForm] = useState(false)
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | undefined>(initialFeedbackId)

  const isSuperAdmin = user?.isSuperAdmin || false

  useEffect(() => {
    if (leagueId) {
      loadLeagueInfo()
    }
  }, [leagueId])

  useEffect(() => {
    if (initialFeedbackId) {
      setSelectedFeedbackId(initialFeedbackId)
      setActiveTab('my-feedback')
    }
  }, [initialFeedbackId])

  async function loadLeagueInfo() {
    const response = await leagueApi.getById(leagueId)
    if (response.success && response.data) {
      const data = response.data as {
        name: string
        userMembership?: { role: string; teamName?: string }
      }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
      setLeagueName(data.name)
      setTeamName(data.userMembership?.teamName)
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  function handleSelectFeedback(id: string) {
    setSelectedFeedbackId(id)
  }

  function handleBackToList() {
    setSelectedFeedbackId(undefined)
  }

  function handleFormSuccess() {
    setShowForm(false)
    setActiveTab('my-feedback')
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation
        currentPage="feedbackHub"
        leagueId={leagueId}
        leagueName={leagueName}
        teamName={teamName}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Feedback Hub</h1>
                <p className="text-sm text-gray-400">Novita, segnalazioni e suggerimenti</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nuova Segnalazione</span>
              <span className="sm:hidden">Segnala</span>
            </button>
          </div>

          {/* Alpha Test Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg mt-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-xs text-amber-400 font-medium">Alpha Test</span>
            <span className="text-xs text-gray-500">Aiutaci a migliorare segnalando problemi!</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-surface-50/20 pb-4">
          <button
            onClick={() => {
              setActiveTab('news')
              setSelectedFeedbackId(undefined)
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'news'
                ? 'bg-purple-500 text-white'
                : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
            }`}
          >
            Novita
          </button>
          <button
            onClick={() => {
              setActiveTab('my-feedback')
              setSelectedFeedbackId(undefined)
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'my-feedback'
                ? 'bg-purple-500 text-white'
                : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
            }`}
          >
            Le mie Segnalazioni
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => {
                setActiveTab('all-feedback')
                setSelectedFeedbackId(undefined)
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'all-feedback'
                  ? 'bg-purple-500 text-white'
                  : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
              }`}
            >
              Tutte le Segnalazioni
            </button>
          )}
        </div>

        {/* Content */}
        {activeTab === 'news' && (
          <div className="space-y-4">
            {PATCH_NOTES.map((patch) => {
              const config = typeConfig[patch.type]
              return (
                <div
                  key={patch.id}
                  className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden hover:border-purple-500/30 transition-colors"
                >
                  {/* Header */}
                  <div className="px-4 py-3 bg-surface-300/50 border-b border-surface-50/20 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      {/* Version Badge */}
                      <span className="px-2.5 py-1 bg-purple-500/20 text-purple-400 text-xs font-mono font-semibold rounded-lg border border-purple-500/30">
                        {patch.version}
                      </span>

                      {/* Type Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${config.color}`}>
                        {config.icon}
                        {config.label}
                      </span>

                      {/* Issue Number */}
                      {patch.issueNumber && (
                        <span className="text-xs text-gray-500 font-mono">
                          #{patch.issueNumber}
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <span className="text-xs text-gray-400">
                      {formatDate(patch.date)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="px-4 py-4">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {patch.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {patch.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'my-feedback' && (
          selectedFeedbackId ? (
            <FeedbackDetail
              feedbackId={selectedFeedbackId}
              isAdmin={false}
              onBack={handleBackToList}
            />
          ) : (
            <FeedbackList
              isAdmin={false}
              onSelectFeedback={handleSelectFeedback}
              selectedId={selectedFeedbackId}
            />
          )
        )}

        {activeTab === 'all-feedback' && isSuperAdmin && (
          selectedFeedbackId ? (
            <FeedbackDetail
              feedbackId={selectedFeedbackId}
              isAdmin={true}
              onBack={handleBackToList}
              onUpdated={() => {}}
            />
          ) : (
            <FeedbackList
              isAdmin={true}
              onSelectFeedback={handleSelectFeedback}
              selectedId={selectedFeedbackId}
            />
          )
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Grazie per il tuo contributo nel migliorare l'app!
          </p>
        </div>
      </main>

      {/* Feedback Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-200 rounded-2xl border border-surface-50/30 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-50/20 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Nuova Segnalazione</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-surface-300/50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <FeedbackForm
                leagueId={leagueId}
                onSuccess={handleFormSuccess}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeedbackHub

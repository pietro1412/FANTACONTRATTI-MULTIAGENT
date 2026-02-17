import { useEffect, useState } from 'react'
import { leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'

interface PatchNote {
  id: string
  version: string
  date: string
  title: string
  description: string
  type: 'feature' | 'fix' | 'improvement'
  issueNumber?: number
}

interface PatchNotesProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

// Hardcoded patch notes - in the future this could come from an API
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
    id: 'fix-strategie-save',
    version: '1.x',
    date: '2026-01-31',
    title: 'Fix salvataggio strategie Rubata',
    description: 'Risolto un bug che impediva il corretto salvataggio delle strategie (priorita\', max bid, note) nella pagina Strategie Rubata. Ora i dati vengono salvati automaticamente dopo 2 secondi e persistono al refresh della pagina.',
    type: 'fix',
  },
  {
    id: 'feedback-system',
    version: '1.x',
    date: '2026-01-31',
    title: 'Sistema Feedback e Segnalazioni',
    description: 'Attivato il sistema di feedback e segnalazioni. I manager possono ora inviare bug report, suggerimenti e domande direttamente dall\'app tramite il menu Segnalazioni.',
    type: 'feature',
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
    title: 'Pagina Patch Notes',
    description: 'Aggiunta nuova pagina per visualizzare le note di rilascio e gli aggiornamenti dell\'applicazione.',
    type: 'feature',
    issueNumber: 208,
  },
  {
    id: '5',
    version: '1.x',
    date: '2026-01-29',
    title: 'Richiesta aumento ingaggio prima di estendere durata',
    description: 'Ora e\' possibile richiedere un aumento di ingaggio prima di procedere con l\'estensione della durata del contratto.',
    type: 'feature',
    issueNumber: 207,
  },
  {
    id: '6',
    version: '1.x',
    date: '2026-01-28',
    title: 'Eta e rating in tabella Contratti',
    description: 'Aggiunte colonne per visualizzare eta e rating dei giocatori direttamente nella tabella dei contratti.',
    type: 'improvement',
    issueNumber: 206,
  },
  {
    id: '7',
    version: '1.x',
    date: '2026-01-27',
    title: 'Modale statistiche giocatore nei Contratti',
    description: 'Implementata modale per visualizzare le statistiche dettagliate del giocatore direttamente dalla pagina Contratti.',
    type: 'feature',
    issueNumber: 205,
  },
  {
    id: '8',
    version: '1.x',
    date: '2026-01-26',
    title: 'Integrazione statistiche API-Football',
    description: 'Integrazione con API-Football per recuperare e visualizzare statistiche aggiornate dei giocatori.',
    type: 'feature',
    issueNumber: 159,
  },
  {
    id: '9',
    version: '1.x',
    date: '2026-01-25',
    title: 'Sistema KEEP/RELEASE per giocatori usciti',
    description: 'Aggiunto sistema per gestire le decisioni KEEP/RELEASE per i giocatori che lasciano il campionato.',
    type: 'feature',
    issueNumber: 158,
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

export function PatchNotes({ leagueId, onNavigate }: PatchNotesProps) {
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [leagueName, setLeagueName] = useState<string>()
  const [teamName, setTeamName] = useState<string>()

  useEffect(() => {
    if (leagueId) {
      loadLeagueInfo()
    }
  }, [leagueId])

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

  return (
    <div className="min-h-screen">
      <Navigation
        currentPage="patchNotes"
        leagueId={leagueId}
        leagueName={leagueName}
        teamName={teamName}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Patch Notes</h1>
              <p className="text-sm text-gray-400">Cronologia degli aggiornamenti dell'applicazione</p>
            </div>
          </div>

          {/* Alpha Test Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg mt-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-xs text-amber-400 font-medium">Alpha Test</span>
            <span className="text-xs text-gray-500">Questa e' una versione di test - segnala eventuali problemi!</span>
          </div>
        </div>

        {/* Patch Notes List */}
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

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Hai suggerimenti o hai trovato un bug? Contatta l'amministratore della lega.
          </p>
        </div>
      </main>
    </div>
  )
}

export default PatchNotes

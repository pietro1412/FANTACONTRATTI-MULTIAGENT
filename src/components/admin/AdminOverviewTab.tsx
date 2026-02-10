import { Button } from '../ui/Button'

interface League {
  id: string
  name: string
  status: string
  maxParticipants: number
  minParticipants: number
  initialBudget: number
  goalkeeperSlots: number
  defenderSlots: number
  midfielderSlots: number
  forwardSlots: number
}

interface Member {
  id: string
  role: string
  status: string
  currentBudget: number
  teamName?: string
  user: { id: string; username: string; email: string }
}

interface MarketSession {
  id: string
  type: string
  status: string
  currentPhase: string | null
  season: number
  semester: number
  createdAt: string
}

interface ConsolidationManager {
  memberId: string
  username: string
  playerCount: number
  isConsolidated: boolean
  consolidatedAt: string | null
}

interface ConsolidationStatus {
  inContrattiPhase: boolean
  sessionId?: string
  managers: ConsolidationManager[]
  consolidatedCount: number
  totalCount: number
  allConsolidated: boolean
}

const MARKET_PHASES = [
  { value: 'ASTA_LIBERA', label: 'Asta Libera', onlyFirst: true },
  { value: 'OFFERTE_PRE_RINNOVO', label: 'Offerte Pre Rinnovo', onlyFirst: false },
  { value: 'PREMI', label: 'Premi Budget', onlyFirst: false },
  { value: 'CONTRATTI', label: 'Rinnovo Contratti', onlyFirst: false },
  { value: 'RUBATA', label: 'Rubata', onlyFirst: false },
  { value: 'ASTA_SVINCOLATI', label: 'Asta Svincolati', onlyFirst: false },
  { value: 'OFFERTE_POST_ASTA_SVINCOLATI', label: 'Offerte Post Svincolati', onlyFirst: false },
]

export interface AdminOverviewTabProps {
  league: League | null
  activeMembers: Member[]
  pendingMembers: Member[]
  sessions: MarketSession[]
  activeSession: MarketSession | undefined
  consolidationStatus: ConsolidationStatus | null
  isSubmitting: boolean
  auctionMode: 'REMOTE' | 'IN_PRESENCE'
  setAuctionMode: (mode: 'REMOTE' | 'IN_PRESENCE') => void
  handleStartLeague: () => void
  handleSetPhase: (sessionId: string, phase: string) => void
  handleCloseSession: (sessionId: string) => void
  handleCreateSession: (isRegularMarket: boolean) => void
  handleSimulateAllConsolidation: () => void
}

export function AdminOverviewTab({
  league,
  activeMembers,
  pendingMembers,
  sessions,
  activeSession,
  consolidationStatus,
  isSubmitting,
  auctionMode,
  setAuctionMode,
  handleStartLeague,
  handleSetPhase,
  handleCloseSession,
  handleCreateSession,
  handleSimulateAllConsolidation,
}: AdminOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5 text-center">
          <p className="text-4xl font-bold text-primary-400">{activeMembers.length}/{league?.maxParticipants}</p>
          <p className="text-sm text-gray-400 mt-1">Partecipanti attivi</p>
        </div>
        <div className="bg-surface-200 rounded-xl border border-accent-500/30 p-5 text-center">
          <p className="text-4xl font-bold text-accent-400">{pendingMembers.length}</p>
          <p className="text-sm text-gray-400 mt-1">Richieste in attesa</p>
        </div>
        <div className="bg-surface-200 rounded-xl border border-secondary-500/30 p-5 text-center">
          <p className="text-4xl font-bold text-secondary-400">{league?.initialBudget}</p>
          <p className="text-sm text-gray-400 mt-1">Budget iniziale</p>
        </div>
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5 text-center">
          <p className="text-4xl font-bold text-blue-400">{sessions.length}</p>
          <p className="text-sm text-gray-400 mt-1">Sessioni totali</p>
        </div>
      </div>

      {/* League Config */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-5 border-b border-surface-50/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span>📋</span> Configurazione Lega
          </h3>
        </div>
        <div className="p-5">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-surface-300 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Nome</p>
              <p className="font-semibold text-white text-lg">{league?.name}</p>
            </div>
            <div className="bg-surface-300 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Stato</p>
              <p className={`font-semibold text-lg ${league?.status === 'ACTIVE' ? 'text-secondary-400' : 'text-primary-400'}`}>
                {league?.status === 'DRAFT' ? 'Creazione Lega' : league?.status === 'ACTIVE' ? 'Primo Mercato' : league?.status}
              </p>
            </div>
            <div className="bg-surface-300 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Codice Invito</p>
              <p className="font-mono text-lg text-primary-400">{league?.id.slice(0, 8)}</p>
            </div>
            <div className="bg-surface-300 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Partecipanti</p>
              <p className="font-semibold text-white text-lg">{activeMembers.length} / {league?.maxParticipants}</p>
            </div>
            <div className="bg-surface-300 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Minimo Richiesto</p>
              <p className="font-semibold text-white text-lg">{league?.minParticipants || 6}</p>
            </div>
            <div className="bg-surface-300 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Slot Rosa</p>
              <p className="font-semibold text-lg">
                <span className="text-amber-400">P:{league?.goalkeeperSlots}</span>{' '}
                <span className="text-blue-400">D:{league?.defenderSlots}</span>{' '}
                <span className="text-emerald-400">C:{league?.midfielderSlots}</span>{' '}
                <span className="text-red-400">A:{league?.forwardSlots}</span>
              </p>
            </div>
          </div>

          {/* Start League */}
          {league?.status === 'DRAFT' && (
            <div className="mt-6 p-5 bg-primary-500/10 border border-primary-500/30 rounded-xl">
              <h4 className="font-bold text-white text-lg mb-3">Avvia Lega</h4>
              <p className="text-gray-300 mb-4">
                Per passare al <span className="text-primary-400 font-semibold">Primo Mercato</span> servono almeno {league?.minParticipants || 6} partecipanti.
                Attualmente: <span className="font-bold text-white">{activeMembers.length}</span> partecipanti.
              </p>
              <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-4 mb-4">
                <p className="text-accent-400 text-sm">
                  <strong>Attenzione:</strong> Una volta passati al Primo Mercato, non sarà più possibile
                  aggiungere nuovi Direttori Generali.
                </p>
              </div>
              {activeMembers.length >= (league?.minParticipants || 6) ? (
                <Button variant="accent" size="lg" onClick={handleStartLeague} disabled={isSubmitting}>
                  {isSubmitting ? 'Avvio...' : 'Passa al Primo Mercato'}
                </Button>
              ) : (
                <p className="text-danger-400 font-medium">
                  Mancano {(league?.minParticipants || 6) - activeMembers.length} partecipanti
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active Session */}
      <div className={`bg-surface-200 rounded-xl border overflow-hidden ${activeSession ? 'border-secondary-500/50' : 'border-surface-50/20'}`}>
        <div className="p-5 border-b border-surface-50/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span>🔨</span> Sessione Corrente
          </h3>
        </div>
        <div className="p-5">
          {activeSession ? (
            <div>
              <div className="flex items-center gap-4 mb-5">
                <span className="px-4 py-2 bg-secondary-500/20 text-secondary-400 rounded-full font-semibold border border-secondary-500/40">
                  {activeSession.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                </span>
                <span className="text-gray-300">
                  Fase: <strong className="text-white">{activeSession.currentPhase || 'Non impostata'}</strong>
                </span>
              </div>

              {/* Consolidation Status for CONTRATTI phase */}
              {activeSession.currentPhase === 'CONTRATTI' && consolidationStatus?.inContrattiPhase && (
                <div className="mb-5 p-4 bg-surface-300 rounded-xl border border-surface-50/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold">Stato Consolidamento Contratti</h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        consolidationStatus.allConsolidated
                          ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/40'
                          : 'bg-warning-500/20 text-warning-400 border border-warning-500/40'
                      }`}>
                        {consolidationStatus.consolidatedCount}/{consolidationStatus.totalCount} completati
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {consolidationStatus.managers.map(m => (
                      <div key={m.memberId} className="flex items-center justify-between p-2 bg-surface-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${m.isConsolidated ? 'bg-secondary-400' : 'bg-warning-400'}`}></span>
                          <span className="text-white">{m.username}</span>
                          <span className="text-gray-500 text-xs">({m.playerCount} giocatori)</span>
                        </div>
                        {m.isConsolidated ? (
                          <span className="text-secondary-400 text-xs">
                            Consolidato {m.consolidatedAt ? new Date(m.consolidatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        ) : (
                          <span className="text-warning-400 text-xs">In attesa</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {!consolidationStatus.allConsolidated && (
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-warning-400 text-sm">
                        Non puoi passare alla fase successiva finché tutti i Direttori Generali non hanno consolidato.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-purple-500/50 text-purple-400 ml-3 shrink-0"
                        onClick={handleSimulateAllConsolidation}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? '...' : 'Simula Consolidamento'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-5">
                <p className="text-sm text-gray-400 mb-3 uppercase tracking-wide">Cambia fase</p>
                <div className="flex flex-wrap gap-2">
                  {MARKET_PHASES.filter(p => activeSession.type === 'PRIMO_MERCATO' || !p.onlyFirst).map(phase => {
                    // Disable phase change from CONTRATTI if not all consolidated
                    const isDisabled = isSubmitting || (
                      activeSession.currentPhase === 'CONTRATTI' &&
                      phase.value !== 'CONTRATTI' &&
                      !consolidationStatus?.allConsolidated
                    )
                    return (
                      <Button
                        key={phase.value}
                        size="sm"
                        variant={activeSession.currentPhase === phase.value ? 'primary' : 'outline'}
                        onClick={() => handleSetPhase(activeSession.id, phase.value)}
                        disabled={isDisabled}
                        className={isDisabled && phase.value !== activeSession.currentPhase ? 'opacity-50' : ''}
                      >
                        {phase.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="danger" onClick={() => handleCloseSession(activeSession.id)} disabled={isSubmitting}>
                  Chiudi Sessione
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {league?.status === 'DRAFT' ? (
                <p className="text-amber-400">
                  ⚠️ La lega è in fase di creazione. Usa il pulsante "Passa al Primo Mercato" qui sopra per attivarla.
                </p>
              ) : (
                <>
                  <p className="text-gray-400 mb-5">Nessuna sessione attiva</p>

                  {/* Auction Mode Selector */}
                  <div className="mb-4 p-4 bg-surface-300 rounded-lg">
                    <p className="text-sm text-gray-400 mb-2">Modalità asta:</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAuctionMode('REMOTE')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          auctionMode === 'REMOTE'
                            ? 'bg-primary-500 text-white'
                            : 'bg-surface-200 text-gray-400 hover:text-white'
                        }`}
                      >
                        Remoto
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuctionMode('IN_PRESENCE')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          auctionMode === 'IN_PRESENCE'
                            ? 'bg-accent-500 text-white'
                            : 'bg-surface-200 text-gray-400 hover:text-white'
                        }`}
                      >
                        In Presenza
                      </button>
                    </div>
                    {auctionMode === 'IN_PRESENCE' && (
                      <p className="text-xs text-accent-400 mt-2">
                        Ready-check disabilitato: le aste partono subito dopo la nomina.
                      </p>
                    )}
                  </div>

                  {(() => {
                    const hasPrimoMercato = sessions.some(s => s.type === 'PRIMO_MERCATO')
                    return (
                      <div className="flex gap-3">
                        {!hasPrimoMercato && (
                          <Button size="lg" onClick={() => handleCreateSession(false)} disabled={isSubmitting}>
                            Avvia Primo Mercato
                          </Button>
                        )}
                        {hasPrimoMercato && (
                          <Button size="lg" onClick={() => handleCreateSession(true)} disabled={isSubmitting}>
                            Avvia Mercato Ricorrente
                          </Button>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

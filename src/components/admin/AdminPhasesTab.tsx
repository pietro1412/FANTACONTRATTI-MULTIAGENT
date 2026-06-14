import { useState } from 'react'
import { Button } from '../ui/Button'
import { MarketPhaseManager } from '../MarketPhaseManager'
import type { League, Member, MarketSession, ConsolidationStatus } from './types'

export interface AdminPhasesTabProps {
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

export function AdminPhasesTab({
  league,
  activeMembers,
  pendingMembers,
  sessions,
  activeSession,
  consolidationStatus,
  isSubmitting,
  auctionMode: _auctionMode,
  setAuctionMode: _setAuctionMode,
  handleStartLeague,
  handleSetPhase,
  handleCloseSession,
  handleCreateSession,
  handleSimulateAllConsolidation,
}: AdminPhasesTabProps) {
  const [showConfig, setShowConfig] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="space-y-6">
      {/* Box Avvia Lega - shown when DRAFT (blocco con azione → resta inline) */}
      {league?.status === 'DRAFT' && (
        <div className="arena-gold p-5 bg-surface-200 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-accent-500/[0.13] border border-accent-500/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">Attiva la Lega</h3>
              <p className="text-sm text-gray-400">La lega è in fase di creazione. Attivala per iniziare il Primo Mercato.</p>
            </div>
          </div>
          <div className="bg-surface-300 border border-surface-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-300">
              Partecipanti: <span className="font-bold text-white">{activeMembers.length}</span> / {league?.minParticipants || 6} richiesti
            </p>
          </div>
          {activeMembers.length >= (league?.minParticipants || 6) ? (
            <Button variant="accent" size="lg" onClick={handleStartLeague} disabled={isSubmitting}>
              {isSubmitting ? 'Attivazione...' : 'Attiva Lega e Passa al Primo Mercato'}
            </Button>
          ) : (
            <p className="text-danger-400 font-medium text-sm">
              Mancano {(league?.minParticipants || 6) - activeMembers.length} partecipanti per attivare la lega
            </p>
          )}
        </div>
      )}

      {/* Phase Controller - MarketPhaseManager */}
      {league?.status !== 'DRAFT' && (
        <MarketPhaseManager
          session={activeSession ? {
            id: activeSession.id,
            type: activeSession.type as 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE',
            status: activeSession.status,
            currentPhase: activeSession.currentPhase
          } : null}
          consolidationStatus={consolidationStatus ? {
            allConsolidated: consolidationStatus.allConsolidated,
            members: consolidationStatus.managers.map(m => ({
              memberId: m.memberId,
              username: m.username,
              consolidated: m.isConsolidated
            }))
          } : null}
          isSubmitting={isSubmitting}
          onSetPhase={handleSetPhase}
          onCloseSession={handleCloseSession}
          onCreateSession={handleCreateSession}
          onSimulateConsolidation={handleSimulateAllConsolidation}
          hasCompletedFirstMarket={sessions.some(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-300 rounded-xl border border-surface-50 p-4">
          <p className="stat-number text-3xl text-primary-400 leading-none">{activeMembers.length}/{league?.maxParticipants}</p>
          <p className="text-xs text-gray-400 mt-2">Partecipanti attivi</p>
        </div>
        <div className="bg-surface-300 rounded-xl border border-accent-500/30 p-4">
          <p className="stat-number text-3xl text-accent-400 leading-none">{pendingMembers.length}</p>
          <p className="text-xs text-gray-400 mt-2">Richieste in attesa</p>
        </div>
        <div className="bg-surface-300 rounded-xl border border-secondary-500/30 p-4">
          <p className="stat-number text-3xl text-secondary-400 leading-none">{league?.initialBudget}</p>
          <p className="text-xs text-gray-400 mt-2">Budget iniziale</p>
        </div>
        <div className="bg-surface-300 rounded-xl border border-surface-50 p-4">
          <p className="stat-number text-3xl text-white leading-none">{sessions.length}</p>
          <p className="text-xs text-gray-400 mt-2">Sessioni totali</p>
        </div>
      </div>

      {/* Config Collapsible */}
      <div className="bg-surface-200 rounded-xl border border-surface-50 overflow-hidden">
        <button
          onClick={() => { setShowConfig(!showConfig); }}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-300/30 transition-colors"
        >
          <h3 className="micro-label text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Configurazione lega
          </h3>
          <span className={`text-gray-500 transition-transform ${showConfig ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {showConfig && (
          <div className="p-4 border-t border-surface-50">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Nome</p>
                <p className="font-display font-bold text-white">{league?.name}</p>
              </div>
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Stato</p>
                <p className={`font-display font-bold ${league?.status === 'ACTIVE' ? 'text-secondary-400' : 'text-primary-400'}`}>
                  {league?.status === 'DRAFT' ? 'Creazione Lega' : league?.status === 'ACTIVE' ? 'Attiva' : league?.status}
                </p>
              </div>
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Partecipanti</p>
                <p className="font-mono font-bold text-white">{activeMembers.length} / {league?.maxParticipants}</p>
              </div>
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Minimo Richiesto</p>
                <p className="font-mono font-bold text-white">{league?.minParticipants || 6}</p>
              </div>
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Budget Iniziale</p>
                <p className="budget-display text-accent-400 text-lg">{league?.initialBudget}M</p>
              </div>
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Slot Rosa</p>
                <p className="font-mono font-bold flex gap-2">
                  <span className="text-amber-400">P:{league?.goalkeeperSlots}</span>
                  <span className="text-primary-400">D:{league?.defenderSlots}</span>
                  <span className="text-secondary-400">C:{league?.midfielderSlots}</span>
                  <span className="text-danger-400">A:{league?.forwardSlots}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sessions History Collapsible */}
      <div className="bg-surface-200 rounded-xl border border-surface-50 overflow-hidden">
        <button
          onClick={() => { setShowHistory(!showHistory); }}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-300/30 transition-colors"
        >
          <h3 className="micro-label text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Storico sessioni
            {sessions.length > 0 && (
              <span className="font-mono text-[10px] font-bold text-gray-400 bg-surface-300 border border-surface-50 px-1.5 py-0.5 rounded-full">{sessions.length}</span>
            )}
          </h3>
          <span className={`text-gray-500 transition-transform ${showHistory ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {showHistory && (
          <div className="border-t border-surface-50">
            {sessions.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-10">Nessuna sessione creata</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-300">
                    <tr>
                      <th className="px-5 py-3 text-left micro-label text-gray-400">Tipo</th>
                      <th className="px-5 py-3 text-center micro-label text-gray-400">Stagione</th>
                      <th className="px-5 py-3 text-center micro-label text-gray-400">Semestre</th>
                      <th className="px-5 py-3 text-center micro-label text-gray-400">Fase</th>
                      <th className="px-5 py-3 text-center micro-label text-gray-400">Stato</th>
                      <th className="px-5 py-3 text-right micro-label text-gray-400">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50/10">
                    {sessions.map(session => (
                      <tr key={session.id} className="hover:bg-surface-300/50 transition-colors">
                        <td className="px-5 py-3 font-display font-bold text-white">
                          {session.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-300 font-mono">{session.season}</td>
                        <td className="px-5 py-3 text-center text-gray-300 font-mono">{session.semester}</td>
                        <td className="px-5 py-3 text-center text-gray-300">{session.currentPhase || '-'}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-mono text-[10px] font-bold tracking-[0.06em] px-2.5 py-1 rounded-md border ${
                            session.status === 'ACTIVE' ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40' :
                            session.status === 'COMPLETED' ? 'bg-surface-300 text-gray-400 border-surface-50' :
                            'bg-accent-500/20 text-accent-400 border-accent-500/40'
                          }`}>
                            {session.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400 font-mono">
                          {new Date(session.createdAt).toLocaleDateString('it-IT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

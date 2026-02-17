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

  // Status badge
  const statusLabel = league?.status === 'DRAFT'
    ? 'ISCRIZIONI'
    : activeSession
      ? activeSession.type === 'PRIMO_MERCATO' ? 'PRIMO MERCATO' : 'MERCATO RICORRENTE'
      : 'CAMPIONATO'

  const statusColor = league?.status === 'DRAFT'
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    : activeSession
      ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40'
      : 'bg-primary-500/20 text-primary-400 border-primary-500/40'

  return (
    <div className="space-y-6">
      {/* Status Box */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">Stato attuale</p>
              <p className="text-lg font-bold text-white">{league?.name}</p>
            </div>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-bold border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        {activeSession?.currentPhase && (
          <div className="mt-3 pl-16">
            <p className="text-sm text-gray-400">
              Fase corrente: <span className="text-white font-semibold">{activeSession.currentPhase}</span>
            </p>
          </div>
        )}
      </div>

      {/* Box Avvia Lega - shown when DRAFT */}
      {league?.status === 'DRAFT' && (
        <div className="p-6 bg-gradient-to-r from-primary-500/20 to-accent-500/20 border-2 border-primary-500/50 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary-500/30 flex items-center justify-center">
              <span className="text-3xl">🚀</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Attiva la Lega</h3>
              <p className="text-gray-300">La lega è in fase di creazione. Attivala per iniziare il Primo Mercato.</p>
            </div>
          </div>
          <div className="bg-surface-300/50 rounded-lg p-4 mb-4">
            <p className="text-gray-300">
              Partecipanti: <span className="font-bold text-white">{activeMembers.length}</span> / {league?.minParticipants || 6} richiesti
            </p>
          </div>
          {activeMembers.length >= (league?.minParticipants || 6) ? (
            <Button variant="accent" size="lg" onClick={handleStartLeague} disabled={isSubmitting}>
              {isSubmitting ? 'Attivazione...' : 'Attiva Lega e Passa al Primo Mercato'}
            </Button>
          ) : (
            <p className="text-danger-400 font-medium">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5 text-center">
          <p className="text-3xl md:text-4xl font-bold text-primary-400">{activeMembers.length}/{league?.maxParticipants}</p>
          <p className="text-sm text-gray-400 mt-1">Partecipanti attivi</p>
        </div>
        <div className="bg-surface-200 rounded-xl border border-accent-500/30 p-5 text-center">
          <p className="text-3xl md:text-4xl font-bold text-accent-400">{pendingMembers.length}</p>
          <p className="text-sm text-gray-400 mt-1">Richieste in attesa</p>
        </div>
        <div className="bg-surface-200 rounded-xl border border-secondary-500/30 p-5 text-center">
          <p className="text-3xl md:text-4xl font-bold text-secondary-400">{league?.initialBudget}</p>
          <p className="text-sm text-gray-400 mt-1">Budget iniziale</p>
        </div>
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5 text-center">
          <p className="text-3xl md:text-4xl font-bold text-blue-400">{sessions.length}</p>
          <p className="text-sm text-gray-400 mt-1">Sessioni totali</p>
        </div>
      </div>

      {/* Config Collapsible */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <button
          onClick={() => { setShowConfig(!showConfig); }}
          className="w-full p-5 flex items-center justify-between hover:bg-surface-300/30 transition-colors"
        >
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <span>📋</span> Configurazione Lega
          </h3>
          <span className={`text-gray-400 transition-transform ${showConfig ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {showConfig && (
          <div className="p-5 border-t border-surface-50/20">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-surface-300 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Nome</p>
                <p className="font-semibold text-white text-lg">{league?.name}</p>
              </div>
              <div className="bg-surface-300 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Stato</p>
                <p className={`font-semibold text-lg ${league?.status === 'ACTIVE' ? 'text-secondary-400' : 'text-primary-400'}`}>
                  {league?.status === 'DRAFT' ? 'Creazione Lega' : league?.status === 'ACTIVE' ? 'Attiva' : league?.status}
                </p>
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
                <p className="text-sm text-gray-400 mb-1">Budget Iniziale</p>
                <p className="font-semibold text-accent-400 text-lg">{league?.initialBudget}M</p>
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
          </div>
        )}
      </div>

      {/* Sessions History Collapsible */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <button
          onClick={() => { setShowHistory(!showHistory); }}
          className="w-full p-5 flex items-center justify-between hover:bg-surface-300/30 transition-colors"
        >
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <span>📅</span> Storico Sessioni
            {sessions.length > 0 && (
              <span className="bg-surface-300 px-2 py-0.5 rounded-full text-xs text-gray-400">{sessions.length}</span>
            )}
          </h3>
          <span className={`text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {showHistory && (
          <div className="border-t border-surface-50/20">
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 opacity-50">📭</div>
                <p className="text-gray-500">Nessuna sessione creata</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-300">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm text-gray-400 font-semibold">Tipo</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Stagione</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Semestre</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Fase</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Stato</th>
                      <th className="px-5 py-4 text-right text-sm text-gray-400 font-semibold">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50/10">
                    {sessions.map(session => (
                      <tr key={session.id} className="hover:bg-surface-300/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-white">
                          {session.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                        </td>
                        <td className="px-5 py-4 text-center text-gray-300">{session.season}</td>
                        <td className="px-5 py-4 text-center text-gray-300">{session.semester}</td>
                        <td className="px-5 py-4 text-center text-gray-300">{session.currentPhase || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            session.status === 'ACTIVE' ? 'bg-secondary-500/20 text-secondary-400' :
                            session.status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-accent-500/20 text-accent-400'
                          }`}>
                            {session.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-gray-400">
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

import { Button } from '../ui/Button'
import { MarketPhaseManager } from '../MarketPhaseManager'
import type { League, MarketSession, ConsolidationStatus } from './types'

export interface AdminMarketTabProps {
  league: League | null
  activeMembers: Array<{ id: string }>
  activeSession: MarketSession | undefined
  sessions: Array<{ type: string; status: string }>
  consolidationStatus: ConsolidationStatus | null
  isSubmitting: boolean
  handleStartLeague: () => void
  handleSetPhase: (sessionId: string, phase: string) => void
  handleCloseSession: (sessionId: string) => void
  handleCreateSession: (isRegularMarket: boolean) => void
  handleSimulateAllConsolidation: () => void
  auctionMode: 'REMOTE' | 'IN_PRESENCE'
  setAuctionMode: (mode: 'REMOTE' | 'IN_PRESENCE') => void
}

export function AdminMarketTab({
  league,
  activeMembers,
  activeSession,
  sessions,
  consolidationStatus,
  isSubmitting,
  handleStartLeague,
  handleSetPhase,
  handleCloseSession,
  handleCreateSession,
  handleSimulateAllConsolidation,
  auctionMode,
  setAuctionMode,
}: AdminMarketTabProps) {
  return (
    <>
      {/* Box Avvia Lega - mostrato quando DRAFT */}
      {league?.status === 'DRAFT' && (
        <div className="mb-6 p-6 bg-gradient-to-r from-primary-500/20 to-accent-500/20 border-2 border-primary-500/50 rounded-2xl">
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
              {isSubmitting ? 'Attivazione...' : '✅ Attiva Lega e Passa al Primo Mercato'}
            </Button>
          ) : (
            <p className="text-danger-400 font-medium">
              ⚠️ Mancano {(league?.minParticipants || 6) - activeMembers.length} partecipanti per attivare la lega
            </p>
          )}
        </div>
      )}
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
    </>
  )
}

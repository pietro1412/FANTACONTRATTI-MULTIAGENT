import { useState, useEffect } from 'react'
import { auctionApi, leagueApi, prizePhaseApi } from '@/services/api'
import { Navigation } from '@/components/Navigation'
import { PrizePhaseManager } from '@/components/PrizePhaseManager'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { PrizeHistoryAccordion, type HistorySession } from '@/components/prizes/PrizeHistoryAccordion'

interface PrizePhasePageProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Session {
  id: string
  type: string
  status: string
  currentPhase: string | null
}

export function PrizePhasePage({ leagueId, onNavigate }: PrizePhasePageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [prizeHistory, setPrizeHistory] = useState<HistorySession[]>([])
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)

  useEffect(() => {
    void loadData()
  }, [leagueId])

  async function loadData() {
    setIsLoading(true)

    // Get league info to check admin status
    const leagueRes = await leagueApi.getById(leagueId)
    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { isAdmin: boolean }
      setIsAdmin(data.isAdmin)
    }

    // Get active session
    const sessionsRes = await auctionApi.getSessions(leagueId)
    if (sessionsRes.success && sessionsRes.data) {
      const sessions = sessionsRes.data as Session[]
      const active = sessions.find(s => s.status === 'ACTIVE')
      setActiveSession(active || null)
    }

    // Get prize history
    const historyRes = await prizePhaseApi.getHistory(leagueId)
    if (historyRes.success && historyRes.data) {
      const data = historyRes.data as { history: HistorySession[] }
      setPrizeHistory(data.history)
    }

    setIsLoading(false)
  }

  const toggleHistory = (sessionId: string) => {
    setExpandedHistory(prev => (prev === sessionId ? null : sessionId))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="prizes" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <Spinner size="xl" color="accent" className="mx-auto mb-4" />
            <p className="text-lg text-gray-400">Caricamento fase premi...</p>
          </div>
        </div>
      </div>
    )
  }

  // No active session: consultation-only (history) view.
  if (!activeSession) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="prizes" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <main className="max-w-[1600px] mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4" aria-hidden="true">🏆</div>
            <p className="text-xl text-gray-400 mb-2">Nessuna sessione di mercato attiva</p>
            <p className="text-gray-500">Puoi consultare lo storico dei premi assegnati</p>
          </div>

          <div className="mb-8">
            <h2 className="micro-label mb-4">Storico Premi</h2>
            <PrizeHistoryAccordion history={prizeHistory} expandedId={expandedHistory} onToggle={toggleHistory} />
          </div>

          <div className="text-center">
            <Button onClick={() => { onNavigate('leagueDetail', { leagueId }); }}>
              Torna alla Lega
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="prizes" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      <main className="max-w-[1600px] mx-auto px-4 py-8">
        <PrizePhaseManager
          sessionId={activeSession.id}
          isAdmin={isAdmin}
          onUpdate={() => void loadData()}
        />

        {prizeHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="micro-label mb-4">Storico Premi</h2>
            <PrizeHistoryAccordion history={prizeHistory} expandedId={expandedHistory} onToggle={toggleHistory} />
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => { onNavigate('leagueDetail', { leagueId }); }}>
            Torna alla Lega
          </Button>
        </div>
      </main>
    </div>
  )
}

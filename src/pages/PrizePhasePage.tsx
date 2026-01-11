import { useState, useEffect } from 'react'
import { auctionApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { PrizePhaseManager } from '../components/PrizePhaseManager'

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
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [leagueId])

  async function loadData() {
    setIsLoading(true)
    setError('')

    const sessionsRes = await auctionApi.getSessions(leagueId)

    if (sessionsRes.success && sessionsRes.data) {
      const sessions = sessionsRes.data as Session[]
      const active = sessions.find(s => s.status === 'ACTIVE')
      setActiveSession(active || null)

      // Check if user is admin (we'll get this from the session API response or league API)
      // For now, if they can access this page and there's an active session in PREMI, they're admin
      if (active?.currentPhase === 'PREMI') {
        setIsAdmin(true)
      }
    }

    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="prizes" leagueId={leagueId} isLeagueAdmin={true} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-gray-400">Caricamento fase premi...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!activeSession || activeSession.currentPhase !== 'PREMI') {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="prizes" leagueId={leagueId} isLeagueAdmin={true} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-xl text-gray-400 mb-4">La fase premi non è attiva</p>
            <p className="text-gray-500 mb-6">
              {!activeSession
                ? 'Nessuna sessione di mercato attiva'
                : `Fase corrente: ${activeSession.currentPhase || 'Non impostata'}`
              }
            </p>
            <button
              onClick={() => onNavigate('leagueDetail', { leagueId })}
              className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
            >
              Torna alla Lega
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="prizes" leagueId={leagueId} isLeagueAdmin={true} onNavigate={onNavigate} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        <PrizePhaseManager
          sessionId={activeSession.id}
          isAdmin={isAdmin}
          onUpdate={loadData}
        />

        {/* Back button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => onNavigate('leagueDetail', { leagueId })}
            className="px-6 py-3 bg-surface-200 text-gray-300 rounded-xl hover:bg-surface-300 transition-colors border border-surface-50/20"
          >
            Torna alla Lega
          </button>
        </div>
      </main>
    </div>
  )
}

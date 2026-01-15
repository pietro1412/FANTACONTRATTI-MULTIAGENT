import { useState, useEffect } from 'react'
import { auctionApi, leagueApi, prizePhaseApi } from '../services/api'
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

interface HistoryMember {
  memberId: string
  teamName: string | null
  username: string
  baseReincrement: number
  categoryPrizes: Record<string, number>
  total: number
}

interface HistoryCategory {
  name: string
  isSystemPrize: boolean
}

interface HistorySession {
  sessionId: string
  type: string
  season: number
  semester: string
  finalizedAt: string
  baseReincrement: number
  categories: HistoryCategory[]
  members: HistoryMember[]
}

export function PrizePhasePage({ leagueId, onNavigate }: PrizePhasePageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [prizeHistory, setPrizeHistory] = useState<HistorySession[]>([])
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [leagueId])

  async function loadData() {
    setIsLoading(true)
    setError('')

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

  // Helper to format session type
  function formatSessionType(type: string, season: number, semester: string) {
    const typeMap: Record<string, string> = {
      PRIMO_MERCATO: 'Primo Mercato',
      SECONDO_MERCATO: 'Secondo Mercato',
    }
    const semesterMap: Record<string, string> = {
      FIRST: '1° Semestre',
      SECOND: '2° Semestre',
    }
    return `${typeMap[type] || type} - Stagione ${season} - ${semesterMap[semester] || semester}`
  }

  // Render history section
  function renderPrizeHistory() {
    if (prizeHistory.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <p>Nessuno storico premi disponibile</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {prizeHistory.map(session => {
          const isExpanded = expandedHistory === session.sessionId

          return (
            <div key={session.sessionId} className="bg-surface-200 rounded-xl border border-surface-50/20">
              {/* Session Header - clickable */}
              <button
                onClick={() => setExpandedHistory(isExpanded ? null : session.sessionId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-300/50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div className="text-left">
                    <p className="font-medium text-white">
                      {formatSessionType(session.type, session.season, session.semester)}
                    </p>
                    <p className="text-sm text-gray-400">
                      Finalizzato il {new Date(session.finalizedAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">
                    Base: {session.baseReincrement}M
                  </span>
                  <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-surface-50/20">
                  {/* Categories legend */}
                  <div className="flex flex-wrap gap-2 py-3 mb-3">
                    <span className="text-sm text-gray-400">Categorie:</span>
                    {session.categories.map(cat => (
                      <span
                        key={cat.name}
                        className={`text-xs px-2 py-1 rounded-full ${
                          cat.isSystemPrize
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-primary-500/20 text-primary-400'
                        }`}
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>

                  {/* Members table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-50/20">
                          <th className="text-left py-2 text-gray-400 font-medium">Manager</th>
                          <th className="text-center py-2 text-gray-400 font-medium">Base</th>
                          {session.categories.map(cat => (
                            <th key={cat.name} className="text-center py-2 text-gray-400 font-medium whitespace-nowrap">
                              {cat.name.length > 15 ? cat.name.substring(0, 15) + '...' : cat.name}
                            </th>
                          ))}
                          <th className="text-center py-2 text-yellow-400 font-medium">Totale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.members.map(member => (
                          <tr key={member.memberId} className="border-b border-surface-50/10 hover:bg-surface-300/30">
                            <td className="py-2">
                              <div>
                                <p className="font-medium text-white">{member.teamName || 'Team'}</p>
                                <p className="text-xs text-gray-500">{member.username}</p>
                              </div>
                            </td>
                            <td className="text-center py-2 text-gray-300">{member.baseReincrement}M</td>
                            {session.categories.map(cat => (
                              <td key={cat.name} className="text-center py-2 text-gray-300">
                                {member.categoryPrizes[cat.name] ?? 0}M
                              </td>
                            ))}
                            <td className="text-center py-2 font-bold text-yellow-400">{member.total}M</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Allow access during PREMI phase OR after (to view finalized prizes)
  if (!activeSession) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="prizes" leagueId={leagueId} isLeagueAdmin={true} onNavigate={onNavigate} />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-xl text-gray-400 mb-2">Nessuna sessione di mercato attiva</p>
            <p className="text-gray-500">Puoi consultare lo storico dei premi assegnati</p>
          </div>

          {/* Prize History */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📜</span> Storico Premi
            </h2>
            {renderPrizeHistory()}
          </div>

          <div className="text-center">
            <button
              onClick={() => onNavigate('leagueDetail', { leagueId })}
              className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
            >
              Torna alla Lega
            </button>
          </div>
        </main>
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

        {/* Prize History Section */}
        {prizeHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📜</span> Storico Premi
            </h2>
            {renderPrizeHistory()}
          </div>
        )}

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

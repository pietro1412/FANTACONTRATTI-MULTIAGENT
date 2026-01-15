import { useState, useEffect } from 'react'
import { historyApi, leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { SessionView } from '../components/history/SessionView'
import { TimelineView } from '../components/history/TimelineView'
import { PlayerCareerPanel } from '../components/history/PlayerCareerPanel'

interface HistoryProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface SessionSummary {
  id: string
  type: string
  season: number
  semester: string
  status: string
  currentPhase: string | null
  createdAt: string
  startsAt: string | null
  endsAt: string | null
  counts: {
    auctions: number
    movements: number
    trades: number
    prizes: number
  }
  prizesFinalized: boolean
  prizesFinalizedAt: string | null
}

interface PlayerInfo {
  id: string
  name: string
  position: string
  team: string
  currentOwner: {
    username: string
    teamName: string | null
  } | null
  isActive: boolean
}

export function History({ leagueId, onNavigate }: HistoryProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'sessions' | 'timeline'>('sessions')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfo | null>(null)
  const [isPlayerSearchOpen, setIsPlayerSearchOpen] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerResults, setPlayerResults] = useState<PlayerInfo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  useEffect(() => {
    loadData()
  }, [leagueId])

  async function loadData() {
    setIsLoading(true)
    setError('')
    try {
      // Fetch league info for admin status
      const leagueResponse = await leagueApi.getById(leagueId)
      if (leagueResponse.success && leagueResponse.data) {
        const data = leagueResponse.data as { userMembership?: { role: string } }
        setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
      }

      // Fetch sessions
      const result = await historyApi.getSessionsOverview(leagueId)
      if (result.success && result.data) {
        const data = result.data as { sessions: SessionSummary[] }
        setSessions(data.sessions)
      } else {
        setError(result.message || 'Errore nel caricamento')
      }
    } catch (err) {
      setError('Errore di connessione')
    }
    setIsLoading(false)
  }

  async function searchPlayers(query: string) {
    if (query.length < 2) {
      setPlayerResults([])
      return
    }
    setIsSearching(true)
    try {
      const result = await historyApi.searchPlayers(leagueId, query, { includeReleased: true, limit: 10 })
      if (result.success && result.data) {
        const data = result.data as { players: PlayerInfo[] }
        setPlayerResults(data.players)
      }
    } catch (err) {
      console.error('Search error:', err)
    }
    setIsSearching(false)
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (playerSearch) {
        searchPlayers(playerSearch)
      } else {
        setPlayerResults([])
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [playerSearch])

  function formatSessionType(type: string) {
    return type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'
  }

  function formatSemester(semester: string) {
    return semester === 'FIRST' ? '1° Semestre' : '2° Semestre'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="history" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-gray-400">Caricamento storico...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="history" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Header with view toggle and player filter */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('sessions')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'sessions'
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-300 text-gray-400 hover:text-white'
                }`}
              >
                Per Sessione
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-300 text-gray-400 hover:text-white'
                }`}
              >
                Timeline
              </button>
            </div>

            {/* Player Filter */}
            <div className="relative">
              {selectedPlayer ? (
                <div className="flex items-center gap-2 bg-surface-300 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-400">Filtro:</span>
                  <span className="font-medium text-white">{selectedPlayer.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    selectedPlayer.position === 'P' ? 'bg-amber-500/20 text-amber-400' :
                    selectedPlayer.position === 'D' ? 'bg-blue-500/20 text-blue-400' :
                    selectedPlayer.position === 'C' ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {selectedPlayer.position}
                  </span>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="ml-2 text-gray-400 hover:text-white"
                  >
                    x
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cerca giocatore..."
                    value={playerSearch}
                    onChange={(e) => {
                      setPlayerSearch(e.target.value)
                      setIsPlayerSearchOpen(true)
                    }}
                    onFocus={() => setIsPlayerSearchOpen(true)}
                    className="w-64 px-4 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                  {isPlayerSearchOpen && (playerResults.length > 0 || isSearching) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-200 border border-surface-50/20 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                      {isSearching ? (
                        <div className="p-4 text-center text-gray-400">Ricerca...</div>
                      ) : (
                        playerResults.map(player => (
                          <button
                            key={player.id}
                            onClick={() => {
                              setSelectedPlayer(player)
                              setPlayerSearch('')
                              setIsPlayerSearchOpen(false)
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-surface-300 transition-colors flex items-center gap-2"
                          >
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              player.position === 'P' ? 'bg-amber-500/20 text-amber-400' :
                              player.position === 'D' ? 'bg-blue-500/20 text-blue-400' :
                              player.position === 'C' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {player.position}
                            </span>
                            <span className="text-white">{player.name}</span>
                            <span className="text-sm text-gray-500">{player.team}</span>
                            {player.currentOwner && (
                              <span className="ml-auto text-xs text-gray-400">
                                {player.currentOwner.teamName || player.currentOwner.username}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Player Career Panel (when player is selected) */}
        {selectedPlayer && (
          <PlayerCareerPanel
            leagueId={leagueId}
            playerId={selectedPlayer.id}
            playerName={selectedPlayer.name}
            onClose={() => setSelectedPlayer(null)}
          />
        )}

        {/* Main Content */}
        {!selectedPlayer && (
          <>
            {viewMode === 'sessions' ? (
              <SessionView
                leagueId={leagueId}
                sessions={sessions}
                formatSessionType={formatSessionType}
                formatSemester={formatSemester}
              />
            ) : (
              <TimelineView
                leagueId={leagueId}
                sessions={sessions}
              />
            )}
          </>
        )}

        {/* Empty State */}
        {sessions.length === 0 && !selectedPlayer && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📜</div>
            <p className="text-xl text-gray-400 mb-2">Nessuno storico disponibile</p>
            <p className="text-gray-500">Le sessioni di mercato completate appariranno qui</p>
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

      {/* Click outside to close player search */}
      {isPlayerSearchOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsPlayerSearchOpen(false)}
        />
      )}
    </div>
  )
}

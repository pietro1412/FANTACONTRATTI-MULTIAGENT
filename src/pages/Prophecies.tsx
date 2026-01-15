import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { historyApi } from '../services/api'

interface Prophecy {
  id: string
  content: string
  authorRole: 'BUYER' | 'SELLER'
  createdAt: string
  player: {
    id: string
    name: string
    position: string
    team: string
  }
  author: {
    memberId: string
    username: string
    teamName: string | null
  }
  session: {
    type: string
    season: number
    semester: string
  } | null
  movementPrice: number | null
}

interface ProphecyStats {
  total: number
  byAuthor: Array<{
    memberId: string
    username: string
    teamName: string | null
    count: number
  }>
  topPlayers: Array<{
    playerId: string
    name: string
    position: string
    team: string
    count: number
  }>
}

type FilterMode = 'all' | 'player' | 'author'

export default function Prophecies() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [prophecies, setProphecies] = useState<Prophecy[]>([])
  const [stats, setStats] = useState<ProphecyStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (leagueId) {
      loadStats()
      loadProphecies(true)
    }
  }, [leagueId])

  useEffect(() => {
    if (leagueId) {
      loadProphecies(true)
    }
  }, [selectedPlayerId, selectedAuthorId, search])

  async function loadStats() {
    try {
      const result = await historyApi.getProphecyStats(leagueId!)
      if (result.success && result.data) {
        setStats(result.data as ProphecyStats)
      }
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  async function loadProphecies(reset = false) {
    setIsLoading(true)
    try {
      const newOffset = reset ? 0 : offset
      const result = await historyApi.getProphecies(leagueId!, {
        playerId: selectedPlayerId || undefined,
        authorId: selectedAuthorId || undefined,
        search: search || undefined,
        limit: 30,
        offset: newOffset,
      })

      if (result.success && result.data) {
        const data = result.data as { prophecies: Prophecy[]; pagination: { hasMore: boolean } }
        if (reset) {
          setProphecies(data.prophecies)
          setOffset(30)
        } else {
          setProphecies(prev => [...prev, ...data.prophecies])
          setOffset(newOffset + 30)
        }
        setHasMore(data.pagination.hasMore)
      }
    } catch (err) {
      console.error('Error loading prophecies:', err)
    }
    setIsLoading(false)
  }

  function handleFilterByPlayer(playerId: string) {
    setFilterMode('player')
    setSelectedPlayerId(playerId)
    setSelectedAuthorId(null)
    setSearch('')
  }

  function handleFilterByAuthor(authorId: string) {
    setFilterMode('author')
    setSelectedAuthorId(authorId)
    setSelectedPlayerId(null)
    setSearch('')
  }

  function clearFilters() {
    setFilterMode('all')
    setSelectedPlayerId(null)
    setSelectedAuthorId(null)
    setSearch('')
  }

  const positionColors: Record<string, string> = {
    P: 'text-amber-400 bg-amber-400/20',
    D: 'text-blue-400 bg-blue-400/20',
    C: 'text-emerald-400 bg-emerald-400/20',
    A: 'text-red-400 bg-red-400/20',
  }

  const formatSessionType = (type: string) => {
    const types: Record<string, string> = {
      PRIMO_MERCATO: 'Primo Mercato',
      SESSIONE_INVERNALE: 'Sessione Invernale',
      SESSIONE_ESTIVA: 'Sessione Estiva',
    }
    return types[type] || type
  }

  const getActiveFilterLabel = () => {
    if (filterMode === 'player' && selectedPlayerId) {
      const player = stats?.topPlayers.find(p => p.playerId === selectedPlayerId)
      return `Giocatore: ${player?.name || 'Selezionato'}`
    }
    if (filterMode === 'author' && selectedAuthorId) {
      const author = stats?.byAuthor.find(a => a.memberId === selectedAuthorId)
      return `Manager: ${author?.teamName || author?.username || 'Selezionato'}`
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-100 to-surface-200">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to={`/leagues/${leagueId}`}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🔮</span>
              Profezie
            </h1>
            <p className="text-gray-400 mt-1">
              {stats?.total || 0} profezie nella lega
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Top Prophets */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span>👤</span> Profeti Attivi
              </h3>
              <div className="space-y-2">
                {stats.byAuthor.slice(0, 5).map((author, idx) => (
                  <button
                    key={author.memberId}
                    onClick={() => handleFilterByAuthor(author.memberId)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                      selectedAuthorId === author.memberId
                        ? 'bg-purple-500/30 border border-purple-500/50'
                        : 'hover:bg-surface-300/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                        idx === 1 ? 'bg-gray-400/30 text-gray-300' :
                        idx === 2 ? 'bg-amber-600/30 text-amber-500' :
                        'bg-surface-300 text-gray-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="text-left">
                        <p className="text-white font-medium">{author.teamName || author.username}</p>
                        {author.teamName && (
                          <p className="text-xs text-gray-500">{author.username}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-purple-400 font-bold">{author.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Most Prophesied Players */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span>⚽</span> Giocatori Più Profetizzati
              </h3>
              <div className="space-y-2">
                {stats.topPlayers.slice(0, 5).map((player, idx) => (
                  <button
                    key={player.playerId}
                    onClick={() => handleFilterByPlayer(player.playerId)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                      selectedPlayerId === player.playerId
                        ? 'bg-purple-500/30 border border-purple-500/50'
                        : 'hover:bg-surface-300/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                        idx === 1 ? 'bg-gray-400/30 text-gray-300' :
                        idx === 2 ? 'bg-amber-600/30 text-amber-500' :
                        'bg-surface-300 text-gray-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${positionColors[player.position]}`}>
                            {player.position}
                          </span>
                          <p className="text-white font-medium">{player.name}</p>
                        </div>
                        <p className="text-xs text-gray-500">{player.team}</p>
                      </div>
                    </div>
                    <span className="text-purple-400 font-bold">{player.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Cerca per giocatore, manager o contenuto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              />
            </div>

            {/* Active Filter Badge */}
            {getActiveFilterLabel() && (
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                <span className="text-purple-300 text-sm">{getActiveFilterLabel()}</span>
                <button
                  onClick={clearFilters}
                  className="text-purple-400 hover:text-purple-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Clear All */}
            {(search || selectedPlayerId || selectedAuthorId) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Resetta filtri
              </button>
            )}
          </div>
        </div>

        {/* Prophecies List */}
        <div className="space-y-4">
          {isLoading && prophecies.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
          ) : prophecies.length === 0 ? (
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8 text-center">
              <span className="text-5xl mb-4 block">🔮</span>
              <p className="text-gray-400">Nessuna profezia trovata</p>
              {(search || selectedPlayerId || selectedAuthorId) && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Resetta filtri
                </button>
              )}
            </div>
          ) : (
            <>
              {prophecies.map(prophecy => (
                <div
                  key={prophecy.id}
                  className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Player Info */}
                    <button
                      onClick={() => handleFilterByPlayer(prophecy.player.id)}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <span className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-bold ${positionColors[prophecy.player.position]}`}>
                        {prophecy.player.position}
                      </span>
                      <div className="text-left">
                        <p className="text-white font-semibold">{prophecy.player.name}</p>
                        <p className="text-xs text-gray-500">{prophecy.player.team}</p>
                      </div>
                    </button>

                    {/* Content */}
                    <div className="flex-1">
                      <p className="text-white italic">"{prophecy.content}"</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <button
                          onClick={() => handleFilterByAuthor(prophecy.author.memberId)}
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          — {prophecy.author.teamName || prophecy.author.username}
                        </button>
                        {prophecy.session && (
                          <span className="text-gray-500">
                            {formatSessionType(prophecy.session.type)} S{prophecy.session.season}
                          </span>
                        )}
                        {prophecy.movementPrice && (
                          <span className="text-primary-400">
                            {prophecy.movementPrice}M
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          prophecy.authorRole === 'BUYER'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {prophecy.authorRole === 'BUYER' ? 'Acquirente' : 'Osservatore'}
                        </span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-500 md:text-right">
                      {new Date(prophecy.createdAt).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => loadProphecies(false)}
                    disabled={isLoading}
                    className="px-6 py-3 bg-surface-300 text-white rounded-lg hover:bg-surface-400 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Caricamento...' : 'Carica altre profezie'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

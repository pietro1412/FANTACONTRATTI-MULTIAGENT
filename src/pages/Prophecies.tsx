import { useState, useEffect, useRef, useCallback } from 'react'
import { historyApi, leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { EmptyState } from '../components/ui/EmptyState'

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
  movementType: string | null
  movementPrice: number | null
}

interface PropheciesProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
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

export function Prophecies({ leagueId, onNavigate }: PropheciesProps) {
  const [prophecies, setProphecies] = useState<Prophecy[]>([])
  const [stats, setStats] = useState<ProphecyStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [showStats, setShowStats] = useState(true)
  const [compactView, setCompactView] = useState(true)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); }, 300)
    return () => { clearTimeout(timer); }
  }, [search])

  useEffect(() => {
    if (leagueId) {
      void loadLeagueInfo()
      void loadStats()
      void loadProphecies(true)
    }
  }, [leagueId])

  async function loadLeagueInfo() {
    const response = await leagueApi.getById(leagueId)
    if (response.success && response.data) {
      const data = response.data as { userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
    }
  }

  useEffect(() => {
    if (leagueId) {
      void loadProphecies(true)
    }
  }, [selectedPlayerId, selectedAuthorId, debouncedSearch])

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          void loadProphecies(false)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => { observer.disconnect(); }
  }, [hasMore, isLoadingMore, isLoading, offset])

  async function loadStats() {
    try {
      const result = await historyApi.getProphecyStats(leagueId)
      if (result.success && result.data) {
        setStats(result.data as ProphecyStats)
      }
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const loadProphecies = useCallback(async (reset: boolean) => {
    if (reset) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const newOffset = reset ? 0 : offset
      const result = await historyApi.getProphecies(leagueId, {
        playerId: selectedPlayerId || undefined,
        authorId: selectedAuthorId || undefined,
        search: debouncedSearch || undefined,
        limit: 50,
        offset: newOffset,
      })

      if (result.success && result.data) {
        const data = result.data as { prophecies: Prophecy[]; pagination: { hasMore: boolean; total: number } }
        if (reset) {
          setProphecies(data.prophecies)
          setOffset(50)
        } else {
          setProphecies(prev => [...prev, ...data.prophecies])
          setOffset(newOffset + 50)
        }
        setHasMore(data.pagination.hasMore)
      }
    } catch (err) {
      console.error('Error loading prophecies:', err)
    }
    setIsLoading(false)
    setIsLoadingMore(false)
  }, [leagueId, selectedPlayerId, selectedAuthorId, debouncedSearch, offset])

  function handleFilterByPlayer(playerId: string) {
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null)
    } else {
      setSelectedPlayerId(playerId)
      setSelectedAuthorId(null)
    }
  }

  function handleFilterByAuthor(authorId: string) {
    if (selectedAuthorId === authorId) {
      setSelectedAuthorId(null)
    } else {
      setSelectedAuthorId(authorId)
      setSelectedPlayerId(null)
    }
  }

  function clearFilters() {
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

  const movementTypeLabels: Record<string, { label: string; color: string }> = {
    FIRST_MARKET: { label: 'Primo Mercato', color: 'bg-blue-500/20 text-blue-400' },
    RUBATA: { label: 'Rubata', color: 'bg-orange-500/20 text-orange-400' },
    SVINCOLATI: { label: 'Svincolati', color: 'bg-cyan-500/20 text-cyan-400' },
    TRADE: { label: 'Scambio', color: 'bg-pink-500/20 text-pink-400' },
    CONTRACT_RENEW: { label: 'Rinnovo', color: 'bg-emerald-500/20 text-emerald-400' },
    RELEASE: { label: 'Svincolo', color: 'bg-red-500/20 text-red-400' },
  }

  const getMovementLabel = (type: string | null) => {
    if (!type) return null
    return movementTypeLabels[type] || { label: type, color: 'bg-gray-500/20 text-gray-400' }
  }

  const getActiveFilterLabel = () => {
    if (selectedPlayerId) {
      const player = stats?.topPlayers.find(p => p.playerId === selectedPlayerId)
      if (player) return player.name
      const fromList = prophecies.find(p => p.player.id === selectedPlayerId)
      return fromList?.player.name || 'Giocatore'
    }
    if (selectedAuthorId) {
      const author = stats?.byAuthor.find(a => a.memberId === selectedAuthorId)
      if (author) return author.teamName || author.username
      const fromList = prophecies.find(p => p.author.memberId === selectedAuthorId)
      return fromList?.author.teamName || fromList?.author.username || 'Manager'
    }
    return null
  }

  const hasActiveFilters = selectedPlayerId || selectedAuthorId || debouncedSearch

  return (
    <div className="min-h-screen">
      <Navigation currentPage="prophecies" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header compatto */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <span>🔮</span>
            Profezie
            <span className="text-base font-normal text-gray-400">
              ({stats?.total || 0})
            </span>
          </h1>

          <div className="flex items-center gap-2">
            {/* Toggle Stats */}
            <button
              onClick={() => { setShowStats(!showStats); }}
              className={`p-2 rounded-lg transition-colors ${showStats ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'}`}
              title={showStats ? 'Nascondi statistiche' : 'Mostra statistiche'}
              aria-label={showStats ? 'Nascondi statistiche' : 'Mostra statistiche'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Toggle View */}
            <button
              onClick={() => { setCompactView(!compactView); }}
              className={`p-2 rounded-lg transition-colors ${compactView ? 'text-gray-400 hover:text-white' : 'bg-primary-500/20 text-primary-400'}`}
              title={compactView ? 'Vista espansa' : 'Vista compatta'}
              aria-label={compactView ? 'Vista espansa' : 'Vista compatta'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {compactView ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Cards - Collapsible */}
        {showStats && stats && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Top Prophets - Compact */}
            <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Top Profeti</h3>
              <div className="flex flex-wrap gap-1">
                {stats.byAuthor.slice(0, 6).map((author, idx) => (
                  <button
                    key={author.memberId}
                    onClick={() => { handleFilterByAuthor(author.memberId); }}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                      selectedAuthorId === author.memberId
                        ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/50'
                        : 'bg-surface-300/50 text-gray-300 hover:bg-surface-300'
                    }`}
                  >
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      idx === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                      idx === 1 ? 'bg-gray-400/30 text-gray-300' :
                      idx === 2 ? 'bg-amber-600/30 text-amber-500' :
                      'bg-surface-400 text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[80px]">{author.teamName || author.username}</span>
                    <span className="text-purple-400 font-semibold">{author.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Most Prophesied Players - Compact */}
            <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Top Giocatori</h3>
              <div className="flex flex-wrap gap-1">
                {stats.topPlayers.slice(0, 6).map((player, _idx) => (
                  <button
                    key={player.playerId}
                    onClick={() => { handleFilterByPlayer(player.playerId); }}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                      selectedPlayerId === player.playerId
                        ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/50'
                        : 'bg-surface-300/50 text-gray-300 hover:bg-surface-300'
                    }`}
                  >
                    <span className={`px-1 rounded text-[10px] font-bold ${positionColors[player.position] ?? ''}`}>
                      {player.position}
                    </span>
                    <span className="truncate max-w-[80px]">{player.name}</span>
                    <span className="text-purple-400 font-semibold">{player.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters Bar */}
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-3 mb-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cerca giocatore, manager o testo..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="w-full pl-9 pr-4 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              />
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                {getActiveFilterLabel() && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300">
                    {selectedPlayerId && <span className={`px-1 rounded text-[10px] font-bold ${positionColors[prophecies.find(p => p.player.id === selectedPlayerId)?.player.position || 'P'] ?? ''}`}>{prophecies.find(p => p.player.id === selectedPlayerId)?.player.position}</span>}
                    {getActiveFilterLabel()}
                    <button onClick={clearFilters} className="ml-1 hover:text-white">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Results count */}
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {prophecies.length} risultati
            </span>
          </div>
        </div>

        {/* Prophecies List */}
        {isLoading && prophecies.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
          </div>
        ) : prophecies.length === 0 ? (
          <EmptyState
            icon="🔮"
            title="Nessuna profezia trovata"
            description={hasActiveFilters ? "Prova a cambiare i filtri di ricerca." : undefined}
            action={hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Resetta filtri
              </button>
            ) : undefined}
          />
        ) : compactView ? (
          /* Vista Compatta - Tabella */
          <div className="bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-300/50 border-b border-surface-50/20">
                <tr>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Giocatore</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase hidden lg:table-cell">Profezia</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Autore</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Evento</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Prezzo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/10">
                {prophecies.map(prophecy => (
                  <tr key={prophecy.id} className="hover:bg-surface-300/30 transition-colors">
                    <td className="px-3 py-2">
                      <button
                        onClick={() => { handleFilterByPlayer(prophecy.player.id); }}
                        className="flex items-center gap-2 hover:opacity-80"
                      >
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${positionColors[prophecy.player.position] ?? ''}`}>
                          {prophecy.player.position}
                        </span>
                        <div>
                          <p className="text-white font-medium text-left">{prophecy.player.name}</p>
                          <p className="text-[10px] text-gray-500 md:hidden">{prophecy.content.substring(0, 40)}...</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <p className="text-gray-300 italic text-xs max-w-md truncate" title={prophecy.content}>
                        "{prophecy.content}"
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => { handleFilterByAuthor(prophecy.author.memberId); }}
                        className="text-purple-400 hover:text-purple-300 text-xs"
                      >
                        {prophecy.author.teamName || prophecy.author.username}
                      </button>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      {prophecy.movementType && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getMovementLabel(prophecy.movementType)?.color ?? ''}`}>
                          {getMovementLabel(prophecy.movementType)?.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">
                      {prophecy.movementPrice && (
                        <span className="text-primary-400 text-xs font-medium">{prophecy.movementPrice}M</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Vista Espansa - Cards */
          <div className="space-y-3">
            {prophecies.map(prophecy => (
              <div
                key={prophecy.id}
                className="bg-surface-200 rounded-lg border border-surface-50/20 p-3 hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Player */}
                  <button
                    onClick={() => { handleFilterByPlayer(prophecy.player.id); }}
                    className="flex items-center gap-2 hover:opacity-80 shrink-0"
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold ${positionColors[prophecy.player.position] ?? ''}`}>
                      {prophecy.player.position}
                    </span>
                    <div className="text-left">
                      <p className="text-white font-medium text-sm">{prophecy.player.name}</p>
                      <p className="text-[10px] text-gray-500">{prophecy.player.team}</p>
                    </div>
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm italic">"{prophecy.content}"</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                      <button
                        onClick={() => { handleFilterByAuthor(prophecy.author.memberId); }}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        — {prophecy.author.teamName || prophecy.author.username}
                      </button>
                      {prophecy.movementType && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getMovementLabel(prophecy.movementType)?.color ?? ''}`}>
                          {getMovementLabel(prophecy.movementType)?.label}
                        </span>
                      )}
                      {prophecy.movementPrice && (
                        <span className="text-primary-400">{prophecy.movementPrice}M</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        prophecy.authorRole === 'BUYER'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {prophecy.authorRole === 'BUYER' ? 'Acquirente' : 'Osservatore'}
                      </span>
                    </div>
                  </div>

                  {/* Date */}
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {new Date(prophecy.createdAt).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        <div ref={observerTarget} className="h-10 flex items-center justify-center">
          {isLoadingMore && (
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
          )}
        </div>

        {/* End of list indicator */}
        {!hasMore && prophecies.length > 0 && (
          <p className="text-center text-xs text-gray-500 py-4">
            Fine delle profezie
          </p>
        )}
      </main>
    </div>
  )
}

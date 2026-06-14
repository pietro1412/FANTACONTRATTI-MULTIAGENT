import { useState, useEffect, useRef, useCallback } from 'react'
import { historyApi, leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { EmptyState } from '../components/ui/EmptyState'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { Monogram } from '@/components/ui/Monogram'

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

  // Position accent badge — token tema (gold/primary/secondary/danger), non colori crudi.
  const positionColors: Record<string, string> = {
    P: 'text-accent-400 bg-accent-500/15',
    D: 'text-primary-300 bg-primary-500/15',
    C: 'text-secondary-300 bg-secondary-500/15',
    A: 'text-danger-300 bg-danger-500/15',
  }

  // Movement/event tag — token tema (primary/secondary/gold/danger), niente pink/cyan/orange crudi.
  const movementTypeLabels: Record<string, { label: string; color: string }> = {
    FIRST_MARKET: { label: 'Primo Mercato', color: 'bg-primary-500/12 text-primary-300' },
    RUBATA: { label: 'Rubata', color: 'bg-accent-500/13 text-accent-400' },
    SVINCOLATI: { label: 'Svincolati', color: 'bg-secondary-500/12 text-secondary-300' },
    TRADE: { label: 'Scambio', color: 'bg-primary-500/12 text-primary-300' },
    CONTRACT_RENEW: { label: 'Rinnovo', color: 'bg-secondary-500/12 text-secondary-300' },
    RELEASE: { label: 'Svincolo', color: 'bg-danger-500/12 text-danger-300' },
  }

  const getMovementLabel = (type: string | null) => {
    if (!type) return null
    return movementTypeLabels[type] || { label: type, color: 'bg-surface-100 text-gray-400' }
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

  // Role chip: BUYER=Acquirente verde/secondary · SELLER=Osservatore blu/primary
  const roleChip = (role: 'BUYER' | 'SELLER') => (
    <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.06em] rounded-md px-2 py-0.5 border whitespace-nowrap ${
      role === 'BUYER'
        ? 'text-secondary-300 bg-secondary-500/14 border-secondary-500/40'
        : 'text-primary-300 bg-primary-500/14 border-primary-500/40'
    }`}>
      {role === 'BUYER' ? 'Acquirente' : 'Osservatore'}
    </span>
  )

  const activeFilterPosition = selectedPlayerId
    ? prophecies.find(p => p.player.id === selectedPlayerId)?.player.position
    : undefined

  // ===== TESTATA: icona + titolo + conteggio + toggle stats + segmented vista =====
  const header = (
    <div className="bg-surface-300 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <span className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-primary-500/12 border border-primary-500/40">
        <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3c-3.866 0-7 3.134-7 7 0 2.345 1.153 4.42 2.924 5.7.41.296.576.81.576 1.31V18a1 1 0 001 1h5a1 1 0 001-1v-.99c0-.5.166-1.014.576-1.31A6.997 6.997 0 0019 10c0-3.866-3.134-7-7-7z" />
        </svg>
      </span>

      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-base sm:text-[17px] text-white leading-tight flex items-baseline gap-2.5">
          Profezie
          <span className="stat-number text-lg text-primary-300 font-semibold">({stats?.total || 0})</span>
        </h1>
        <p className="text-xs text-gray-500 leading-tight mt-0.5">
          Archivio commenti dei manager su ogni movimento di mercato
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Toggle Stats */}
        <button
          onClick={() => { setShowStats(!showStats); }}
          className={`inline-flex items-center gap-1.5 font-display text-xs font-semibold rounded-xl px-3 py-2 border transition-colors ${
            showStats
              ? 'text-primary-300 bg-primary-500/10 border-primary-500/40'
              : 'text-gray-400 bg-surface-300 border-surface-50 hover:text-white'
          }`}
          title={showStats ? 'Nascondi statistiche' : 'Mostra statistiche'}
          aria-label={showStats ? 'Nascondi statistiche' : 'Mostra statistiche'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="hidden sm:inline">Statistiche</span>
        </button>

        {/* Toggle View — segmented compatta/espansa */}
        <div className="inline-flex border border-surface-50 rounded-xl overflow-hidden bg-surface-300">
          <button
            onClick={() => { setCompactView(true); }}
            className={`flex items-center gap-1.5 font-display text-xs font-semibold px-3 py-2 transition-colors ${
              compactView ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
            aria-pressed={compactView}
            title="Vista compatta"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="hidden sm:inline">Compatta</span>
          </button>
          <span className="w-px bg-surface-50" />
          <button
            onClick={() => { setCompactView(false); }}
            className={`flex items-center gap-1.5 font-display text-xs font-semibold px-3 py-2 transition-colors ${
              !compactView ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
            aria-pressed={!compactView}
            title="Vista espansa"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span className="hidden sm:inline">Espansa</span>
          </button>
        </div>
      </div>
    </div>
  )

  // ===== BARRA FILTRI: ricerca + chip filtri attivi + reset + conteggio =====
  const filterBar = (
    <div className="mt-2 bg-surface-300 border border-surface-50 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-[520px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Cerca giocatore, manager o testo..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); }}
          className="w-full pl-9 pr-4 py-2 bg-surface-200 border border-surface-50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
        />
      </div>

      {hasActiveFilters && getActiveFilterLabel() && (
        <span className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 bg-primary-500/12 border border-primary-500/40 rounded-full text-xs text-primary-300">
          {selectedPlayerId && activeFilterPosition && (
            <span className={`font-mono text-[9.5px] font-bold rounded px-1.5 py-0.5 ${positionColors[activeFilterPosition] ?? ''}`}>
              {activeFilterPosition}
            </span>
          )}
          {selectedAuthorId && <Monogram name={getActiveFilterLabel() ?? '?'} size="xs" />}
          {getActiveFilterLabel()}
          <button onClick={clearFilters} className="flex p-0.5 text-primary-300 hover:text-white" aria-label="Rimuovi filtro">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      )}

      {hasActiveFilters && (
        <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-white transition-colors">
          Reset
        </button>
      )}

      <span className="ml-auto font-mono text-[11px] text-primary-300 whitespace-nowrap">
        {prophecies.length} risultati
      </span>
    </div>
  )

  // ===== SIDEBAR STATS: mini tiles + Top Profeti (podio) + Top Giocatori =====
  const podiumOrder = stats ? [stats.byAuthor[1], stats.byAuthor[0], stats.byAuthor[2]] : []
  const restProphets = stats ? stats.byAuthor.slice(3, 8) : []
  const maxPlayerCount = stats && stats.topPlayers[0] ? stats.topPlayers[0].count : 0

  const statsSidebar = stats && (
    <div className="lg:h-full lg:min-h-0 lg:flex lg:flex-col bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-surface-50">
        <span className="micro-label text-gray-300">Statistiche</span>
      </div>
      <div className="lg:flex-1 lg:min-h-0 panel-scroll p-4 space-y-3.5">
        {/* mini stat tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-surface-300 border border-surface-50 rounded-xl px-3.5 py-3">
            <div className="stat-number text-2xl text-primary-300 leading-none">{stats.total}</div>
            <div className="text-[10.5px] text-gray-400 mt-1.5">Profezie totali</div>
          </div>
          <div className="bg-surface-300 border border-surface-50 rounded-xl px-3.5 py-3">
            <div className="stat-number text-2xl text-accent-400 leading-none">{stats.byAuthor.length}</div>
            <div className="text-[10.5px] text-gray-400 mt-1.5">Profeti attivi</div>
          </div>
        </div>

        {/* Top Profeti — podio + resto classifica */}
        <div className="bg-surface-300 border border-surface-50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-surface-50">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <h3 className="micro-label text-gray-200">Top Profeti</h3>
          </div>
          <div className="px-3.5 pt-2 pb-3">
            {/* podio (2° - 1° - 3°) */}
            <div className="flex items-end justify-center gap-2.5 pt-2 pb-3.5">
              {podiumOrder.map((author, slot) => {
                if (!author) return null
                const rank = slot === 0 ? 2 : slot === 1 ? 1 : 3
                const isFirst = rank === 1
                const isActive = selectedAuthorId === author.memberId
                const ring = isFirst
                  ? 'w-14 h-14 text-lg bg-accent-500/15 text-accent-400 border-2 border-accent-500 shadow-[0_0_0_4px_rgba(245,158,11,0.10),0_0_18px_rgba(245,158,11,0.25)]'
                  : rank === 2
                    ? 'w-12 h-12 text-[15px] bg-surface-100 text-gray-300 border-2 border-gray-300'
                    : 'w-12 h-12 text-[15px] bg-surface-100 text-accent-700 border-2 border-accent-700'
                const initials = (author.teamName || author.username)
                  .split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?'
                return (
                  <button
                    key={author.memberId}
                    onClick={() => { handleFilterByAuthor(author.memberId); }}
                    className={`flex flex-col items-center gap-1.5 ${isActive ? 'opacity-100' : 'hover:opacity-85'}`}
                  >
                    <span className="font-mono text-[9px] font-bold text-gray-400">{rank}°</span>
                    <span className={`relative rounded-full flex items-center justify-center font-display font-bold ${ring}`}>
                      {isFirst && (
                        <svg className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 text-accent-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 2h14v2H5v-2z" />
                        </svg>
                      )}
                      {initials}
                    </span>
                    <span className="font-display text-[11.5px] font-bold text-white max-w-[78px] truncate text-center">
                      {author.teamName || author.username}
                    </span>
                    <span className={`stat-number text-[22px] leading-none ${isFirst ? 'text-accent-400' : rank === 2 ? 'text-gray-300' : 'text-accent-700'}`}>
                      {author.count}
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-gray-500">profezie</span>
                  </button>
                )
              })}
            </div>
            {/* resto classifica */}
            {restProphets.map((author, i) => {
              const isActive = selectedAuthorId === author.memberId
              return (
                <button
                  key={author.memberId}
                  onClick={() => { handleFilterByAuthor(author.memberId); }}
                  className={`w-full flex items-center gap-2.5 py-1.5 border-t border-surface-50 transition-colors ${
                    isActive ? 'bg-primary-500/8 -mx-3.5 px-3.5' : 'hover:opacity-85'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold text-gray-400 w-[18px] text-center flex-shrink-0">{i + 4}</span>
                  <Monogram name={author.teamName || author.username} size="sm" />
                  <span className="font-display text-[12.5px] font-semibold text-white flex-1 min-w-0 truncate text-left">
                    {author.teamName || author.username}
                  </span>
                  <span className="stat-number text-[15px] text-primary-300">{author.count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Top Giocatori */}
        <div className="bg-surface-300 border border-surface-50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-surface-50">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
            </svg>
            <h3 className="micro-label text-gray-200">Top Giocatori</h3>
            <span className="ml-auto font-mono text-[10.5px] text-gray-500">più profetizzati</span>
          </div>
          <div className="px-3.5 py-2">
            {stats.topPlayers.slice(0, 8).map((player, i) => {
              const isActive = selectedPlayerId === player.playerId
              const pct = maxPlayerCount > 0 ? Math.max(8, Math.round((player.count / maxPlayerCount) * 100)) : 0
              return (
                <button
                  key={player.playerId}
                  onClick={() => { handleFilterByPlayer(player.playerId); }}
                  className={`w-full flex items-center gap-2.5 py-2 ${i > 0 ? 'border-t border-surface-50' : ''} transition-colors ${
                    isActive ? 'bg-primary-500/8 -mx-3.5 px-3.5' : 'hover:opacity-85'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 ${positionColors[player.position] ?? ''}`}>
                    {player.position}
                  </span>
                  <span className="font-display text-[12.5px] font-bold text-white flex-1 min-w-0 truncate text-left">
                    {player.name}
                    <span className="font-sans font-normal text-[10px] text-gray-500"> · {player.team}</span>
                  </span>
                  <span className="hidden sm:block flex-1 max-w-[64px] h-1.5 rounded-full bg-surface-100 overflow-hidden">
                    <span className="block h-full rounded-full progress-gradient" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="stat-number text-[15px] text-primary-300 w-6 text-right">{player.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  // ===== LISTA (compatta tabella / espansa card) + infinite scroll =====
  const listBody = (
    isLoading && prophecies.length === 0 ? (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    ) : prophecies.length === 0 ? (
      <EmptyState
        icon="🔮"
        title="Nessuna profezia trovata"
        description={hasActiveFilters ? 'Prova a cambiare i filtri di ricerca.' : undefined}
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
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 z-[1] bg-surface-300 text-left px-4 py-2.5 micro-label text-gray-400 border-b border-surface-50">Giocatore</th>
            <th scope="col" className="sticky top-0 z-[1] bg-surface-300 text-left px-4 py-2.5 micro-label text-gray-400 border-b border-surface-50 hidden lg:table-cell">Profezia</th>
            <th scope="col" className="sticky top-0 z-[1] bg-surface-300 text-left px-4 py-2.5 micro-label text-gray-400 border-b border-surface-50">Autore</th>
            <th scope="col" className="sticky top-0 z-[1] bg-surface-300 text-left px-4 py-2.5 micro-label text-gray-400 border-b border-surface-50 hidden sm:table-cell">Tipo</th>
            <th scope="col" className="sticky top-0 z-[1] bg-surface-300 text-left px-4 py-2.5 micro-label text-gray-400 border-b border-surface-50 hidden md:table-cell">Evento</th>
            <th scope="col" className="sticky top-0 z-[1] bg-surface-300 text-right px-4 py-2.5 micro-label text-gray-400 border-b border-surface-50 hidden sm:table-cell">Prezzo</th>
            <th scope="col" className="sticky top-0 z-[1] bg-surface-300 text-right px-4 py-2.5 micro-label text-gray-400 border-b border-surface-50 hidden md:table-cell">Data</th>
          </tr>
        </thead>
        <tbody>
          {prophecies.map(prophecy => (
            <tr key={prophecy.id} className="hover:bg-surface-100/60 transition-colors">
              <td className="px-4 py-2.5 border-b border-surface-50">
                <button
                  onClick={() => { handleFilterByPlayer(prophecy.player.id); }}
                  className="flex items-center gap-2.5 hover:opacity-80"
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 ${positionColors[prophecy.player.position] ?? ''}`}>
                    {prophecy.player.position}
                  </span>
                  <span className="text-left">
                    <span className="block font-display text-[13px] font-bold text-white">{prophecy.player.name}</span>
                    <span className="block text-[10.5px] text-gray-500">{prophecy.player.team}</span>
                  </span>
                </button>
              </td>
              <td className="px-4 py-2.5 border-b border-surface-50 hidden lg:table-cell">
                <p className="text-gray-300 italic text-[12.5px] max-w-[380px] truncate" title={prophecy.content}>
                  "{prophecy.content}"
                </p>
              </td>
              <td className="px-4 py-2.5 border-b border-surface-50">
                <button
                  onClick={() => { handleFilterByAuthor(prophecy.author.memberId); }}
                  className="inline-flex items-center gap-2 hover:opacity-80"
                >
                  <Monogram name={prophecy.author.teamName || prophecy.author.username} size="sm" />
                  <span className="font-display text-[12.5px] font-semibold text-primary-300 hover:text-primary-200">
                    {prophecy.author.teamName || prophecy.author.username}
                  </span>
                </button>
              </td>
              <td className="px-4 py-2.5 border-b border-surface-50 hidden sm:table-cell">
                {roleChip(prophecy.authorRole)}
              </td>
              <td className="px-4 py-2.5 border-b border-surface-50 hidden md:table-cell">
                {prophecy.movementType && (
                  <span className={`inline-block font-mono text-[9px] font-bold uppercase tracking-[0.04em] rounded px-2 py-0.5 ${getMovementLabel(prophecy.movementType)?.color ?? ''}`}>
                    {getMovementLabel(prophecy.movementType)?.label}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 border-b border-surface-50 text-right hidden sm:table-cell">
                {prophecy.movementPrice ? (
                  <span className="stat-number text-sm text-accent-400">{prophecy.movementPrice}M</span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 border-b border-surface-50 text-right hidden md:table-cell">
                <span className="font-mono text-[10.5px] text-gray-500 whitespace-nowrap">
                  {new Date(prophecy.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      /* Vista Espansa - Cards */
      <div className="space-y-3">
        {prophecies.map(prophecy => (
          <div
            key={prophecy.id}
            className="bg-surface-300 border border-surface-50 rounded-2xl p-4 flex gap-3.5 hover:border-primary-500/40 transition-colors"
          >
            {/* Player position badge */}
            <button
              onClick={() => { handleFilterByPlayer(prophecy.player.id); }}
              className="hover:opacity-80 flex-shrink-0"
              aria-label={`Filtra per ${prophecy.player.name}`}
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono text-[15px] font-bold ${positionColors[prophecy.player.position] ?? ''}`}>
                {prophecy.player.position}
              </span>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2.5 mb-1.5">
                <span className="font-display text-[15px] font-bold text-white">{prophecy.player.name}</span>
                <span className="text-[11px] text-gray-500">{prophecy.player.team}</span>
              </div>
              <p className="relative pl-3.5 text-white italic text-sm leading-relaxed">
                <span className="absolute left-0 -top-1 font-display text-2xl text-primary-500/55 leading-none">&ldquo;</span>
                {prophecy.content}
              </p>
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <button
                  onClick={() => { handleFilterByAuthor(prophecy.author.memberId); }}
                  className="inline-flex items-center gap-2 hover:opacity-80"
                >
                  <Monogram name={prophecy.author.teamName || prophecy.author.username} size="sm" />
                  <span className="font-display text-[12.5px] font-semibold text-primary-300 hover:text-primary-200">
                    {prophecy.author.teamName || prophecy.author.username}
                  </span>
                </button>
                {roleChip(prophecy.authorRole)}
                {prophecy.movementType && (
                  <span className={`inline-block font-mono text-[9px] font-bold uppercase tracking-[0.04em] rounded px-2 py-0.5 ${getMovementLabel(prophecy.movementType)?.color ?? ''}`}>
                    {getMovementLabel(prophecy.movementType)?.label}
                  </span>
                )}
                {prophecy.movementPrice && (
                  <span className="stat-number text-sm text-accent-400">{prophecy.movementPrice}M</span>
                )}
              </div>
            </div>

            <span className="font-mono text-[10.5px] text-gray-500 whitespace-nowrap flex-shrink-0">
              {new Date(prophecy.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    )
  )

  const listColumn = (
    <div className="lg:h-full lg:min-h-0 lg:flex lg:flex-col bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-surface-50">
        <span className="micro-label text-gray-300">
          Profezie · vista {compactView ? 'compatta' : 'espansa'}
        </span>
        <span className="ml-auto font-mono text-[10.5px] text-gray-500">
          {hasActiveFilters ? 'filtrate' : 'più recenti'}
        </span>
      </div>
      <div className="lg:flex-1 lg:min-h-0 panel-scroll">
        <div className={compactView && prophecies.length > 0 && !(isLoading && prophecies.length === 0) ? '' : 'p-3 sm:p-4'}>
          {listBody}
        </div>

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
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation currentPage="prophecies" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="w-full max-w-[1600px] mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        <CockpitShell header={header} adminBar={filterBar}>
          <div className={`mt-3 lg:h-full lg:min-h-0 grid gap-3 ${
            showStats ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : 'lg:grid-cols-1'
          }`}>
            {listColumn}
            {showStats && (
              <div className="lg:h-full lg:min-h-0">
                {statsSidebar}
              </div>
            )}
          </div>
        </CockpitShell>
      </main>
    </div>
  )
}

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { rubataApi, leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'

interface StrategyPlayer {
  rosterId: string
  memberId: string
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
  playerQuotation: number
  ownerUsername: string
  ownerTeamName: string | null
  ownerRubataOrder: number | null
  rubataPrice: number
  contractSalary: number
  contractDuration: number
  contractClause: number
}

interface SvincolatoPlayer {
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
}

interface RubataPreference {
  id: string
  playerId: string
  memberId: string
  maxBid: number | null
  priority: number | null
  notes: string | null
  isWatchlist: boolean
  isAutoPass: boolean
}

interface StrategyPlayerWithPreference extends StrategyPlayer {
  preference?: RubataPreference | null
}

interface SvincolatoPlayerWithPreference extends SvincolatoPlayer {
  preference?: RubataPreference | null
}

// Union type for display - can be either owned player or svincolato
type DisplayPlayer = (StrategyPlayerWithPreference & { type: 'owned' }) | (SvincolatoPlayerWithPreference & { type: 'svincolato' })

interface StrategiesData {
  players: StrategyPlayerWithPreference[]
  myMemberId: string
  hasRubataBoard: boolean
  hasRubataOrder: boolean
  rubataState: string | null
  sessionId: string | null
  totalPlayers: number
}

interface SvincolatiData {
  players: SvincolatoPlayerWithPreference[]
  myMemberId: string
  sessionId: string | null
  totalPlayers: number
}

type ViewMode = 'owned' | 'svincolati' | 'all'

const POSITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  P: { bg: 'bg-gradient-to-r from-amber-500 to-amber-600', text: 'text-white', border: '' },
  D: { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-white', border: '' },
  C: { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-white', border: '' },
  A: { bg: 'bg-gradient-to-r from-red-500 to-red-600', text: 'text-white', border: '' },
}

// Team logo component
function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-full h-full object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

// Sort configuration
// - role: Position (P,D,C,A) > Alphabetical
// - manager: Manager team name > Position > Alphabetical
// - rubata: Rubata order > Position > Alphabetical (only when order is set)
type SortMode = 'role' | 'manager' | 'rubata'
type SortField = 'position' | 'name' | 'owner' | 'team' | 'contract' | 'rubata' | 'maxBid' | 'priority'
type SortDirection = 'asc' | 'desc'

// Local strategy state for a player (with debounce)
interface LocalStrategy {
  maxBid: string
  priority: number
  notes: string
  isDirty: boolean
}

export function StrategieRubata({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { leagueId } = useParams<{ leagueId: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savingPlayerIds, setSavingPlayerIds] = useState<Set<string>>(new Set())
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  const [strategiesData, setStrategiesData] = useState<StrategiesData | null>(null)
  const [svincolatiData, setSvincolatiData] = useState<SvincolatiData | null>(null)

  // View mode: owned players, svincolati, or all
  const [viewMode, setViewMode] = useState<ViewMode>('owned')

  // Filter state
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyWithStrategy, setShowOnlyWithStrategy] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL')

  // Sort state
  const [sortMode, setSortMode] = useState<SortMode>('role')
  const [sortField, setSortField] = useState<SortField>('position')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Local edits with debounce
  const [localStrategies, setLocalStrategies] = useState<Record<string, LocalStrategy>>({})
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const myMemberId = strategiesData?.myMemberId

  // Load data
  const loadData = useCallback(async () => {
    if (!leagueId) return
    setLoading(true)

    try {
      // Fetch league info for admin status
      const leagueResponse = await leagueApi.getById(leagueId)
      if (leagueResponse.success && leagueResponse.data) {
        const data = leagueResponse.data as { userMembership?: { role: string } }
        setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
      }

      // Fetch both owned players and svincolati in parallel
      const [ownedRes, svincolatiRes] = await Promise.all([
        rubataApi.getAllPlayersForStrategies(leagueId),
        rubataApi.getAllSvincolatiForStrategies(leagueId),
      ])

      // Initialize local strategies
      const locals: Record<string, LocalStrategy> = {}

      if (ownedRes.success && ownedRes.data) {
        setStrategiesData(ownedRes.data)
        ownedRes.data.players.forEach(p => {
          if (p.preference) {
            locals[p.playerId] = {
              maxBid: p.preference.maxBid?.toString() || '',
              priority: p.preference.priority || 0,
              notes: p.preference.notes || '',
              isDirty: false,
            }
          }
        })
      } else {
        setError(ownedRes.message || 'Errore nel caricamento giocatori')
      }

      if (svincolatiRes.success && svincolatiRes.data) {
        setSvincolatiData(svincolatiRes.data)
        svincolatiRes.data.players.forEach(p => {
          if (p.preference) {
            locals[p.playerId] = {
              maxBid: p.preference.maxBid?.toString() || '',
              priority: p.preference.priority || 0,
              notes: p.preference.notes || '',
              isDirty: false,
            }
          }
        })
      }

      setLocalStrategies(locals)
    } catch (err) {
      setError('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer))
    }
  }, [])

  // Clear messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2000)
      return () => clearTimeout(timer)
    }
  }, [success])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Get unique owners for filter
  const uniqueOwners = useMemo(() => {
    if (!strategiesData?.players) return []
    const owners = new Map<string, string>() // username -> teamName
    strategiesData.players.forEach(p => {
      if (p.memberId !== myMemberId) {
        owners.set(p.ownerUsername, p.ownerTeamName || p.ownerUsername)
      }
    })
    return Array.from(owners.entries())
      .map(([username, teamName]) => ({ username, teamName }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName))
  }, [strategiesData?.players, myMemberId])

  // Get local strategy or create empty
  const getLocalStrategy = useCallback((playerId: string): LocalStrategy => {
    return localStrategies[playerId] || { maxBid: '', priority: 0, notes: '', isDirty: false }
  }, [localStrategies])

  // Update local strategy with debounced save
  const updateLocalStrategy = useCallback((
    playerId: string,
    field: keyof Omit<LocalStrategy, 'isDirty'>,
    value: string | number
  ) => {
    setLocalStrategies(prev => {
      const current = prev[playerId] || { maxBid: '', priority: 0, notes: '', isDirty: false }
      return {
        ...prev,
        [playerId]: {
          ...current,
          [field]: value,
          isDirty: true,
        }
      }
    })

    // Clear existing timer for this player
    if (debounceTimers.current[playerId]) {
      clearTimeout(debounceTimers.current[playerId])
    }

    // Set new debounce timer (2 seconds)
    debounceTimers.current[playerId] = setTimeout(() => {
      saveStrategy(playerId)
    }, 2000)
  }, [])

  // Save strategy to server
  const saveStrategy = useCallback(async (playerId: string) => {
    if (!leagueId) return

    const local = localStrategies[playerId]
    if (!local || !local.isDirty) return

    setSavingPlayerIds(prev => new Set(prev).add(playerId))

    const maxBid = local.maxBid ? parseInt(local.maxBid) : null
    const priority = local.priority || null
    const notes = local.notes.trim() || null
    const hasStrategy = maxBid !== null || priority !== null || !!notes

    try {
      const res = await rubataApi.setPreference(leagueId, playerId, {
        maxBid,
        priority,
        notes,
        isWatchlist: hasStrategy,
        isAutoPass: false,
      })

      if (res.success) {
        // Mark as not dirty
        setLocalStrategies(prev => ({
          ...prev,
          [playerId]: {
            ...prev[playerId],
            isDirty: false,
          }
        }))

        // Update server data optimistically
        setStrategiesData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            players: prev.players.map(p => {
              if (p.playerId === playerId) {
                return {
                  ...p,
                  preference: hasStrategy ? {
                    id: p.preference?.id || 'temp',
                    playerId,
                    memberId: prev.myMemberId,
                    maxBid,
                    priority,
                    notes,
                    isWatchlist: hasStrategy,
                    isAutoPass: false,
                  } : null
                }
              }
              return p
            })
          }
        })
      }
    } catch {
      // Ignore errors, just log
      console.error('Error saving strategy for', playerId)
    } finally {
      setSavingPlayerIds(prev => {
        const next = new Set(prev)
        next.delete(playerId)
        return next
      })
    }
  }, [leagueId, localStrategies])

  // Handle column sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  // Filtered and sorted players - now supports both owned and svincolati
  const filteredPlayers = useMemo((): DisplayPlayer[] => {
    const result: DisplayPlayer[] = []

    // Position order: P (0) > D (1) > C (2) > A (3)
    const getPositionOrder = (pos: string): number => {
      const normalized = (pos || '').toString().trim().toUpperCase()
      const order: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 }
      return order[normalized] ?? 99
    }

    // Add owned players if viewMode is 'owned' or 'all'
    if ((viewMode === 'owned' || viewMode === 'all') && strategiesData?.players) {
      strategiesData.players.forEach(player => {
        // Exclude own players
        if (player.memberId === myMemberId) return

        // Position filter
        if (positionFilter !== 'ALL' && player.playerPosition !== positionFilter) return

        // Owner filter (only for owned)
        if (ownerFilter !== 'ALL' && player.ownerUsername !== ownerFilter) return

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          if (!player.playerName.toLowerCase().includes(query) &&
              !player.playerTeam.toLowerCase().includes(query) &&
              !player.ownerUsername.toLowerCase().includes(query) &&
              !(player.ownerTeamName?.toLowerCase().includes(query))) {
            return
          }
        }

        // Strategy filter
        if (showOnlyWithStrategy) {
          const local = getLocalStrategy(player.playerId)
          if (!local.maxBid && !local.priority && !local.notes) return
        }

        result.push({ ...player, type: 'owned' })
      })
    }

    // Add svincolati if viewMode is 'svincolati' or 'all'
    if ((viewMode === 'svincolati' || viewMode === 'all') && svincolatiData?.players) {
      svincolatiData.players.forEach(player => {
        // Position filter
        if (positionFilter !== 'ALL' && player.playerPosition !== positionFilter) return

        // Owner filter doesn't apply to svincolati, skip them if a specific owner is selected
        if (viewMode === 'all' && ownerFilter !== 'ALL') return

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          if (!player.playerName.toLowerCase().includes(query) &&
              !player.playerTeam.toLowerCase().includes(query)) {
            return
          }
        }

        // Strategy filter
        if (showOnlyWithStrategy) {
          const local = getLocalStrategy(player.playerId)
          if (!local.maxBid && !local.priority && !local.notes) return
        }

        result.push({ ...player, type: 'svincolato' })
      })
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0

      // Compare by position
      const comparePosition = () => getPositionOrder(a.playerPosition) - getPositionOrder(b.playerPosition)

      // Compare alphabetically
      const compareName = () => a.playerName.localeCompare(b.playerName)

      // Compare by manager (only for owned)
      const compareManager = () => {
        if (a.type === 'svincolato' && b.type === 'svincolato') return 0
        if (a.type === 'svincolato') return 1 // Svincolati after owned
        if (b.type === 'svincolato') return -1
        const teamA = a.ownerTeamName || a.ownerUsername
        const teamB = b.ownerTeamName || b.ownerUsername
        return teamA.localeCompare(teamB)
      }

      // Compare by rubata order (only for owned)
      const compareRubataOrder = () => {
        if (a.type === 'svincolato' && b.type === 'svincolato') return 0
        if (a.type === 'svincolato') return 1
        if (b.type === 'svincolato') return -1
        const orderA = a.ownerRubataOrder ?? 999
        const orderB = b.ownerRubataOrder ?? 999
        return orderA - orderB
      }

      // Sort by mode
      if (sortMode === 'rubata') {
        cmp = compareRubataOrder()
        if (cmp !== 0) return cmp
        cmp = comparePosition()
        if (cmp !== 0) return cmp
        return compareName()
      }

      if (sortMode === 'manager') {
        cmp = compareManager()
        if (cmp !== 0) return cmp
        cmp = comparePosition()
        if (cmp !== 0) return cmp
        return compareName()
      }

      // Default: role mode
      cmp = comparePosition()
      if (cmp !== 0) return cmp
      return compareName()
    })

    return result
  }, [strategiesData?.players, svincolatiData?.players, myMemberId, viewMode, positionFilter, ownerFilter, searchQuery, showOnlyWithStrategy, sortMode, getLocalStrategy])

  // My strategies count (for footer) - includes both owned and svincolati
  const myStrategiesCount = useMemo(() => {
    let count = 0

    // Count owned strategies
    if (strategiesData?.players) {
      count += strategiesData.players.filter(p => {
        if (p.memberId === myMemberId) return false
        const local = getLocalStrategy(p.playerId)
        return local.maxBid || local.priority || local.notes
      }).length
    }

    // Count svincolati strategies
    if (svincolatiData?.players) {
      count += svincolatiData.players.filter(p => {
        const local = getLocalStrategy(p.playerId)
        return local.maxBid || local.priority || local.notes
      }).length
    }

    return count
  }, [strategiesData?.players, svincolatiData?.players, myMemberId, getLocalStrategy])

  // Sortable column header component
  const SortableHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`cursor-pointer hover:bg-surface-50/10 transition-colors select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-primary-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
        )}
      </div>
    </th>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="strategie-rubata" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-400"></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300 pb-6">
      <Navigation currentPage="strategie-rubata" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Strategie Rubata
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Imposta offerta massima, priorita e note. Le modifiche vengono salvate automaticamente dopo 2 secondi.
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-4 text-sm">{success}</div>
        )}

        {/* Main content: Table + Sidebar */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Table */}
          <div className="flex-1 min-w-0">
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              {/* Filters */}
              <div className="p-3 border-b border-surface-50/20 bg-surface-300/30">
                <div className="flex flex-wrap gap-2 items-center">
                  {/* View Mode Toggle */}
                  <div className="flex gap-1 bg-surface-300/50 rounded-lg p-0.5">
                    <button
                      onClick={() => { setViewMode('owned'); setOwnerFilter('ALL'); }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        viewMode === 'owned'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="Giocatori di altri manager"
                    >
                      Rose
                    </button>
                    <button
                      onClick={() => { setViewMode('svincolati'); setOwnerFilter('ALL'); }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        viewMode === 'svincolati'
                          ? 'bg-emerald-500 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="Giocatori svincolati"
                    >
                      Svincolati
                    </button>
                    <button
                      onClick={() => { setViewMode('all'); setOwnerFilter('ALL'); }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        viewMode === 'all'
                          ? 'bg-purple-500 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="Tutti i giocatori"
                    >
                      Tutti
                    </button>
                  </div>

                  {/* Position Filter */}
                  <div className="flex gap-1">
                    {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                      const colors = POSITION_COLORS[pos] ?? { bg: 'bg-white/20', text: 'text-white', border: '' }
                      return (
                        <button
                          key={pos}
                          onClick={() => setPositionFilter(pos)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                            positionFilter === pos
                              ? pos === 'ALL'
                                ? 'bg-white/20 text-white'
                                : `${colors.bg} ${colors.text}`
                              : 'bg-surface-300 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {pos === 'ALL' ? 'Tutti' : pos}
                        </button>
                      )
                    })}
                  </div>

                  {/* Sort Mode Toggle */}
                  <div className="flex gap-1 bg-surface-300/50 rounded-lg p-0.5">
                    <button
                      onClick={() => setSortMode('role')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        sortMode === 'role'
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="Ordina per Ruolo > Alfabetico"
                    >
                      Ruolo
                    </button>
                    <button
                      onClick={() => setSortMode('manager')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        sortMode === 'manager'
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="Ordina per Manager > Ruolo > Alfabetico"
                    >
                      Manager
                    </button>
                    {strategiesData?.hasRubataOrder && (
                      <button
                        onClick={() => setSortMode('rubata')}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          sortMode === 'rubata'
                            ? 'bg-warning-500 text-white'
                            : 'text-warning-400 hover:text-warning-300'
                        }`}
                        title="Ordina per Ordine Rubata > Ruolo > Alfabetico"
                      >
                        Ord. Rubata
                      </button>
                    )}
                  </div>

                  {/* Owner Filter - only show for owned or all views */}
                  {viewMode !== 'svincolati' && (
                    <select
                      value={ownerFilter}
                      onChange={(e) => setOwnerFilter(e.target.value)}
                      className="px-2 py-1 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    >
                      <option value="ALL">Tutti i manager</option>
                      {uniqueOwners.map(o => (
                        <option key={o.username} value={o.username}>{o.teamName}</option>
                      ))}
                    </select>
                  )}

                  {/* Search */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca..."
                    className="flex-1 min-w-[100px] px-2 py-1 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                  />

                  {/* Strategy filter */}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyWithStrategy}
                      onChange={(e) => setShowOnlyWithStrategy(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-surface-300 border-surface-50/50 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-400 whitespace-nowrap">Con strategia</span>
                  </label>
                </div>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3 p-3">
                {filteredPlayers.map(player => {
                  const defaultColors = { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white', border: '' }
                  const posColors = POSITION_COLORS[player.playerPosition] ?? defaultColors
                  const local = getLocalStrategy(player.playerId)
                  const hasStrategy = !!(local.maxBid || local.priority || local.notes)
                  const isSvincolato = player.type === 'svincolato'

                  return (
                    <div key={player.playerId} className={`bg-surface-300/30 rounded-lg p-3 border ${hasStrategy ? 'border-indigo-500/30 bg-indigo-500/5' : isSvincolato ? 'border-emerald-500/20' : 'border-surface-50/10'}`}>
                      {/* Header: Position + Player + Svincolato badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                          {player.playerPosition}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white text-sm truncate">{player.playerName}</span>
                            {isSvincolato && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">SVINC.</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{player.playerTeam}</div>
                        </div>
                      </div>
                      {/* Owner + Contract */}
                      <div className="flex justify-between items-center mb-2 text-xs">
                        <span className="text-gray-400">
                          <span className="text-gray-500">Prop: </span>
                          {isSvincolato ? (
                            <span className="text-emerald-400">Svincolato</span>
                          ) : (
                            <span>{player.ownerTeamName || player.ownerUsername}</span>
                          )}
                        </span>
                        {!isSvincolato && (
                          <span>
                            <span className="text-accent-400 font-medium">{player.contractSalary}M</span>
                            <span className="text-gray-500"> x </span>
                            <span className="text-white">{player.contractDuration}s</span>
                          </span>
                        )}
                      </div>
                      {/* Price info - only for owned players */}
                      {!isSvincolato && (
                        <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Clausola</div>
                            <div className="text-orange-400 font-medium">{player.contractClause}M</div>
                          </div>
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Rubata</div>
                            <div className="text-warning-400 font-bold">{player.rubataPrice}M</div>
                          </div>
                        </div>
                      )}
                      {/* Strategy Section */}
                      <div className="bg-indigo-500/10 rounded-lg p-2 border border-indigo-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          {/* Max Bid */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 uppercase">Max:</span>
                            <button onClick={() => updateLocalStrategy(player.playerId, 'maxBid', Math.max(0, (parseInt(local.maxBid) || 0) - 1).toString())} className="w-6 h-6 rounded bg-surface-300/70 text-gray-400 text-sm font-bold">−</button>
                            <input type="number" value={local.maxBid} onChange={(e) => updateLocalStrategy(player.playerId, 'maxBid', e.target.value)} placeholder="-" className="w-12 px-1 py-1 bg-surface-300/50 border border-surface-50/30 rounded text-white text-center text-sm" />
                            <button onClick={() => updateLocalStrategy(player.playerId, 'maxBid', ((parseInt(local.maxBid) || 0) + 1).toString())} className="w-6 h-6 rounded bg-surface-300/70 text-gray-400 text-sm font-bold">+</button>
                          </div>
                          {/* Priority */}
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button key={star} onClick={() => updateLocalStrategy(player.playerId, 'priority', local.priority === star ? 0 : star)} className={`w-5 h-5 text-sm ${local.priority >= star ? 'text-purple-400' : 'text-gray-600'}`}>★</button>
                            ))}
                          </div>
                        </div>
                        {/* Notes */}
                        <input type="text" value={local.notes} onChange={(e) => updateLocalStrategy(player.playerId, 'notes', e.target.value)} placeholder="Note..." className="w-full px-2 py-1 bg-surface-300/50 border border-surface-50/30 rounded text-white text-sm" />
                      </div>
                    </div>
                  )
                })}
                {filteredPlayers.length === 0 && (
                  <div className="text-center text-gray-500 py-8">Nessun giocatore trovato</div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-surface-300/50">
                    {/* Group headers */}
                    <tr className="text-[10px] text-gray-500 uppercase border-b border-surface-50/20">
                      <th colSpan={6} className="text-left py-1 px-3 bg-surface-300/30">
                        Dati Giocatore
                      </th>
                      <th colSpan={3} className="text-center py-1 px-3 bg-indigo-500/10 border-l-2 border-indigo-500/30">
                        La Mia Strategia
                      </th>
                    </tr>
                    {/* Column headers */}
                    <tr className="text-xs text-gray-400 uppercase">
                      <SortableHeader field="position" label="R" className="w-10 p-2 text-center" />
                      <SortableHeader field="name" label="Giocatore" className="text-left p-2" />
                      <SortableHeader field="owner" label="Proprietario" className="text-left p-2" />
                      <SortableHeader field="contract" label="Contratto" className="text-center p-2" />
                      <th className="text-center p-2 text-orange-400">Cls</th>
                      <SortableHeader field="rubata" label="Rubata" className="text-center p-2" />
                      <th className="text-center p-2 bg-indigo-500/5 border-l-2 border-indigo-500/30">Offerta Max</th>
                      <th className="text-center p-2 bg-indigo-500/5">Priorità</th>
                      <th className="text-left p-2 bg-indigo-500/5">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map(player => {
                      const defaultColors = { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white', border: '' }
                      const posColors = POSITION_COLORS[player.playerPosition] ?? defaultColors
                      const local = getLocalStrategy(player.playerId)
                      const isSaving = savingPlayerIds.has(player.playerId)
                      const hasStrategy = !!(local.maxBid || local.priority || local.notes)
                      const isSvincolato = player.type === 'svincolato'

                      return (
                        <tr
                          key={player.playerId}
                          className={`border-t border-surface-50/10 transition-colors ${
                            hasStrategy ? 'bg-indigo-500/5' : isSvincolato ? 'bg-emerald-500/5' : ''
                          } hover:bg-surface-300/30`}
                        >
                          {/* Position */}
                          <td className="p-2 text-center">
                            <div className={`w-7 h-7 mx-auto rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-xs font-bold`}>
                              {player.playerPosition}
                            </div>
                          </td>

                          {/* Player */}
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-white rounded p-0.5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white text-sm truncate">{player.playerName}</span>
                                  {isSvincolato && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded flex-shrink-0">SVINC.</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">{player.playerTeam}</div>
                              </div>
                            </div>
                          </td>

                          {/* Owner / Svincolato */}
                          <td className="p-2">
                            {isSvincolato ? (
                              <div className="min-w-0">
                                <div className="font-medium text-emerald-400 text-sm">Svincolato</div>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <div className="font-medium text-gray-300 text-sm truncate">
                                  {player.ownerTeamName || player.ownerUsername}
                                </div>
                                {player.ownerTeamName && (
                                  <div className="text-xs text-gray-500">{player.ownerUsername}</div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Contract */}
                          <td className="p-2 text-center">
                            {isSvincolato ? (
                              <span className="text-gray-600">-</span>
                            ) : (
                              <div className="text-xs">
                                <span className="text-accent-400 font-medium">{player.contractSalary}M</span>
                                <span className="text-gray-500"> x </span>
                                <span className="text-white">{player.contractDuration}s</span>
                              </div>
                            )}
                          </td>

                          {/* Clausola */}
                          <td className="p-2 text-center">
                            {isSvincolato ? (
                              <span className="text-gray-600">-</span>
                            ) : (
                              <span className="text-orange-400 font-medium">{player.contractClause}M</span>
                            )}
                          </td>

                          {/* Rubata Price */}
                          <td className="p-2 text-center">
                            {isSvincolato ? (
                              <span className="text-gray-600">-</span>
                            ) : (
                              <span className="text-warning-400 font-bold">{player.rubataPrice}M</span>
                            )}
                          </td>

                          {/* === STRATEGY SECTION === */}

                          {/* Offerta Max */}
                          <td className="p-2 text-center bg-indigo-500/5 border-l-2 border-indigo-500/30">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(local.maxBid) || 0
                                  updateLocalStrategy(player.playerId, 'maxBid', Math.max(0, current - 1).toString())
                                }}
                                className="w-6 h-6 rounded bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-sm font-bold flex items-center justify-center transition-colors"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                value={local.maxBid}
                                onChange={(e) => updateLocalStrategy(player.playerId, 'maxBid', e.target.value)}
                                placeholder="-"
                                className={`w-12 px-1 py-1 bg-surface-300/50 border rounded text-white text-center text-sm font-medium focus:border-blue-500 focus:outline-none placeholder:text-gray-600 ${
                                  isSaving ? 'border-blue-500/50' : local.isDirty ? 'border-yellow-500/50' : 'border-surface-50/30'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(local.maxBid) || 0
                                  updateLocalStrategy(player.playerId, 'maxBid', (current + 1).toString())
                                }}
                                className="w-6 h-6 rounded bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-sm font-bold flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="p-2 text-center bg-indigo-500/5">
                            <div className="flex items-center justify-center gap-0.5">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => {
                                    const newPrio = local.priority === star ? 0 : star
                                    updateLocalStrategy(player.playerId, 'priority', newPrio)
                                  }}
                                  className={`w-5 h-5 text-sm transition-colors ${
                                    local.priority >= star
                                      ? 'text-purple-400 hover:text-purple-300'
                                      : 'text-gray-600 hover:text-gray-400'
                                  }`}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="p-2 bg-indigo-500/5">
                            <input
                              type="text"
                              value={local.notes}
                              onChange={(e) => updateLocalStrategy(player.playerId, 'notes', e.target.value)}
                              placeholder="Note..."
                              className={`w-full min-w-[80px] px-2 py-1 bg-surface-300/50 border rounded text-white text-sm focus:border-blue-500 focus:outline-none placeholder:text-gray-600 ${
                                isSaving ? 'border-blue-500/50' : local.isDirty ? 'border-yellow-500/50' : 'border-surface-50/30'
                              }`}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filteredPlayers.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    Nessun giocatore trovato
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-surface-50/20 bg-surface-300/20 text-xs text-gray-500 flex flex-wrap justify-between gap-2">
                <span>
                  {filteredPlayers.length} giocatori
                  {viewMode === 'owned' && ' (rose)'}
                  {viewMode === 'svincolati' && ' (svincolati)'}
                  {viewMode === 'all' && ` (${filteredPlayers.filter(p => p.type === 'owned').length} rose, ${filteredPlayers.filter(p => p.type === 'svincolato').length} svinc.)`}
                </span>
                <span className="text-indigo-400">{myStrategiesCount} strategie impostate</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

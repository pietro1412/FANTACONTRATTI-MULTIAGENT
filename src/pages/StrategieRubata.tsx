import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { rubataApi, leagueApi, gameApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { MarketPhaseBanner, type DisplayPhase } from '../components/MarketPhaseBanner'
import { FilterSidebar } from '../components/FilterSidebar'
import { PlannerWidget } from '../components/PlannerWidget'
import { SeasonalitySparkbar } from '../components/SeasonalitySparkbar'
import { getTeamLogo } from '../utils/teamLogos'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { POSITION_COLORS } from '../components/ui/PositionBadge'
import { PlayerStatsModal, type PlayerInfo, type PlayerStats } from '../components/PlayerStatsModal'
import RadarChart from '../components/ui/RadarChart'

// Player colors for radar chart comparison
const PLAYER_CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7']

// Age color coding - younger is better
function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold' // Very young - excellent
  if (age < 25) return 'text-green-400' // Young - good
  if (age < 30) return 'text-yellow-400' // Prime - neutral
  if (age < 35) return 'text-orange-400' // Aging - caution
  return 'text-red-400' // Old - warning
}

function getAgeBgColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'bg-gray-500/20 text-gray-400'
  if (age < 20) return 'bg-emerald-500/20 text-emerald-400 font-bold'
  if (age < 25) return 'bg-green-500/20 text-green-400'
  if (age < 30) return 'bg-yellow-500/20 text-yellow-400'
  if (age < 35) return 'bg-orange-500/20 text-orange-400'
  return 'bg-red-500/20 text-red-400'
}

// Seasonality cache structure from API
interface SeasonalStats {
  avgRating: number
  hotMonths: string[]
  monthlyBreakdown: Record<string, number>
  matchCount: number
}

interface StrategyPlayer {
  rosterId: string
  memberId: string
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
  playerQuotation: number
  playerAge?: number | null
  playerApiFootballId?: number | null
  playerApiFootballStats?: PlayerStats | null
  playerSeasonalStatsCache?: SeasonalStats | null
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
  playerAge?: number | null
  playerApiFootballId?: number | null
  playerApiFootballStats?: PlayerStats | null
  playerSeasonalStatsCache?: SeasonalStats | null
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

// Union type for display - can be my roster, owned player, or svincolato
type DisplayPlayer = (StrategyPlayerWithPreference & { type: 'myRoster' | 'owned' }) | (SvincolatoPlayerWithPreference & { type: 'svincolato' })

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

type ViewMode = 'myRoster' | 'owned' | 'svincolati' | 'all'
type DataViewMode = 'contracts' | 'stats' | 'merge'

// Stats column definitions for stats/merge views
interface StatsColumn {
  key: string
  label: string
  shortLabel: string
  getValue: (stats: PlayerStats | null | undefined) => number | string | null
  format?: (val: number | null) => string
  colorClass?: string
}

const STATS_COLUMNS: StatsColumn[] = [
  { key: 'appearances', label: 'Presenze', shortLabel: 'Pres', getValue: s => s?.games?.appearences ?? null },
  { key: 'rating', label: 'Rating', shortLabel: 'Rat', getValue: s => s?.games?.rating ?? null, format: v => v?.toFixed(2) ?? '-' },
  { key: 'goals', label: 'Gol', shortLabel: 'Gol', getValue: s => s?.goals?.total ?? null, colorClass: 'text-secondary-400' },
  { key: 'assists', label: 'Assist', shortLabel: 'Ass', getValue: s => s?.goals?.assists ?? null, colorClass: 'text-primary-400' },
  { key: 'minutes', label: 'Minuti', shortLabel: 'Min', getValue: s => s?.games?.minutes ?? null },
  { key: 'shotsOn', label: 'Tiri Porta', shortLabel: 'TiP', getValue: s => s?.shots?.on ?? null },
  { key: 'passKey', label: 'Key Pass', shortLabel: 'KeyP', getValue: s => s?.passes?.key ?? null },
  { key: 'tackles', label: 'Contrasti', shortLabel: 'Tckl', getValue: s => s?.tackles?.total ?? null },
  { key: 'interceptions', label: 'Intercetti', shortLabel: 'Int', getValue: s => s?.tackles?.interceptions ?? null },
  { key: 'yellowCards', label: 'Amm.', shortLabel: 'Amm', getValue: s => s?.cards?.yellow ?? null, colorClass: 'text-warning-400' },
]

// Essential stats for merge view
const MERGE_STATS_KEYS = ['rating', 'goals', 'assists']

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

  // Game status for phase-aware UI
  const [gameStatus, setGameStatus] = useState<{
    phase: DisplayPhase
    phaseLabel: string
    marketPhase: string | null
    nextClauseDay: string
    daysRemaining: number
    isActive: boolean
  } | null>(null)

  // Budget data for planner widget
  const [budgetData, setBudgetData] = useState<{
    budgetTotal: number
    budgetUsed: number
  } | null>(null)

  // View mode: my roster, owned players, svincolati, or all
  const [viewMode, setViewMode] = useState<ViewMode>('myRoster')

  // Data view mode: contracts, stats, or merge
  const [dataViewMode, setDataViewMode] = useState<DataViewMode>('contracts')

  // Filter state
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyWithStrategy, setShowOnlyWithStrategy] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL')
  const [teamFilter, setTeamFilter] = useState<string>('ALL')

  // Sort state
  const [sortMode, setSortMode] = useState<SortMode>('role')
  const [sortField, setSortField] = useState<SortField>('position')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Player stats modal
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)

  // Player comparison feature (#187)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())
  const [showCompareModal, setShowCompareModal] = useState(false)

  // Local edits with debounce
  const [localStrategies, setLocalStrategies] = useState<Record<string, LocalStrategy>>({})
  const localStrategiesRef = useRef<Record<string, LocalStrategy>>({})
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Sidebar collapse states (3-column layout)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)

  // Keep ref in sync with state (for stale closure fix)
  useEffect(() => {
    localStrategiesRef.current = localStrategies
  }, [localStrategies])

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

      // Fetch owned players, svincolati, game status, and financials in parallel
      const [ownedRes, svincolatiRes, gameStatusRes, financialsRes] = await Promise.all([
        rubataApi.getAllPlayersForStrategies(leagueId),
        rubataApi.getAllSvincolatiForStrategies(leagueId),
        gameApi.getStatus(leagueId),
        leagueApi.getFinancials(leagueId),
      ])

      // Set game status
      if (gameStatusRes.success && gameStatusRes.data) {
        setGameStatus(gameStatusRes.data)
      }

      // Set budget data for planner widget
      if (financialsRes.success && financialsRes.data) {
        const data = financialsRes.data as { teams: Array<{ budget: number; annualContractCost: number }> }
        // Find my team (first team in the response belongs to current user)
        const myTeam = data.teams?.[0]
        if (myTeam) {
          setBudgetData({
            budgetTotal: myTeam.budget || 100,
            budgetUsed: myTeam.annualContractCost || 0,
          })
        }
      }

      // Initialize local strategies
      const locals: Record<string, LocalStrategy> = {}

      if (ownedRes.success && ownedRes.data) {
        // DEBUG: Check what API returns
        const withPrefs = ownedRes.data.players.filter(p => p.preference)
        console.log('[Strategie DEBUG]', {
          totalPlayers: ownedRes.data.players.length,
          withPreferences: withPrefs.length,
          samplePrefs: withPrefs.slice(0, 3).map(p => ({ name: p.playerName, pref: p.preference }))
        })

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

  // Get unique Serie A teams for filter
  const uniqueTeams = useMemo(() => {
    const teams = new Set<string>()
    if (strategiesData?.players) {
      strategiesData.players.forEach(p => teams.add(p.playerTeam))
    }
    if (svincolatiData?.players) {
      svincolatiData.players.forEach(p => teams.add(p.playerTeam))
    }
    return Array.from(teams).sort()
  }, [strategiesData?.players, svincolatiData?.players])

  // Get local strategy or create empty
  const getLocalStrategy = useCallback((playerId: string): LocalStrategy => {
    return localStrategies[playerId] || { maxBid: '', priority: 0, notes: '', isDirty: false }
  }, [localStrategies])

  // Save strategy to server (defined before updateLocalStrategy to avoid reference error)
  const saveStrategy = useCallback(async (playerId: string) => {
    if (!leagueId) return

    // Use ref to get current value (avoids stale closure)
    const local = localStrategiesRef.current[playerId]
    if (!local || !local.isDirty) {
      console.log('[Strategie SAVE skipped]', { playerId, local, isDirty: local?.isDirty })
      return
    }

    setSavingPlayerIds(prev => new Set(prev).add(playerId))

    const maxBid = local.maxBid ? parseInt(local.maxBid) : null
    const priority = local.priority || null
    const notes = local.notes.trim() || null
    const hasStrategy = maxBid !== null || priority !== null || !!notes

    try {
      console.log('[Strategie SAVE]', { playerId, maxBid, priority, notes, hasStrategy })
      const res = await rubataApi.setPreference(leagueId, playerId, {
        maxBid,
        priority,
        notes,
        isWatchlist: hasStrategy,
        isAutoPass: false,
      })
      console.log('[Strategie SAVE result]', res)

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
  }, [leagueId])

  // Update local strategy with debounced save
  const updateLocalStrategy = useCallback((
    playerId: string,
    field: keyof Omit<LocalStrategy, 'isDirty'>,
    value: string | number
  ) => {
    console.log('[Strategie UPDATE]', { playerId, field, value })
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
      console.log('[Strategie DEBOUNCE fired]', playerId)
      saveStrategy(playerId)
    }, 2000)
  }, [saveStrategy])

  // Handle column sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  // Toggle player for comparison (#187)
  const togglePlayerForCompare = useCallback((playerId: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else if (next.size < 4) {
        next.add(playerId)
      }
      return next
    })
  }, [])

  // Clear comparison selection
  const clearComparison = useCallback(() => {
    setSelectedForCompare(new Set())
  }, [])

  // Filtered and sorted players - supports myRoster, owned, svincolati, and all
  const filteredPlayers = useMemo((): DisplayPlayer[] => {
    const result: DisplayPlayer[] = []

    // Position order: P (0) > D (1) > C (2) > A (3)
    const getPositionOrder = (pos: string): number => {
      const normalized = (pos || '').toString().trim().toUpperCase()
      const order: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 }
      return order[normalized] ?? 99
    }

    // Add MY players if viewMode is 'myRoster' or 'all'
    if ((viewMode === 'myRoster' || viewMode === 'all') && strategiesData?.players) {
      strategiesData.players.forEach(player => {
        // Only include own players
        if (player.memberId !== myMemberId) return

        // Position filter
        if (positionFilter !== 'ALL' && player.playerPosition !== positionFilter) return

        // Team filter (Serie A team)
        if (teamFilter !== 'ALL' && player.playerTeam !== teamFilter) return

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

        result.push({ ...player, type: 'myRoster' })
      })
    }

    // Add OTHER owned players if viewMode is 'owned' or 'all'
    if ((viewMode === 'owned' || viewMode === 'all') && strategiesData?.players) {
      strategiesData.players.forEach(player => {
        // Exclude own players
        if (player.memberId === myMemberId) return

        // Position filter
        if (positionFilter !== 'ALL' && player.playerPosition !== positionFilter) return

        // Team filter (Serie A team)
        if (teamFilter !== 'ALL' && player.playerTeam !== teamFilter) return

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

        // Team filter (Serie A team)
        if (teamFilter !== 'ALL' && player.playerTeam !== teamFilter) return

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

        // Strategy filter (not for myRoster view)
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
  }, [strategiesData?.players, svincolatiData?.players, myMemberId, viewMode, positionFilter, teamFilter, ownerFilter, searchQuery, showOnlyWithStrategy, sortMode, getLocalStrategy])

  // Players selected for comparison (#187) - must be after filteredPlayers
  const playersToCompare = useMemo(() => {
    return filteredPlayers.filter(p => selectedForCompare.has(p.playerId))
  }, [filteredPlayers, selectedForCompare])

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
        <main className="max-w-[1600px] mx-auto px-4 py-8">
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

      {/* Phase Banner - shows current market phase */}
      {gameStatus && (
        <MarketPhaseBanner
          phase={gameStatus.phase}
          phaseLabel={gameStatus.phaseLabel}
          marketPhase={gameStatus.marketPhase}
          nextClauseDay={gameStatus.nextClauseDay}
          daysRemaining={gameStatus.daysRemaining}
          isActive={gameStatus.isActive}
        />
      )}

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">👥</span>
              Giocatori
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            {viewMode === 'myRoster'
              ? 'Visualizza la tua rosa con contratti e valori.'
              : 'Imposta offerta massima, priorità e note per le strategie rubata. Le modifiche vengono salvate automaticamente.'
            }
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-4 text-sm">{success}</div>
        )}

        {/* 3-Column Layout: Left Sidebar (Filters) + Main Table + Right Sidebar (Planner) */}
        <div className="flex gap-4">
          {/* Left Sidebar - Filters (hidden on mobile, shown on lg+) */}
          <div className="hidden lg:block">
            <FilterSidebar
              positionFilter={positionFilter}
              viewMode={viewMode}
              dataViewMode={dataViewMode}
              searchQuery={searchQuery}
              showOnlyWithStrategy={showOnlyWithStrategy}
              ownerFilter={ownerFilter}
              teamFilter={teamFilter}
              setPositionFilter={setPositionFilter}
              setViewMode={setViewMode}
              setDataViewMode={setDataViewMode}
              setSearchQuery={setSearchQuery}
              setShowOnlyWithStrategy={setShowOnlyWithStrategy}
              setOwnerFilter={setOwnerFilter}
              setTeamFilter={setTeamFilter}
              uniqueOwners={uniqueOwners}
              uniqueTeams={uniqueTeams}
              counts={{
                myRoster: strategiesData?.players.filter(p => p.memberId === myMemberId).length || 0,
                owned: strategiesData?.players.filter(p => p.memberId !== myMemberId).length || 0,
                svincolati: svincolatiData?.players.length || 0,
                total: (strategiesData?.players.length || 0) + (svincolatiData?.players.length || 0),
                filtered: filteredPlayers.length,
              }}
              isCollapsed={leftSidebarCollapsed}
              onToggleCollapse={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            />
          </div>

          {/* Main Table */}
          <div className="flex-1 min-w-0">
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              {/* === MOBILE FILTERS (shown only on mobile) === */}
              <div className="lg:hidden">
                {/* LEVEL 1: Data View Toggle (sticky) */}
                <div className="sticky top-0 z-10 p-2 border-b border-surface-50/20 bg-surface-300/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1 bg-surface-400/50 rounded-lg p-0.5">
                      <button
                        onClick={() => setDataViewMode('contracts')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          dataViewMode === 'contracts'
                            ? 'bg-accent-500 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-surface-300/50'
                        }`}
                        title="Vista contratti"
                      >
                        📋 Contratti
                      </button>
                      <button
                        onClick={() => setDataViewMode('stats')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          dataViewMode === 'stats'
                            ? 'bg-cyan-500 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-surface-300/50'
                        }`}
                        title="Vista statistiche"
                      >
                        📊 Stats
                      </button>
                      <button
                        onClick={() => setDataViewMode('merge')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          dataViewMode === 'merge'
                            ? 'bg-violet-500 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-surface-300/50'
                        }`}
                        title="Vista mista"
                      >
                        🔀 Merge
                      </button>
                    </div>
                    <div className="text-sm text-gray-400">
                      <span className="font-semibold text-white">{filteredPlayers.length}</span> giocatori
                    </div>
                  </div>
                </div>

                {/* LEVEL 2: Scope Buttons with Count Badges */}
                <div className="p-2 border-b border-surface-50/20 bg-surface-300/50">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={() => { setViewMode('myRoster'); setOwnerFilter('ALL'); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        viewMode === 'myRoster'
                          ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                          : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                      }`}
                      title="La mia rosa"
                    >
                      <span>🏠 La Mia Rosa</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                        viewMode === 'myRoster' ? 'bg-white/20' : 'bg-primary-500/20 text-primary-400'
                      }`}>
                        {strategiesData?.players.filter(p => p.memberId === myMemberId).length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { setViewMode('owned'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'owned'
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="Giocatori di altri manager"
                  >
                    <span>👥 Altre Rose</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      viewMode === 'owned' ? 'bg-white/20' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {strategiesData?.players.filter(p => p.memberId !== myMemberId).length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { setViewMode('svincolati'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'svincolati'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="Giocatori svincolati"
                  >
                    <span>🆓 Svincolati</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      viewMode === 'svincolati' ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {svincolatiData?.players.length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { setViewMode('all'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'all'
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="Tutti i giocatori"
                  >
                    <span>🌐 Tutti</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      viewMode === 'all' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {(strategiesData?.players.length || 0) + (svincolatiData?.players.length || 0)}
                    </span>
                  </button>
                </div>
              </div>

              {/* LEVEL 3: Filters */}
              <div className="p-2 border-b border-surface-50/20 bg-surface-300/30">
                {/* Row 1: Position + Dropdowns */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {/* Position Filter Group */}
                  <div className="flex gap-1">
                    {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                      const colors = POSITION_COLORS[pos] ?? { bg: 'bg-white/20', text: 'text-white', border: '' }
                      return (
                        <button
                          key={pos}
                          onClick={() => setPositionFilter(pos)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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

                  {/* Owner Filter - only for owned or all views */}
                  {(viewMode === 'owned' || viewMode === 'all') && (
                    <select
                      value={ownerFilter}
                      onChange={(e) => setOwnerFilter(e.target.value)}
                      className="px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    >
                      <option value="ALL">Manager</option>
                      {uniqueOwners.map(o => (
                        <option key={o.username} value={o.username}>{o.teamName}</option>
                      ))}
                    </select>
                  )}

                  {/* Team Filter */}
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                  >
                    <option value="ALL">Squadra</option>
                    {uniqueTeams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Search + Strategy */}
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Cerca giocatore..."
                      className="w-full px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    />
                  </div>

                  {/* Strategy filter */}
                  <label className="flex items-center gap-2 cursor-pointer px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={showOnlyWithStrategy}
                      onChange={(e) => setShowOnlyWithStrategy(e.target.checked)}
                      className="w-4 h-4 rounded bg-surface-300 border-indigo-500/50 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-indigo-300 whitespace-nowrap font-medium">⭐ Strategia</span>
                  </label>

                  {/* Compare button (#187) */}
                  {selectedForCompare.size > 0 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setShowCompareModal(true)}
                        disabled={selectedForCompare.size < 2}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedForCompare.size >= 2
                            ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                            : 'bg-cyan-500/30 text-cyan-400/50 cursor-not-allowed'
                        }`}
                      >
                        📊 Confronta ({selectedForCompare.size})
                      </button>
                      <button
                        onClick={clearComparison}
                        className="w-7 h-7 rounded-lg bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-sm flex items-center justify-center transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </div>
              {/* End of mobile filters */}

              {/* Desktop Table Header (shown only on lg+) */}
              <div className="hidden lg:block sticky top-0 z-10 p-3 border-b border-surface-50/20 bg-surface-300/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-white">{filteredPlayers.length}</span>
                    <span className="text-gray-400">giocatori</span>
                    {selectedForCompare.size > 0 && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => setShowCompareModal(true)}
                          disabled={selectedForCompare.size < 2}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            selectedForCompare.size >= 2
                              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                              : 'bg-cyan-500/30 text-cyan-400/50 cursor-not-allowed'
                          }`}
                        >
                          📊 Confronta ({selectedForCompare.size})
                        </button>
                        <button
                          onClick={clearComparison}
                          className="w-7 h-7 rounded-lg bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-sm flex items-center justify-center transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Filtri nella sidebar sinistra
                  </div>
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
                  const isMyRoster = player.type === 'myRoster'

                  return (
                    <div key={player.playerId} className={`bg-surface-300/30 rounded-lg p-3 border ${selectedForCompare.has(player.playerId) ? 'border-cyan-500/50 bg-cyan-500/10' : isMyRoster ? 'border-primary-500/30 bg-primary-500/5' : hasStrategy ? 'border-indigo-500/30 bg-indigo-500/5' : isSvincolato ? 'border-emerald-500/20' : 'border-surface-50/10'}`}>
                      {/* Header: Checkbox + Photo + Player + Svincolato badge */}
                      <div className="flex items-center gap-2 mb-2">
                        {/* Compare checkbox (#187) */}
                        <input
                          type="checkbox"
                          checked={selectedForCompare.has(player.playerId)}
                          onChange={() => togglePlayerForCompare(player.playerId)}
                          className="w-5 h-5 rounded bg-surface-300 border-cyan-500/50 text-cyan-500 focus:ring-cyan-500 flex-shrink-0"
                        />
                        {/* Player Photo with Team Logo Badge - increased size #186 */}
                        <div className="relative flex-shrink-0">
                          {(() => {
                            const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
                            return photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={player.playerName}
                                className="w-12 h-12 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                  const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                  if (fallback) fallback.style.display = 'flex'
                                }}
                              />
                            ) : null
                          })()}
                          <div
                            className={`w-12 h-12 rounded-full ${posColors.bg} ${posColors.text} items-center justify-center text-sm font-bold ${getPlayerPhotoUrl(player.playerApiFootballId) ? 'hidden' : 'flex'}`}
                          >
                            {player.playerPosition}
                          </div>
                          {/* Team logo badge - increased size #186 */}
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white p-0.5 border border-surface-50/20">
                            <TeamLogo team={player.playerTeam} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setSelectedPlayerStats({
                              name: player.playerName,
                              team: player.playerTeam,
                              position: player.playerPosition,
                              quotation: isSvincolato ? undefined : player.playerQuotation,
                              age: player.playerAge,
                              apiFootballId: player.playerApiFootballId,
                              apiFootballStats: player.playerApiFootballStats,
                            })}
                            className="font-medium text-white text-base truncate hover:text-primary-400 transition-colors text-left"
                          >
                            {player.playerName}
                          </button>
                        </div>
                      </div>
                      {/* Player details: Squadra, Età, Owner */}
                      <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                        <div>
                          <span className="text-gray-500">Squadra: </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-4 h-4 flex-shrink-0">
                              <TeamLogo team={player.playerTeam} />
                            </div>
                            <span className="text-gray-300 truncate">{player.playerTeam}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Età: </span>
                          <span className={`${getAgeColor(player.playerAge)}`}>
                            {player.playerAge != null ? `${player.playerAge} anni` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Prop: </span>
                          {isSvincolato ? (
                            <span className="text-emerald-400">Svincolato</span>
                          ) : isMyRoster ? (
                            <span className="text-primary-400">La Mia Rosa</span>
                          ) : (
                            <span className="text-gray-300">{player.ownerTeamName || player.ownerUsername}</span>
                          )}
                        </div>
                      </div>
                      {/* Contract info - only for contracts/merge view */}
                      {!isSvincolato && (dataViewMode === 'contracts' || dataViewMode === 'merge') && (
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

                      {/* Stats info - only for stats/merge view */}
                      {(dataViewMode === 'stats' || dataViewMode === 'merge') && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                          <div className="bg-cyan-500/10 rounded p-1.5 border border-cyan-500/20">
                            <div className="text-gray-500 text-[10px] uppercase">Rating</div>
                            <div className="text-cyan-400 font-semibold">
                              {player.playerApiFootballStats?.games?.rating != null
                                ? Number(player.playerApiFootballStats.games.rating).toFixed(1)
                                : '-'}
                            </div>
                          </div>
                          <div className="bg-secondary-500/10 rounded p-1.5 border border-secondary-500/20">
                            <div className="text-gray-500 text-[10px] uppercase">Gol</div>
                            <div className="text-secondary-400 font-medium">
                              {player.playerApiFootballStats?.goals?.total ?? '-'}
                            </div>
                          </div>
                          <div className="bg-primary-500/10 rounded p-1.5 border border-primary-500/20">
                            <div className="text-gray-500 text-[10px] uppercase">Assist</div>
                            <div className="text-primary-400 font-medium">
                              {player.playerApiFootballStats?.goals?.assists ?? '-'}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Strategy Section - always visible */}
                      <div className="bg-indigo-500/10 rounded-lg p-2 border border-indigo-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          {/* Max Bid */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 uppercase">Max:</span>
                            <button onClick={() => updateLocalStrategy(player.playerId, 'maxBid', Math.max(0, (parseInt(local.maxBid) || 0) - 1).toString())} className="w-6 h-6 rounded bg-surface-300/70 text-gray-400 text-sm font-bold">−</button>
                            <input type="number" value={local.maxBid} onChange={(e) => updateLocalStrategy(player.playerId, 'maxBid', e.target.value)} placeholder="-" className="w-12 px-1 py-1 bg-surface-300/50 border border-surface-50/30 rounded text-white text-center text-sm" />
                            <button onClick={() => updateLocalStrategy(player.playerId, 'maxBid', ((parseInt(local.maxBid) || 0) + 1).toString())} className="w-6 h-6 rounded bg-surface-300/70 text-gray-400 text-sm font-bold">+</button>
                          </div>
                          {/* Priority - increased size #186 */}
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button key={star} onClick={() => updateLocalStrategy(player.playerId, 'priority', local.priority === star ? 0 : star)} className={`w-8 h-8 text-xl ${local.priority >= star ? 'text-purple-400' : 'text-gray-600'}`}>★</button>
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
                      <th className="w-10 py-1 px-2 bg-cyan-500/10">📊</th>
                      <th colSpan={5} className="text-left py-1 px-3 bg-surface-300/30">
                        Giocatore
                      </th>
                      {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                        <th colSpan={4} className="text-center py-1 px-3 bg-accent-500/10 border-l border-surface-50/20">
                          Contratto
                        </th>
                      )}
                      {(dataViewMode === 'stats' || dataViewMode === 'merge') && (
                        <th colSpan={dataViewMode === 'stats' ? STATS_COLUMNS.length : MERGE_STATS_KEYS.length} className="text-center py-1 px-3 bg-cyan-500/10 border-l border-surface-50/20">
                          Statistiche
                        </th>
                      )}
                      <th colSpan={3} className="text-center py-1 px-3 bg-indigo-500/10 border-l border-surface-50/20">
                        Strategia
                      </th>
                    </tr>
                    {/* Column headers */}
                    <tr className="text-xs text-gray-400 uppercase">
                      {/* Compare checkbox header (#187) */}
                      <th className="w-10 p-2 text-center bg-cyan-500/5">
                        <input
                          type="checkbox"
                          checked={selectedForCompare.size > 0}
                          onChange={() => selectedForCompare.size > 0 ? clearComparison() : null}
                          className="w-4 h-4 rounded bg-surface-300 border-cyan-500/50 text-cyan-500 focus:ring-cyan-500"
                        />
                      </th>
                      <SortableHeader field="position" label="R" className="w-10 p-2 text-center" />
                      <SortableHeader field="name" label="Giocatore" className="text-left p-2" />
                      <th className="text-left p-2">Squadra</th>
                      <th className="text-center p-2 w-12">Età</th>
                      <SortableHeader field="owner" label="Prop." className="text-left p-2" />
                      {/* Seasonality column */}
                      <th className="text-center p-2 w-24" title="Andamento mensile (Set-Mag)">Trend</th>
                      {/* Contract columns */}
                      {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                        <>
                          <th className="text-center p-2 text-accent-400 border-l border-surface-50/20">Ing.</th>
                          <th className="text-center p-2">Dur.</th>
                          <th className="text-center p-2 text-orange-400">Cls</th>
                          <SortableHeader field="rubata" label="Rub." className="text-center p-2" />
                        </>
                      )}
                      {/* Stats columns */}
                      {dataViewMode === 'stats' && STATS_COLUMNS.map((col, idx) => (
                        <th key={col.key} className={`text-center p-2 ${col.colorClass || ''} ${idx === 0 ? 'border-l border-surface-50/20' : ''}`} title={col.label}>
                          {col.shortLabel}
                        </th>
                      ))}
                      {dataViewMode === 'merge' && STATS_COLUMNS.filter(c => MERGE_STATS_KEYS.includes(c.key)).map((col, idx) => (
                        <th key={col.key} className={`text-center p-2 ${col.colorClass || ''} ${idx === 0 ? 'border-l border-surface-50/20' : ''}`} title={col.label}>
                          {col.shortLabel}
                        </th>
                      ))}
                      {/* Strategy columns */}
                      <th className="text-center p-2 bg-indigo-500/5 border-l border-surface-50/20">Max</th>
                      <th className="text-center p-2 bg-indigo-500/5">★</th>
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
                      const isMyRoster = player.type === 'myRoster'

                      return (
                        <tr
                          key={player.playerId}
                          className={`border-t border-surface-50/10 transition-colors ${
                            selectedForCompare.has(player.playerId) ? 'bg-cyan-500/10' : isMyRoster ? 'bg-primary-500/5' : hasStrategy ? 'bg-indigo-500/5' : isSvincolato ? 'bg-emerald-500/5' : ''
                          } hover:bg-surface-300/30`}
                        >
                          {/* Compare checkbox (#187) */}
                          <td className="p-2 text-center bg-cyan-500/5">
                            <input
                              type="checkbox"
                              checked={selectedForCompare.has(player.playerId)}
                              onChange={() => togglePlayerForCompare(player.playerId)}
                              className="w-4 h-4 rounded bg-surface-300 border-cyan-500/50 text-cyan-500 focus:ring-cyan-500"
                            />
                          </td>

                          {/* Position */}
                          <td className="p-2 text-center">
                            <div className={`w-8 h-8 mx-auto rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-sm font-bold`}>
                              {player.playerPosition}
                            </div>
                          </td>

                          {/* Player - increased sizes #186 */}
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {/* Player Photo - increased size #186 */}
                              <div className="relative flex-shrink-0">
                                {(() => {
                                  const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
                                  return photoUrl ? (
                                    <img
                                      src={photoUrl}
                                      alt={player.playerName}
                                      className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                        const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                        if (fallback) fallback.style.display = 'flex'
                                      }}
                                    />
                                  ) : null
                                })()}
                                <div
                                  className={`w-10 h-10 rounded-full ${posColors.bg} ${posColors.text} items-center justify-center font-bold text-sm ${getPlayerPhotoUrl(player.playerApiFootballId) ? 'hidden' : 'flex'}`}
                                >
                                  {player.playerPosition}
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedPlayerStats({
                                  name: player.playerName,
                                  team: player.playerTeam,
                                  position: player.playerPosition,
                                  quotation: isSvincolato ? undefined : player.playerQuotation,
                                  age: player.playerAge,
                                  apiFootballId: player.playerApiFootballId,
                                  apiFootballStats: player.playerApiFootballStats,
                                })}
                                className="font-medium text-white text-base truncate hover:text-primary-400 transition-colors text-left"
                              >
                                {player.playerName}
                              </button>
                            </div>
                          </td>

                          {/* Squadra */}
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <span className="text-sm text-gray-300 truncate">{player.playerTeam}</span>
                            </div>
                          </td>

                          {/* Età */}
                          {/* Età */}
                          <td className="p-2 text-center">
                            <span className={`text-sm px-2 py-0.5 rounded ${getAgeBgColor(player.playerAge)}`}>
                              {player.playerAge != null ? player.playerAge : '-'}
                            </span>
                          </td>

                          {/* Owner / Svincolato / My Roster */}
                          <td className="p-2">
                            {isSvincolato ? (
                              <div className="min-w-0">
                                <div className="font-medium text-emerald-400 text-sm">Svincolato</div>
                              </div>
                            ) : player.type === 'myRoster' ? (
                              <div className="min-w-0">
                                <div className="font-medium text-primary-400 text-sm">La Mia Rosa</div>
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

                          {/* Seasonality - Rating with tooltip */}
                          <td className="p-2">
                            {player.playerSeasonalStatsCache ? (
                              <SeasonalitySparkbar
                                monthlyBreakdown={player.playerSeasonalStatsCache.monthlyBreakdown}
                                hotMonths={player.playerSeasonalStatsCache.hotMonths}
                                avgRating={player.playerSeasonalStatsCache.avgRating}
                                matchCount={player.playerSeasonalStatsCache.matchCount}
                              />
                            ) : (
                              <div className="flex items-center justify-center">
                                <span className="text-xs text-gray-600">—</span>
                              </div>
                            )}
                          </td>

                          {/* Contract columns - only for contracts and merge views */}
                          {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                            <>
                              {/* Ingaggio */}
                              <td className="p-2 text-center border-l border-surface-50/10">
                                {isSvincolato ? (
                                  <span className="text-gray-600">-</span>
                                ) : (
                                  <span className="text-accent-400 font-medium text-xs">{player.contractSalary}M</span>
                                )}
                              </td>

                              {/* Durata */}
                              <td className="p-2 text-center">
                                {isSvincolato ? (
                                  <span className="text-gray-600">-</span>
                                ) : (
                                  <span className="text-white text-xs">{player.contractDuration}</span>
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
                            </>
                          )}

                          {/* Stats columns - full set for stats view */}
                          {dataViewMode === 'stats' && STATS_COLUMNS.map((col, idx) => {
                            const rawValue = col.getValue(player.playerApiFootballStats)
                            const numValue = rawValue != null && rawValue !== '' ? Number(rawValue) : null
                            const formatted = col.format ? col.format(numValue) : (numValue ?? '-')
                            return (
                              <td key={col.key} className={`p-2 text-center text-xs ${col.colorClass || 'text-gray-300'} ${idx === 0 ? 'border-l border-surface-50/10' : ''}`}>
                                {formatted}
                              </td>
                            )
                          })}

                          {/* Stats columns - essential only for merge view */}
                          {dataViewMode === 'merge' && STATS_COLUMNS.filter(c => MERGE_STATS_KEYS.includes(c.key)).map((col, idx) => {
                            const rawValue = col.getValue(player.playerApiFootballStats)
                            const numValue = rawValue != null && rawValue !== '' ? Number(rawValue) : null
                            const formatted = col.format ? col.format(numValue) : (numValue ?? '-')
                            return (
                              <td key={col.key} className={`p-2 text-center text-xs ${col.colorClass || 'text-gray-300'} ${idx === 0 ? 'border-l border-surface-50/10' : ''}`}>
                                {formatted}
                              </td>
                            )
                          })}

                          {/* === STRATEGY SECTION === */}
                          {/* Offerta Max */}
                          <td className="p-2 text-center bg-indigo-500/5 border-l border-surface-50/10">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(local.maxBid) || 0
                                  updateLocalStrategy(player.playerId, 'maxBid', Math.max(0, current - 1).toString())
                                }}
                                className="w-5 h-5 rounded bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-xs font-bold flex items-center justify-center transition-colors"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                value={local.maxBid}
                                onChange={(e) => updateLocalStrategy(player.playerId, 'maxBid', e.target.value)}
                                placeholder="-"
                                className={`w-10 px-1 py-0.5 bg-surface-300/50 border rounded text-white text-center text-xs font-medium focus:border-blue-500 focus:outline-none placeholder:text-gray-600 ${
                                  isSaving ? 'border-blue-500/50' : local.isDirty ? 'border-yellow-500/50' : 'border-surface-50/30'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(local.maxBid) || 0
                                  updateLocalStrategy(player.playerId, 'maxBid', (current + 1).toString())
                                }}
                                className="w-5 h-5 rounded bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-xs font-bold flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Priority - increased size #186 */}
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
                              className={`w-full min-w-[60px] px-1 py-0.5 bg-surface-300/50 border rounded text-white text-xs focus:border-blue-500 focus:outline-none placeholder:text-gray-600 ${
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
                  {viewMode === 'myRoster' && ' (la mia rosa)'}
                  {viewMode === 'owned' && ' (altre rose)'}
                  {viewMode === 'svincolati' && ' (svincolati)'}
                  {viewMode === 'all' && ` (${filteredPlayers.filter(p => p.type === 'myRoster').length} miei, ${filteredPlayers.filter(p => p.type === 'owned').length} altri, ${filteredPlayers.filter(p => p.type === 'svincolato').length} svinc.)`}
                </span>
                {viewMode !== 'myRoster' && (
                  <span className="text-indigo-400">{myStrategiesCount} strategie impostate</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Planner Widget (hidden on mobile, shown on xl+) */}
          <div className="hidden xl:block">
            <PlannerWidget
              isCollapsed={rightSidebarCollapsed}
              onToggleCollapse={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
              budgetTotal={budgetData?.budgetTotal ?? 100}
              budgetUsed={budgetData?.budgetUsed ?? 0}
              strategiesData={strategiesData?.players ?? []}
              svincolatiData={svincolatiData?.players.map(p => ({
                id: p.playerId,
                name: p.playerName,
                team: p.playerTeam,
                position: p.playerPosition,
                quotation: 0, // Svincolati don't have quotation in this context
                status: 'SVINCOLATO',
                preference: p.preference ? {
                  maxBid: p.preference.maxBid,
                  priority: p.preference.priority,
                  notes: p.preference.notes,
                  isWatchlist: p.preference.isWatchlist,
                  isAutoPass: p.preference.isAutoPass,
                } : undefined,
              })) ?? []}
              onPlayerClick={(playerId) => {
                // Find player and open strategy panel
                const player = [...(strategiesData?.players ?? []), ...(svincolatiData?.players ?? [])].find(p =>
                  ('playerId' in p ? p.playerId : p.playerId) === playerId
                )
                if (player) {
                  setSelectedPlayer(player as any)
                }
              }}
            />
          </div>
        </div>
      </main>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => setSelectedPlayerStats(null)}
        player={selectedPlayerStats}
      />

      {/* Player Compare Modal (#187) */}
      {showCompareModal && playersToCompare.length >= 2 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-surface-50/20 bg-gradient-to-r from-cyan-500/10 to-surface-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Confronto Giocatori</h2>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="w-10 h-10 rounded-lg bg-surface-300 hover:bg-surface-50/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Player Cards Header */}
              <div className="flex flex-wrap justify-center gap-6 mb-8">
                {playersToCompare.map((player, idx) => {
                  const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
                  const posColors = POSITION_COLORS[player.playerPosition] ?? { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white' }

                  return (
                    <div key={player.playerId} className="flex flex-col items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full mb-1"
                        style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                      />
                      <div className="relative">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={player.playerName}
                            className="w-16 h-16 rounded-full object-cover bg-surface-300 border-3 border-surface-50/20"
                            style={{ borderColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            className={`w-16 h-16 rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center font-bold text-xl`}
                          >
                            {player.playerPosition}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${posColors.bg} flex items-center justify-center text-white font-bold text-xs border-2 border-surface-200`}
                        >
                          {player.playerPosition}
                        </span>
                      </div>
                      <span className="font-medium text-white">{player.playerName}</span>
                      <div className="flex items-center gap-1">
                        <img
                          src={getTeamLogo(player.playerTeam)}
                          alt={player.playerTeam}
                          className="w-5 h-5 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                        <span className="text-sm text-gray-400">{player.playerTeam}</span>
                      </div>
                      {player.type !== 'svincolato' && (
                        <span className="text-lg font-bold text-primary-400">Quot. {player.playerQuotation}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Radar Charts - different for goalkeepers vs outfield players */}
              {(() => {
                const allGoalkeepers = playersToCompare.every(p => p.playerPosition === 'P')
                const hasGoalkeepers = playersToCompare.some(p => p.playerPosition === 'P')

                if (allGoalkeepers) {
                  // All goalkeepers - show goalkeeper-specific radar charts
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      {/* Goalkeeper Performance Radar */}
                      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                        <h3 className="text-center text-yellow-400 font-semibold mb-4">🧤 Performance Portiere</h3>
                        <RadarChart
                          size={280}
                          players={playersToCompare.map((p, i) => ({
                            name: p.playerName,
                            color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                          }))}
                          data={[
                            { label: 'Parate', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.saves ?? 0) },
                            { label: 'Rig. Parati', values: playersToCompare.map(p => (p.playerApiFootballStats?.penalty?.saved ?? 0) * 10) },
                            { label: 'Rating', values: playersToCompare.map(p => Math.round((Number(p.playerApiFootballStats?.games?.rating) || 0) * 10)) },
                            { label: 'Presenze', values: playersToCompare.map(p => p.playerApiFootballStats?.games?.appearences ?? 0) },
                            { label: 'Minuti', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.games?.minutes ?? 0) / 100)) },
                            { label: 'Passaggi', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.passes?.total ?? 0) / 10)) },
                          ]}
                        />
                      </div>

                      {/* Goalkeeper Goals Conceded Radar */}
                      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                        <h3 className="text-center text-yellow-400 font-semibold mb-4">🧤 Gol Subiti (meno è meglio)</h3>
                        <RadarChart
                          size={280}
                          players={playersToCompare.map((p, i) => ({
                            name: p.playerName,
                            color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                          }))}
                          data={[
                            { label: 'Gol Subiti', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.conceded ?? 0) },
                            { label: 'Prec. Pass', values: playersToCompare.map(p => p.playerApiFootballStats?.passes?.accuracy ?? 0) },
                            { label: 'Gialli', values: playersToCompare.map(p => (p.playerApiFootballStats?.cards?.yellow ?? 0) * 5) },
                            { label: 'Rossi', values: playersToCompare.map(p => (p.playerApiFootballStats?.cards?.red ?? 0) * 20) },
                          ]}
                        />
                      </div>
                    </div>
                  )
                }

                // Mixed or outfield players - show standard radar charts
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {hasGoalkeepers && (
                      <div className="col-span-full text-center text-sm text-yellow-400 bg-yellow-500/10 rounded-lg p-2 mb-2">
                        ⚠️ Confronto misto portieri/giocatori - alcune statistiche potrebbero non essere comparabili
                      </div>
                    )}
                    {/* Offensive Stats Radar */}
                    <div className="bg-surface-300/50 rounded-xl p-4">
                      <h3 className="text-center text-white font-semibold mb-4">Statistiche Offensive</h3>
                      <RadarChart
                        size={280}
                        players={playersToCompare.map((p, i) => ({
                          name: p.playerName,
                          color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                        }))}
                        data={[
                          { label: 'Gol', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.total ?? 0) },
                          { label: 'Assist', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.assists ?? 0) },
                          { label: 'Tiri', values: playersToCompare.map(p => p.playerApiFootballStats?.shots?.total ?? 0) },
                          { label: 'Tiri Porta', values: playersToCompare.map(p => p.playerApiFootballStats?.shots?.on ?? 0) },
                          { label: 'Dribbling', values: playersToCompare.map(p => p.playerApiFootballStats?.dribbles?.success ?? 0) },
                          { label: 'Pass Chiave', values: playersToCompare.map(p => p.playerApiFootballStats?.passes?.key ?? 0) },
                        ]}
                      />
                    </div>

                    {/* Defensive/General Stats Radar */}
                    <div className="bg-surface-300/50 rounded-xl p-4">
                      <h3 className="text-center text-white font-semibold mb-4">Statistiche Difensive</h3>
                      <RadarChart
                        size={280}
                        players={playersToCompare.map((p, i) => ({
                          name: p.playerName,
                          color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                        }))}
                        data={[
                          { label: 'Contrasti', values: playersToCompare.map(p => p.playerApiFootballStats?.tackles?.total ?? 0) },
                          { label: 'Intercetti', values: playersToCompare.map(p => p.playerApiFootballStats?.tackles?.interceptions ?? 0) },
                          { label: 'Passaggi', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.passes?.total ?? 0) / 10)) },
                          { label: 'Presenze', values: playersToCompare.map(p => p.playerApiFootballStats?.games?.appearences ?? 0) },
                          { label: 'Rating', values: playersToCompare.map(p => Math.round((Number(p.playerApiFootballStats?.games?.rating) || 0) * 10)) },
                          { label: 'Minuti', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.games?.minutes ?? 0) / 100)) },
                        ]}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Detailed Stats Table */}
              <div className="bg-surface-300/30 rounded-xl overflow-hidden">
                <h3 className="text-white font-semibold p-4 border-b border-surface-50/10">Dettaglio Statistiche</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-300/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Statistica</th>
                        {playersToCompare.map((player, idx) => (
                          <th key={player.playerId} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                              />
                              <span className="text-sm font-medium text-white">{player.playerName}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-50/10">
                      {/* Basic info: Squadra, Età */}
                      <tr className="hover:bg-surface-300/30">
                        <td className="px-4 py-3 text-sm text-gray-300">Squadra</td>
                        {playersToCompare.map(player => (
                          <td key={player.playerId} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-5 h-5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <span className="text-sm text-gray-300">{player.playerTeam}</span>
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr className="hover:bg-surface-300/30">
                        <td className="px-4 py-3 text-sm text-gray-300">Età</td>
                        {playersToCompare.map(player => (
                          <td key={player.playerId} className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded ${getAgeBgColor(player.playerAge)}`}>
                              {player.playerAge != null ? `${player.playerAge} anni` : '-'}
                            </span>
                          </td>
                        ))}
                      </tr>
                      {/* Contract info - only for non-svincolati */}
                      {playersToCompare.some(p => p.type !== 'svincolato') && (
                        <>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Quotazione</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-white">
                                {player.type !== 'svincolato' ? `${player.playerQuotation}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Ingaggio</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-accent-400">
                                {player.type !== 'svincolato' ? `${player.contractSalary}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Durata</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-white">
                                {player.type !== 'svincolato' ? `${player.contractDuration} stagioni` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Clausola</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-orange-400">
                                {player.type !== 'svincolato' ? `${player.contractClause}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Prezzo Rubata</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-warning-400">
                                {player.type !== 'svincolato' ? `${player.rubataPrice}M` : '-'}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}
                      {/* Stats - includes goalkeeper-specific stats */}
                      {[
                        { label: 'Presenze', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.games?.appearences },
                        { label: 'Minuti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.games?.minutes },
                        { label: 'Rating', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.games?.rating, format: (v: number | null) => v != null ? Number(v).toFixed(2) : '-' },
                        // Goalkeeper-specific stats
                        { label: '🧤 Parate', getValue: (p: DisplayPlayer) => p.playerPosition === 'P' ? p.playerApiFootballStats?.goals?.saves : null, colorClass: 'text-yellow-400', goalkeeperOnly: true },
                        { label: '🧤 Gol Subiti', getValue: (p: DisplayPlayer) => p.playerPosition === 'P' ? p.playerApiFootballStats?.goals?.conceded : null, colorClass: 'text-yellow-400', goalkeeperOnly: true, lowerIsBetter: true },
                        { label: '🧤 Rigori Parati', getValue: (p: DisplayPlayer) => p.playerPosition === 'P' ? p.playerApiFootballStats?.penalty?.saved : null, colorClass: 'text-yellow-400', goalkeeperOnly: true },
                        // Outfield stats
                        { label: 'Gol', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.goals?.total, colorClass: 'text-secondary-400' },
                        { label: 'Assist', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.goals?.assists, colorClass: 'text-primary-400' },
                        { label: 'Tiri Totali', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.shots?.total },
                        { label: 'Tiri in Porta', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.shots?.on },
                        { label: 'Contrasti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.tackles?.total },
                        { label: 'Intercetti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.tackles?.interceptions },
                        { label: 'Passaggi Chiave', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.passes?.key },
                        { label: 'Precisione Passaggi', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.passes?.accuracy, format: (v: number | null) => v != null ? `${v}%` : '-' },
                        { label: 'Dribbling Riusciti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.dribbles?.success },
                        { label: 'Ammonizioni', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.cards?.yellow, colorClass: 'text-warning-400' },
                        { label: 'Espulsioni', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.cards?.red, colorClass: 'text-danger-400' },
                      ].filter(row => {
                        // Hide goalkeeper-only rows if no goalkeepers in comparison
                        if ((row as { goalkeeperOnly?: boolean }).goalkeeperOnly) {
                          return playersToCompare.some(p => p.playerPosition === 'P')
                        }
                        return true
                      }).map(row => {
                        const values = playersToCompare.map(p => {
                          const val = row.getValue(p)
                          return val != null ? Number(val) : 0
                        })
                        const maxVal = Math.max(...values.filter(v => v > 0))

                        return (
                          <tr key={row.label} className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">{row.label}</td>
                            {playersToCompare.map((player, idx) => {
                              const val = values[idx]
                              const isMax = val === maxVal && maxVal > 0
                              const formatted = row.format ? row.format(val || null) : (val || '-')

                              return (
                                <td
                                  key={player.playerId}
                                  className={`px-4 py-3 text-center font-medium ${
                                    isMax ? 'text-secondary-400' : row.colorClass || 'text-white'
                                  }`}
                                >
                                  {isMax && maxVal > 0 && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-secondary-400 mr-2" />
                                  )}
                                  {formatted}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

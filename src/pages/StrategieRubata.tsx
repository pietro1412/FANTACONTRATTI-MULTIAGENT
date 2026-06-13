import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { rubataApi, leagueApi } from '@/services/api'
import { AUTO_TAG_DEFS, type AutoTagId } from '@/services/player-stats.service'

// Watchlist categories (#219) — tassonomia condivisa con la pagina Rubata
import { WATCHLIST_CATEGORIES, type WatchlistCategoryId } from '@/types/watchlist.types'
import { Navigation } from '@/components/Navigation'
import { getTeamLogo } from '@/utils/teamLogos'
import { POSITION_COLORS } from '@/components/ui/PositionBadge'
import { PlayerStatsModal, type PlayerInfo, type PlayerStats, type ComputedSeasonStats } from '@/components/PlayerStatsModal'
import { PlayerCompareModal } from '@/components/rubata/PlayerCompareModal'
import { AmountStepper } from '@/components/ui/AmountStepper'
import { Monogram } from '@/components/ui/Monogram'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import type { BoardPlayer } from '@/types/rubata.types'

// Age color coding (Stadium Nights tokens) - younger is better
function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 25) return 'text-secondary-400'
  if (age < 30) return 'text-warning-400'
  if (age < 35) return 'text-passion-400'
  return 'text-danger-400'
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
  playerComputedStats?: ComputedSeasonStats | null
  playerAutoTags?: AutoTagId[]
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
  playerComputedStats?: ComputedSeasonStats | null
  playerAutoTags?: AutoTagId[]
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
  watchlistCategory: string | null
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

type ViewMode = 'myRoster' | 'owned' | 'svincolati' | 'all' | 'overview'
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
  { key: 'rating', label: 'Rating', shortLabel: 'Voto', getValue: s => s?.games?.rating ?? null, format: v => v?.toFixed(2) ?? '-' },
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

// Local strategy state for a player (with debounce)
interface LocalStrategy {
  maxBid: string
  priority: number
  notes: string
  isDirty: boolean
}

// Round role badge (square, themed). Mirrors the mockup .role-badge.
function RoleBadge({ position, size = 'md' }: { position: string; size?: 'sm' | 'md' }) {
  const posColors = POSITION_COLORS[position] ?? { bg: 'bg-surface-100', text: 'text-gray-200', border: '' }
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
  return (
    <span className={`${dim} rounded-lg ${posColors.bg} ${posColors.text} font-display font-bold flex items-center justify-center flex-shrink-0`}>
      {position}
    </span>
  )
}

// Compact star rating (read-only) for overview lists
function StarRating({ value }: { value: number }) {
  return (
    <span className="text-accent-400 text-[11px] tracking-wide" aria-label={`Priorità ${value} su 5`}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={s <= value ? '' : 'text-surface-50/50'}>★</span>
      ))}
    </span>
  )
}

// Map a DisplayPlayer to the BoardPlayer shape consumed by PlayerCompareModal.
// Svincolati lack contract data → fill with zero defaults (the modal renders them as 0/-).
function toBoardPlayer(p: DisplayPlayer): BoardPlayer {
  const isSvincolato = p.type === 'svincolato'
  return {
    rosterId: isSvincolato ? p.playerId : p.rosterId,
    memberId: isSvincolato ? '' : p.memberId,
    playerId: p.playerId,
    playerName: p.playerName,
    playerPosition: (p.playerPosition || '').toUpperCase() as BoardPlayer['playerPosition'],
    playerTeam: p.playerTeam,
    playerQuotation: isSvincolato ? undefined : p.playerQuotation,
    playerAge: p.playerAge,
    playerApiFootballId: p.playerApiFootballId,
    playerApiFootballStats: p.playerApiFootballStats,
    playerComputedStats: p.playerComputedStats,
    ownerUsername: isSvincolato ? '' : p.ownerUsername,
    ownerTeamName: isSvincolato ? null : p.ownerTeamName,
    rubataPrice: isSvincolato ? 0 : p.rubataPrice,
    contractSalary: isSvincolato ? 0 : p.contractSalary,
    contractDuration: isSvincolato ? 0 : p.contractDuration,
    contractClause: isSvincolato ? 0 : p.contractClause,
  }
}

export function StrategieRubata({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { leagueId } = useParams<{ leagueId: string }>()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [savingPlayerIds, setSavingPlayerIds] = useState<Set<string>>(new Set())
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  const [strategiesData, setStrategiesData] = useState<StrategiesData | null>(null)
  const [svincolatiData, setSvincolatiData] = useState<SvincolatiData | null>(null)

  // View mode (scope): overview is the default landing view (strategic output)
  const [viewMode, setViewMode] = useState<ViewMode>('overview')

  // Data view mode: contracts, stats, or merge
  const [dataViewMode, setDataViewMode] = useState<DataViewMode>('merge')

  // Filter state
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyWithStrategy, setShowOnlyWithStrategy] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL')
  const [teamFilter, setTeamFilter] = useState<string>('ALL')

  // Player stats modal
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)

  // Player comparison feature (#187)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())
  const [showCompareModal, setShowCompareModal] = useState(false)

  // Category popover (which player row has the category picker open)
  const [openCategoryFor, setOpenCategoryFor] = useState<string | null>(null)

  // Local edits with debounce
  const [localStrategies, setLocalStrategies] = useState<Record<string, LocalStrategy>>({})
  const localStrategiesRef = useRef<Record<string, LocalStrategy>>({})
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

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

      // Fetch both owned players and svincolati in parallel
      const [ownedRes, svincolatiRes] = await Promise.all([
        rubataApi.getAllPlayersForStrategies(leagueId),
        rubataApi.getAllSvincolatiForStrategies(leagueId),
      ])

      // Initialize local strategies
      const locals: Record<string, LocalStrategy> = {}

      if (ownedRes.success && ownedRes.data) {
        setStrategiesData(ownedRes.data as StrategiesData)
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
        toast.error(ownedRes.message || 'Errore nel caricamento giocatori')
      }

      if (svincolatiRes.success && svincolatiRes.data) {
        setSvincolatiData(svincolatiRes.data as SvincolatiData)
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
    } catch {
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }, [leagueId, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => { clearTimeout(timer); })
    }
  }, [])

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
      return
    }

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
        setLocalStrategies(prev => {
          const existing = prev[playerId]
          if (!existing) return prev
          return {
            ...prev,
            [playerId]: {
              ...existing,
              isDirty: false,
            }
          }
        })

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
                    watchlistCategory: p.preference?.watchlistCategory || null,
                  } : null
                }
              }
              return p
            })
          }
        })
      } else {
        toast.error(res.message || 'Errore nel salvataggio della strategia')
      }
    } catch {
      toast.error('Errore nel salvataggio della strategia')
    } finally {
      setSavingPlayerIds(prev => {
        const next = new Set(prev)
        next.delete(playerId)
        return next
      })
    }
  }, [leagueId, toast])

  // Set watchlist category for a player (immediate save, no debounce) (#219)
  const setWatchlistCategory = useCallback(async (playerId: string, category: string | null) => {
    if (!leagueId) return
    setSavingPlayerIds(prev => new Set(prev).add(playerId))
    try {
      const res = await rubataApi.setPreference(leagueId, playerId, {
        watchlistCategory: category,
        isWatchlist: category !== null,
      })
      if (!res.success) {
        toast.error(res.message || 'Errore nel salvataggio della categoria')
        return
      }
      // Optimistic update for both datasets
      const buildPref = (p: { preference?: RubataPreference | null }): RubataPreference => ({
        id: p.preference?.id || 'temp',
        playerId,
        memberId: strategiesData?.myMemberId || '',
        maxBid: p.preference?.maxBid ?? null,
        priority: p.preference?.priority ?? null,
        notes: p.preference?.notes ?? null,
        isWatchlist: category !== null,
        isAutoPass: p.preference?.isAutoPass ?? false,
        watchlistCategory: category,
      })
      setStrategiesData(prev => prev ? {
        ...prev,
        players: prev.players.map(p => p.playerId !== playerId ? p : { ...p, preference: buildPref(p) })
      } : prev)
      setSvincolatiData(prev => prev ? {
        ...prev,
        players: prev.players.map(p => p.playerId !== playerId ? p : { ...p, preference: buildPref(p) })
      } : prev)
    } catch {
      toast.error('Errore nel salvataggio della categoria')
    } finally {
      setSavingPlayerIds(prev => { const next = new Set(prev); next.delete(playerId); return next })
    }
  }, [leagueId, strategiesData?.myMemberId, toast])

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
      void saveStrategy(playerId)
    }, 2000)
  }, [saveStrategy])

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

  // Filtered and sorted players - supports myRoster, owned, svincolati, and all.
  // Sort is fixed by role (P→D→C→A) then alphabetical.
  const filteredPlayers = useMemo((): DisplayPlayer[] => {
    const result: DisplayPlayer[] = []

    // Position order: P (0) > D (1) > C (2) > A (3)
    const getPositionOrder = (pos: string): number => {
      const normalized = (pos || '').trim().toUpperCase()
      const order: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 }
      return order[normalized] ?? 99
    }

    // Add MY players if viewMode is 'myRoster' or 'all'
    if ((viewMode === 'myRoster' || viewMode === 'all') && strategiesData?.players) {
      strategiesData.players.forEach(player => {
        if (player.memberId !== myMemberId) return
        if (positionFilter !== 'ALL' && player.playerPosition !== positionFilter) return
        if (teamFilter !== 'ALL' && player.playerTeam !== teamFilter) return
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          if (!player.playerName.toLowerCase().includes(query) &&
              !player.playerTeam.toLowerCase().includes(query)) {
            return
          }
        }
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
        if (player.memberId === myMemberId) return
        if (positionFilter !== 'ALL' && player.playerPosition !== positionFilter) return
        if (teamFilter !== 'ALL' && player.playerTeam !== teamFilter) return
        if (ownerFilter !== 'ALL' && player.ownerUsername !== ownerFilter) return
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          if (!player.playerName.toLowerCase().includes(query) &&
              !player.playerTeam.toLowerCase().includes(query) &&
              !player.ownerUsername.toLowerCase().includes(query) &&
              !(player.ownerTeamName?.toLowerCase().includes(query))) {
            return
          }
        }
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
        if (positionFilter !== 'ALL' && player.playerPosition !== positionFilter) return
        if (teamFilter !== 'ALL' && player.playerTeam !== teamFilter) return
        // Owner filter doesn't apply to svincolati, skip them if a specific owner is selected
        if (viewMode === 'all' && ownerFilter !== 'ALL') return
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          if (!player.playerName.toLowerCase().includes(query) &&
              !player.playerTeam.toLowerCase().includes(query)) {
            return
          }
        }
        if (showOnlyWithStrategy) {
          const local = getLocalStrategy(player.playerId)
          if (!local.maxBid && !local.priority && !local.notes) return
        }
        result.push({ ...player, type: 'svincolato' })
      })
    }

    // Sort by role then name
    result.sort((a, b) => {
      const cmp = getPositionOrder(a.playerPosition) - getPositionOrder(b.playerPosition)
      if (cmp !== 0) return cmp
      return a.playerName.localeCompare(b.playerName)
    })

    return result
  }, [strategiesData?.players, svincolatiData?.players, myMemberId, viewMode, positionFilter, teamFilter, ownerFilter, searchQuery, showOnlyWithStrategy, getLocalStrategy])

  // Players selected for comparison (#187)
  const playersToCompare = useMemo(() => {
    return filteredPlayers.filter(p => selectedForCompare.has(p.playerId))
  }, [filteredPlayers, selectedForCompare])

  // Scope counts for tabs
  const counts = useMemo(() => {
    const owned = strategiesData?.players ?? []
    const svinc = svincolatiData?.players ?? []
    const mine = owned.filter(p => p.memberId === myMemberId).length
    const others = owned.length - mine
    return {
      myRoster: mine,
      owned: others,
      svincolati: svinc.length,
      all: owned.length + svinc.length,
    }
  }, [strategiesData?.players, svincolatiData?.players, myMemberId])

  // Watchlist headline stats (for the testata)
  const watchlistStats = useMemo(() => {
    let inWatchlist = 0
    let daRubare = 0
    let budget = 0
    const tally = (cat: string | null | undefined, playerId: string) => {
      if (cat) {
        inWatchlist++
        if (cat === 'DA_RUBARE') daRubare++
        const maxBid = parseInt(getLocalStrategy(playerId).maxBid) || 0
        budget += maxBid
      }
    }
    strategiesData?.players.forEach(p => { if (p.memberId !== myMemberId) tally(p.preference?.watchlistCategory, p.playerId) })
    svincolatiData?.players.forEach(p => { tally(p.preference?.watchlistCategory, p.playerId) })
    return { inWatchlist, daRubare, budget }
  }, [strategiesData?.players, svincolatiData?.players, myMemberId, getLocalStrategy])

  // My strategies count (for footer) - includes both owned and svincolati
  const myStrategiesCount = useMemo(() => {
    let count = 0
    if (strategiesData?.players) {
      count += strategiesData.players.filter(p => {
        if (p.memberId === myMemberId) return false
        const local = getLocalStrategy(p.playerId)
        return local.maxBid || local.priority || local.notes
      }).length
    }
    if (svincolatiData?.players) {
      count += svincolatiData.players.filter(p => {
        const local = getLocalStrategy(p.playerId)
        return local.maxBid || local.priority || local.notes
      }).length
    }
    return count
  }, [strategiesData?.players, svincolatiData?.players, myMemberId, getLocalStrategy])

  // ---- Overview helpers ----

  // All watched players (with a category) grouped, plus all with priority
  const overviewData = useMemo(() => {
    const byCategory: Record<WatchlistCategoryId, DisplayPlayer[]> = {
      DA_RUBARE: [], SOTTO_OSSERVAZIONE: [], POTENZIALE_ACQUISTO: [], SCAMBIO: [], DA_VENDERE: [],
    }
    const withPriority: DisplayPlayer[] = []

    const collect = (dp: DisplayPlayer) => {
      const catId = dp.preference?.watchlistCategory as WatchlistCategoryId | null | undefined
      if (catId && byCategory[catId]) byCategory[catId].push(dp)
      if (getLocalStrategy(dp.playerId).priority > 0) withPriority.push(dp)
    }

    strategiesData?.players.forEach(p => {
      const isMy = p.memberId === myMemberId
      collect({ ...p, type: isMy ? 'myRoster' : 'owned' })
    })
    svincolatiData?.players.forEach(p => {
      collect({ ...p, type: 'svincolato' })
    })

    // Sort each category by priority desc then maxBid desc
    const sortFn = (a: DisplayPlayer, b: DisplayPlayer) => {
      const la = getLocalStrategy(a.playerId)
      const lb = getLocalStrategy(b.playerId)
      if (lb.priority !== la.priority) return lb.priority - la.priority
      return (parseInt(lb.maxBid) || 0) - (parseInt(la.maxBid) || 0)
    }
    ;(Object.keys(byCategory) as WatchlistCategoryId[]).forEach(k => byCategory[k].sort(sortFn))
    withPriority.sort(sortFn)

    return { byCategory, topPriority: withPriority.slice(0, 3) }
  }, [strategiesData?.players, svincolatiData?.players, myMemberId, getLocalStrategy])

  // Open the player stats modal for a player
  const openStats = useCallback((player: DisplayPlayer) => {
    setSelectedPlayerStats({
      name: player.playerName,
      team: player.playerTeam,
      position: player.playerPosition,
      quotation: player.type === 'svincolato' ? undefined : player.playerQuotation,
      age: player.playerAge,
      apiFootballId: player.playerApiFootballId,
      computedStats: player.playerComputedStats,
    })
  }, [])

  // ---------- LOADING ----------
  if (loading) {
    return (
      <div className="min-h-screen pb-6">
        <Navigation currentPage="strategie-rubata" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <Skeleton className="h-9 w-full max-w-md rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  const isTableView = viewMode !== 'overview'

  return (
    <div className="min-h-screen pb-6">
      <Navigation currentPage="strategie-rubata" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* === TESTATA === */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-passion-700 to-passion-500 border border-passion-500/50 flex items-center justify-center text-2xl flex-shrink-0">
            🎯
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white">Strategie Rubata</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
              {isTableView
                ? 'Imposta max bid, priorità e categoria per ogni giocatore che ti interessa.'
                : 'Prepara la tua watchlist, i max bid e le priorità prima che parta la rubata.'}
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-5 lg:gap-7">
            <div className="text-right">
              <div className="micro-label text-gray-500">In watchlist</div>
              <div className="stat-number text-lg text-white">{watchlistStats.inWatchlist}</div>
            </div>
            <div className="text-right">
              <div className="micro-label text-gray-500">Da Rubare</div>
              <div className="stat-number text-lg text-accent-400">{watchlistStats.daRubare}</div>
            </div>
            <div className="text-right">
              <div className="micro-label text-gray-500">Budget rubata</div>
              <div className="budget-display text-lg text-white">{watchlistStats.budget}M</div>
            </div>
          </div>
        </div>

        {/* === SCOPE TABS === */}
        <div className="flex items-center gap-1 border-b border-surface-50/20 mb-4 overflow-x-auto">
          {([
            { key: 'overview', label: 'Overview', n: null },
            { key: 'myRoster', label: 'Mia rosa', n: counts.myRoster },
            { key: 'owned', label: 'Altre rose', n: counts.owned },
            { key: 'svincolati', label: 'Svincolati', n: counts.svincolati },
            { key: 'all', label: 'Tutti', n: counts.all },
          ] as { key: ViewMode; label: string; n: number | null }[]).map(tab => {
            const isActive = viewMode === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setViewMode(tab.key); setOwnerFilter('ALL'); }}
                className={`font-display text-sm font-semibold px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  isActive ? 'text-accent-400 border-accent-400' : 'text-gray-400 border-transparent hover:text-gray-200'
                }`}
              >
                {tab.label}
                {tab.n != null && (
                  <span className={`font-mono text-[10px] ${isActive ? 'text-accent-400' : 'text-gray-500'}`}>{tab.n}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* === OVERVIEW (default) === */}
        {viewMode === 'overview' && (
          <OverviewSection
            byCategory={overviewData.byCategory}
            topPriority={overviewData.topPriority}
            getLocalStrategy={getLocalStrategy}
            onAddPlayers={() => { setViewMode('svincolati'); }}
            onOpenStats={openStats}
          />
        )}

        {/* === TABLE / CARDS VIEW === */}
        {isTableView && (
          <>
            {/* Filters bar (sticky) */}
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 bg-surface-300 border border-surface-50/20 rounded-xl px-3 py-2 mb-4">
              {/* Data view segmented */}
              <div className="inline-flex rounded-lg border border-surface-50/30 overflow-hidden">
                {([
                  { key: 'contracts', label: 'Contratti' },
                  { key: 'stats', label: 'Stats' },
                  { key: 'merge', label: 'Misto' },
                ] as { key: DataViewMode; label: string }[]).map((seg, i) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => { setDataViewMode(seg.key); }}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${i > 0 ? 'border-l border-surface-50/30' : ''} ${
                      dataViewMode === seg.key ? 'bg-accent-500 text-surface-400' : 'bg-surface-200 text-gray-400 hover:text-white'
                    }`}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>

              {/* Position chips */}
              <div className="flex gap-1">
                {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                  const active = positionFilter === pos
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => { setPositionFilter(pos); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border transition-colors ${
                        active ? 'bg-accent-500 text-surface-400 border-accent-500' : 'bg-surface-200 text-gray-400 border-surface-50/30 hover:text-white'
                      }`}
                    >
                      {pos === 'ALL' ? 'Tutti' : pos}
                    </button>
                  )
                })}
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 bg-surface-200 border border-surface-50/30 rounded-lg px-2.5 py-1.5 flex-1 min-w-[140px]">
                <span className="text-gray-500 text-xs" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); }}
                  placeholder="Cerca giocatore..."
                  className="bg-transparent text-white text-xs w-full outline-none placeholder:text-gray-500"
                />
              </div>

              {/* Owner filter (owned/all) */}
              {(viewMode === 'owned' || viewMode === 'all') && (
                <select
                  value={ownerFilter}
                  onChange={(e) => { setOwnerFilter(e.target.value); }}
                  className="px-2.5 py-1.5 bg-surface-200 border border-surface-50/30 rounded-lg text-white text-xs"
                >
                  <option value="ALL">Manager</option>
                  {uniqueOwners.map(o => (
                    <option key={o.username} value={o.username}>{o.teamName}</option>
                  ))}
                </select>
              )}

              {/* Team filter */}
              <select
                value={teamFilter}
                onChange={(e) => { setTeamFilter(e.target.value); }}
                className="px-2.5 py-1.5 bg-surface-200 border border-surface-50/30 rounded-lg text-white text-xs"
              >
                <option value="ALL">Squadra</option>
                {uniqueTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>

              {/* Strategy toggle + compare on the right */}
              <div className="ml-auto flex items-center gap-2">
                {selectedForCompare.size > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setShowCompareModal(true); }}
                      disabled={selectedForCompare.size < 2}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selectedForCompare.size >= 2 ? 'bg-info-500 text-white hover:bg-info-600' : 'bg-info-500/30 text-info-400/50 cursor-not-allowed'
                      }`}
                    >
                      Confronta ({selectedForCompare.size})
                    </button>
                    <button
                      type="button"
                      onClick={clearComparison}
                      className="w-7 h-7 rounded-lg bg-surface-200 text-gray-400 hover:text-white hover:bg-surface-100 text-sm flex items-center justify-center transition-colors"
                      aria-label="Annulla confronto"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-50/30 hover:border-secondary-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={showOnlyWithStrategy}
                    onChange={(e) => { setShowOnlyWithStrategy(e.target.checked); }}
                    className="w-4 h-4 rounded bg-surface-300 border-secondary-500/50 text-secondary-500 focus:ring-secondary-500"
                  />
                  <span className="text-xs text-gray-300 whitespace-nowrap font-medium">Solo con strategia</span>
                </label>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              {filteredPlayers.length === 0 ? (
                <EmptyState
                  compact
                  icon="🔍"
                  title={
                    searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL' || ownerFilter !== 'ALL' || showOnlyWithStrategy
                      ? 'Nessun giocatore con questi filtri'
                      : 'Nessun giocatore disponibile'
                  }
                  description={
                    searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL' || ownerFilter !== 'ALL' || showOnlyWithStrategy
                      ? 'Prova ad allargare i filtri o la ricerca.'
                      : undefined
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      {/* Group headers */}
                      <tr className="micro-label text-gray-500 bg-surface-300/50 border-b border-surface-50/20">
                        <th className="text-left py-2 px-3" colSpan={2}>Giocatore</th>
                        {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                          <th className="text-center py-2 px-3 border-l border-surface-50/20 text-accent-400" colSpan={4}>Contratto</th>
                        )}
                        {(dataViewMode === 'stats' || dataViewMode === 'merge') && (
                          <th className="text-center py-2 px-3 border-l border-surface-50/20" colSpan={dataViewMode === 'stats' ? STATS_COLUMNS.length : MERGE_STATS_KEYS.length}>Statistiche</th>
                        )}
                        {dataViewMode === 'contracts' && (
                          <th className="text-center py-2 px-3 border-l border-surface-50/20">Voto</th>
                        )}
                        <th className="text-center py-2 px-3 border-l border-surface-50/20 text-accent-400" colSpan={4}>Strategia</th>
                      </tr>
                      {/* Column headers */}
                      <tr className="micro-label text-gray-500 bg-surface-300/30 border-b border-surface-50/20">
                        <th className="text-center p-2 w-9"></th>
                        <th className="text-left p-2">Nome</th>
                        {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                          <>
                            <th className="text-center p-2 border-l border-surface-50/20" title="Ingaggio">Ing.</th>
                            <th className="text-center p-2" title="Durata (semestri)">Dur.</th>
                            <th className="text-center p-2" title="Clausola rescissoria">Cls</th>
                            <th className="text-center p-2" title="Prezzo rubata">Rub.</th>
                          </>
                        )}
                        {dataViewMode === 'stats' && STATS_COLUMNS.map((col, idx) => (
                          <th key={col.key} className={`text-center p-2 ${idx === 0 ? 'border-l border-surface-50/20' : ''}`} title={col.label}>{col.shortLabel}</th>
                        ))}
                        {dataViewMode === 'merge' && STATS_COLUMNS.filter(c => MERGE_STATS_KEYS.includes(c.key)).map((col, idx) => (
                          <th key={col.key} className={`text-center p-2 ${idx === 0 ? 'border-l border-surface-50/20' : ''}`} title={col.label}>{col.shortLabel}</th>
                        ))}
                        {dataViewMode === 'contracts' && (
                          <th className="text-center p-2 border-l border-surface-50/20" title="Rating medio">Voto</th>
                        )}
                        <th className="text-center p-2 border-l border-surface-50/20">Max bid</th>
                        <th className="text-center p-2">Priorità</th>
                        <th className="text-center p-2">Categoria</th>
                        <th className="text-left p-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlayers.map(player => {
                        const local = getLocalStrategy(player.playerId)
                        const isSaving = savingPlayerIds.has(player.playerId)
                        const isSvincolato = player.type === 'svincolato'
                        const catId = player.preference?.watchlistCategory as WatchlistCategoryId | null
                        const cat = catId ? WATCHLIST_CATEGORIES[catId] : null

                        return (
                          <tr
                            key={player.playerId}
                            className={`border-t border-surface-50/10 transition-colors hover:bg-surface-300/30 ${
                              local.isDirty ? 'shadow-[inset_3px_0_0_theme(colors.accent.500)]' : selectedForCompare.has(player.playerId) ? 'bg-info-500/10' : ''
                            }`}
                          >
                            {/* Compare checkbox + role */}
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedForCompare.has(player.playerId)}
                                onChange={() => { togglePlayerForCompare(player.playerId); }}
                                className="w-4 h-4 rounded bg-surface-300 border-info-500/50 text-info-500 focus:ring-info-500"
                                aria-label={`Seleziona ${player.playerName} per confronto`}
                              />
                            </td>

                            {/* Player */}
                            <td className="p-2">
                              <div className="flex items-center gap-2.5">
                                <RoleBadge position={player.playerPosition} />
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => { openStats(player); }}
                                    className="font-display font-bold text-white text-[13px] truncate hover:text-accent-400 transition-colors text-left"
                                  >
                                    {player.playerName}
                                  </button>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
                                    <span className="w-3.5 h-3.5 flex-shrink-0"><TeamLogo team={player.playerTeam} /></span>
                                    <span className="truncate">{player.playerTeam}</span>
                                    {!isSvincolato && (
                                      player.type === 'myRoster'
                                        ? <span className="text-primary-400">· Mia rosa</span>
                                        : <span className="inline-flex items-center gap-1">· <Monogram name={player.ownerTeamName || player.ownerUsername} size="xs" /></span>
                                    )}
                                    {isSvincolato && <span className="text-secondary-400">· Svincolato</span>}
                                    {player.playerAutoTags && player.playerAutoTags.slice(0, 2).map(tagId => {
                                      const def = AUTO_TAG_DEFS[tagId]
                                      return def ? (
                                        <span key={tagId} className={`font-mono text-[8px] font-bold px-1 py-0.5 rounded border border-surface-50/30 ${def.color}`} title={def.description}>
                                          {def.icon}
                                        </span>
                                      ) : null
                                    })}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Contract columns */}
                            {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                              <>
                                <td className="p-2 text-center border-l border-surface-50/10">
                                  {isSvincolato ? <span className="text-gray-500">-</span> : <span className="stat-number text-sm text-accent-400">{player.contractSalary}</span>}
                                </td>
                                <td className="p-2 text-center">
                                  {isSvincolato ? <span className="text-gray-500">-</span> : <span className="stat-number text-sm text-gray-300">{player.contractDuration}</span>}
                                </td>
                                <td className="p-2 text-center">
                                  {isSvincolato ? <span className="text-gray-500">-</span> : <span className="stat-number text-sm text-passion-400">{player.contractClause}</span>}
                                </td>
                                <td className="p-2 text-center">
                                  {isSvincolato ? <span className="text-gray-500">-</span> : <span className="stat-number text-sm text-warning-400">{player.rubataPrice}</span>}
                                </td>
                              </>
                            )}

                            {/* Stats columns - stats view */}
                            {dataViewMode === 'stats' && STATS_COLUMNS.map((col, idx) => {
                              let rawValue: number | string | null = null
                              const cs = player.playerComputedStats
                              if (col.key === 'appearances') rawValue = cs?.appearances ?? null
                              else if (col.key === 'rating') rawValue = cs?.avgRating ?? null
                              else if (col.key === 'goals') rawValue = cs?.totalGoals ?? null
                              else if (col.key === 'assists') rawValue = cs?.totalAssists ?? null
                              else if (col.key === 'minutes') rawValue = cs?.totalMinutes ?? null
                              else rawValue = col.getValue(player.playerApiFootballStats)
                              const numValue = rawValue != null && rawValue !== '' ? Number(rawValue) : null
                              const formatted = col.format ? col.format(numValue) : (numValue ?? '-')
                              return (
                                <td key={col.key} className={`p-2 text-center ${idx === 0 ? 'border-l border-surface-50/10' : ''}`}>
                                  <span className={`stat-number text-sm ${col.colorClass || 'text-gray-300'}`}>{formatted}</span>
                                </td>
                              )
                            })}

                            {/* Stats columns - merge view */}
                            {dataViewMode === 'merge' && STATS_COLUMNS.filter(c => MERGE_STATS_KEYS.includes(c.key)).map((col, idx) => {
                              const cs = player.playerComputedStats
                              let rawValue: number | string | null = null
                              if (col.key === 'rating') rawValue = cs?.avgRating ?? null
                              else if (col.key === 'goals') rawValue = cs?.totalGoals ?? null
                              else if (col.key === 'assists') rawValue = cs?.totalAssists ?? null
                              else rawValue = col.getValue(player.playerApiFootballStats)
                              const numValue = rawValue != null && rawValue !== '' ? Number(rawValue) : null
                              const formatted = col.format ? col.format(numValue) : (numValue ?? '-')
                              return (
                                <td key={col.key} className={`p-2 text-center ${idx === 0 ? 'border-l border-surface-50/10' : ''}`}>
                                  <span className={`stat-number text-sm ${col.colorClass || 'text-gray-300'}`}>{formatted}</span>
                                </td>
                              )
                            })}

                            {/* Rating column - contracts view */}
                            {dataViewMode === 'contracts' && (
                              <td className="p-2 text-center border-l border-surface-50/10">
                                <span className="stat-number text-sm text-info-400">
                                  {player.playerComputedStats?.avgRating != null ? player.playerComputedStats.avgRating.toFixed(1) : '-'}
                                </span>
                              </td>
                            )}

                            {/* === STRATEGY === */}
                            <td className="p-2 text-center border-l border-surface-50/10">
                              <AmountStepper
                                value={parseInt(local.maxBid) || 0}
                                onChange={(v) => { updateLocalStrategy(player.playerId, 'maxBid', v > 0 ? v.toString() : '') }}
                                min={0}
                                tone="accent"
                                size="sm"
                                disabled={isSaving}
                                aria-label={`Max bid per ${player.playerName}`}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <PriorityStars
                                value={local.priority}
                                onChange={(v) => { updateLocalStrategy(player.playerId, 'priority', v) }}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <CategoryPicker
                                current={cat}
                                open={openCategoryFor === player.playerId}
                                onToggleOpen={() => { setOpenCategoryFor(prev => prev === player.playerId ? null : player.playerId) }}
                                onSelect={(id) => { void setWatchlistCategory(player.playerId, id); setOpenCategoryFor(null) }}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={local.notes}
                                onChange={(e) => { updateLocalStrategy(player.playerId, 'notes', e.target.value); }}
                                placeholder="+ nota"
                                className="w-full min-w-[100px] px-2 py-1 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs focus:border-accent-500 focus:outline-none placeholder:text-gray-500 placeholder:italic"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden space-y-3">
              {filteredPlayers.length === 0 ? (
                <EmptyState
                  compact
                  icon="🔍"
                  title={
                    searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL' || ownerFilter !== 'ALL' || showOnlyWithStrategy
                      ? 'Nessun giocatore con questi filtri'
                      : 'Nessun giocatore disponibile'
                  }
                  description={
                    searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL' || ownerFilter !== 'ALL' || showOnlyWithStrategy
                      ? 'Prova ad allargare i filtri o la ricerca.'
                      : undefined
                  }
                />
              ) : (
                filteredPlayers.map(player => {
                  const local = getLocalStrategy(player.playerId)
                  const isSaving = savingPlayerIds.has(player.playerId)
                  const isSvincolato = player.type === 'svincolato'
                  const catId = player.preference?.watchlistCategory as WatchlistCategoryId | null
                  const cat = catId ? WATCHLIST_CATEGORIES[catId] : null

                  return (
                    <div
                      key={player.playerId}
                      className={`bg-surface-200 rounded-xl p-3 border transition-colors ${
                        local.isDirty ? 'border-accent-500/60' : selectedForCompare.has(player.playerId) ? 'border-info-500/50' : 'border-surface-50/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <input
                          type="checkbox"
                          checked={selectedForCompare.has(player.playerId)}
                          onChange={() => { togglePlayerForCompare(player.playerId); }}
                          className="w-5 h-5 rounded bg-surface-300 border-info-500/50 text-info-500 focus:ring-info-500 flex-shrink-0"
                          aria-label={`Seleziona ${player.playerName} per confronto`}
                        />
                        <RoleBadge position={player.playerPosition} />
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => { openStats(player); }}
                            className="font-display font-bold text-white text-sm truncate hover:text-accent-400 transition-colors text-left block"
                          >
                            {player.playerName}
                          </button>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <span className="w-3.5 h-3.5 flex-shrink-0"><TeamLogo team={player.playerTeam} /></span>
                            <span className="truncate">{player.playerTeam}</span>
                            {player.playerAge != null && <span className={getAgeColor(player.playerAge)}>· {player.playerAge}a</span>}
                            {isSvincolato
                              ? <span className="text-secondary-400">· Svincolato</span>
                              : player.type === 'myRoster'
                                ? <span className="text-primary-400">· Mia rosa</span>
                                : <span className="truncate">· {player.ownerTeamName || player.ownerUsername}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Auto-tags */}
                      {player.playerAutoTags && player.playerAutoTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {player.playerAutoTags.map(tagId => {
                            const def = AUTO_TAG_DEFS[tagId]
                            return def ? (
                              <span key={tagId} className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-surface-50/30 ${def.color}`} title={def.description}>
                                {def.icon} {def.label}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}

                      {/* Contract / stats chips */}
                      {!isSvincolato && (dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                        <div className="grid grid-cols-4 gap-1.5 text-center mb-2">
                          <StatChip label="Ing." value={`${player.contractSalary}`} className="text-accent-400" />
                          <StatChip label="Dur." value={`${player.contractDuration}`} className="text-gray-300" />
                          <StatChip label="Cls" value={`${player.contractClause}`} className="text-passion-400" />
                          <StatChip label="Rub." value={`${player.rubataPrice}`} className="text-warning-400" />
                        </div>
                      )}
                      {(dataViewMode === 'stats' || dataViewMode === 'merge') && (
                        <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                          <StatChip label="Voto" value={player.playerComputedStats?.avgRating != null ? player.playerComputedStats.avgRating.toFixed(1) : '-'} className="text-info-400" />
                          <StatChip label="Gol" value={`${player.playerComputedStats?.totalGoals ?? '-'}`} className="text-secondary-400" />
                          <StatChip label="Ass" value={`${player.playerComputedStats?.totalAssists ?? '-'}`} className="text-primary-400" />
                        </div>
                      )}

                      {/* Strategy */}
                      <div className="bg-surface-300 rounded-lg p-2.5 border border-surface-50/20 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="micro-label text-gray-500">Max</span>
                            <AmountStepper
                              value={parseInt(local.maxBid) || 0}
                              onChange={(v) => { updateLocalStrategy(player.playerId, 'maxBid', v > 0 ? v.toString() : '') }}
                              min={0}
                              tone="accent"
                              size="sm"
                              disabled={isSaving}
                              aria-label={`Max bid per ${player.playerName}`}
                            />
                          </div>
                          <PriorityStars
                            value={local.priority}
                            onChange={(v) => { updateLocalStrategy(player.playerId, 'priority', v) }}
                            large
                          />
                        </div>
                        <input
                          type="text"
                          value={local.notes}
                          onChange={(e) => { updateLocalStrategy(player.playerId, 'notes', e.target.value); }}
                          placeholder="+ nota"
                          className="w-full px-2 py-1.5 bg-surface-200 border border-surface-50/30 rounded-lg text-white text-sm focus:border-accent-500 focus:outline-none placeholder:text-gray-500 placeholder:italic"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {(Object.entries(WATCHLIST_CATEGORIES) as [WatchlistCategoryId, typeof WATCHLIST_CATEGORIES[WatchlistCategoryId]][]).map(([cid, c]) => {
                            const isActive = catId === cid
                            return (
                              <button
                                key={cid}
                                type="button"
                                onClick={() => { void setWatchlistCategory(player.playerId, isActive ? null : cid) }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                                  isActive ? c.color : 'bg-surface-300 text-gray-500 border-surface-50/20 hover:text-gray-300'
                                }`}
                              >
                                {c.icon} {c.label}
                              </button>
                            )
                          })}
                        </div>
                        {cat && (
                          <div className="text-[10px] text-gray-500">
                            Categoria: <span className={`font-medium px-1.5 py-0.5 rounded border ${cat.color}`}>{cat.label}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-1">
              <span className="micro-label text-gray-500">
                {filteredPlayers.length} giocatori · {myStrategiesCount} con strategia impostata
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-accent-400">
                <span className="w-2 h-2 rounded-sm bg-accent-500" aria-hidden="true" />
                modifica non salvata (autosave 2s)
              </span>
            </div>
          </>
        )}
      </main>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => { setSelectedPlayerStats(null); }}
        player={selectedPlayerStats}
      />

      {/* Player Compare Modal (#187) — shared with Rubata live */}
      {showCompareModal && playersToCompare.length >= 2 && (
        <PlayerCompareModal
          isOpen={showCompareModal}
          onClose={() => { setShowCompareModal(false); }}
          players={playersToCompare.map(toBoardPlayer)}
        />
      )}
    </div>
  )
}

// ===== Sub-components (presentation only) =====

function StatChip({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-surface-300 rounded-lg p-1.5">
      <div className="micro-label text-gray-500">{label}</div>
      <div className={`stat-number text-sm ${className}`}>{value}</div>
    </div>
  )
}

function PriorityStars({ value, onChange, large = false }: { value: number; onChange: (v: number) => void; large?: boolean }) {
  const size = large ? 'w-8 h-8 text-xl' : 'w-7 h-7 text-base'
  return (
    <div className="flex items-center justify-center">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => { onChange(value === star ? 0 : star) }}
          className={`${size} flex items-center justify-center transition-colors ${
            value >= star ? 'text-accent-400 hover:text-accent-300' : 'text-gray-600 hover:text-gray-400'
          }`}
          aria-label={`Priorità ${star}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function CategoryPicker({
  current,
  open,
  onToggleOpen,
  onSelect,
}: {
  current: typeof WATCHLIST_CATEGORIES[WatchlistCategoryId] | null
  open: boolean
  onToggleOpen: () => void
  onSelect: (id: WatchlistCategoryId | null) => void
}) {
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onToggleOpen}
        className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${
          current ? current.color : 'bg-surface-300 text-gray-500 border-surface-50/30 hover:text-gray-300'
        }`}
      >
        {current ? `${current.icon} ${current.label}` : '+ categoria'} ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onToggleOpen} aria-hidden="true" />
          <div className="absolute right-0 z-40 mt-1 w-44 bg-surface-100 border border-surface-50/40 rounded-lg shadow-xl py-1">
            <button
              type="button"
              onClick={() => { onSelect(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-surface-50/20"
            >
              Nessuna
            </button>
            {(Object.entries(WATCHLIST_CATEGORIES) as [WatchlistCategoryId, typeof WATCHLIST_CATEGORIES[WatchlistCategoryId]][]).map(([cid, c]) => (
              <button
                key={cid}
                type="button"
                onClick={() => { onSelect(cid) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-surface-50/20"
              >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold border ${c.color}`}>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OverviewSection({
  byCategory,
  topPriority,
  getLocalStrategy,
  onAddPlayers,
  onOpenStats,
}: {
  byCategory: Record<WatchlistCategoryId, DisplayPlayer[]>
  topPriority: DisplayPlayer[]
  getLocalStrategy: (playerId: string) => LocalStrategy
  onAddPlayers: () => void
  onOpenStats: (player: DisplayPlayer) => void
}) {
  return (
    <div className="space-y-4">
      {/* Top priority */}
      <div className="bg-surface-200 rounded-2xl border border-accent-500/30 shadow-[0_0_0_1px_rgba(245,158,11,0.08)] p-4">
        <div className="micro-label text-accent-400 mb-3">★ Top priorità · i tuoi 3 obiettivi</div>
        {topPriority.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Nessun giocatore con priorità impostata. Assegna delle stelle dalle viste giocatori.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {topPriority.map((player, idx) => {
              const local = getLocalStrategy(player.playerId)
              return (
                <button
                  key={player.playerId}
                  type="button"
                  onClick={() => { onOpenStats(player); }}
                  className="flex items-center gap-2.5 bg-surface-300 border border-surface-50/20 rounded-xl p-2.5 text-left hover:border-accent-500/40 transition-colors"
                >
                  <span className="budget-display text-2xl text-accent-400 w-6 text-center flex-shrink-0">{idx + 1}</span>
                  <RoleBadge position={player.playerPosition} />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[13px] text-white truncate">{player.playerName}</div>
                    <div className="text-[10.5px] text-gray-500 flex items-center gap-1.5">
                      <span className="truncate">{player.playerTeam}</span>· <StarRating value={local.priority} />
                    </div>
                  </div>
                  {local.maxBid && (
                    <div className="text-right flex-shrink-0">
                      <div className="micro-label text-gray-500">Max bid</div>
                      <div className="budget-display text-lg text-accent-400">{local.maxBid}M</div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Object.entries(WATCHLIST_CATEGORIES) as [WatchlistCategoryId, typeof WATCHLIST_CATEGORIES[WatchlistCategoryId]][]).map(([catId, cat]) => {
          const players = byCategory[catId]
          return (
            <div key={catId} className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-surface-50/20">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-display font-bold border ${cat.color}`}>{cat.icon}</span>
                <span className="font-display font-bold text-[13.5px] text-white">{cat.label}</span>
                <span className="ml-auto font-mono text-[10.5px] text-gray-500">{players.length}</span>
              </div>
              {players.length === 0 ? (
                <p className="px-4 py-5 text-center text-[11.5px] text-gray-500 italic">Nessun giocatore in questa categoria</p>
              ) : (
                <div>
                  {players.map(player => {
                    const local = getLocalStrategy(player.playerId)
                    return (
                      <button
                        key={player.playerId}
                        type="button"
                        onClick={() => { onOpenStats(player); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 border-b border-surface-50/10 last:border-b-0 text-left hover:bg-surface-300/40 transition-colors"
                      >
                        <RoleBadge position={player.playerPosition} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-semibold text-[12.5px] text-white truncate">{player.playerName}</div>
                          <div className="text-[10.5px] text-gray-500 flex items-center gap-1.5">
                            <span className="truncate">{player.playerTeam}</span>
                            {local.priority > 0 && <>· <StarRating value={local.priority} /></>}
                          </div>
                        </div>
                        <span className="stat-number text-sm text-accent-400 flex-shrink-0">{local.maxBid ? `${local.maxBid}M` : '—'}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Add players CTA */}
        <button
          type="button"
          onClick={onAddPlayers}
          className="bg-surface-200/50 rounded-2xl border border-dashed border-surface-50/30 flex flex-col items-center justify-center p-6 text-center hover:border-accent-500/40 hover:bg-surface-200 transition-colors min-h-[120px]"
        >
          <span className="font-display font-semibold text-sm text-gray-300">+ Aggiungi giocatori</span>
          <span className="text-[10.5px] text-gray-500 mt-1">dalle viste Svincolati / Altre rose</span>
        </button>
      </div>
    </div>
  )
}

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { rubataApi, leagueApi } from '../services/api'
import type { PlayerInfo } from '../components/PlayerStatsModal'
import type {
  StrategiesData,
  SvincolatiData,
  ViewMode,
  DataViewMode,
  SortMode,
  SortField,
  SortDirection,
  LocalStrategy,
  DisplayPlayer,
  StrategyPlayerWithPreference,
  SvincolatoPlayerWithPreference,
} from '../types/strategierubata.types'

export function useStrategieRubataState(leagueId: string | undefined) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savingPlayerIds, setSavingPlayerIds] = useState<Set<string>>(new Set())
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  const [strategiesData, setStrategiesData] = useState<StrategiesData | null>(null)
  const [svincolatiData, setSvincolatiData] = useState<SvincolatiData | null>(null)

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
                    watchlistCategory: p.preference?.watchlistCategory || null,
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

  // Set watchlist category for a player (immediate save, no debounce) (#219)
  const setWatchlistCategory = useCallback(async (playerId: string, category: string | null) => {
    if (!leagueId) return
    setSavingPlayerIds(prev => new Set(prev).add(playerId))
    try {
      await rubataApi.setPreference(leagueId, playerId, {
        watchlistCategory: category,
        isWatchlist: category !== null,
      })
      // Optimistic update for both datasets
      const updatePlayer = (p: StrategyPlayerWithPreference | SvincolatoPlayerWithPreference) => {
        if (p.playerId !== playerId) return p
        return {
          ...p,
          preference: {
            id: p.preference?.id || 'temp',
            playerId,
            memberId: strategiesData?.myMemberId || '',
            maxBid: p.preference?.maxBid ?? null,
            priority: p.preference?.priority ?? null,
            notes: p.preference?.notes ?? null,
            isWatchlist: category !== null,
            isAutoPass: p.preference?.isAutoPass ?? false,
            watchlistCategory: category,
          }
        }
      }
      setStrategiesData(prev => prev ? { ...prev, players: prev.players.map(updatePlayer) } : prev)
      setSvincolatiData(prev => prev ? { ...prev, players: prev.players.map(updatePlayer) } : prev)
    } catch {
      console.error('Error setting watchlist category for', playerId)
    } finally {
      setSavingPlayerIds(prev => { const next = new Set(prev); next.delete(playerId); return next })
    }
  }, [leagueId, strategiesData?.myMemberId])

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

  return {
    // Loading / messages
    loading,
    error,
    success,
    savingPlayerIds,
    isLeagueAdmin,

    // Data
    strategiesData,
    svincolatiData,
    myMemberId,

    // View mode
    viewMode,
    setViewMode,
    dataViewMode,
    setDataViewMode,

    // Filters
    positionFilter,
    setPositionFilter,
    searchQuery,
    setSearchQuery,
    showOnlyWithStrategy,
    setShowOnlyWithStrategy,
    ownerFilter,
    setOwnerFilter,
    teamFilter,
    setTeamFilter,

    // Sort
    sortMode,
    setSortMode,
    sortField,
    sortDirection,
    handleSort,

    // Player stats modal
    selectedPlayerStats,
    setSelectedPlayerStats,

    // Compare
    selectedForCompare,
    showCompareModal,
    setShowCompareModal,
    togglePlayerForCompare,
    clearComparison,

    // Local strategies
    getLocalStrategy,
    updateLocalStrategy,
    setWatchlistCategory,

    // Derived
    uniqueOwners,
    uniqueTeams,
    filteredPlayers,
    playersToCompare,
    myStrategiesCount,
  }
}

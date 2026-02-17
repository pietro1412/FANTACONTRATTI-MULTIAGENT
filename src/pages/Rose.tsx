import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_COLORS } from '../components/ui/PositionBadge'
import { BottomSheet } from '../components/ui/BottomSheet'
import { PlayerStatsModal, type PlayerInfo, type PlayerStats } from '../components/PlayerStatsModal'
import { SlidersHorizontal, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { SkeletonPlayerRow } from '../components/ui/Skeleton'
import { ShareButton } from '../components/ShareButton'

interface RoseProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

// Computed stats from PlayerMatchRating (accurate data)
interface ComputedSeasonStats {
  season: string
  appearances: number
  totalMinutes: number
  avgRating: number | null
  totalGoals: number
  totalAssists: number
  startingXI: number
  matchesInSquad: number
}

interface Player {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  apiFootballId?: number | null
  apiFootballStats?: PlayerStats | null
  computedStats?: ComputedSeasonStats | null
  statsSyncedAt?: string | null
}

interface RosterEntry {
  id: string
  playerId: string
  acquisitionPrice: number
  acquisitionType: string
  player: Player
  contract?: {
    id: string
    salary: number
    duration: number
    rescissionClause: number | null
    signedAt: string
  } | null
}

interface Member {
  id: string
  userId: string
  role: 'ADMIN' | 'MEMBER'
  teamName: string | null
  currentBudget: number
  user: {
    username: string
  }
  roster: RosterEntry[]
}

interface LeagueData {
  id: string
  name: string
  members: Member[]
  currentUserId: string
  inContrattiPhase?: boolean
  isAdmin?: boolean
}

const DURATION_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  2: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' },
  3: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' },
  4: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' },
}

// Team logo component
function TeamLogo({ team, size = 'sm' }: { team: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <div className={`${sizeClass} bg-white rounded p-0.5 flex-shrink-0`}>
      <img
        src={getTeamLogo(team)}
        alt={team}
        className="w-full h-full object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    </div>
  )
}

export function Rose({ onNavigate }: RoseProps) {
  const { leagueId } = useParams<{ leagueId: string }>()

  const [loading, setLoading] = useState(true)
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  // Filters
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('ALL')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('position')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rose-sidebar-collapsed') === 'true'
    }
    return false
  })
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('rose-sidebar-collapsed', String(next))
      return next
    })
  }, [])

  // Stats modal
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    if (!leagueId) return
    setLoading(true)

    try {
      const res = await leagueApi.getAllRosters(leagueId)
      if (res.success && res.data) {
        const data = res.data as LeagueData
        setLeagueData(data)
        setIsLeagueAdmin(data.isAdmin || false)

        // Default to current user's member
        const myMember = data.members.find(m => m.userId === data.currentUserId)
        if (myMember) {
          setSelectedMemberId(myMember.id)
        } else if (data.members.length > 0 && data.members[0]) {
          setSelectedMemberId(data.members[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading rosters:', err)
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Get selected member
  const selectedMember = useMemo(() => {
    return leagueData?.members.find(m => m.id === selectedMemberId) || null
  }, [leagueData, selectedMemberId])

  // Check if viewing own roster
  const isOwnRoster = useMemo(() => {
    if (!leagueData || !selectedMember) return false
    return selectedMember.userId === leagueData.currentUserId
  }, [leagueData, selectedMember])

  // Get unique teams for filter
  const uniqueTeams = useMemo(() => {
    if (!selectedMember?.roster) return []
    const teams = new Set(selectedMember.roster.map(r => r.player.team))
    return Array.from(teams).sort()
  }, [selectedMember])

  // Filtered and sorted players
  const filteredPlayers = useMemo(() => {
    if (!selectedMember?.roster) return []

    let players = selectedMember.roster.filter(entry => {
      // Position filter
      if (positionFilter !== 'ALL' && entry.player.position !== positionFilter) return false

      // Team filter
      if (teamFilter !== 'ALL' && entry.player.team !== teamFilter) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!entry.player.name.toLowerCase().includes(query) &&
            !entry.player.team.toLowerCase().includes(query)) {
          return false
        }
      }

      return true
    })

    // Sort by selected column
    const posOrder: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 }
    const dir = sortDirection === 'asc' ? 1 : -1

    players.sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case 'position': {
          const posA = posOrder[a.player.position] ?? 99
          const posB = posOrder[b.player.position] ?? 99
          cmp = posA - posB
          if (cmp === 0) cmp = a.player.name.localeCompare(b.player.name)
          break
        }
        case 'name':
          cmp = a.player.name.localeCompare(b.player.name)
          break
        case 'team':
          cmp = a.player.team.localeCompare(b.player.team)
          break
        case 'appearances':
          cmp = (a.player.computedStats?.appearances ?? 0) - (b.player.computedStats?.appearances ?? 0)
          break
        case 'goals':
          cmp = (a.player.computedStats?.totalGoals ?? 0) - (b.player.computedStats?.totalGoals ?? 0)
          break
        case 'assists':
          cmp = (a.player.computedStats?.totalAssists ?? 0) - (b.player.computedStats?.totalAssists ?? 0)
          break
        case 'rating':
          cmp = (a.player.computedStats?.avgRating ?? 0) - (b.player.computedStats?.avgRating ?? 0)
          break
        case 'salary':
          cmp = (a.contract?.salary ?? 0) - (b.contract?.salary ?? 0)
          break
        case 'duration':
          cmp = (a.contract?.duration ?? 0) - (b.contract?.duration ?? 0)
          break
        case 'clause':
          cmp = (a.contract?.rescissionClause ?? 0) - (b.contract?.rescissionClause ?? 0)
          break
        case 'rubata': {
          const rubA = a.contract?.rescissionClause != null ? (a.contract.rescissionClause + a.contract.salary) : 0
          const rubB = b.contract?.rescissionClause != null ? (b.contract.rescissionClause + b.contract.salary) : 0
          cmp = rubA - rubB
          break
        }
        default: {
          const posA2 = posOrder[a.player.position] ?? 99
          const posB2 = posOrder[b.player.position] ?? 99
          cmp = posA2 - posB2
        }
      }
      return cmp * dir
    })

    return players
  }, [selectedMember, positionFilter, teamFilter, searchQuery, sortColumn, sortDirection])

  // Stats
  const stats = useMemo(() => {
    if (!selectedMember?.roster) return { total: 0, salary: 0, byPosition: { P: 0, D: 0, C: 0, A: 0 } }

    const roster = selectedMember.roster
    return {
      total: roster.length,
      salary: roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0),
      byPosition: {
        P: roster.filter(r => r.player.position === 'P').length,
        D: roster.filter(r => r.player.position === 'D').length,
        C: roster.filter(r => r.player.position === 'C').length,
        A: roster.filter(r => r.player.position === 'A').length,
      }
    }
  }, [selectedMember])

  // Team counts for sidebar
  const teamCounts = useMemo(() => {
    if (!selectedMember?.roster) return []
    const counts: Record<string, number> = {}
    for (const entry of selectedMember.roster) {
      counts[entry.player.team] = (counts[entry.player.team] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([team, count]) => ({ team, count }))
  }, [selectedMember])

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="rose" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <main className="max-w-[1600px] mx-auto px-4 py-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonPlayerRow key={i} />
          ))}
        </main>
      </div>
    )
  }

  if (!leagueData) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="rose" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <main className="max-w-[1600px] mx-auto px-4 py-8">
          <div className="text-center text-gray-400 py-20">
            Errore nel caricamento delle rose
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-6">
      <Navigation
        currentPage="rose"
        leagueId={leagueId}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 mb-2">
              <span className="text-2xl">📋</span>
              Rose
            </h1>
            <p className="text-gray-400 text-sm">
              Visualizza le rose di tutti i Direttori Generali della lega.
            </p>
          </div>
          <ShareButton title="Rose" text="Rose della lega" compact />
        </div>

        {/* Warning for contracts phase */}
        {leagueData.inContrattiPhase && !isOwnRoster && (
          <div className="mb-4 p-3 bg-warning-500/10 border border-warning-500/30 rounded-xl text-sm">
            <p className="text-warning-400">
              <strong>Fase CONTRATTI attiva:</strong> I dettagli dei contratti degli altri manager sono nascosti.
            </p>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Table Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              {/* Manager Selector Row */}
              <div className="p-3 border-b border-surface-50/20 bg-surface-300/30">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-400 whitespace-nowrap">Seleziona Manager:</label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => {
                      setSelectedMemberId(e.target.value)
                      setTeamFilter('ALL')
                    }}
                    className="flex-1 max-w-md px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {leagueData.members
                      .filter(m => m.roster.length > 0 || m.currentBudget > 0)
                      .sort((a, b) => {
                        // Current user first
                        if (a.userId === leagueData.currentUserId) return -1
                        if (b.userId === leagueData.currentUserId) return 1
                        return (a.teamName || a.user.username).localeCompare(b.teamName || b.user.username)
                      })
                      .map(m => {
                        const isMe = m.userId === leagueData.currentUserId
                        const displayName = m.teamName
                          ? `${m.teamName} (${m.user.username})`
                          : m.user.username
                        return (
                          <option key={m.id} value={m.id}>
                            {isMe ? '⭐ ' : ''}{displayName}{isMe ? ' - LA MIA ROSA' : ''}
                          </option>
                        )
                      })
                    }
                  </select>
                  {isOwnRoster && (
                    <span className="px-2 py-1 text-xs font-medium bg-primary-500/20 text-primary-400 rounded-full whitespace-nowrap">
                      LA MIA ROSA
                    </span>
                  )}
                </div>
              </div>

              {/* Filters Row — Mobile: compact search + Filtri button */}
              <div className="p-3 border-b border-surface-50/20 bg-surface-300/20">
                {/* Mobile compact */}
                <div className="flex gap-2 items-center md:hidden">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca giocatore..."
                    className="flex-1 min-w-0 px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    inputMode="search"
                    enterKeyHint="search"
                  />
                  <button
                    onClick={() => setFiltersOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-xs text-gray-300 hover:text-white transition-colors flex-shrink-0"
                  >
                    <SlidersHorizontal size={14} />
                    Filtri{(positionFilter !== 'ALL' || teamFilter !== 'ALL') && (
                      <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary-500/30 text-primary-400 rounded-full">
                        {[positionFilter !== 'ALL', teamFilter !== 'ALL'].filter(Boolean).length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Desktop: full inline filters */}
                <div className="hidden md:flex flex-wrap gap-2 items-center">
                  {/* Position Filter */}
                  <div className="flex gap-1">
                    {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                      const colors = POSITION_COLORS[pos]
                      return (
                        <button
                          key={pos}
                          onClick={() => setPositionFilter(pos)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                            positionFilter === pos
                              ? pos === 'ALL'
                                ? 'bg-white/20 text-white'
                                : `${colors?.bg} ${colors?.text}`
                              : 'bg-surface-300 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {pos === 'ALL' ? 'Tutti' : pos}
                        </button>
                      )
                    })}
                  </div>

                  {/* Team Filter */}
                  {uniqueTeams.length > 0 && (
                    <select
                      value={teamFilter}
                      onChange={(e) => setTeamFilter(e.target.value)}
                      className="px-2 py-1 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    >
                      <option value="ALL">Tutte le squadre</option>
                      {uniqueTeams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  )}

                  {/* Search */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca giocatore..."
                    className="flex-1 min-w-[120px] px-2 py-1 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    inputMode="search"
                    enterKeyHint="search"
                  />
                </div>
                {/* Duration color legend */}
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-2 flex-wrap">
                  <span>Durata:</span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-red-500 to-red-600" />
                    1 sem
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-yellow-500 to-yellow-600" />
                    2 sem
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-green-500 to-green-600" />
                    3 sem
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-blue-600" />
                    4+ sem
                  </span>
                </div>
              </div>

              {/* Mobile Filters BottomSheet */}
              <BottomSheet isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtri">
                <div className="p-4 space-y-5">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Posizione</label>
                    <div className="flex gap-2">
                      {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                        const colors = POSITION_COLORS[pos]
                        return (
                          <button
                            key={pos}
                            onClick={() => setPositionFilter(pos)}
                            className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                              positionFilter === pos
                                ? pos === 'ALL'
                                  ? 'bg-white/20 text-white'
                                  : `${colors?.bg} ${colors?.text}`
                                : 'bg-surface-300 text-gray-500'
                            }`}
                          >
                            {pos === 'ALL' ? 'Tutti' : pos}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {uniqueTeams.length > 0 && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Squadra Serie A</label>
                      <select
                        value={teamFilter}
                        onChange={(e) => setTeamFilter(e.target.value)}
                        className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm"
                      >
                        <option value="ALL">Tutte le squadre</option>
                        {uniqueTeams.map(team => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={() => setFiltersOpen(false)}
                    className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
                  >
                    Applica Filtri
                  </button>
                </div>
              </BottomSheet>

              {/* Stats Bar */}
              {selectedMember && (
                <div className="p-3 border-b border-surface-50/20 bg-surface-300/20">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {/* Position counts */}
                    <div className="flex items-center gap-3">
                      <span className="text-amber-400 font-medium">P: {stats.byPosition.P}</span>
                      <span className="text-blue-400 font-medium">D: {stats.byPosition.D}</span>
                      <span className="text-emerald-400 font-medium">C: {stats.byPosition.C}</span>
                      <span className="text-red-400 font-medium">A: {stats.byPosition.A}</span>
                    </div>

                    <div className="w-px h-4 bg-surface-50/30" />

                    {/* Stats */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Budget:</span>
                        <span className="text-accent-400 font-bold">{selectedMember.currentBudget}M</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Ingaggi:</span>
                        <span className="text-warning-400 font-bold">{stats.salary}M</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-2 p-3">
                {filteredPlayers.map(entry => {
                  const defaultPosColor = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' }
                  const posColors = POSITION_COLORS[entry.player.position] ?? defaultPosColor
                  const defaultDurColor = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' }
                  const durColors = entry.contract ? (DURATION_COLORS[entry.contract.duration] ?? defaultDurColor) : null
                  const clause = entry.contract?.rescissionClause ?? null
                  const rubata = clause !== null && entry.contract ? clause + entry.contract.salary : null

                  return (
                    <div key={entry.id} className="bg-surface-300/30 rounded-lg p-3 border border-surface-50/10">
                      {/* Header: Position + Player + Team */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                          {entry.player.position}
                        </div>
                        <div className="flex-1 min-w-0 leading-tight">
                          <button
                            onClick={() => setSelectedPlayerStats({
                              name: entry.player.name,
                              team: entry.player.team,
                              position: entry.player.position,
                              quotation: entry.player.quotation,
                              apiFootballId: entry.player.apiFootballId,
                              computedStats: entry.player.computedStats,
                              statsSyncedAt: entry.player.statsSyncedAt,
                            })}
                            className="font-medium text-white text-sm truncate block hover:text-primary-400 transition-colors text-left w-full"
                          >
                            {entry.player.name}
                          </button>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <TeamLogo team={entry.player.team} size="sm" />
                            <span className="truncate">{entry.player.team}</span>
                            {entry.player.computedStats && entry.player.computedStats.appearances > 0 && (
                              <span className="ml-auto text-[10px] text-gray-500">
                                {entry.player.computedStats.appearances}P {entry.player.computedStats.totalGoals}G {entry.player.computedStats.totalAssists}A
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Contract Details Grid */}
                      {entry.contract && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Ing</div>
                            <div className="text-accent-400 font-medium">{entry.contract.salary}M</div>
                          </div>
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Dur</div>
                            <div className={`${durColors?.text || 'text-gray-400'} font-medium`}>{entry.contract.duration}s</div>
                          </div>
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Cls</div>
                            <div className="text-orange-400 font-medium">{clause ?? '-'}M</div>
                          </div>
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Rub</div>
                            <div className="text-warning-400 font-bold">{rubata ?? '-'}M</div>
                          </div>
                        </div>
                      )}
                      {!entry.contract && (
                        <div className="text-center text-gray-500 text-xs py-1">Nessun contratto</div>
                      )}
                    </div>
                  )
                })}
                {filteredPlayers.length === 0 && (
                  <div className="text-center py-12 px-4">
                    {selectedMember?.roster.length === 0 ? (
                      <div className="space-y-4">
                        <div className="w-16 h-16 rounded-full bg-surface-300 flex items-center justify-center mx-auto">
                          <span className="text-3xl">📋</span>
                        </div>
                        <div>
                          <p className="text-gray-300 font-semibold text-base">Rosa vuota</p>
                          <p className="text-gray-500 text-sm mt-1">
                            {isOwnRoster
                              ? 'Non hai ancora acquistato giocatori. Partecipa a un\'asta per costruire la tua squadra!'
                              : 'Questo manager non ha ancora acquistato giocatori.'
                            }
                          </p>
                        </div>
                        {isOwnRoster && leagueId && (
                          <button
                            onClick={() => onNavigate('league-detail', { leagueId })}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium text-sm transition-colors"
                          >
                            <span>⚡</span>
                            Vai alla Lega
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-gray-500">Nessun giocatore trovato con i filtri selezionati</p>
                        <button
                          onClick={() => { setPositionFilter('ALL'); setTeamFilter('ALL'); setSearchQuery('') }}
                          className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                        >
                          Resetta filtri
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm table-fixed">
                  <thead className="bg-surface-300/50">
                    <tr className="text-xs text-gray-400 uppercase">
                      {[
                        { key: 'position', label: 'R', width: 'w-12', align: 'text-center', color: '' },
                        { key: 'name', label: 'Giocatore', width: 'w-auto', align: 'text-left', color: '' },
                        { key: 'team', label: 'Squadra', width: 'w-36', align: 'text-left', color: '' },
                        { key: 'appearances', label: 'Pr', width: 'w-10', align: 'text-center', color: '', title: 'Presenze' },
                        { key: 'goals', label: 'G', width: 'w-10', align: 'text-center', color: '', title: 'Gol' },
                        { key: 'assists', label: 'A', width: 'w-10', align: 'text-center', color: '', title: 'Assist' },
                        { key: 'rating', label: 'Vt', width: 'w-12', align: 'text-center', color: '', title: 'Rating' },
                        { key: 'salary', label: 'Ing', width: 'w-16', align: 'text-center', color: 'text-accent-400' },
                        { key: 'duration', label: 'Dur', width: 'w-14', align: 'text-center', color: '' },
                        { key: 'clause', label: 'Cls', width: 'w-16', align: 'text-center', color: 'text-orange-400' },
                        { key: 'rubata', label: 'Rub', width: 'w-16', align: 'text-center', color: 'text-warning-400' },
                      ].map(col => (
                        <th
                          key={col.key}
                          scope="col"
                          className={`${col.width} ${col.align} p-2 ${col.color} cursor-pointer select-none hover:text-gray-200 transition-colors`}
                          title={col.title || col.label}
                          onClick={() => handleSort(col.key)}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {col.label}
                            {sortColumn === col.key && (
                              <span className="text-primary-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map(entry => {
                      const defaultPosColor = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' }
                      const posColors = POSITION_COLORS[entry.player.position] ?? defaultPosColor
                      const defaultDurColor = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' }
                      const durColors = entry.contract ? (DURATION_COLORS[entry.contract.duration] ?? defaultDurColor) : null
                      const clause = entry.contract?.rescissionClause ?? null
                      const rubata = clause !== null && entry.contract ? clause + entry.contract.salary : null

                      return (
                        <tr
                          key={entry.id}
                          className="border-t border-surface-50/10 hover:bg-surface-300/30 transition-colors"
                        >
                          {/* Position */}
                          <td className="p-2 text-center">
                            <div className={`w-8 h-8 mx-auto rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-xs font-bold`}>
                              {entry.player.position}
                            </div>
                          </td>

                          {/* Player */}
                          <td className="p-2">
                            <button
                              onClick={() => setSelectedPlayerStats({
                                name: entry.player.name,
                                team: entry.player.team,
                                position: entry.player.position,
                                quotation: entry.player.quotation,
                                apiFootballId: entry.player.apiFootballId,
                                computedStats: entry.player.computedStats,
                                statsSyncedAt: entry.player.statsSyncedAt,
                              })}
                              className="font-medium text-white text-sm truncate block hover:text-primary-400 transition-colors text-left"
                            >
                              {entry.player.name}
                            </button>
                          </td>

                          {/* Team */}
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <TeamLogo team={entry.player.team} />
                              <span className="text-gray-400 text-sm truncate">{entry.player.team}</span>
                            </div>
                          </td>

                          {/* Stats columns - using computedStats from PlayerMatchRating */}
                          <td className="p-2 text-center">
                            <span className="text-gray-400 text-xs">{entry.player.computedStats?.appearances ?? '-'}</span>
                          </td>
                          <td className="p-2 text-center">
                            <span className="text-gray-400 text-xs">{entry.player.computedStats?.totalGoals ?? '-'}</span>
                          </td>
                          <td className="p-2 text-center">
                            <span className="text-gray-400 text-xs">{entry.player.computedStats?.totalAssists ?? '-'}</span>
                          </td>
                          <td className="p-2 text-center">
                            <span className="text-gray-400 text-xs">
                              {entry.player.computedStats?.avgRating != null
                                ? entry.player.computedStats.avgRating.toFixed(1)
                                : '-'}
                            </span>
                          </td>

                          {/* Ingaggio */}
                          <td className="p-2 text-center">
                            {entry.contract ? (
                              <span className="text-accent-400 font-medium">{entry.contract.salary}M</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Durata */}
                          <td className="p-2 text-center">
                            {entry.contract && durColors ? (
                              <span className={`${durColors.text} font-medium`}>{entry.contract.duration}s</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Clausola */}
                          <td className="p-2 text-center">
                            {clause !== null ? (
                              <span className="text-orange-400 font-medium">{clause}M</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Rubata */}
                          <td className="p-2 text-center">
                            {rubata !== null ? (
                              <span className="text-warning-400 font-bold">{rubata}M</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filteredPlayers.length === 0 && (
                  <div className="text-center py-16 px-4">
                    {selectedMember?.roster.length === 0 ? (
                      <div className="space-y-4">
                        <div className="w-20 h-20 rounded-full bg-surface-300 flex items-center justify-center mx-auto">
                          <span className="text-4xl">📋</span>
                        </div>
                        <div>
                          <p className="text-gray-300 font-semibold text-lg">Rosa vuota</p>
                          <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                            {isOwnRoster
                              ? 'Non hai ancora acquistato giocatori. Partecipa a un\'asta per costruire la tua squadra!'
                              : 'Questo manager non ha ancora acquistato giocatori.'
                            }
                          </p>
                        </div>
                        {isOwnRoster && leagueId && (
                          <button
                            onClick={() => onNavigate('league-detail', { leagueId })}
                            className="inline-flex items-center gap-2 px-5 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
                          >
                            <span>⚡</span>
                            Vai alla Lega
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-gray-500">Nessun giocatore trovato con i filtri selezionati</p>
                        <button
                          onClick={() => { setPositionFilter('ALL'); setTeamFilter('ALL'); setSearchQuery('') }}
                          className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                        >
                          Resetta filtri
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-surface-50/20 bg-surface-300/20 text-xs text-gray-500 flex justify-between">
                <span>{filteredPlayers.length} di {selectedMember?.roster.length || 0} giocatori</span>
                <span>Totale rosa: {stats.total}</span>
              </div>
            </div>
          </div>

          {/* Sidebar - Team Distribution (collapsible on desktop) */}
          <div className={`flex-shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'xl:w-14' : 'xl:w-72'}`}>
            <div className="xl:sticky xl:top-4 space-y-4">
              {/* Toggle button - visible only on xl */}
              <button
                onClick={toggleSidebar}
                className="hidden xl:flex items-center justify-center w-full p-2 bg-surface-200 rounded-xl border border-surface-50/20 text-gray-400 hover:text-white transition-colors"
                title={sidebarCollapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
                aria-label={sidebarCollapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
              >
                {sidebarCollapsed ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
              </button>

              {/* Team Counts */}
              {teamCounts.length > 0 && (
                <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
                  {!sidebarCollapsed && (
                    <div className="p-3 border-b border-surface-50/20 bg-surface-300/30">
                      <h2 className="font-bold text-gray-300 text-sm flex items-center gap-2">
                        <span>🏟️</span>
                        Giocatori per Squadra
                      </h2>
                    </div>
                  )}
                  <div className="p-2">
                    {sidebarCollapsed ? (
                      /* Collapsed: only logos with count */
                      <div className="flex flex-col gap-1.5 items-center">
                        {teamCounts.map(({ team, count }) => (
                          <button
                            key={team}
                            onClick={() => setTeamFilter(teamFilter === team ? 'ALL' : team)}
                            className={`relative rounded-lg p-1 transition-all ${
                              teamFilter === team
                                ? 'bg-primary-500/30 ring-1 ring-primary-500/50'
                                : 'hover:bg-surface-50/20'
                            }`}
                            title={`${team}: ${count}`}
                          >
                            <TeamLogo team={team} />
                            <span className="absolute -top-1 -right-1 text-[9px] font-bold text-white bg-surface-300 rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* Expanded: full chips */
                      <div className="flex flex-wrap gap-2 p-1">
                        {teamCounts.map(({ team, count }) => (
                          <button
                            key={team}
                            onClick={() => setTeamFilter(teamFilter === team ? 'ALL' : team)}
                            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-all ${
                              teamFilter === team
                                ? 'bg-primary-500/30 border border-primary-500/50'
                                : 'bg-surface-300 hover:bg-surface-50/20'
                            }`}
                          >
                            <TeamLogo team={team} />
                            <span className="text-xs text-gray-400 max-w-[60px] truncate">{team}</span>
                            <span className="text-xs font-bold text-white">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Stats Card */}
              {selectedMember && !sidebarCollapsed && (
                <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
                  <div className="p-3 border-b border-surface-50/20 bg-surface-300/30">
                    <h2 className="font-bold text-gray-300 text-sm flex items-center gap-2">
                      <span>📊</span>
                      Riepilogo
                    </h2>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Manager</span>
                      <span className="text-white font-medium text-sm truncate max-w-[120px]">
                        {selectedMember.user.username}
                      </span>
                    </div>
                    {selectedMember.teamName && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Team</span>
                        <span className="text-gray-300 text-sm truncate max-w-[120px]">
                          {selectedMember.teamName}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-surface-50/20 pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Budget</span>
                        <span className="text-accent-400 font-bold">{selectedMember.currentBudget}M</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Tot. Ingaggi</span>
                        <span className="text-warning-400 font-bold">{stats.salary}M</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsed stats - icons only */}
              {selectedMember && sidebarCollapsed && (
                <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-2 space-y-2 text-center">
                  <div title={`Budget: ${selectedMember.currentBudget}M`}>
                    <div className="text-[10px] text-gray-500">Bdg</div>
                    <div className="text-xs text-accent-400 font-bold">{selectedMember.currentBudget}</div>
                  </div>
                  <div title={`Ingaggi: ${stats.salary}M`}>
                    <div className="text-[10px] text-gray-500">Ing</div>
                    <div className="text-xs text-warning-400 font-bold">{stats.salary}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => setSelectedPlayerStats(null)}
        player={selectedPlayerStats}
      />
    </div>
  )
}

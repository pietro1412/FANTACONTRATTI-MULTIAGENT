import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { leagueApi } from '@/services/api'
import { Navigation } from '@/components/Navigation'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { ErrorState } from '@/components/ui/ErrorState'
import { PlayerStatsModal, type PlayerInfo } from '@/components/PlayerStatsModal'
import { SkeletonPlayerRow } from '@/components/ui/Skeleton'
import { ShareButton } from '@/components/ShareButton'
import { getTeamLogo } from '@/utils/teamLogos'
import { POSITION_FILTER_COLORS } from '@/components/ui/PositionBadge'
import { ManagerStrip, type ManagerStripMember } from '@/components/players/ManagerStrip'
import { RosterFilters } from '@/components/players/RosterFilters'
import { RosterTableRow } from '@/components/players/RosterTableRow'
import { RosterPlayerCard } from '@/components/players/RosterPlayerCard'
import { RosterSidebar } from '@/components/players/RosterSidebar'
import type { RosterEntry } from '@/components/players/types'
import { SlidersHorizontal } from 'lucide-react'

interface RoseProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
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

type SortColumn = 'position' | 'salary' | 'clause' | 'rubata' | 'appearances' | 'goals' | 'assists' | 'rating'

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
  const [sortColumn, setSortColumn] = useState<SortColumn>('position')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Stats modal
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)

  const openPlayerStats = useCallback((entry: RosterEntry) => {
    setSelectedPlayerStats({
      name: entry.player.name,
      team: entry.player.team,
      position: entry.player.position,
      quotation: entry.player.quotation,
      apiFootballId: entry.player.apiFootballId,
      computedStats: entry.player.computedStats,
      statsSyncedAt: entry.player.statsSyncedAt,
    })
  }, [])

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
    } catch {
      // Errore di caricamento: gestito dallo stato di errore (leagueData resta null)
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => {
    void loadData()
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

  // Members available in the avatar-strip (own roster first, then alphabetical)
  const stripMembers = useMemo<ManagerStripMember[]>(() => {
    if (!leagueData) return []
    return leagueData.members
      .filter(m => m.roster.length > 0 || m.currentBudget > 0)
      .sort((a, b) => {
        if (a.userId === leagueData.currentUserId) return -1
        if (b.userId === leagueData.currentUserId) return 1
        return (a.teamName || a.user.username).localeCompare(b.teamName || b.user.username)
      })
      .map(m => ({
        id: m.id,
        userId: m.userId,
        displayName: m.teamName || m.user.username,
        isMe: m.userId === leagueData.currentUserId,
      }))
  }, [leagueData])

  // Get unique teams for filter
  const uniqueTeams = useMemo(() => {
    if (!selectedMember?.roster) return []
    const teams = new Set(selectedMember.roster.map(r => r.player.team))
    return Array.from(teams).sort()
  }, [selectedMember])

  // Filtered and sorted players
  const filteredPlayers = useMemo(() => {
    if (!selectedMember?.roster) return []

    const players = selectedMember.roster.filter(entry => {
      if (positionFilter !== 'ALL' && entry.player.position !== positionFilter) return false
      if (teamFilter !== 'ALL' && entry.player.team !== teamFilter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !entry.player.name.toLowerCase().includes(query) &&
          !entry.player.team.toLowerCase().includes(query)
        ) {
          return false
        }
      }
      return true
    })

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
        case 'clause':
          cmp = (a.contract?.rescissionClause ?? 0) - (b.contract?.rescissionClause ?? 0)
          break
        case 'rubata': {
          const rubA = a.contract?.rescissionClause != null ? a.contract.rescissionClause + a.contract.salary : 0
          const rubB = b.contract?.rescissionClause != null ? b.contract.rescissionClause + b.contract.salary : 0
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
    if (!selectedMember?.roster) {
      return { total: 0, salary: 0, clauses: 0, byPosition: { P: 0, D: 0, C: 0, A: 0 } }
    }
    const roster = selectedMember.roster
    return {
      total: roster.length,
      salary: roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0),
      clauses: roster.reduce((sum, r) => sum + (r.contract?.rescissionClause || 0), 0),
      byPosition: {
        P: roster.filter(r => r.player.position === 'P').length,
        D: roster.filter(r => r.player.position === 'D').length,
        C: roster.filter(r => r.player.position === 'C').length,
        A: roster.filter(r => r.player.position === 'A').length,
      },
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

  const handleSelectMember = useCallback((id: string) => {
    setSelectedMemberId(id)
    setTeamFilter('ALL')
  }, [])

  const handleTeamToggle = useCallback((team: string) => {
    setTeamFilter(prev => (prev === team ? 'ALL' : team))
  }, [])

  const resetFilters = useCallback(() => {
    setPositionFilter('ALL')
    setTeamFilter('ALL')
    setSearchQuery('')
  }, [])

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
          <ErrorState
            message="Errore nel caricamento delle rose"
            onRetry={() => { void loadData(); }}
          />
        </main>
      </div>
    )
  }

  const selectedName = selectedMember ? (selectedMember.teamName || selectedMember.user.username) : ''

  // ===== Cockpit testata =====
  const header = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">
          Rose{selectedName ? <span className="text-gray-400"> · {selectedName}</span> : ''}
        </h1>
        <span className="text-sm text-gray-500 leading-tight truncate">
          {leagueData.name} · {stats.total} giocatori
        </span>
      </div>

      {isOwnRoster && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold tracking-[0.06em] border text-accent-400 bg-accent-500/10 border-accent-500/50">
          <span className="dot-live bg-accent-400" /> La mia rosa
        </span>
      )}

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <div className="micro-label text-[9px]">Budget</div>
          <div className="budget-display text-lg sm:text-xl text-accent-400 leading-tight">
            {selectedMember?.currentBudget ?? 0}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
        <div className="w-px h-7 bg-surface-50" />
        <div className="text-right">
          <div className="micro-label text-[9px]">Monte ingaggi</div>
          <div className="budget-display text-lg sm:text-xl text-white leading-tight">
            {stats.salary}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
        <div className="hidden sm:block w-px h-7 bg-surface-50" />
        <div className="hidden sm:block text-right">
          <div className="micro-label text-[9px]">Clausole tot.</div>
          <div className="budget-display text-lg sm:text-xl text-gray-300 leading-tight">
            {stats.clauses}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
        <div className="ml-1">
          <ShareButton title="Rose" text="Rose della lega" compact />
        </div>
      </div>
    </div>
  )

  // ===== Cockpit barra: avatar-strip + filtri =====
  const adminBar = (
    <div className="mt-2 flex items-center gap-3 flex-wrap">
      <ManagerStrip
        className="flex-1 min-w-0"
        members={stripMembers}
        selectedId={selectedMemberId}
        onSelect={handleSelectMember}
      />
      {/* Desktop filters */}
      <div className="hidden md:flex flex-shrink-0">
        <RosterFilters
          positionFilter={positionFilter}
          onPositionChange={setPositionFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
      {/* Mobile compact search + Filtri */}
      <div className="flex md:hidden items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); }}
          placeholder="Cerca…"
          inputMode="search"
          enterKeyHint="search"
          className="w-32 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
        <button
          type="button"
          onClick={() => { setFiltersOpen(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
        >
          <SlidersHorizontal size={14} />
          {(positionFilter !== 'ALL' || teamFilter !== 'ALL') && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary-500/30 text-primary-400 rounded-full">
              {[positionFilter !== 'ALL', teamFilter !== 'ALL'].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>
    </div>
  )

  const emptyState = (
    <div className="text-center py-12 px-4">
      {selectedMember?.roster.length === 0 ? (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-surface-300 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-gray-300 font-semibold text-base">Rosa vuota</p>
            <p className="text-gray-500 text-sm mt-1">
              {isOwnRoster
                ? "Non hai ancora acquistato giocatori. Partecipa a un'asta per costruire la tua squadra!"
                : 'Questo manager non ha ancora acquistato giocatori.'}
            </p>
          </div>
          {isOwnRoster && leagueId && (
            <button
              type="button"
              onClick={() => { onNavigate('league-detail', { leagueId }); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium text-sm transition-colors"
            >
              Vai alla Lega
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-500">Nessun giocatore trovato con i filtri selezionati</p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
          >
            Resetta filtri
          </button>
        </div>
      )}
    </div>
  )

  // ===== Desktop table panel (cockpit, scroll only inside the panel) =====
  const sortableHeaders: { key: SortColumn; label: string; align: string }[] = [
    { key: 'position', label: 'Giocatore', align: 'text-left' },
    { key: 'salary', label: 'Ingaggio', align: 'text-right' },
    { key: 'clause', label: 'Clausola', align: 'text-right' },
    { key: 'rubata', label: 'Rubata', align: 'text-right' },
    { key: 'rating', label: 'Rendimento', align: 'text-center' },
  ]

  const tablePanel = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
      {/* Column headers */}
      <div className="grid grid-cols-[1.6fr_88px_96px_80px_150px] gap-2.5 px-4 py-2.5 border-b border-surface-50 bg-surface-300/40 flex-shrink-0">
        {sortableHeaders.map(col => (
          <button
            key={col.key}
            type="button"
            onClick={() => { handleSort(col.key); }}
            className={`micro-label text-[9px] hover:text-gray-300 transition-colors ${col.align} ${
              col.align === 'text-right' ? 'justify-self-end' : col.align === 'text-center' ? 'justify-self-center' : ''
            }`}
          >
            {col.label}
            {sortColumn === col.key && <span className="text-accent-400 ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
          </button>
        ))}
      </div>
      <div className="lg:panel-scroll lg:flex-1 lg:min-h-0">
        {filteredPlayers.length === 0 ? emptyState : filteredPlayers.map(entry => (
          <RosterTableRow key={entry.id} entry={entry} onPlayerClick={() => { openPlayerStats(entry); }} />
        ))}
      </div>
      <div className="px-4 py-2 border-t border-surface-50 bg-surface-300/30 flex-shrink-0 flex justify-between font-mono text-[10.5px] text-gray-500">
        <span>{filteredPlayers.length} di {stats.total} giocatori</span>
        <span>Totale rosa: {stats.total}</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation
        currentPage="rose"
        leagueId={leagueId}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <main className="w-full max-w-[1400px] mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        <CockpitShell header={header} adminBar={adminBar}>
          {/* Contracts-phase info banner (other managers' contracts hidden) */}
          {leagueData.inContrattiPhase && !isOwnRoster && (
            <div className="mt-3 lg:mt-2 p-2.5 bg-warning-500/10 border border-warning-500/30 rounded-xl text-sm flex-shrink-0">
              <p className="text-warning-400">
                <strong>Fase CONTRATTI attiva:</strong> i dettagli dei contratti degli altri manager sono nascosti.
              </p>
            </div>
          )}

          <div className="mt-3 lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_264px] lg:gap-3.5">
            {/* Desktop table */}
            <div className="hidden lg:block lg:min-h-0 lg:h-full">
              {tablePanel}
            </div>

            {/* Mobile cards (normal flow) */}
            <div className="lg:hidden space-y-2">
              {filteredPlayers.length === 0
                ? emptyState
                : filteredPlayers.map(entry => (
                    <RosterPlayerCard key={entry.id} entry={entry} onPlayerClick={() => { openPlayerStats(entry); }} />
                  ))}
            </div>

            {/* Sidebar */}
            {selectedMember && (
              <div className="mt-3 lg:mt-0 lg:min-h-0 lg:h-full">
                <RosterSidebar
                  total={stats.total}
                  byPosition={stats.byPosition}
                  teamCounts={teamCounts}
                  teamFilter={teamFilter}
                  onTeamToggle={handleTeamToggle}
                />
              </div>
            )}
          </div>
        </CockpitShell>
      </main>

      {/* Mobile Filters BottomSheet */}
      <BottomSheet isOpen={filtersOpen} onClose={() => { setFiltersOpen(false); }} title="Filtri">
        <div className="p-4 space-y-5">
          <div>
            <label className="block micro-label mb-2">Posizione</label>
            <div className="flex gap-2">
              {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                const active = positionFilter === pos
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => { setPositionFilter(pos); }}
                    className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      active
                        ? pos === 'ALL'
                          ? 'bg-accent-400 text-dark-300 border-accent-400'
                          : (POSITION_FILTER_COLORS[pos] ?? '')
                        : 'bg-surface-300 text-gray-500 border-surface-50'
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
              <label className="block micro-label mb-2">Squadra Serie A</label>
              <select
                value={teamFilter}
                onChange={(e) => { setTeamFilter(e.target.value); }}
                className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm"
              >
                <option value="ALL">Tutte le squadre</option>
                {uniqueTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          )}

          {teamFilter !== 'ALL' && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <img src={getTeamLogo(teamFilter)} alt={teamFilter} className="w-5 h-5 object-contain" />
              <span>Filtro squadra: {teamFilter}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setFiltersOpen(false); }}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Applica Filtri
          </button>
        </div>
      </BottomSheet>

      {/* Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => { setSelectedPlayerStats(null); }}
        player={selectedPlayerStats}
      />
    </div>
  )
}

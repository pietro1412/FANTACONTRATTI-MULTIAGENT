import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { playerApi, leagueApi } from '@/services/api'
import { Navigation } from '@/components/Navigation'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonPlayerRow } from '@/components/ui/Skeleton'
import { LandscapeHint } from '@/components/ui/LandscapeHint'
import RadarChart from '@/components/ui/RadarChart'
import { PlayerStatsModal, type PlayerInfo } from '@/components/PlayerStatsModal'
import { PlayerRoleBadge } from '@/components/players/PlayerRoleBadge'
import { PlayerPhoto } from '@/components/players/PlayerPhoto'
import { PlayerRoleFilter } from '@/components/players/PlayerRoleFilter'
import { PlayerViewToggle, type PlayerView } from '@/components/players/PlayerViewToggle'
import { Monogram } from '@/components/ui/Monogram'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { SlidersHorizontal } from 'lucide-react'

// ==================== TYPES ====================

interface PlayersProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
  /** Vista iniziale: 'list' (rotta /players) o 'stats' (rotta /stats). */
  initialView?: PlayerView
  /** Deep-link da Finanze: apre la Lista filtrata per quella squadra (in rosa). */
  initialTeamFilter?: string
}

// ----- List view (database) -----

interface ListPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  listStatus: string
  age?: number | null
  apiFootballId?: number | null
  apiFootballStats?: {
    games?: { appearences?: number | null; rating?: number | null } | null
    goals?: { total?: number | null; assists?: number | null } | null
  } | null
  statsSyncedAt?: string | null
}

interface RosterInfo {
  memberId: string
  memberUsername: string
  teamName: string | null
  acquisitionPrice: number
  contract?: {
    salary: number
    duration: number
    rescissionClause: number | null
  } | null
}

interface ListPlayerWithRoster extends ListPlayer {
  rosterInfo?: RosterInfo
}

interface LeagueRosterData {
  id: string
  name: string
  members: {
    id: string
    user: { username: string }
    teamName: string | null
    roster: {
      playerId: string
      acquisitionPrice: number
      contract?: {
        salary: number
        duration: number
        rescissionClause: number | null
      } | null
    }[]
  }[]
  isAdmin?: boolean
}

// ----- Stats view (Serie A tabellone) -----

type PlayerWithStats = {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  apiFootballId: number | null
  statsSyncedAt: string | null
  stats: {
    appearances: number
    minutes: number
    rating: number | null
    goals: number
    assists: number
    yellowCards: number
    redCards: number
    passesTotal: number
    passesKey: number
    passAccuracy: number | null
    shotsTotal: number
    shotsOn: number
    tacklesTotal: number
    interceptions: number
    dribblesAttempts: number
    dribblesSuccess: number
    penaltyScored: number
    penaltyMissed: number
  } | null
}

// ==================== STATS COLUMN DEFINITIONS ====================

interface ColumnDef {
  key: string
  label: string
  shortLabel: string
  category: 'general' | 'attack' | 'defense' | 'passing' | 'discipline'
  getValue: (player: PlayerWithStats) => number | string | null
  format?: (val: number | null) => string
  /** Semantic accent for the value cell (gol secondary, assist primary, ...). */
  tone?: 'good' | 'attack' | 'pass' | 'warning' | 'danger'
  sortable?: boolean
}

const STAT_COLUMNS: ColumnDef[] = [
  // General
  { key: 'appearances', label: 'Presenze', shortLabel: 'Pres', category: 'general', getValue: p => p.stats?.appearances ?? null, sortable: true },
  { key: 'minutes', label: 'Minuti Giocati', shortLabel: 'Min', category: 'general', getValue: p => p.stats?.minutes ?? null, sortable: true },
  { key: 'rating', label: 'Rating Medio', shortLabel: 'Rating', category: 'general', getValue: p => p.stats?.rating ?? null, format: v => v?.toFixed(2) ?? '-', sortable: true },

  // Attack
  { key: 'goals', label: 'Gol', shortLabel: 'Gol', category: 'attack', getValue: p => p.stats?.goals ?? null, tone: 'good', sortable: true },
  { key: 'assists', label: 'Assist', shortLabel: 'Ass', category: 'attack', getValue: p => p.stats?.assists ?? null, tone: 'attack', sortable: true },
  { key: 'ga', label: 'Gol + Assist', shortLabel: 'G+A', category: 'attack', getValue: p => p.stats ? p.stats.goals + p.stats.assists : null, sortable: true },
  { key: 'shotsTotal', label: 'Tiri Totali', shortLabel: 'Tiri', category: 'attack', getValue: p => p.stats?.shotsTotal ?? null, sortable: true },
  { key: 'shotsOn', label: 'Tiri in Porta', shortLabel: 'TiP', category: 'attack', getValue: p => p.stats?.shotsOn ?? null, sortable: true },
  { key: 'shotsAccuracy', label: 'Precisione Tiri %', shortLabel: 'Tiri%', category: 'attack', getValue: p => p.stats && p.stats.shotsTotal > 0 ? Math.round((p.stats.shotsOn / p.stats.shotsTotal) * 100) : null, format: v => v !== null ? `${v}%` : '-', sortable: true },
  { key: 'penaltyScored', label: 'Rigori Segnati', shortLabel: 'RigS', category: 'attack', getValue: p => p.stats?.penaltyScored ?? null, sortable: true },
  { key: 'penaltyMissed', label: 'Rigori Sbagliati', shortLabel: 'RigX', category: 'attack', getValue: p => p.stats?.penaltyMissed ?? null, tone: 'danger', sortable: true },

  // Defense
  { key: 'tacklesTotal', label: 'Contrasti', shortLabel: 'Tckl', category: 'defense', getValue: p => p.stats?.tacklesTotal ?? null, sortable: true },
  { key: 'interceptions', label: 'Intercetti', shortLabel: 'Int', category: 'defense', getValue: p => p.stats?.interceptions ?? null, sortable: true },

  // Passing
  { key: 'passesTotal', label: 'Passaggi Totali', shortLabel: 'Pass', category: 'passing', getValue: p => p.stats?.passesTotal ?? null, sortable: true },
  { key: 'passesKey', label: 'Passaggi Chiave', shortLabel: 'KeyP', category: 'passing', getValue: p => p.stats?.passesKey ?? null, tone: 'attack', sortable: true },
  { key: 'passAccuracy', label: 'Precisione Pass %', shortLabel: 'Pass%', category: 'passing', getValue: p => p.stats?.passAccuracy ?? null, format: v => v !== null ? `${v}%` : '-', sortable: true },
  { key: 'dribblesAttempts', label: 'Dribbling Tentati', shortLabel: 'DrbT', category: 'passing', getValue: p => p.stats?.dribblesAttempts ?? null, sortable: true },
  { key: 'dribblesSuccess', label: 'Dribbling Riusciti', shortLabel: 'DrbR', category: 'passing', getValue: p => p.stats?.dribblesSuccess ?? null, sortable: true },
  { key: 'dribblesAccuracy', label: 'Dribbling %', shortLabel: 'Drb%', category: 'passing', getValue: p => p.stats && p.stats.dribblesAttempts > 0 ? Math.round((p.stats.dribblesSuccess / p.stats.dribblesAttempts) * 100) : null, format: v => v !== null ? `${v}%` : '-', sortable: true },

  // Discipline
  { key: 'yellowCards', label: 'Ammonizioni', shortLabel: 'Amm', category: 'discipline', getValue: p => p.stats?.yellowCards ?? null, tone: 'warning', sortable: true },
  { key: 'redCards', label: 'Espulsioni', shortLabel: 'Esp', category: 'discipline', getValue: p => p.stats?.redCards ?? null, tone: 'danger', sortable: true },
]

const COLUMN_PRESETS: Record<string, { label: string; columns: string[] }> = {
  essential: { label: 'Essenziali', columns: ['appearances', 'rating', 'goals', 'assists', 'ga', 'yellowCards'] },
  A: { label: 'Attaccante', columns: ['appearances', 'minutes', 'rating', 'goals', 'assists', 'ga', 'shotsTotal', 'shotsOn', 'shotsAccuracy', 'penaltyScored', 'dribblesSuccess'] },
  C: { label: 'Centroc.', columns: ['appearances', 'minutes', 'rating', 'assists', 'passesKey', 'passesTotal', 'passAccuracy', 'dribblesSuccess', 'tacklesTotal', 'goals', 'ga'] },
  D: { label: 'Difensore', columns: ['appearances', 'minutes', 'rating', 'tacklesTotal', 'interceptions', 'passesTotal', 'yellowCards', 'redCards', 'goals', 'assists'] },
  P: { label: 'Portiere', columns: ['appearances', 'minutes', 'rating', 'passesTotal', 'passAccuracy', 'yellowCards', 'redCards'] },
  all: { label: 'Tutte', columns: STAT_COLUMNS.map(c => c.key) },
}

const PRESET_ORDER: string[] = ['essential', 'A', 'C', 'D', 'P', 'all']
const LOCALSTORAGE_KEY = 'playerStats_visibleColumns'
const PLAYER_CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7']
const BACKEND_SORTABLE = ['name', 'team', 'position', 'quotation']

const TONE_CLASS: Record<NonNullable<ColumnDef['tone']>, string> = {
  good: 'text-secondary-400',
  attack: 'text-primary-400',
  pass: 'text-primary-400',
  warning: 'text-warning-400',
  danger: 'text-danger-400',
}

// ==================== COMPONENT ====================

export function Players({ leagueId, onNavigate, initialView = 'list', initialTeamFilter }: PlayersProps) {
  const [view, setView] = useState<PlayerView>(initialView)

  // Shared
  const [leagueName, setLeagueName] = useState('')
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('')
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // ----- List view state -----
  const [listPlayers, setListPlayers] = useState<ListPlayer[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [rosterMap, setRosterMap] = useState<Map<string, RosterInfo>>(new Map())
  const [availableTeams, setAvailableTeams] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'free' | 'rostered'>(initialTeamFilter ? 'rostered' : 'all')
  const [listTeamFilter, setListTeamFilter] = useState<string>(initialTeamFilter || '')

  // ----- Stats view state -----
  const [statsPlayers, setStatsPlayers] = useState<PlayerWithStats[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [teams, setTeams] = useState<string[]>([])
  const [statsTeamFilter, setStatsTeamFilter] = useState('')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
      }
    } catch {
      // ignore corrupted preference, fall back to essential preset
    }
    return COLUMN_PRESETS.essential!.columns
  })

  // =============== LIST VIEW DATA ===============

  const loadListData = useCallback(async () => {
    setListLoading(true)

    const leagueResponse = await leagueApi.getAllRosters(leagueId)
    if (leagueResponse.success && leagueResponse.data) {
      const leagueData = leagueResponse.data as LeagueRosterData
      setLeagueName(leagueData.name)
      setIsLeagueAdmin(leagueData.isAdmin || false)

      const newRosterMap = new Map<string, RosterInfo>()
      const teamSet: string[] = []
      if (Array.isArray(leagueData.members)) {
        for (const member of leagueData.members) {
          if (member.teamName) teamSet.push(member.teamName)
          if (Array.isArray(member.roster)) {
            for (const entry of member.roster) {
              newRosterMap.set(entry.playerId, {
                memberId: member.id,
                memberUsername: member.user.username,
                teamName: member.teamName,
                acquisitionPrice: entry.acquisitionPrice,
                contract: entry.contract,
              })
            }
          }
        }
      }
      setRosterMap(newRosterMap)
      setAvailableTeams(teamSet.sort())
    }

    const filters: { position?: string; search?: string } = {}
    if (positionFilter) filters.position = positionFilter
    if (searchQuery) filters.search = searchQuery
    const playersResponse = await playerApi.getAll(filters)
    if (playersResponse.success && playersResponse.data) {
      setListPlayers(playersResponse.data as ListPlayer[])
    }

    setListLoading(false)
  }, [leagueId, positionFilter, searchQuery])

  useEffect(() => {
    if (view === 'list') void loadListData()
  }, [view, loadListData])

  const filteredListPlayers = useMemo<ListPlayerWithRoster[]>(() => {
    return listPlayers
      .map(p => ({ ...p, rosterInfo: rosterMap.get(p.id) }))
      .filter(p => {
        if (statusFilter === 'free' && p.rosterInfo) return false
        if (statusFilter === 'rostered' && !p.rosterInfo) return false
        if (listTeamFilter && p.rosterInfo?.teamName !== listTeamFilter) return false
        return true
      })
  }, [listPlayers, rosterMap, statusFilter, listTeamFilter])

  const freeCount = useMemo(
    () => listPlayers.filter(p => !rosterMap.has(p.id)).length,
    [listPlayers, rosterMap],
  )

  const listScrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filteredListPlayers.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 56,
    overscan: 12,
  })

  // =============== STATS VIEW DATA ===============

  const loadTeams = useCallback(async () => {
    const res = await playerApi.getTeams()
    if (res.success && res.data) {
      setTeams((res.data as { name: string }[]).map(t => t.name))
    }
  }, [])

  const loadStatsPlayers = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await playerApi.getStats({
        position: positionFilter || undefined,
        team: statsTeamFilter || undefined,
        search: searchQuery || undefined,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      })
      if (res.success && res.data) {
        setStatsPlayers(res.data.players as PlayerWithStats[])
        setTotalPages(res.data.pagination.totalPages)
        setTotal(res.data.pagination.total)
      }
    } catch {
      setStatsError('Errore nel caricamento delle statistiche. Riprova.')
    } finally {
      setStatsLoading(false)
    }
  }, [positionFilter, statsTeamFilter, searchQuery, sortBy, sortOrder, page])

  useEffect(() => {
    if (view === 'stats') void loadTeams()
  }, [view, loadTeams])

  useEffect(() => {
    if (view === 'stats') void loadStatsPlayers()
  }, [view, loadStatsPlayers])

  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(visibleColumns))
    } catch {
      // ignore storage write failures (private mode / quota)
    }
  }, [visibleColumns])

  const visibleColumnDefs = useMemo(
    () => STAT_COLUMNS.filter(col => visibleColumns.includes(col.key)),
    [visibleColumns],
  )

  const sortedStatsPlayers = useMemo(() => {
    if (BACKEND_SORTABLE.includes(sortBy)) return statsPlayers
    const colDef = STAT_COLUMNS.find(c => c.key === sortBy)
    return [...statsPlayers].sort((a, b) => {
      let aVal = 0
      let bVal = 0
      if (colDef) {
        const aRaw = colDef.getValue(a)
        const bRaw = colDef.getValue(b)
        aVal = typeof aRaw === 'number' ? aRaw : 0
        bVal = typeof bRaw === 'number' ? bRaw : 0
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [statsPlayers, sortBy, sortOrder])

  const activePreset = useMemo(() => {
    const key = JSON.stringify([...visibleColumns].sort())
    return PRESET_ORDER.find(p => JSON.stringify([...(COLUMN_PRESETS[p]?.columns ?? [])].sort()) === key)
  }, [visibleColumns])

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const togglePlayerForCompare = useCallback((playerId: string) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else if (next.size < 4) next.add(playerId)
      return next
    })
  }, [])

  const clearComparison = useCallback(() => { setSelectedForCompare(new Set()); }, [])

  const playersToCompare = sortedStatsPlayers.filter(p => selectedForCompare.has(p.id))

  // =============== SHARED ===============

  const openPlayerStats = useCallback((p: { name: string; team: string; position: string; quotation: number; apiFootballId?: number | null; statsSyncedAt?: string | null; age?: number | null }) => {
    setSelectedPlayerStats({
      name: p.name,
      team: p.team,
      position: p.position,
      quotation: p.quotation,
      age: p.age,
      apiFootballId: p.apiFootballId,
      statsSyncedAt: p.statsSyncedAt,
    })
  }, [])

  // Keep counts/title coherent for the header across views
  const headerTotal = view === 'list' ? listPlayers.length : total

  // ===== Cockpit testata =====
  const header = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">Giocatori</h1>
        <span className="text-sm text-gray-500 leading-tight truncate">
          {view === 'list'
            ? `${leagueName || 'Lega'} · database Serie A`
            : 'Statistiche Serie A · stagione 2025/26'}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <div className="micro-label text-[9px]">{view === 'list' ? 'Totale' : 'Giocatori'}</div>
          <div className="stat-number text-lg sm:text-xl text-white leading-tight">{headerTotal}</div>
        </div>
        {view === 'list' && (
          <>
            <div className="w-px h-7 bg-surface-50" />
            <div className="text-right">
              <div className="micro-label text-[9px]">Liberi</div>
              <div className="stat-number text-lg sm:text-xl text-secondary-400 leading-tight">{freeCount}</div>
            </div>
          </>
        )}
        {/* Desktop inline search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); }}
          placeholder="Cerca giocatore o squadra…"
          inputMode="search"
          enterKeyHint="search"
          className="hidden md:block w-48 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
      </div>
    </div>
  )

  // ===== Cockpit barra: toggle vista + filtri =====
  const adminBar = (
    <div className="mt-2 flex items-center gap-2.5 flex-wrap">
      <PlayerViewToggle view={view} onChange={setView} />
      <div className="hidden sm:block w-px h-5 bg-surface-50" />
      <PlayerRoleFilter value={positionFilter} onChange={setPositionFilter} />

      {view === 'list' && (
        <>
          <div className="hidden sm:block w-px h-5 bg-surface-50" />
          <div className="hidden md:inline-flex items-center gap-1.5">
            {([
              { key: 'all', label: 'Tutti' },
              { key: 'free', label: 'Liberi' },
              { key: 'rostered', label: 'In rosa' },
            ] as const).map(opt => {
              const active = statusFilter === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(opt.key)
                    if (opt.key !== 'rostered') setListTeamFilter('')
                  }}
                  aria-pressed={active}
                  className={`font-mono text-[9.5px] font-bold tracking-[0.08em] uppercase rounded-full px-2.5 py-1 border transition-colors ${
                    active
                      ? opt.key === 'free'
                        ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40'
                        : 'bg-accent-400 text-dark-300 border-accent-400'
                      : 'border-surface-50 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {availableTeams.length > 0 && (
            <select
              value={listTeamFilter}
              onChange={(e) => {
                setListTeamFilter(e.target.value)
                if (e.target.value) setStatusFilter('rostered')
              }}
              className="hidden md:block px-2.5 py-1.5 text-xs rounded-lg bg-surface-300 border border-surface-50 text-gray-300 focus:outline-none focus:border-accent-500/50"
            >
              <option value="">Squadra (rosa)</option>
              {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </>
      )}

      {view === 'stats' && (
        <div className="ml-auto hidden md:flex items-center gap-2 flex-wrap">
          <span className="micro-label text-[9px]">Preset</span>
          {PRESET_ORDER.map(key => {
            const preset = COLUMN_PRESETS[key]!
            const active = activePreset === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setVisibleColumns(preset.columns); }}
                className={`text-[11px] font-semibold rounded-lg px-2.5 py-1 border transition-colors ${
                  active
                    ? 'text-accent-400 border-accent-500/50 bg-accent-500/10'
                    : 'text-gray-400 border-surface-50 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Mobile compact search + Filtri */}
      <div className="flex md:hidden items-center gap-2 ml-auto flex-shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); }}
          placeholder="Cerca…"
          inputMode="search"
          enterKeyHint="search"
          className="w-28 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
        <button
          type="button"
          onClick={() => { setFiltersOpen(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>
    </div>
  )

  // ===== LIST PANEL =====
  const listColsClass = 'grid grid-cols-[minmax(0,2fr)_minmax(110px,1.2fr)_84px_72px] gap-3 items-center'
  const listPanel = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
      <div className={`${listColsClass} px-4 py-2.5 border-b border-surface-50 bg-surface-300/40 flex-shrink-0`}>
        <span className="micro-label text-[9px]">Giocatore</span>
        <span className="micro-label text-[9px]">Stato</span>
        <span className="micro-label text-[9px] text-right">Quot.</span>
        <span className="micro-label text-[9px] text-right">Voto</span>
      </div>
      {listLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonPlayerRow key={i} />)}
        </div>
      ) : filteredListPlayers.length === 0 ? (
        <EmptyState icon="🔍" title="Nessun giocatore trovato" description="Prova a cambiare i filtri di ricerca." compact />
      ) : (
        <div ref={listScrollRef} className="lg:panel-scroll lg:flex-1 lg:min-h-0 max-h-[70vh] overflow-y-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const player = filteredListPlayers[virtualRow.index]
              if (!player) return null
              const rating = player.apiFootballStats?.games?.rating
              return (
                <div
                  key={player.id}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                  className={`${listColsClass} px-4 py-2 border-b border-surface-50/10 hover:bg-surface-100/60 transition-colors cursor-pointer`}
                  onClick={() => { openPlayerStats(player); }}
                >
                  {/* Player identity */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} />
                    <PlayerRoleBadge position={player.position} size="sm" />
                    <div className="min-w-0">
                      <span className="block font-display font-bold text-[13px] text-white leading-tight truncate">{player.name}</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5 min-w-0">
                        <TeamLogo team={player.team} size="xs" />
                        <span className="truncate">{player.team}</span>
                        {player.age != null && <span className="text-gray-600">· {player.age} anni</span>}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="min-w-0">
                    {player.rosterInfo ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300 min-w-0">
                        <Monogram name={player.rosterInfo.teamName || player.rosterInfo.memberUsername} size="xs" />
                        <span className="truncate">{player.rosterInfo.teamName || player.rosterInfo.memberUsername}</span>
                      </span>
                    ) : (
                      <span className="inline-flex font-mono text-[9.5px] font-bold tracking-[0.06em] text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-2.5 py-0.5">
                        LIBERO
                      </span>
                    )}
                  </div>

                  {/* Quotation */}
                  <div className="text-right">
                    <span className="stat-number text-base text-white">{player.quotation}</span>
                  </div>

                  {/* Rating */}
                  <div className="text-right">
                    <span className={`stat-number text-base ${rating != null && rating >= 7 ? 'text-accent-400' : 'text-gray-400'}`}>
                      {rating != null ? rating.toFixed(1) : '-'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="px-4 py-2 border-t border-surface-50 bg-surface-300/30 flex-shrink-0 font-mono text-[10.5px] text-gray-500">
        {filteredListPlayers.length} giocatori
      </div>
    </div>
  )

  // ===== STATS PANEL =====
  const statsPanel = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
      {statsError && (
        <div className="m-3 bg-danger-500/10 border border-danger-500/40 text-danger-400 p-2.5 rounded-lg text-sm flex items-center justify-between flex-shrink-0">
          <span>{statsError}</span>
          <button
            type="button"
            onClick={() => { void loadStatsPlayers(); }}
            className="px-3 py-1 text-xs font-medium border border-danger-500/40 rounded-lg hover:bg-danger-500/10 transition-colors"
          >
            Riprova
          </button>
        </div>
      )}
      {statsLoading ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Caricamento statistiche…</p>
        </div>
      ) : sortedStatsPlayers.length === 0 ? (
        <EmptyState icon="🔍" title="Nessun giocatore trovato" description="Prova a modificare i filtri di ricerca o a cambiare ruolo/squadra." compact />
      ) : (
        <div className="lg:panel-scroll lg:flex-1 lg:min-h-0 overflow-auto">
          <table className="border-separate border-spacing-0 w-max min-w-full">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-20 bg-surface-300 text-left min-w-[200px] px-3 py-2.5 border-b border-surface-50 cursor-pointer"
                  onClick={() => { handleSort('name'); }}
                >
                  <span className={`micro-label text-[9px] ${sortBy === 'name' ? 'text-accent-400' : ''}`}>
                    Giocatore {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-10 bg-surface-300 text-right px-2.5 py-2.5 border-b border-surface-50 cursor-pointer whitespace-nowrap"
                  onClick={() => { handleSort('quotation'); }}
                >
                  <span className={`micro-label text-[9px] ${sortBy === 'quotation' ? 'text-accent-400' : ''}`}>
                    Quot {sortBy === 'quotation' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </th>
                {visibleColumnDefs.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    title={col.label}
                    className="sticky top-0 z-10 bg-surface-300 text-right px-2.5 py-2.5 border-b border-surface-50 cursor-pointer whitespace-nowrap"
                    onClick={() => { if (col.sortable) handleSort(col.key); }}
                  >
                    <span className={`micro-label text-[9px] ${sortBy === col.key ? 'text-accent-400' : ''}`}>
                      {col.shortLabel} {col.sortable && sortBy === col.key && (sortOrder === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStatsPlayers.map(player => {
                const isSelected = selectedForCompare.has(player.id)
                return (
                  <tr key={player.id} className="group hover:bg-surface-100/60 transition-colors">
                    <td className={`sticky left-0 z-10 px-3 py-2 border-b border-surface-50/10 ${isSelected ? 'bg-primary-500/10' : 'bg-surface-200 group-hover:bg-surface-100'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          className="rounded border-surface-50 bg-surface-300 text-primary-500 focus:ring-primary-500 flex-shrink-0"
                          checked={isSelected}
                          onChange={() => { togglePlayerForCompare(player.id); }}
                          onClick={(e) => { e.stopPropagation(); }}
                          aria-label={`Seleziona ${player.name} per il confronto`}
                        />
                        <PlayerRoleBadge position={player.position} size="sm" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => { openPlayerStats(player); }}
                            className="block font-display font-bold text-[13px] text-white leading-tight truncate text-left hover:text-primary-400 transition-colors max-w-[150px]"
                          >
                            {player.name}
                          </button>
                          <span className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
                            <TeamLogo team={player.team} size="xs" />
                            <span className="truncate">{player.team}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-2.5 py-2 border-b border-surface-50/10 stat-number text-sm text-white">
                      {player.quotation}
                    </td>
                    {visibleColumnDefs.map(col => {
                      const raw = col.getValue(player)
                      const display = col.format
                        ? col.format(typeof raw === 'number' ? raw : null)
                        : raw ?? '-'
                      const isRating = col.key === 'rating' && typeof raw === 'number'
                      const ratingTone = isRating
                        ? (raw >= 7 ? 'text-secondary-400' : raw >= 6 ? 'text-white' : 'text-warning-400')
                        : ''
                      const tone = col.tone ? TONE_CLASS[col.tone] : 'text-gray-400'
                      return (
                        <td
                          key={col.key}
                          className={`text-right px-2.5 py-2 border-b border-surface-50/10 stat-number text-sm whitespace-nowrap ${isRating ? ratingTone : tone}`}
                        >
                          {display}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer: compare action + pagination */}
      <div className="px-4 py-2 border-t border-surface-50 bg-surface-300/30 flex-shrink-0 flex items-center justify-between gap-3 flex-wrap font-mono text-[10.5px] text-gray-500">
        <div className="flex items-center gap-3">
          <span>{total} giocatori</span>
          {selectedForCompare.size > 0 && (
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={selectedForCompare.size < 2}
                onClick={() => { setShowCompareModal(true); }}
                className="px-2.5 py-1 rounded-lg bg-primary-500 text-white font-display font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
              >
                Confronta ({selectedForCompare.size})
              </button>
              <button
                type="button"
                onClick={clearComparison}
                className="px-2 py-1 rounded-lg border border-surface-50 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span>Pagina {page} di {totalPages}</span>
            <button
              type="button"
              onClick={() => { setPage(p => Math.max(1, p - 1)); }}
              disabled={page === 1}
              className="px-2.5 py-1 rounded-lg border border-surface-50 text-gray-300 disabled:opacity-40 hover:text-white transition-colors"
            >
              Prec
            </button>
            <button
              type="button"
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); }}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded-lg border border-surface-50 text-gray-300 disabled:opacity-40 hover:text-white transition-colors"
            >
              Succ
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation
        currentPage={initialView === 'stats' ? 'playerStats' : 'allPlayers'}
        leagueId={leagueId}
        leagueName={leagueName}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <main className="w-full max-w-[1400px] mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        <CockpitShell header={header} adminBar={adminBar}>
          {/* Desktop: cockpit panel (scroll only inside the panel). Mobile: normal
              flow with the panel's own max-height fallback. Rendered once to avoid
              duplicated DOM. */}
          <div className="mt-3 lg:h-full lg:min-h-0">
            {view === 'list' ? listPanel : statsPanel}
          </div>
        </CockpitShell>
      </main>

      {/* Mobile Filters BottomSheet */}
      <BottomSheet isOpen={filtersOpen} onClose={() => { setFiltersOpen(false); }} title="Filtri">
        <div className="p-4 space-y-5">
          <div>
            <label className="block micro-label mb-2">Vista</label>
            <PlayerViewToggle view={view} onChange={setView} className="w-full" />
          </div>

          <div>
            <label className="block micro-label mb-2">Ruolo</label>
            <PlayerRoleFilter value={positionFilter} onChange={setPositionFilter} />
          </div>

          {view === 'list' && (
            <>
              <div>
                <label className="block micro-label mb-2">Stato</label>
                <div className="flex gap-2">
                  {([
                    { key: 'all', label: 'Tutti' },
                    { key: 'free', label: 'Liberi' },
                    { key: 'rostered', label: 'In rosa' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.key)
                        if (opt.key !== 'rostered') setListTeamFilter('')
                      }}
                      className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                        statusFilter === opt.key
                          ? 'bg-accent-400 text-dark-300 border-accent-400'
                          : 'bg-surface-300 text-gray-500 border-surface-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {availableTeams.length > 0 && (
                <div>
                  <label className="block micro-label mb-2">Squadra (in rosa)</label>
                  <select
                    value={listTeamFilter}
                    onChange={(e) => {
                      setListTeamFilter(e.target.value)
                      if (e.target.value) setStatusFilter('rostered')
                    }}
                    className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm"
                  >
                    <option value="">Tutte le squadre</option>
                    {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {view === 'stats' && (
            <>
              <div>
                <label className="block micro-label mb-2">Preset colonne</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_ORDER.map(key => {
                    const preset = COLUMN_PRESETS[key]!
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setVisibleColumns(preset.columns); }}
                        className={`px-2 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          activePreset === key
                            ? 'text-accent-400 border-accent-500/50 bg-accent-500/10'
                            : 'text-gray-400 border-surface-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {teams.length > 0 && (
                <div>
                  <label className="block micro-label mb-2">Squadra Serie A</label>
                  <select
                    value={statsTeamFilter}
                    onChange={(e) => { setStatsTeamFilter(e.target.value); setPage(1) }}
                    className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm"
                  >
                    <option value="">Tutte le squadre</option>
                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </>
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

      {/* Full-page Compare View (stats) */}
      {showCompareModal && playersToCompare.length >= 2 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-100">
          <div className="sticky top-0 z-10 bg-surface-200 border-b border-surface-50">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setShowCompareModal(false); }}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors min-h-[44px]"
              >
                <span className="text-xl">←</span>
                <span className="text-sm md:text-base">Torna alla lista</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center">
                  <span className="text-base">⚖️</span>
                </div>
                <h2 className="font-display text-lg md:text-xl font-bold text-white">Confronto Giocatori</h2>
              </div>
              <div className="w-20" />
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
              {playersToCompare.map((player, idx) => (
                <div key={player.id} className="flex flex-col items-center gap-1.5 md:gap-2 bg-surface-200 rounded-xl p-3 md:p-4 border border-surface-50">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full" style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }} />
                  <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="md" />
                  <span className="font-display font-medium text-white text-sm md:text-base text-center truncate w-full">{player.name}</span>
                  <div className="flex items-center gap-1">
                    <TeamLogo team={player.team} size="xs" />
                    <span className="text-xs md:text-sm text-gray-400">{player.team}</span>
                  </div>
                  <span className="budget-display text-base md:text-lg text-primary-400">Quot. {player.quotation}</span>
                </div>
              ))}
            </div>

            <LandscapeHint />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
              <div className="bg-surface-200 rounded-xl p-4 md:p-6 border border-surface-50">
                <h3 className="text-center text-white font-semibold mb-4">Statistiche Offensive</h3>
                <RadarChart
                  size={320}
                  players={playersToCompare.map((p, i) => ({ name: p.name, color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length] ?? '#3b82f6' }))}
                  data={[
                    { label: 'Gol', values: playersToCompare.map(p => p.stats?.goals ?? 0) },
                    { label: 'Assist', values: playersToCompare.map(p => p.stats?.assists ?? 0) },
                    { label: 'Tiri', values: playersToCompare.map(p => p.stats?.shotsTotal ?? 0) },
                    { label: 'Tiri Porta', values: playersToCompare.map(p => p.stats?.shotsOn ?? 0) },
                    { label: 'Dribbling', values: playersToCompare.map(p => p.stats?.dribblesSuccess ?? 0) },
                    { label: 'Pass Chiave', values: playersToCompare.map(p => p.stats?.passesKey ?? 0) },
                  ]}
                />
              </div>
              <div className="bg-surface-200 rounded-xl p-4 md:p-6 border border-surface-50">
                <h3 className="text-center text-white font-semibold mb-4">Statistiche Difensive</h3>
                <RadarChart
                  size={320}
                  players={playersToCompare.map((p, i) => ({ name: p.name, color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length] ?? '#3b82f6' }))}
                  data={[
                    { label: 'Contrasti', values: playersToCompare.map(p => p.stats?.tacklesTotal ?? 0) },
                    { label: 'Intercetti', values: playersToCompare.map(p => p.stats?.interceptions ?? 0) },
                    { label: 'Passaggi', values: playersToCompare.map(p => Math.round((p.stats?.passesTotal ?? 0) / 10)) },
                    { label: 'Presenze', values: playersToCompare.map(p => p.stats?.appearances ?? 0) },
                    { label: 'Rating', values: playersToCompare.map(p => Math.round((p.stats?.rating ?? 0) * 10)) },
                    { label: 'Minuti', values: playersToCompare.map(p => Math.round((p.stats?.minutes ?? 0) / 100)) },
                  ]}
                />
              </div>
            </div>

            <div className="bg-surface-200 rounded-xl overflow-hidden border border-surface-50">
              <h3 className="text-white font-semibold p-4 border-b border-surface-50/10">Dettaglio Statistiche</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-300/50">
                    <tr>
                      <th className="px-3 md:px-4 py-3 text-left text-sm font-medium text-gray-400">Statistica</th>
                      {playersToCompare.map((player, idx) => (
                        <th key={player.id} className="px-3 md:px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 md:gap-2">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }} />
                            <span className="text-xs md:text-sm font-medium text-white truncate">{player.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50/10">
                    {([
                      { key: 'quotation', label: 'Quotazione', getValue: (p: PlayerWithStats) => p.quotation, format: undefined },
                      ...STAT_COLUMNS.map(col => ({ key: col.key, label: col.label, format: col.format, getValue: col.getValue })),
                    ]).map(row => {
                      const values = playersToCompare.map(p => {
                        const val = row.getValue(p)
                        return typeof val === 'number' ? val : 0
                      })
                      const maxVal = Math.max(...values.filter(v => v > 0), 0)
                      return (
                        <tr key={row.key} className="hover:bg-surface-300/30">
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-gray-300">{row.label}</td>
                          {playersToCompare.map((player, idx) => {
                            const val = values[idx] ?? 0
                            const isMax = val === maxVal && maxVal > 0
                            const formatted = row.format ? row.format(val) : val
                            return (
                              <td
                                key={player.id}
                                className={`px-3 md:px-4 py-3 text-center text-sm md:text-base font-medium font-mono ${isMax ? 'text-secondary-400' : 'text-white'}`}
                              >
                                {isMax && maxVal > 0 && <span className="inline-block w-2 h-2 rounded-full bg-secondary-400 mr-1 md:mr-2" />}
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
      )}

      {/* Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => { setSelectedPlayerStats(null); }}
        player={selectedPlayerStats}
      />
    </div>
  )
}

export default Players

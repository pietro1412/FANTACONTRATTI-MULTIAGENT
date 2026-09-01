import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { playerApi, leagueApi, tradeApi } from '@/services/api'
import { computeBilancio } from '@/utils/finance'
import { Navigation } from '@/components/Navigation'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonPlayerRow } from '@/components/ui/Skeleton'
import { LandscapeHint } from '@/components/ui/LandscapeHint'
import RadarChart from '@/components/ui/RadarChart'
import { PlayerStatsModal, type PlayerInfo } from '@/components/PlayerStatsModal'
import { ShareButton } from '@/components/ShareButton'
import { getTeamLogo } from '@/utils/teamLogos'
import { POSITION_FILTER_COLORS } from '@/components/ui/PositionBadge'
import { PlayerPhoto } from '@/components/players/PlayerPhoto'
import { PlayerRoleFilter } from '@/components/players/PlayerRoleFilter'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { ManagerStrip, type ManagerStripMember } from '@/components/players/ManagerStrip'
import { RosterFilters } from '@/components/players/RosterFilters'
import { RosterTableRow, ROSTER_ROW_GRID_BASE, ROSTER_ROW_GRID_EXTRA, ROSTER_ROW_GAP } from '@/components/players/RosterTableRow'
import { RosterPlayerCard } from '@/components/players/RosterPlayerCard'
import { RosterSidebar, type CompositionRankingRow } from '@/components/players/RosterSidebar'
import { getExitReasonTag, type RosterEntry, type RosterRowStatus } from '@/components/players/types'
import { Tag } from '@/components/contracts/shared'
import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { GLOSSARY } from '@/components/help/Glossary'
import { SlidersHorizontal } from 'lucide-react'
import { sortPlayersByRoleAndName, comparePlayersByRoleAndName } from '@/utils/player-sort'
import { formatStat } from '@/utils/stat-format'
import type { ComputedSeasonStats } from '@/services/player-stats.service'
import type { FantacalcioSeasonStats } from '@/services/fantacalcio-stats.service'

// ==================== TYPES ====================

/** Tab attiva della pagina unica Rose / Tutti i giocatori / Statistiche. */
export type RoseView = 'rose' | 'players' | 'stats'

interface RoseGiocatoriProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
  /** Tab iniziale — derivata dal query param ?view= (default 'rose'). */
  initialView?: RoseView
  /** Deep-link da Finanze: apre "Tutti i giocatori" filtrata per quella squadra (in rosa). */
  initialTeamFilter?: string
  /** Deep-link dall'Hub Lega: apre la tab Rose con la rosa di questo manager selezionata invece della propria. */
  initialMemberId?: string
}

// ----- Rose tab -----

interface Member {
  id: string
  userId: string
  role: 'ADMIN' | 'MEMBER'
  teamName: string | null
  currentBudget: number
  /** Monte ingaggi fissato all'ultimo consolidamento (LeagueMember.totalSalaries) — non live. */
  totalSalaries: number
  user: { username: string }
  roster: RosterEntry[]
}

interface LeagueData {
  id: string
  name: string
  members: Member[]
  currentUserId: string
  inContrattiPhase?: boolean
  firstMarketConcluded?: boolean
  isAdmin?: boolean
}

type SortColumn = 'position' | 'age' | 'salary' | 'duration' | 'clause' | 'rubata' | 'appearances' | 'goals' | 'assists' | 'rating'

// ----- "Tutti i giocatori" tab (database) -----

interface ListPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  listStatus: string
  /** Motivo di uscita dalla Serie A (RITIRATO/RETROCESSO/ESTERO), se noto. */
  exitReason?: string | null
  age?: number | null
  apiFootballId?: number | null
  apiFootballStats?: {
    games?: { appearences?: number | null; rating?: number | null } | null
    goals?: { total?: number | null; assists?: number | null } | null
  } | null
  computedStats?: ComputedSeasonStats | null
  fantacalcioStats?: FantacalcioSeasonStats | null
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

/** Adatta una riga della lista giocatori al tipo condiviso RosterEntry, così
 * "Tutti i giocatori" riusa RosterTableRow/RosterPlayerCard come Rose. */
function toRosterEntry(p: ListPlayerWithRoster): RosterEntry {
  return {
    id: p.id,
    playerId: p.id,
    acquisitionPrice: p.rosterInfo?.acquisitionPrice ?? 0,
    acquisitionType: '',
    player: {
      id: p.id,
      name: p.name,
      team: p.team,
      position: p.position,
      quotation: p.quotation,
      age: p.age,
      apiFootballId: p.apiFootballId,
      computedStats: p.computedStats ?? null,
      fantacalcioStats: p.fantacalcioStats ?? null,
      statsSyncedAt: p.statsSyncedAt ?? null,
      listStatus: p.listStatus,
      exitReason: p.exitReason,
    },
    contract: p.rosterInfo?.contract
      ? {
          salary: p.rosterInfo.contract.salary,
          duration: p.rosterInfo.contract.duration,
          rescissionClause: p.rosterInfo.contract.rescissionClause,
        }
      : null,
  }
}

function toRowStatus(p: ListPlayerWithRoster): RosterRowStatus {
  return p.rosterInfo
    ? { free: false, ownerName: p.rosterInfo.teamName || p.rosterInfo.memberUsername }
    : { free: true, exitReason: p.exitReason }
}

// ----- Stats tab (Serie A tabellone) -----

type PlayerWithStats = {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  apiFootballId: number | null
  computedStats?: ComputedSeasonStats | null
  fantacalcioStats?: FantacalcioSeasonStats | null
  statsSyncedAt: string | null
  /** Motivo di uscita dalla Serie A (RITIRATO/RETROCESSO/ESTERO), se noto. */
  listStatus?: string
  exitReason?: string | null
}

interface ColumnDef {
  key: string
  label: string
  shortLabel: string
  category: 'general' | 'attack' | 'discipline'
  getValue: (player: PlayerWithStats) => number | string | null
  format?: (val: number | null) => string
  tone?: 'good' | 'attack' | 'pass' | 'warning' | 'danger'
  sortable?: boolean
}

// Colonne da fantacalcio.it (fonte primaria): niente minuti/tiri/passaggi/
// dribbling/contrasti/cartellini — quella fonte non li fornisce (vedi
// FantacalcioSeasonStats in fantacalcio-stats.service.ts).
const STAT_COLUMNS: ColumnDef[] = [
  { key: 'appearances', label: 'Presenze', shortLabel: 'Pres', category: 'general', getValue: p => p.fantacalcioStats?.presenze ?? null, sortable: true },
  { key: 'rating', label: 'Fantamedia', shortLabel: 'FM', category: 'general', getValue: p => p.fantacalcioStats?.avgFm ?? null, format: v => formatStat(v, { decimals: 2 }), sortable: true },
  { key: 'mv', label: 'Voto Medio', shortLabel: 'MV', category: 'general', getValue: p => p.fantacalcioStats?.avgMv ?? null, format: v => formatStat(v, { decimals: 2 }), sortable: true },
  { key: 'goals', label: 'Gol', shortLabel: 'Gol', category: 'attack', getValue: p => p.fantacalcioStats?.golSegnati ?? null, tone: 'good', sortable: true },
  { key: 'assists', label: 'Assist', shortLabel: 'Ass', category: 'attack', getValue: p => p.fantacalcioStats?.assist ?? null, tone: 'attack', sortable: true },
  { key: 'ga', label: 'Gol + Assist', shortLabel: 'G+A', category: 'attack', getValue: p => p.fantacalcioStats ? p.fantacalcioStats.golSegnati + p.fantacalcioStats.assist : null, sortable: true },
  { key: 'goalsConceded', label: 'Gol Subiti', shortLabel: 'GS', category: 'general', getValue: p => p.fantacalcioStats?.golSubiti ?? null, tone: 'danger', sortable: true },
  { key: 'penaltyScored', label: 'Rigori Segnati', shortLabel: 'RigS', category: 'attack', getValue: p => p.fantacalcioStats?.rigoriSegnati ?? null, sortable: true },
  { key: 'penaltyMissed', label: 'Rigori Sbagliati', shortLabel: 'RigX', category: 'attack', getValue: p => p.fantacalcioStats?.rigoriSbagliati ?? null, tone: 'danger', sortable: true },
  { key: 'penaltySaved', label: 'Rigori Parati', shortLabel: 'RigP', category: 'general', getValue: p => p.fantacalcioStats?.rigoriParati ?? null, tone: 'good', sortable: true },
  { key: 'ownGoals', label: 'Autoreti', shortLabel: 'AR', category: 'discipline', getValue: p => p.fantacalcioStats?.autoreti ?? null, tone: 'danger', sortable: true },
  { key: 'potm', label: 'Player of the Match', shortLabel: 'POTM', category: 'general', getValue: p => p.fantacalcioStats?.potm ?? null, tone: 'good', sortable: true },
]

const COLUMN_PRESETS: Record<string, { label: string; columns: string[] }> = {
  essential: { label: 'Essenziali', columns: ['appearances', 'rating', 'goals', 'assists', 'ga'] },
  A: { label: 'Attaccante', columns: ['appearances', 'rating', 'goals', 'assists', 'ga', 'penaltyScored'] },
  C: { label: 'Centroc.', columns: ['appearances', 'rating', 'assists', 'goals', 'ga'] },
  D: { label: 'Difensore', columns: ['appearances', 'rating', 'goals', 'assists', 'ownGoals'] },
  P: { label: 'Portiere', columns: ['appearances', 'rating', 'goalsConceded', 'penaltySaved'] },
  all: { label: 'Tutte', columns: STAT_COLUMNS.map(c => c.key) },
}

const PRESET_ORDER: string[] = ['essential', 'A', 'C', 'D', 'P', 'all']
const LOCALSTORAGE_KEY = 'playerStats_visibleColumns'
const PLAYER_CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7']
// name/team/position/quotation sono colonne dirette su SerieAPlayer; le altre
// sono statistiche fantacalcio.it, ordinate lato backend su tutto il dataset
// filtrato (vedi FC_STAT_SORT_KEYS in src/api/routes/players.ts) — nessuna va
// riordinata lato client sulla sola pagina corrente.
const BACKEND_SORTABLE = ['name', 'team', 'position', 'quotation', ...STAT_COLUMNS.map(c => c.key)]

const TONE_CLASS: Record<NonNullable<ColumnDef['tone']>, string> = {
  good: 'text-secondary-400',
  attack: 'text-primary-400',
  pass: 'text-primary-400',
  warning: 'text-warning-400',
  danger: 'text-danger-400',
}

const TAB_ITEMS: TabItem[] = [
  { id: 'rose', label: 'Rose', accent: 'accent' },
  { id: 'players', label: 'Tutti i giocatori', mobileLabel: 'Giocatori', accent: 'primary' },
  { id: 'stats', label: 'Statistiche', mobileLabel: 'Stats', accent: 'primary' },
]

// ==================== COMPONENT ====================

export function RoseGiocatori({ onNavigate, initialView = 'rose', initialTeamFilter, initialMemberId }: RoseGiocatoriProps) {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<RoseView>(initialView)

  const handleTabChange = useCallback((id: string) => {
    const next = id as RoseView
    setTab(next)
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      if (next === 'rose') params.delete('view')
      else params.set('view', next)
      return params
    }, { replace: true })
  }, [setSearchParams])

  // ===== Shared: stats modal (used by all 3 tabs) =====
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)

  const openPlayerStatsFromEntry = useCallback((entry: RosterEntry) => {
    const contract = entry.contract
    setSelectedPlayerStats({
      name: entry.player.name,
      team: entry.player.team,
      position: entry.player.position,
      quotation: entry.player.quotation,
      age: entry.player.age,
      apiFootballId: entry.player.apiFootballId,
      computedStats: entry.player.computedStats,
      statsSyncedAt: entry.player.statsSyncedAt,
      leaguePlayerId: entry.player.id,
      listStatus: entry.player.listStatus,
      exitReason: entry.player.exitReason,
      contract: contract
        ? { salary: contract.salary, duration: contract.duration, clause: contract.rescissionClause }
        : null,
    })
  }, [])

  const openStatsPlayerStats = useCallback((p: { id: string; name: string; team: string; position: string; quotation: number; apiFootballId?: number | null; statsSyncedAt?: string | null; computedStats?: ComputedSeasonStats | null }) => {
    setSelectedPlayerStats({
      name: p.name,
      team: p.team,
      position: p.position,
      quotation: p.quotation,
      apiFootballId: p.apiFootballId,
      computedStats: p.computedStats,
      statsSyncedAt: p.statsSyncedAt,
      leaguePlayerId: p.id,
      contract: null,
    })
  }, [])

  // =============================================================
  // ===== ROSE TAB — own data-fetching (leagueApi.getAllRosters) =====
  // =============================================================

  const [roseLoading, setRoseLoading] = useState(true)
  const [roseLeagueData, setRoseLeagueData] = useState<LeagueData | null>(null)
  const [roseSelectedMemberId, setRoseSelectedMemberId] = useState<string>('')

  const [rosePositionFilter, setRosePositionFilter] = useState<string>('ALL')
  const [roseSearchQuery, setRoseSearchQuery] = useState('')
  const [roseTeamFilter, setRoseTeamFilter] = useState<string>('ALL')
  const [roseFiltersOpen, setRoseFiltersOpen] = useState(false)

  const [roseSortColumn, setRoseSortColumn] = useState<SortColumn>('position')
  const [roseSortDirection, setRoseSortDirection] = useState<'asc' | 'desc'>('asc')

  function handleRoseSort(column: SortColumn) {
    if (roseSortColumn === column) {
      setRoseSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setRoseSortColumn(column)
      setRoseSortDirection('asc')
    }
  }

  const [roseOngoingTradesCount, setRoseOngoingTradesCount] = useState(0)

  const roseLoadData = useCallback(async () => {
    if (!leagueId) return
    setRoseLoading(true)
    try {
      const [res, ongoingRes] = await Promise.all([
        leagueApi.getAllRosters(leagueId),
        tradeApi.getOngoingIndicator(leagueId).catch((): { success: boolean; data?: unknown } => ({ success: false })),
      ])
      if (res.success && res.data) {
        const data = res.data as LeagueData
        setRoseLeagueData(data)

        if (ongoingRes.success && ongoingRes.data) {
          const ongoingData = ongoingRes.data as { count?: number }
          setRoseOngoingTradesCount(typeof ongoingData.count === 'number' ? ongoingData.count : 0)
        }

        const requestedMember = initialMemberId ? data.members.find(m => m.id === initialMemberId) : undefined
        const myMember = data.members.find(m => m.userId === data.currentUserId)
        if (requestedMember) {
          setRoseSelectedMemberId(requestedMember.id)
        } else if (myMember) {
          setRoseSelectedMemberId(myMember.id)
        } else if (data.members.length > 0 && data.members[0]) {
          setRoseSelectedMemberId(data.members[0].id)
        }
      }
    } catch {
      // Errore di caricamento: gestito dallo stato di errore (roseLeagueData resta null)
    } finally {
      setRoseLoading(false)
    }
  }, [leagueId, initialMemberId])

  // Caricata sempre (indipendentemente dalla tab attiva): alimenta anche
  // l'header globale (nome lega/admin) usato da Navigation su tutte le tab.
  useEffect(() => {
    void roseLoadData()
  }, [roseLoadData])

  const roseSelectedMember = useMemo(() => {
    return roseLeagueData?.members.find(m => m.id === roseSelectedMemberId) || null
  }, [roseLeagueData, roseSelectedMemberId])

  const roseIsOwnRoster = useMemo(() => {
    if (!roseLeagueData || !roseSelectedMember) return false
    return roseSelectedMember.userId === roseLeagueData.currentUserId
  }, [roseLeagueData, roseSelectedMember])

  const roseFirstMarketNotStarted = useMemo(() => {
    return !roseLeagueData || roseLeagueData.members.every(m => m.roster.length === 0)
  }, [roseLeagueData])

  const roseStripMembers = useMemo<ManagerStripMember[]>(() => {
    if (!roseLeagueData) return []
    return roseLeagueData.members
      .filter(m => m.roster.length > 0 || m.currentBudget > 0)
      .sort((a, b) => {
        if (a.userId === roseLeagueData.currentUserId) return -1
        if (b.userId === roseLeagueData.currentUserId) return 1
        return (a.teamName || a.user.username).localeCompare(b.teamName || b.user.username)
      })
      .map(m => ({
        id: m.id,
        userId: m.userId,
        displayName: m.teamName || m.user.username,
        isMe: m.userId === roseLeagueData.currentUserId,
      }))
  }, [roseLeagueData])

  const roseUniqueTeams = useMemo(() => {
    if (!roseSelectedMember?.roster) return []
    const teams = new Set(roseSelectedMember.roster.map(r => r.player.team))
    return Array.from(teams).sort()
  }, [roseSelectedMember])

  const roseFilteredPlayers = useMemo(() => {
    if (!roseSelectedMember?.roster) return []

    const players = roseSelectedMember.roster.filter(entry => {
      if (rosePositionFilter !== 'ALL' && entry.player.position !== rosePositionFilter) return false
      if (roseTeamFilter !== 'ALL' && entry.player.team !== roseTeamFilter) return false
      if (roseSearchQuery) {
        const query = roseSearchQuery.toLowerCase()
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
    const dir = roseSortDirection === 'asc' ? 1 : -1

    players.sort((a, b) => {
      let cmp = 0
      switch (roseSortColumn) {
        case 'position': {
          const posA = posOrder[a.player.position] ?? 99
          const posB = posOrder[b.player.position] ?? 99
          cmp = posA - posB
          if (cmp === 0) cmp = a.player.name.localeCompare(b.player.name)
          break
        }
        case 'age':
          cmp = (a.player.age ?? -1) - (b.player.age ?? -1)
          break
        case 'appearances':
          cmp = (a.player.fantacalcioStats?.presenze ?? 0) - (b.player.fantacalcioStats?.presenze ?? 0)
          break
        case 'goals':
          cmp = (a.player.fantacalcioStats?.golSegnati ?? 0) - (b.player.fantacalcioStats?.golSegnati ?? 0)
          break
        case 'assists':
          cmp = (a.player.fantacalcioStats?.assist ?? 0) - (b.player.fantacalcioStats?.assist ?? 0)
          break
        case 'rating':
          cmp = (a.player.fantacalcioStats?.avgFm ?? 0) - (b.player.fantacalcioStats?.avgFm ?? 0)
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
  }, [roseSelectedMember, rosePositionFilter, roseTeamFilter, roseSearchQuery, roseSortColumn, roseSortDirection])

  const roseStats = useMemo(() => {
    if (!roseSelectedMember?.roster) {
      return { total: 0, salary: 0, clauses: 0, byPosition: { P: 0, D: 0, C: 0, A: 0 } }
    }
    const roster = roseSelectedMember.roster
    return {
      total: roster.length,
      // Monte ingaggi fissato (LeagueMember.totalSalaries), non ricalcolato live dal roster:
      // uno scambio non deve alterarlo fino al prossimo consolidamento Fase 3 Contratti.
      salary: roseSelectedMember.totalSalaries,
      clauses: roster.reduce((sum, r) => sum + (r.contract?.rescissionClause || 0), 0),
      byPosition: {
        P: roster.filter(r => r.player.position === 'P').length,
        D: roster.filter(r => r.player.position === 'D').length,
        C: roster.filter(r => r.player.position === 'C').length,
        A: roster.filter(r => r.player.position === 'A').length,
      },
    }
  }, [roseSelectedMember])

  const roseTeamCounts = useMemo(() => {
    if (!roseSelectedMember?.roster) return []
    const counts: Record<string, number> = {}
    for (const entry of roseSelectedMember.roster) {
      counts[entry.player.team] = (counts[entry.player.team] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([team, count]) => ({ team, count }))
  }, [roseSelectedMember])

  const roseCompositionRanking = useMemo<CompositionRankingRow[]>(() => {
    if (!roseLeagueData || roseFirstMarketNotStarted) return []
    return roseLeagueData.members
      .map(m => {
        const byPosition = { P: 0, D: 0, C: 0, A: 0 }
        for (const entry of m.roster) {
          byPosition[entry.player.position] += 1
        }
        return {
          memberId: m.id,
          displayName: m.teamName || m.user.username,
          total: m.roster.length,
          byPosition,
          isMe: m.userId === roseLeagueData.currentUserId,
        }
      })
      .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName))
  }, [roseLeagueData, roseFirstMarketNotStarted])

  const roseHandleSelectMember = useCallback((id: string) => {
    setRoseSelectedMemberId(id)
    setRoseTeamFilter('ALL')
  }, [])

  const roseHandleTeamToggle = useCallback((team: string) => {
    setRoseTeamFilter(prev => (prev === team ? 'ALL' : team))
  }, [])

  const roseResetFilters = useCallback(() => {
    setRosePositionFilter('ALL')
    setRoseTeamFilter('ALL')
    setRoseSearchQuery('')
  }, [])

  // =====================================================================
  // ===== "TUTTI I GIOCATORI" + "STATISTICHE" TABS — own data-fetching =====
  // (playerApi.getAll / getStats — filtri ruolo/ricerca condivisi come nella
  // pagina Players originale; team Serie A caricata una volta, usata da entrambe)
  // =====================================================================

  const [plPositionFilter, setPlPositionFilter] = useState<string>('')
  const [plSearchQuery, setPlSearchQuery] = useState('')
  const [plFiltersOpen, setPlFiltersOpen] = useState(false)
  const [plTeams, setPlTeams] = useState<string[]>([])

  // ----- "Tutti i giocatori" state -----
  const [plPlayers, setPlPlayers] = useState<ListPlayer[]>([])
  const [plLoading, setPlLoading] = useState(true)
  const [plRosterMap, setPlRosterMap] = useState<Map<string, RosterInfo>>(new Map())
  const [plAvailableTeams, setPlAvailableTeams] = useState<string[]>([])
  const [plStatusFilter, setPlStatusFilter] = useState<'all' | 'free' | 'rostered' | 'exited'>(initialTeamFilter ? 'rostered' : 'all')
  const [plTeamFilter, setPlTeamFilter] = useState<string>(initialTeamFilter || '')
  const [plSerieATeam, setPlSerieATeam] = useState('')

  const plLoadListData = useCallback(async () => {
    setPlLoading(true)

    const leagueResponse = await leagueApi.getAllRosters(leagueId ?? '')
    if (leagueResponse.success && leagueResponse.data) {
      const leagueData = leagueResponse.data as LeagueRosterData

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
      setPlRosterMap(newRosterMap)
      setPlAvailableTeams(teamSet.sort())
    }

    const filters: { position?: string; search?: string } = {}
    if (plPositionFilter) filters.position = plPositionFilter
    if (plSearchQuery) filters.search = plSearchQuery
    const playersResponse = await playerApi.getAll(filters)
    if (playersResponse.success && playersResponse.data) {
      setPlPlayers(playersResponse.data as ListPlayer[])
    }

    setPlLoading(false)
  }, [leagueId, plPositionFilter, plSearchQuery])

  useEffect(() => {
    if (tab === 'players') void plLoadListData()
  }, [tab, plLoadListData])

  const plFilteredListPlayers = useMemo<ListPlayerWithRoster[]>(() => {
    const filtered = plPlayers
      .map(p => ({ ...p, rosterInfo: plRosterMap.get(p.id) }))
      .filter(p => {
        // Un giocatore libero e uscito dalla Serie A (ESTERO/RETROCESSO/RITIRATO)
        // non è realmente disponibile per il mercato: non va mostrato come
        // "LIBERO". Se invece è ancora in una rosa (indennizzo non ancora
        // accettato, o il manager lo tiene) resta visibile con l'owner e
        // l'indicatore "Fuori Serie A" (vedi toRosterEntry).
        if (!p.rosterInfo && p.exitReason) return false
        if (plStatusFilter === 'free' && p.rosterInfo) return false
        if (plStatusFilter === 'rostered' && !p.rosterInfo) return false
        if (plStatusFilter === 'exited' && !p.exitReason) return false
        if (plTeamFilter && p.rosterInfo?.teamName !== plTeamFilter) return false
        if (plSerieATeam && p.team !== plSerieATeam) return false
        return true
      })
    return sortPlayersByRoleAndName(filtered)
  }, [plPlayers, plRosterMap, plStatusFilter, plTeamFilter, plSerieATeam])

  const plFreeCount = useMemo(
    () => plPlayers.filter(p => !plRosterMap.has(p.id) && !p.exitReason).length,
    [plPlayers, plRosterMap],
  )

  const plListScrollRef = useRef<HTMLDivElement>(null)
  const plVirtualizer = useVirtualizer({
    count: plFilteredListPlayers.length,
    getScrollElement: () => plListScrollRef.current,
    // Stima approssimativa per breakpoint: measureElement corregge subito
    // l'altezza reale (riga desktop vs card mobile), come già avveniva per
    // la riga contratto collassata sotto lg.
    estimateSize: () => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 60 : 132),
    overscan: 10,
    measureElement: el => el.getBoundingClientRect().height,
  })

  // ----- "Statistiche" state -----
  const [statsPlayers, setStatsPlayers] = useState<PlayerWithStats[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [statsTeamFilter, setStatsTeamFilter] = useState('')
  const [statsStatusFilter, setStatsStatusFilter] = useState<'all' | 'free' | 'rostered' | 'exited'>('all')
  const [statsSortBy, setStatsSortBy] = useState<string>('position')
  const [statsSortOrder, setStatsSortOrder] = useState<'asc' | 'desc'>('asc')
  const [statsPage, setStatsPage] = useState(1)
  const [statsTotalPages, setStatsTotalPages] = useState(1)
  const [statsTotal, setStatsTotal] = useState(0)
  const [statsSelectedForCompare, setStatsSelectedForCompare] = useState<Set<string>>(new Set())
  const [statsShowCompareModal, setStatsShowCompareModal] = useState(false)
  const [statsVisibleColumns, setStatsVisibleColumns] = useState<string[]>(() => {
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

  const plLoadTeams = useCallback(async () => {
    const res = await playerApi.getTeams()
    if (res.success && res.data) {
      setPlTeams((res.data as { name: string }[]).map(t => t.name))
    }
  }, [])

  const statsLoadPlayers = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await playerApi.getStats({
        position: plPositionFilter || undefined,
        team: statsTeamFilter || undefined,
        search: plSearchQuery || undefined,
        sortBy: statsSortBy,
        sortOrder: statsSortOrder,
        page: statsPage,
        limit: 50,
        leagueId: leagueId || undefined,
        status: statsStatusFilter,
      })
      if (res.success && res.data) {
        setStatsPlayers(res.data.players as PlayerWithStats[])
        setStatsTotalPages(res.data.pagination.totalPages)
        setStatsTotal(res.data.pagination.total)
      }
    } catch {
      setStatsError('Errore nel caricamento delle statistiche. Riprova.')
    } finally {
      setStatsLoading(false)
    }
  }, [plPositionFilter, statsTeamFilter, statsStatusFilter, plSearchQuery, statsSortBy, statsSortOrder, statsPage, leagueId])

  useEffect(() => {
    void plLoadTeams()
  }, [plLoadTeams])

  useEffect(() => {
    setStatsPage(1)
  }, [plPositionFilter, plSearchQuery, statsStatusFilter])

  useEffect(() => {
    if (tab === 'stats') void statsLoadPlayers()
  }, [tab, statsLoadPlayers])

  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(statsVisibleColumns))
    } catch {
      // ignore storage write failures (private mode / quota)
    }
  }, [statsVisibleColumns])

  const statsVisibleColumnDefs = useMemo(
    () => STAT_COLUMNS.filter(col => statsVisibleColumns.includes(col.key)),
    [statsVisibleColumns],
  )

  const statsSortedPlayers = useMemo(() => {
    if (BACKEND_SORTABLE.includes(statsSortBy)) return statsPlayers
    const colDef = STAT_COLUMNS.find(c => c.key === statsSortBy)
    return [...statsPlayers].sort((a, b) => {
      let aVal = 0
      let bVal = 0
      if (colDef) {
        const aRaw = colDef.getValue(a)
        const bRaw = colDef.getValue(b)
        aVal = typeof aRaw === 'number' ? aRaw : 0
        bVal = typeof bRaw === 'number' ? bRaw : 0
      }
      const cmp = statsSortOrder === 'asc' ? aVal - bVal : bVal - aVal
      return cmp !== 0 ? cmp : comparePlayersByRoleAndName(a, b)
    })
  }, [statsPlayers, statsSortBy, statsSortOrder])

  const statsActivePreset = useMemo(() => {
    const key = JSON.stringify([...statsVisibleColumns].sort())
    return PRESET_ORDER.find(p => JSON.stringify([...(COLUMN_PRESETS[p]?.columns ?? [])].sort()) === key)
  }, [statsVisibleColumns])

  function handleStatsSort(column: string) {
    if (statsSortBy === column) {
      setStatsSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setStatsSortBy(column)
      setStatsSortOrder('desc')
    }
    setStatsPage(1)
  }

  const statsTogglePlayerForCompare = useCallback((playerId: string) => {
    setStatsSelectedForCompare(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else if (next.size < 4) next.add(playerId)
      return next
    })
  }, [])

  const statsClearComparison = useCallback(() => { setStatsSelectedForCompare(new Set()); }, [])

  const statsPlayersToCompare = statsSortedPlayers.filter(p => statsSelectedForCompare.has(p.id))

  // Header globale: nome lega/admin sempre disponibili (Rose carica sempre)
  const headerLeagueName = roseLeagueData?.name ?? ''
  const headerIsAdmin = roseLeagueData?.isAdmin ?? false

  // ===== Tabs switcher (sempre visibile, sopra i controlli specifici della tab) =====
  const tabsBar = (
    <Tabs
      ariaLabel="Sezioni Rose, Tutti i giocatori e Statistiche"
      value={tab}
      onChange={handleTabChange}
      tabs={TAB_ITEMS}
    />
  )

  // =====================================================================
  // ===== ROSE TAB — header / adminBar / body =====
  // =====================================================================

  const roseSelectedName = roseSelectedMember ? (roseSelectedMember.teamName || roseSelectedMember.user.username) : ''

  const roseHeader = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">
          Rose{roseSelectedName ? <span className="text-gray-400"> · {roseSelectedName}</span> : ''}
        </h1>
        <span className="text-sm text-gray-500 leading-tight truncate">
          {headerLeagueName || 'Lega'} · {roseStats.total} giocatori
        </span>
      </div>

      {roseIsOwnRoster && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold tracking-[0.06em] border text-accent-400 bg-accent-500/10 border-accent-500/50">
          <span className="dot-live bg-accent-400" /> La mia rosa
        </span>
      )}

      {roseOngoingTradesCount > 0 && !roseIsOwnRoster && (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold tracking-[0.06em] border text-accent-400 bg-accent-500/10 border-accent-500/50"
          title="Altre trattative sono in corso nella lega. I dettagli non sono visibili."
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {roseOngoingTradesCount} {roseOngoingTradesCount === 1 ? 'trattativa' : 'trattative'}
        </span>
      )}

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <div className="micro-label text-[9px] flex items-center justify-end gap-1">
            Budget
            <InfoTooltip content={GLOSSARY.budget!.short} label={GLOSSARY.budget!.term} align="right" />
          </div>
          <div className="budget-display text-lg sm:text-xl text-accent-400 leading-tight">
            {roseSelectedMember?.currentBudget ?? 0}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
        <div className="w-px h-7 bg-surface-50" />
        <div className="text-right">
          <div className="micro-label text-[9px] flex items-center justify-end gap-1">
            Monte ingaggi
            <InfoTooltip content={GLOSSARY.monteIngaggi!.short} label={GLOSSARY.monteIngaggi!.term} align="right" />
          </div>
          <div className="budget-display text-lg sm:text-xl text-white leading-tight">
            {roseStats.salary}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
        <div className="w-px h-7 bg-surface-50" />
        <div className="text-right">
          <div className="micro-label text-[9px] flex items-center justify-end gap-1">
            Bilancio
            <InfoTooltip content={GLOSSARY.bilancio!.short} label={GLOSSARY.bilancio!.term} align="right" />
          </div>
          <div className="budget-display text-lg sm:text-xl text-secondary-400 leading-tight">
            {computeBilancio(roseSelectedMember?.currentBudget ?? 0, roseStats.salary)}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
        <div className="hidden sm:block w-px h-7 bg-surface-50" />
        <div className="hidden sm:block text-right">
          <div className="micro-label text-[9px] flex items-center justify-end gap-1">
            Clausole tot.
            <InfoTooltip content={GLOSSARY.clausola!.short} label={GLOSSARY.clausola!.term} align="right" />
          </div>
          <div className="budget-display text-lg sm:text-xl text-gray-300 leading-tight">
            {roseStats.clauses}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
        <div className="ml-1">
          <ShareButton title="Rose" text="Rose della lega" compact />
        </div>
      </div>
    </div>
  )

  const roseAdminBarInner = (
    <div className="flex items-center gap-3 flex-wrap">
      <ManagerStrip
        className="flex-1 min-w-0"
        members={roseStripMembers}
        selectedId={roseSelectedMemberId}
        onSelect={roseHandleSelectMember}
      />
      <div className="hidden md:flex flex-shrink-0">
        <RosterFilters
          positionFilter={rosePositionFilter}
          onPositionChange={setRosePositionFilter}
          searchQuery={roseSearchQuery}
          onSearchChange={setRoseSearchQuery}
        />
      </div>
      <div className="flex md:hidden items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={roseSearchQuery}
          onChange={(e) => { setRoseSearchQuery(e.target.value); }}
          placeholder="Cerca…"
          inputMode="search"
          enterKeyHint="search"
          className="w-32 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
        <button
          type="button"
          onClick={() => { setRoseFiltersOpen(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
        >
          <SlidersHorizontal size={14} />
          {(rosePositionFilter !== 'ALL' || roseTeamFilter !== 'ALL') && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary-500/30 text-primary-400 rounded-full">
              {[rosePositionFilter !== 'ALL', roseTeamFilter !== 'ALL'].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>
    </div>
  )

  const roseEmptyState = (
    <div className="text-center py-12 px-4">
      {roseSelectedMember?.roster.length === 0 ? (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-surface-300 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-gray-300 font-semibold text-base">Rosa vuota</p>
            <p className="text-gray-500 text-sm mt-1">
              {roseIsOwnRoster && roseFirstMarketNotStarted
                ? "La rosa si comporrà al primo mercato: quando parte l'asta costruirai la tua squadra!"
                : roseIsOwnRoster && roseLeagueData?.firstMarketConcluded
                  ? 'Nessun giocatore in rosa.'
                  : roseIsOwnRoster
                    ? "Non hai ancora acquistato giocatori. Partecipa a un'asta per costruire la tua squadra!"
                    : 'Questo manager non ha ancora acquistato giocatori.'}
            </p>
          </div>
          {roseIsOwnRoster && leagueId && (
            <button
              type="button"
              onClick={() => { onNavigate('leagueDetail', { leagueId }); }}
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
            onClick={roseResetFilters}
            className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
          >
            Resetta filtri
          </button>
        </div>
      )}
    </div>
  )

  const roseSortableHeaders: { key: SortColumn; label: string; align: string }[] = [
    { key: 'position', label: 'Giocatore', align: 'text-left' },
    { key: 'age', label: 'Età', align: 'text-right' },
    { key: 'salary', label: 'Ingaggio', align: 'text-right' },
    { key: 'duration', label: 'Durata', align: 'text-right' },
    { key: 'clause', label: 'Clausola', align: 'text-right' },
    { key: 'rubata', label: 'Rubata', align: 'text-right' },
    { key: 'rating', label: 'Rendimento', align: 'text-center' },
  ]

  const roseTablePanel = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
      <div className={`grid ${ROSTER_ROW_GRID_BASE} ${ROSTER_ROW_GAP} px-4 py-2.5 border-b border-surface-50 bg-surface-300/40 flex-shrink-0`}>
        {roseSortableHeaders.map(col => (
          <button
            key={col.key}
            type="button"
            onClick={() => { handleRoseSort(col.key); }}
            className={`micro-label text-[9px] hover:text-gray-300 transition-colors ${col.align} ${
              col.align === 'text-right' ? 'justify-self-end' : col.align === 'text-center' ? 'justify-self-center' : ''
            }`}
          >
            {col.label}
            {roseSortColumn === col.key && <span className="text-accent-400 ml-1">{roseSortDirection === 'asc' ? '▲' : '▼'}</span>}
          </button>
        ))}
      </div>
      <div className="lg:panel-scroll lg:flex-1 lg:min-h-0 overflow-y-auto overflow-x-hidden">
        {roseFilteredPlayers.length === 0 ? roseEmptyState : roseFilteredPlayers.map(entry => (
          <RosterTableRow key={entry.id} entry={entry} onPlayerClick={() => { openPlayerStatsFromEntry(entry); }} />
        ))}
      </div>
      <div className="px-4 py-2 border-t border-surface-50 bg-surface-300/30 flex-shrink-0 flex justify-between font-mono text-[10.5px] text-gray-500">
        <span>{roseFilteredPlayers.length} di {roseStats.total} giocatori</span>
        <span>Totale rosa: {roseStats.total}</span>
      </div>
    </div>
  )

  const roseBody = (
    <>
      {roseLeagueData?.inContrattiPhase && !roseIsOwnRoster && (
        <div className="mt-3 lg:mt-2 p-2.5 bg-warning-500/10 border border-warning-500/30 rounded-xl text-sm flex-shrink-0">
          <p className="text-warning-400">
            <strong>Fase CONTRATTI attiva:</strong> sono mostrati i contratti in vigore prima dei rinnovi; i nuovi contratti saranno visibili a conclusione della fase.
          </p>
        </div>
      )}

      {roseLoading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonPlayerRow key={i} />)}
        </div>
      ) : !roseLeagueData ? (
        <div className="mt-3">
          <ErrorState message="Errore nel caricamento delle rose" onRetry={() => { void roseLoadData(); }} />
        </div>
      ) : (
        /* grid-rows-[minmax(0,1fr)] + overflow-hidden: senza, la riga implicita "auto"
           cresce oltre h-full quando una colonna ha molto contenuto, e l'overflow-hidden
           di un antenato taglia il fondo invece di far scrollare solo la colonna interna. */
        <div className="mt-3 lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_264px] lg:grid-rows-[minmax(0,1fr)] lg:gap-3.5 lg:overflow-hidden">
          <div className="hidden lg:block lg:min-h-0 lg:h-full">
            {roseTablePanel}
          </div>

          <div className="lg:hidden space-y-2">
            {roseFilteredPlayers.length === 0
              ? roseEmptyState
              : roseFilteredPlayers.map(entry => (
                  <RosterPlayerCard key={entry.id} entry={entry} onPlayerClick={() => { openPlayerStatsFromEntry(entry); }} />
                ))}
          </div>

          {roseSelectedMember && (
            <div className="mt-3 lg:mt-0 lg:min-h-0 lg:h-full">
              <RosterSidebar
                total={roseStats.total}
                byPosition={roseStats.byPosition}
                teamCounts={roseTeamCounts}
                teamFilter={roseTeamFilter}
                onTeamToggle={roseHandleTeamToggle}
                ranking={roseCompositionRanking}
                selectedMemberId={roseSelectedMemberId}
                onSelectMember={roseHandleSelectMember}
              />
            </div>
          )}
        </div>
      )}
    </>
  )

  // =====================================================================
  // ===== "TUTTI I GIOCATORI" TAB — header / adminBar / body =====
  // =====================================================================

  const playersHeader = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">Tutti i giocatori</h1>
        <span className="text-sm text-gray-500 leading-tight truncate">
          {headerLeagueName || 'Lega'} · database Serie A
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <div className="micro-label text-[9px]">Totale</div>
          <div className="stat-number text-lg sm:text-xl text-white leading-tight">{plPlayers.length}</div>
        </div>
        <div className="w-px h-7 bg-surface-50" />
        <div className="text-right">
          <div className="micro-label text-[9px]">Liberi</div>
          <div className="stat-number text-lg sm:text-xl text-secondary-400 leading-tight">{plFreeCount}</div>
        </div>
        <input
          type="text"
          value={plSearchQuery}
          onChange={(e) => { setPlSearchQuery(e.target.value); }}
          placeholder="Cerca giocatore o squadra…"
          inputMode="search"
          enterKeyHint="search"
          className="hidden md:block w-48 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
      </div>
    </div>
  )

  const playersAdminBarInner = (
    <div className="flex items-center gap-2.5 flex-wrap">
      <PlayerRoleFilter value={plPositionFilter} onChange={setPlPositionFilter} />
      <div className="hidden sm:block w-px h-5 bg-surface-50" />
      <div className="hidden md:inline-flex items-center gap-1.5">
        {([
          { key: 'all', label: 'Tutti' },
          { key: 'free', label: 'Liberi' },
          { key: 'rostered', label: 'In rosa' },
          { key: 'exited', label: 'Fuori Serie A' },
        ] as const).map(opt => {
          const active = plStatusFilter === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setPlStatusFilter(opt.key)
                if (opt.key !== 'rostered') setPlTeamFilter('')
              }}
              aria-pressed={active}
              className={`font-mono text-[9.5px] font-bold tracking-[0.08em] uppercase rounded-full px-2.5 py-1 border transition-colors ${
                active
                  ? opt.key === 'free'
                    ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40'
                    : opt.key === 'exited'
                      ? 'bg-warning-500/20 text-warning-400 border-warning-500/40'
                      : 'bg-accent-400 text-dark-300 border-accent-400'
                  : 'border-surface-50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {plAvailableTeams.length > 0 && (
        <select
          value={plTeamFilter}
          onChange={(e) => {
            setPlTeamFilter(e.target.value)
            if (e.target.value) setPlStatusFilter('rostered')
          }}
          className="hidden md:block px-2.5 py-1.5 text-xs rounded-lg bg-surface-300 border border-surface-50 text-gray-300 focus:outline-none focus:border-accent-500/50"
        >
          <option value="">Squadra (rosa)</option>
          {plAvailableTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      {plTeams.length > 0 && (
        <select
          value={plSerieATeam}
          onChange={(e) => { setPlSerieATeam(e.target.value) }}
          className="hidden md:block px-2.5 py-1.5 text-xs rounded-lg bg-surface-300 border border-surface-50 text-gray-300 focus:outline-none focus:border-accent-500/50"
        >
          <option value="">Squadra Serie A</option>
          {plTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      <div className="flex md:hidden items-center gap-2 ml-auto flex-shrink-0">
        <input
          type="text"
          value={plSearchQuery}
          onChange={(e) => { setPlSearchQuery(e.target.value); }}
          placeholder="Cerca…"
          inputMode="search"
          enterKeyHint="search"
          className="w-28 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
        <button
          type="button"
          onClick={() => { setPlFiltersOpen(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>
    </div>
  )

  const playersListPanel = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
      <div className={`hidden lg:grid ${ROSTER_ROW_GRID_EXTRA} ${ROSTER_ROW_GAP} px-4 py-2.5 border-b border-surface-50 bg-surface-300/40 flex-shrink-0`}>
        <span className="micro-label text-[9px]">Giocatore</span>
        <span className="micro-label text-[9px] text-right">Età</span>
        <span className="micro-label text-[9px]">Stato</span>
        <span className="micro-label text-[9px] text-right">Quot</span>
        <span className="micro-label text-[9px] text-right">Ing</span>
        <span className="micro-label text-[9px] text-right">Dur</span>
        <span className="micro-label text-[9px] text-right">Cls</span>
        <span className="micro-label text-[9px] text-right">Rub</span>
        <span className="micro-label text-[9px] text-right">Rendimento</span>
      </div>
      {plLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonPlayerRow key={i} />)}
        </div>
      ) : plFilteredListPlayers.length === 0 ? (
        <EmptyState icon="🔍" title="Nessun giocatore trovato" description="Prova a cambiare i filtri di ricerca." compact />
      ) : (
        <div ref={plListScrollRef} className="lg:panel-scroll lg:flex-1 lg:min-h-0 max-h-[70vh] overflow-y-auto">
          <div style={{ height: `${plVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {plVirtualizer.getVirtualItems().map(virtualRow => {
              const player = plFilteredListPlayers[virtualRow.index]
              if (!player) return null
              const entry = toRosterEntry(player)
              const status = toRowStatus(player)
              return (
                <div
                  key={player.id}
                  data-index={virtualRow.index}
                  ref={plVirtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="hidden lg:block">
                    <RosterTableRow
                      entry={entry}
                      onPlayerClick={() => { openPlayerStatsFromEntry(entry); }}
                      status={status}
                      showQuotation
                    />
                  </div>
                  <div className="lg:hidden px-2 py-1">
                    <RosterPlayerCard
                      entry={entry}
                      onPlayerClick={() => { openPlayerStatsFromEntry(entry); }}
                      status={status}
                      showQuotation
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="px-4 py-2 border-t border-surface-50 bg-surface-300/30 flex-shrink-0 font-mono text-[10.5px] text-gray-500">
        {plFilteredListPlayers.length} giocatori
      </div>
    </div>
  )

  // =====================================================================
  // ===== "STATISTICHE" TAB — header / adminBar / body =====
  // =====================================================================

  const statsHeader = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">Statistiche</h1>
        <span className="text-sm text-gray-500 leading-tight truncate">Statistiche Serie A · stagione 2025/26</span>
      </div>

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <div className="micro-label text-[9px]">Giocatori</div>
          <div className="stat-number text-lg sm:text-xl text-white leading-tight">{statsTotal}</div>
        </div>
        <input
          type="text"
          value={plSearchQuery}
          onChange={(e) => { setPlSearchQuery(e.target.value); }}
          placeholder="Cerca giocatore o squadra…"
          inputMode="search"
          enterKeyHint="search"
          className="hidden md:block w-48 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
      </div>
    </div>
  )

  const statsAdminBarInner = (
    <div className="flex items-center gap-2.5 flex-wrap">
      <PlayerRoleFilter value={plPositionFilter} onChange={setPlPositionFilter} />
      <div className="hidden sm:block w-px h-5 bg-surface-50" />
      <div className="hidden md:inline-flex items-center gap-1.5">
        {([
          { key: 'all', label: 'Tutti' },
          { key: 'free', label: 'Liberi' },
          { key: 'rostered', label: 'In rosa' },
          { key: 'exited', label: 'Fuori Serie A' },
        ] as const).map(opt => {
          const active = statsStatusFilter === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => { setStatsStatusFilter(opt.key); }}
              aria-pressed={active}
              className={`font-mono text-[9.5px] font-bold tracking-[0.08em] uppercase rounded-full px-2.5 py-1 border transition-colors ${
                active
                  ? opt.key === 'free'
                    ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40'
                    : opt.key === 'exited'
                      ? 'bg-warning-500/20 text-warning-400 border-warning-500/40'
                      : 'bg-accent-400 text-dark-300 border-accent-400'
                  : 'border-surface-50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      <div className="hidden sm:block w-px h-5 bg-surface-50" />
      {plTeams.length > 0 && (
        <select
          value={statsTeamFilter}
          onChange={(e) => { setStatsTeamFilter(e.target.value); setStatsPage(1) }}
          className="hidden md:block px-2.5 py-1.5 text-xs rounded-lg bg-surface-300 border border-surface-50 text-gray-300 focus:outline-none focus:border-accent-500/50"
        >
          <option value="">Squadra Serie A</option>
          {plTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      <div className="ml-auto hidden md:flex items-center gap-2 flex-wrap">
        <span className="micro-label text-[9px]">Preset</span>
        {PRESET_ORDER.map(key => {
          const preset = COLUMN_PRESETS[key]!
          const active = statsActivePreset === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setStatsVisibleColumns(preset.columns); }}
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
      <div className="flex md:hidden items-center gap-2 ml-auto flex-shrink-0">
        <input
          type="text"
          value={plSearchQuery}
          onChange={(e) => { setPlSearchQuery(e.target.value); }}
          placeholder="Cerca…"
          inputMode="search"
          enterKeyHint="search"
          className="w-28 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
        <button
          type="button"
          onClick={() => { setPlFiltersOpen(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>
    </div>
  )

  const statsPanel = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
      {statsError && (
        <div className="m-3 bg-danger-500/10 border border-danger-500/40 text-danger-400 p-2.5 rounded-lg text-sm flex items-center justify-between flex-shrink-0">
          <span>{statsError}</span>
          <button
            type="button"
            onClick={() => { void statsLoadPlayers(); }}
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
      ) : statsSortedPlayers.length === 0 ? (
        <EmptyState icon="🔍" title="Nessun giocatore trovato" description="Prova a modificare i filtri di ricerca o a cambiare ruolo/squadra." compact />
      ) : (
        <>
        <div className="hidden lg:block lg:panel-scroll lg:flex-1 lg:min-h-0 overflow-auto">
          <table className="border-separate border-spacing-0 w-max min-w-full">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-20 bg-surface-300 text-left min-w-[230px] px-3 py-2.5 border-b border-surface-50 cursor-pointer"
                  onClick={() => { handleStatsSort('name'); }}
                >
                  <span className={`micro-label text-[9px] ${statsSortBy === 'name' ? 'text-accent-400' : ''}`}>
                    Giocatore {statsSortBy === 'name' && (statsSortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-10 bg-surface-300 text-right px-2.5 py-2.5 border-b border-surface-50 cursor-pointer whitespace-nowrap"
                  onClick={() => { handleStatsSort('quotation'); }}
                >
                  <span className={`micro-label text-[9px] ${statsSortBy === 'quotation' ? 'text-accent-400' : ''}`}>
                    Quot {statsSortBy === 'quotation' && (statsSortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </th>
                {statsVisibleColumnDefs.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    title={col.label}
                    className="sticky top-0 z-10 bg-surface-300 text-right px-2.5 py-2.5 border-b border-surface-50 cursor-pointer whitespace-nowrap"
                    onClick={() => { if (col.sortable) handleStatsSort(col.key); }}
                  >
                    <span className={`micro-label text-[9px] ${statsSortBy === col.key ? 'text-accent-400' : ''}`}>
                      {col.shortLabel} {col.sortable && statsSortBy === col.key && (statsSortOrder === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsSortedPlayers.map(player => {
                const isSelected = statsSelectedForCompare.has(player.id)
                return (
                  <tr key={player.id} className="group hover:bg-surface-100/60 transition-colors">
                    <td className={`sticky left-0 z-10 px-3 py-2 border-b border-surface-50/10 ${isSelected ? 'bg-primary-500/10' : 'bg-surface-200 group-hover:bg-surface-100'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          className="rounded border-surface-50 bg-surface-300 text-primary-500 focus:ring-primary-500 flex-shrink-0"
                          checked={isSelected}
                          onChange={() => { statsTogglePlayerForCompare(player.id); }}
                          onClick={(e) => { e.stopPropagation(); }}
                          aria-label={`Seleziona ${player.name} per il confronto`}
                        />
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="sm" showRoleBadge />
                          <TeamLogo team={player.team} size="md" />
                        </div>
                        <button
                          type="button"
                          onClick={() => { openStatsPlayerStats(player); }}
                          className="font-display font-bold text-[13px] text-white leading-tight truncate block text-left min-w-0 hover:text-primary-400 transition-colors max-w-[150px]"
                        >
                          {player.name}
                        </button>
                        {(() => {
                          const exitTag = getExitReasonTag(player.exitReason)
                          return exitTag ? <Tag tone={exitTag.tone}>{exitTag.label}</Tag> : null
                        })()}
                      </div>
                    </td>
                    <td className="text-right px-2.5 py-2 border-b border-surface-50/10 stat-number text-sm text-white">
                      {player.quotation}
                    </td>
                    {statsVisibleColumnDefs.map(col => {
                      const raw = col.getValue(player)
                      const display = col.format
                        ? col.format(typeof raw === 'number' ? raw : null)
                        : typeof raw === 'string'
                          ? raw
                          : formatStat(raw)
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

        <div className="lg:hidden overflow-y-auto max-h-[70vh] divide-y divide-surface-50/10">
          {statsSortedPlayers.map(player => {
            const isSelected = statsSelectedForCompare.has(player.id)
            return (
              <div key={player.id} className={`p-3 ${isSelected ? 'bg-primary-500/10' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="rounded border-surface-50 bg-surface-300 text-primary-500 focus:ring-primary-500 flex-shrink-0"
                    checked={isSelected}
                    onChange={() => { statsTogglePlayerForCompare(player.id); }}
                    aria-label={`Seleziona ${player.name} per il confronto`}
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="sm" showRoleBadge />
                    <TeamLogo team={player.team} size="md" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => { openStatsPlayerStats(player); }}
                      className="block font-display font-bold text-sm text-white leading-tight truncate text-left hover:text-primary-400 transition-colors"
                    >
                      {player.name}
                    </button>
                    {(() => {
                      const exitTag = getExitReasonTag(player.exitReason)
                      return exitTag ? <div className="mt-1"><Tag tone={exitTag.tone}>{exitTag.label}</Tag></div> : null
                    })()}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="micro-label text-[8px] text-gray-500 block">Quot</span>
                    <span className="stat-number text-sm text-white">{player.quotation}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {statsVisibleColumnDefs.map(col => {
                    const raw = col.getValue(player)
                    const display = col.format
                      ? col.format(typeof raw === 'number' ? raw : null)
                      : typeof raw === 'string'
                        ? raw
                        : formatStat(raw)
                    const isRating = col.key === 'rating' && typeof raw === 'number'
                    const ratingTone = isRating
                      ? (raw >= 7 ? 'text-secondary-400' : raw >= 6 ? 'text-white' : 'text-warning-400')
                      : ''
                    const tone = col.tone ? TONE_CLASS[col.tone] : 'text-gray-300'
                    return (
                      <span key={col.key} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-300/60 border border-surface-50/20">
                        <span className="micro-label text-[8px] text-gray-500">{col.shortLabel}</span>
                        <span className={`stat-number text-xs ${isRating ? ratingTone : tone}`}>{display}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}

      <div className="px-4 py-2 border-t border-surface-50 bg-surface-300/30 flex-shrink-0 flex items-center justify-between gap-3 flex-wrap font-mono text-[10.5px] text-gray-500">
        <div className="flex items-center gap-3">
          <span>{statsTotal} giocatori</span>
          {statsSelectedForCompare.size > 0 && (
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={statsSelectedForCompare.size < 2}
                onClick={() => { setStatsShowCompareModal(true); }}
                className="px-2.5 py-1 rounded-lg bg-primary-500 text-white font-display font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
              >
                Confronta ({statsSelectedForCompare.size})
              </button>
              <button
                type="button"
                onClick={statsClearComparison}
                className="px-2 py-1 rounded-lg border border-surface-50 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        {statsTotalPages > 1 && (
          <div className="flex items-center gap-2">
            <span>Pagina {statsPage} di {statsTotalPages}</span>
            <button
              type="button"
              onClick={() => { setStatsPage(p => Math.max(1, p - 1)); }}
              disabled={statsPage === 1}
              className="px-2.5 py-1 rounded-lg border border-surface-50 text-gray-300 disabled:opacity-40 hover:text-white transition-colors"
            >
              Prec
            </button>
            <button
              type="button"
              onClick={() => { setStatsPage(p => Math.min(statsTotalPages, p + 1)); }}
              disabled={statsPage === statsTotalPages}
              className="px-2.5 py-1 rounded-lg border border-surface-50 text-gray-300 disabled:opacity-40 hover:text-white transition-colors"
            >
              Succ
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // =====================================================================
  // ===== Composizione finale: header/adminBar per tab attiva =====
  // =====================================================================

  const header = tab === 'rose' ? roseHeader : tab === 'players' ? playersHeader : statsHeader

  const adminBar = (
    <div className="mt-2 flex flex-col gap-2.5">
      {tabsBar}
      {tab === 'rose' && roseAdminBarInner}
      {tab === 'players' && playersAdminBarInner}
      {tab === 'stats' && statsAdminBarInner}
    </div>
  )

  const playersToCompare = statsPlayersToCompare

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation
        currentPage="rose"
        leagueId={leagueId}
        leagueName={headerLeagueName}
        isLeagueAdmin={headerIsAdmin}
        onNavigate={onNavigate}
      />

      <main className="w-full max-w-[1400px] mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        <CockpitShell header={header} adminBar={adminBar}>
          <div className={tab === 'rose' ? 'lg:h-full lg:min-h-0' : 'mt-3 lg:h-full lg:min-h-0'}>
            {tab === 'rose' && roseBody}
            {tab === 'players' && playersListPanel}
            {tab === 'stats' && statsPanel}
          </div>
        </CockpitShell>
      </main>

      {/* Rose — Mobile Filters BottomSheet */}
      <BottomSheet isOpen={roseFiltersOpen} onClose={() => { setRoseFiltersOpen(false); }} title="Filtri">
        <div className="p-4 space-y-5">
          <div>
            <label className="block micro-label mb-2">Posizione</label>
            <div className="flex gap-2">
              {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                const active = rosePositionFilter === pos
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => { setRosePositionFilter(pos); }}
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

          {roseUniqueTeams.length > 0 && (
            <div>
              <label className="block micro-label mb-2">Squadra Serie A</label>
              <select
                value={roseTeamFilter}
                onChange={(e) => { setRoseTeamFilter(e.target.value); }}
                className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm"
              >
                <option value="ALL">Tutte le squadre</option>
                {roseUniqueTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          )}

          {roseTeamFilter !== 'ALL' && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <img src={getTeamLogo(roseTeamFilter)} alt={roseTeamFilter} className="w-5 h-5 object-contain" />
              <span>Filtro squadra: {roseTeamFilter}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setRoseFiltersOpen(false); }}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Applica Filtri
          </button>
        </div>
      </BottomSheet>

      {/* Tutti i giocatori / Statistiche — Mobile Filters BottomSheet */}
      <BottomSheet isOpen={plFiltersOpen} onClose={() => { setPlFiltersOpen(false); }} title="Filtri">
        <div className="p-4 space-y-5">
          <div>
            <label className="block micro-label mb-2">Ruolo</label>
            <PlayerRoleFilter value={plPositionFilter} onChange={setPlPositionFilter} />
          </div>

          {tab === 'players' && (
            <>
              <div>
                <label className="block micro-label mb-2">Stato</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'all', label: 'Tutti' },
                    { key: 'free', label: 'Liberi' },
                    { key: 'rostered', label: 'In rosa' },
                    { key: 'exited', label: 'Fuori Serie A' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setPlStatusFilter(opt.key)
                        if (opt.key !== 'rostered') setPlTeamFilter('')
                      }}
                      className={`flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                        plStatusFilter === opt.key
                          ? 'bg-accent-400 text-dark-300 border-accent-400'
                          : 'bg-surface-300 text-gray-500 border-surface-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {plAvailableTeams.length > 0 && (
                <div>
                  <label className="block micro-label mb-2">Squadra (in rosa)</label>
                  <select
                    value={plTeamFilter}
                    onChange={(e) => {
                      setPlTeamFilter(e.target.value)
                      if (e.target.value) setPlStatusFilter('rostered')
                    }}
                    className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm"
                  >
                    <option value="">Tutte le squadre</option>
                    {plAvailableTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              {plTeams.length > 0 && (
                <div>
                  <label className="block micro-label mb-2">Squadra Serie A</label>
                  <select
                    value={plSerieATeam}
                    onChange={(e) => { setPlSerieATeam(e.target.value) }}
                    className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm"
                  >
                    <option value="">Tutte le squadre</option>
                    {plTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {tab === 'stats' && (
            <>
              <div>
                <label className="block micro-label mb-2">Stato</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'all', label: 'Tutti' },
                    { key: 'free', label: 'Liberi' },
                    { key: 'rostered', label: 'In rosa' },
                    { key: 'exited', label: 'Fuori Serie A' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setStatsStatusFilter(opt.key); }}
                      className={`flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                        statsStatusFilter === opt.key
                          ? 'bg-accent-400 text-dark-300 border-accent-400'
                          : 'bg-surface-300 text-gray-500 border-surface-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block micro-label mb-2">Preset colonne</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_ORDER.filter(k => k !== 'all').map(key => {
                    const preset = COLUMN_PRESETS[key]!
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setStatsVisibleColumns(preset.columns); }}
                        className={`px-2 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          statsActivePreset === key
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
              {plTeams.length > 0 && (
                <div>
                  <label className="block micro-label mb-2">Squadra Serie A</label>
                  <select
                    value={statsTeamFilter}
                    onChange={(e) => { setStatsTeamFilter(e.target.value); setStatsPage(1) }}
                    className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm"
                  >
                    <option value="">Tutte le squadre</option>
                    {plTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => { setPlFiltersOpen(false); }}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Applica Filtri
          </button>
        </div>
      </BottomSheet>

      {/* Full-page Compare View (Statistiche) */}
      {statsShowCompareModal && playersToCompare.length >= 2 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-100">
          <div className="sticky top-0 z-10 bg-surface-200 border-b border-surface-50">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStatsShowCompareModal(false); }}
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
            <div className="grid grid-cols-1 mb-6 md:mb-8">
              <div className="bg-surface-200 rounded-xl p-4 md:p-6 border border-surface-50 max-w-xl mx-auto w-full">
                <h3 className="text-center text-white font-semibold mb-4">Statistiche</h3>
                <RadarChart
                  size={320}
                  players={playersToCompare.map((p, i) => ({ name: p.name, color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length] ?? '#3b82f6' }))}
                  data={[
                    { label: 'Gol', values: playersToCompare.map(p => p.fantacalcioStats?.golSegnati ?? 0) },
                    { label: 'Assist', values: playersToCompare.map(p => p.fantacalcioStats?.assist ?? 0) },
                    { label: 'Presenze', values: playersToCompare.map(p => p.fantacalcioStats?.presenze ?? 0) },
                    { label: 'Fantamedia', values: playersToCompare.map(p => Math.round((p.fantacalcioStats?.avgFm ?? 0) * 10)) },
                    { label: 'Rigori Segnati', values: playersToCompare.map(p => p.fantacalcioStats?.rigoriSegnati ?? 0) },
                    { label: 'POTM', values: playersToCompare.map(p => p.fantacalcioStats?.potm ?? 0) },
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

      {/* Stats Modal — condiviso da tutte e 3 le tab */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => { setSelectedPlayerStats(null); }}
        player={selectedPlayerStats}
        leagueId={leagueId}
      />
    </div>
  )
}

export default RoseGiocatori

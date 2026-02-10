import type { AutoTagId } from '../services/player-stats.service'
import type { PlayerStats, ComputedSeasonStats } from '../components/PlayerStatsModal'

// Watchlist categories (#219)
export const WATCHLIST_CATEGORIES = {
  DA_RUBARE: { label: 'Da Rubare', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: 'T' },
  SOTTO_OSSERVAZIONE: { label: 'Osservazione', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: 'O' },
  POTENZIALE_ACQUISTO: { label: 'Pot. Acquisto', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: 'A' },
  SCAMBIO: { label: 'Scambio', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: 'S' },
  DA_VENDERE: { label: 'Da Vendere', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: 'V' },
} as const
export type WatchlistCategoryId = keyof typeof WATCHLIST_CATEGORIES

// Player colors for radar chart comparison
export const PLAYER_CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7']

// Age color coding - younger is better
export function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold' // Very young - excellent
  if (age < 25) return 'text-green-400' // Young - good
  if (age < 30) return 'text-yellow-400' // Prime - neutral
  if (age < 35) return 'text-orange-400' // Aging - caution
  return 'text-red-400' // Old - warning
}

export function getAgeBgColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'bg-gray-500/20 text-gray-400'
  if (age < 20) return 'bg-emerald-500/20 text-emerald-400 font-bold'
  if (age < 25) return 'bg-green-500/20 text-green-400'
  if (age < 30) return 'bg-yellow-500/20 text-yellow-400'
  if (age < 35) return 'bg-orange-500/20 text-orange-400'
  return 'bg-red-500/20 text-red-400'
}

export interface StrategyPlayer {
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

export interface SvincolatoPlayer {
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

export interface RubataPreference {
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

export interface StrategyPlayerWithPreference extends StrategyPlayer {
  preference?: RubataPreference | null
}

export interface SvincolatoPlayerWithPreference extends SvincolatoPlayer {
  preference?: RubataPreference | null
}

// Union type for display - can be my roster, owned player, or svincolato
export type DisplayPlayer = (StrategyPlayerWithPreference & { type: 'myRoster' | 'owned' }) | (SvincolatoPlayerWithPreference & { type: 'svincolato' })

export interface StrategiesData {
  players: StrategyPlayerWithPreference[]
  myMemberId: string
  hasRubataBoard: boolean
  hasRubataOrder: boolean
  rubataState: string | null
  sessionId: string | null
  totalPlayers: number
}

export interface SvincolatiData {
  players: SvincolatoPlayerWithPreference[]
  myMemberId: string
  sessionId: string | null
  totalPlayers: number
}

export type ViewMode = 'myRoster' | 'owned' | 'svincolati' | 'all' | 'overview'
export type DataViewMode = 'contracts' | 'stats' | 'merge'

// Stats column definitions for stats/merge views
export interface StatsColumn {
  key: string
  label: string
  shortLabel: string
  getValue: (stats: PlayerStats | null | undefined) => number | string | null
  format?: (val: number | null) => string
  colorClass?: string
}

export const STATS_COLUMNS: StatsColumn[] = [
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
export const MERGE_STATS_KEYS = ['rating', 'goals', 'assists']

// Sort configuration
// - role: Position (P,D,C,A) > Alphabetical
// - manager: Manager team name > Position > Alphabetical
// - rubata: Rubata order > Position > Alphabetical (only when order is set)
export type SortMode = 'role' | 'manager' | 'rubata'
export type SortField = 'position' | 'name' | 'owner' | 'team' | 'contract' | 'rubata' | 'maxBid' | 'priority'
export type SortDirection = 'asc' | 'desc'

// Local strategy state for a player (with debounce)
export interface LocalStrategy {
  maxBid: string
  priority: number
  notes: string
  isDirty: boolean
}

import type { PlayerStats } from '../components/PlayerStatsModal'

export interface ContractsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

// Computed stats from PlayerMatchRating (accurate data source)
export interface ComputedSeasonStats {
  season: string
  appearances: number
  totalMinutes: number
  avgRating: number | null
  totalGoals: number
  totalAssists: number
  startingXI: number
  matchesInSquad: number
}

export interface Player {
  id: string
  name: string
  team: string
  position: string
  listStatus?: string
  exitReason?: string
  age?: number | null
  apiFootballId?: number | null
  apiFootballStats?: PlayerStats | null
  computedStats?: ComputedSeasonStats | null
}

export interface Contract {
  id: string
  salary: number
  duration: number
  initialSalary: number
  initialDuration: number
  rescissionClause: number
  canRenew: boolean
  canSpalmare: boolean
  // Draft values (saved but not consolidated)
  draftSalary: number | null
  draftDuration: number | null
  draftReleased: boolean  // Marcato per taglio
  draftExitDecision?: string | null  // null=INDECISO, "KEEP", "RELEASE"
  // Exited player info
  isExitedPlayer?: boolean
  exitReason?: string | null
  indemnityCompensation?: number
  // Flag to indicate if contract was modified during consolidation
  wasModified?: boolean
  roster: {
    id: string
    player: Player
    acquisitionPrice: number
    acquisitionType: string
  }
}

export interface PendingContract {
  rosterId: string
  player: Player
  acquisitionPrice: number
  acquisitionType: string
  minSalary: number
  // Draft values (saved but not consolidated)
  draftSalary: number | null
  draftDuration: number | null
}

export interface ReleasedPlayer {
  id: string
  playerName: string
  playerTeam: string
  playerPosition: string
  salary: number
  duration: number
  releaseCost: number
  releaseType: string
  indemnityAmount?: number
}

// Stato locale per modifiche in corso
export interface LocalEdit {
  newSalary: string
  newDuration: string
  isModified: boolean
  previewData: {
    renewalCost?: number
    newRescissionClause?: number
    isValid: boolean
    validationError?: string
    canAfford?: boolean
  } | null
  isSaving: boolean
}

// Moltiplicatori clausola
export const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,
  3: 9,
  2: 7,
  1: 3,
}

// Massimo numero di giocatori in rosa dopo consolidamento
export const MAX_ROSTER_SIZE = 29

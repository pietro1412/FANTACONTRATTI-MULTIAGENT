// Shared types for SuperAdmin tabs (extracted from src/pages/SuperAdmin.tsx)

export interface PlayersStats {
  totalPlayers: number
  inList: number
  notInList: number
  byPosition: Array<{
    position: string
    listStatus: string
    _count: number
  }>
}

export interface Player {
  id: string
  externalId: string | null
  name: string
  team: string
  position: string
  quotation: number
  listStatus: string
}

export interface PlayersListData {
  players: Player[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface LeagueMember {
  id: string
  role: string
  status: string
  currentBudget: number
  user: {
    id: string
    username: string
    email: string
  }
}

export interface League {
  id: string
  name: string
  status: string
  maxParticipants: number
  initialBudget: number
  createdAt: string
  members: LeagueMember[]
  _count: {
    members: number
    marketSessions: number
  }
}

export interface User {
  id: string
  username: string
  email: string
  emailVerified: boolean
  isSuperAdmin: boolean
  createdAt: string
  _count: {
    leagueMemberships: number
  }
}

export interface RosterEntry {
  id: string
  player: {
    id: string
    name: string
    team: string
    position: string
    quotation: number
  }
  contract: {
    id: string
    purchasePrice: number
    acquiredAt: string
  } | null
}

export interface MemberRosterData {
  member: {
    id: string
    username: string
    email: string
    currentBudget: number
    role: string
    league: {
      id: string
      name: string
    }
  }
  roster: RosterEntry[]
}

export interface UploadRecord {
  id: string
  fileName: string
  sheetName: string
  playersCreated: number
  playersUpdated: number
  playersNotInList: number
  totalProcessed: number
  errors: string[] | null
  createdAt: string
  uploadedBy: {
    id: string
    username: string
  }
}

export interface ExitedPlayerInfo {
  playerId: string
  playerName: string
  position: string
  team: string
  lastQuotation: number
  contracts: Array<{
    leagueId: string
    leagueName: string
    memberId: string
    memberUsername: string
    salary: number
    duration: number
  }>
}

export type ExitReason = 'RITIRATO' | 'RETROCESSO' | 'ESTERO'

export interface ApiFootballStatus {
  totalPlayers: number
  matched: number
  unmatched: number
  withStats: number
  withoutStats: number
  lastSync: string | null
}

export interface MatchingResult {
  matched: number
  unmatched: Array<{ id: string; name: string; team: string }>
  ambiguous: Array<{ player: { id: string; name: string; team: string }; candidates: Array<{ apiId: number; name: string }> }>
}

export interface SyncResult {
  synced: number
  notFound: number
  apiCallsUsed: number
}

export interface MatchProposal {
  dbPlayer: { id: string; name: string; team: string; position: string; quotation: number }
  apiPlayer: { id: number; name: string; team: string } | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  method: string
}

export interface MatchedPlayer {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  apiFootballId: number
  apiFootballName: string | null
}

export interface PlayerFilters {
  position: string
  listStatus: string
  search: string
  team: string
  page: number
}

export interface ImportResult {
  success: boolean
  message: string
  data?: unknown
}

// ---- Shared display tokens (POSITION_GRADIENTS → chip ruolo a token) ----

/** Chip ruolo (P/D/C/A) — superfici/accenti del tema, niente gradient. */
export const POSITION_CHIP: Record<string, string> = {
  P: 'bg-accent-500/[0.16] text-accent-400 border-accent-500/40',
  D: 'bg-primary-500/[0.16] text-primary-300 border-primary-500/40',
  C: 'bg-secondary-500/[0.16] text-secondary-400 border-secondary-500/40',
  A: 'bg-danger-500/[0.16] text-danger-400 border-danger-500/40',
}

export const EXIT_REASON_CHIP: Record<ExitReason, string> = {
  RITIRATO: 'bg-surface-100 text-gray-300 border-surface-50',
  RETROCESSO: 'bg-warning-500/[0.13] text-warning-400 border-warning-500/40',
  ESTERO: 'bg-primary-500/[0.13] text-primary-300 border-primary-500/40',
}

export const POSITION_NAMES: Record<string, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'In preparazione',
  ACTIVE: 'Attiva',
  COMPLETED: 'Completata',
}

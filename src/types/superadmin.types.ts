export interface SuperAdminProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
  initialTab?: 'upload' | 'players' | 'leagues' | 'users' | 'stats'
}

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

export type MatchProposal = {
  dbPlayer: { id: string; name: string; team: string; position: string; quotation: number }
  apiPlayer: { id: number; name: string; team: string } | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  method: string
}

export type MatchedPlayer = {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  apiFootballId: number
  apiFootballName: string | null
}

export const EXIT_REASON_COLORS: Record<ExitReason, string> = {
  RITIRATO: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  RETROCESSO: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  ESTERO: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
}

export const POSITION_COLORS: Record<string, string> = {
  P: 'from-amber-500 to-amber-600',
  D: 'from-blue-500 to-blue-600',
  C: 'from-emerald-500 to-emerald-600',
  A: 'from-red-500 to-red-600',
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

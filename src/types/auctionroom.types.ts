import { POSITION_GRADIENTS, POSITION_FILTER_COLORS } from '../components/ui/PositionBadge'

export interface AuctionRoomProps {
  sessionId: string
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export interface Player {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  age?: number | null
  apiFootballId?: number | null
}

export interface Bid {
  id: string
  amount: number
  placedAt: string
  bidder: {
    user: { username: string }
  }
}

export interface Auction {
  id: string
  basePrice: number
  currentPrice: number
  status: string
  timerExpiresAt: string | null
  timerSeconds: number | null
  player: Player
  bids: Bid[]
  winner?: {
    user: { username: string }
  }
}

export interface Membership {
  id: string
  role: string
  currentBudget: number
}

export interface SessionInfo {
  id: string
  type: string
  currentRole: string | null
  currentPhase: string | null
  auctionTimerSeconds: number
  auctionMode?: string
}

export interface MarketProgress {
  currentRole: string
  currentRoleName: string
  filledSlots: number
  totalSlots: number
  roleSequence: string[]
  slotLimits: { P: number; D: number; C: number; A: number }
}

export interface PendingAcknowledgment {
  id: string
  player: Player
  winner: { id: string; username: string } | null
  finalPrice: number
  status: string
  userAcknowledged: boolean
  acknowledgedMembers: { id: string; username: string }[]
  pendingMembers: { id: string; username: string }[]
  totalMembers: number
  totalAcknowledged: number
  contractInfo?: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
}

export interface ReadyStatus {
  hasPendingNomination: boolean
  nominatorConfirmed: boolean
  player: Player | null
  nominatorId: string | null
  nominatorUsername: string
  readyMembers: { id: string; username: string }[]
  pendingMembers: { id: string; username: string }[]
  totalMembers: number
  readyCount: number
  userIsReady: boolean
  userIsNominator: boolean
}

export interface AppealStatus {
  auctionId: string
  auctionStatus: string
  hasActiveAppeal: boolean
  appeal: {
    id: string
    status: string
    reason: string
    adminNotes: string | null
    submittedBy: { username: string }
  } | null
  player: Player | null
  winner: { username: string } | null
  finalPrice: number | null
  appealDecisionAcks: string[]
  resumeReadyMembers: string[]
  allMembers: { id: string; username: string }[]
  userHasAcked: boolean
  userIsReady: boolean
  allAcked: boolean
  allReady: boolean
}

export interface RosterSlot {
  id: string
  playerId: string
  playerName: string
  playerTeam: string
  acquisitionPrice: number
  contract?: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
}

export interface MyRosterSlots {
  slots: {
    P: { filled: number; total: number; players: RosterSlot[] }
    D: { filled: number; total: number; players: RosterSlot[] }
    C: { filled: number; total: number; players: RosterSlot[] }
    A: { filled: number; total: number; players: RosterSlot[] }
  }
  currentRole: string
  budget: number
}

export interface ManagerRosterPlayer {
  id: string
  playerId: string
  playerName: string
  playerTeam: string
  position: string
  acquisitionPrice: number
  contract?: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
}

export interface ManagerData {
  id: string
  username: string
  teamName: string | null
  role: string
  currentBudget: number
  slotsFilled: number
  totalSlots: number
  isConnected?: boolean
  slotsByPosition: {
    P: { filled: number; total: number }
    D: { filled: number; total: number }
    C: { filled: number; total: number }
    A: { filled: number; total: number }
  }
  isCurrentTurn: boolean
  roster: ManagerRosterPlayer[]
}

export interface ManagersStatusData {
  managers: ManagerData[]
  currentTurnManager: ManagerData | null
  currentRole: string
  slotLimits: { P: number; D: number; C: number; A: number }
  myId: string
  allConnected?: boolean
}

export interface FirstMarketStatus {
  currentRole: string
  currentTurnIndex: number
  currentNominator: { memberId: string; username: string; index: number } | null
  allCompletedCurrentRole: boolean
  memberStatus: Array<{
    memberId: string
    username: string
    teamName: string | null
    rosterByRole: { P: number; D: number; C: number; A: number }
    slotsNeeded: { P: number; D: number; C: number; A: number }
    isComplete: boolean
    isCurrentRoleComplete: boolean
  }>
  turnOrder: string[] | null
  roleSequence: string[]
  isUserTurn: boolean
}

export interface ContractForModification {
  contractId: string
  rosterId: string
  playerId: string
  playerName: string
  playerTeam: string
  playerPosition: string
  salary: number
  duration: number
  initialSalary: number
  rescissionClause: number
}

// Alias for backward compatibility
export const POSITION_COLORS = POSITION_GRADIENTS
export const POSITION_BG = POSITION_FILTER_COLORS

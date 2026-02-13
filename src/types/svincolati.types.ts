import { POSITION_GRADIENTS, POSITION_FILTER_COLORS } from '../components/ui/PositionBadge'

export interface AppealStatus {
  auctionId: string
  auctionStatus: string
  hasActiveAppeal: boolean
  appeal: {
    id: string
    status: string
    reason: string
    adminNotes: string | null
    submittedBy: { username: string } | null
  } | null
  player: Player | null
  winner: { username: string } | null
  finalPrice: number | null
  appealDecisionAcks: string[]
  resumeReadyMembers: string[]
  allMembers: { id: string; username: string }[]
  userHasAcked: boolean
  userIsReady: boolean
}

export interface SvincolatiProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export interface Player {
  id: string
  name: string
  team: string
  position: string
  quotation: number
}

export interface TurnMember {
  id: string
  username: string
  budget: number
  hasPassed: boolean
  isConnected?: boolean
}

export interface ActiveAuction {
  id: string
  player: Player
  basePrice: number
  currentPrice: number
  timerExpiresAt: string | null
  timerSeconds: number | null
  nominatorId: string | null
  bids: Array<{
    amount: number
    bidder: string
    bidderId: string
    isWinning: boolean
  }>
}

export interface PendingAck {
  auctionId: string
  playerId: string
  playerName: string
  winnerId: string | null
  winnerUsername: string | null
  price: number
  noBids: boolean
  acknowledgedMembers: string[]
  pendingMembers: string[]
}

export interface BoardState {
  sessionId: string
  isActive: boolean
  state: string
  turnOrder: TurnMember[]
  currentTurnIndex: number
  currentTurnMemberId: string | null
  currentTurnUsername: string | null
  myMemberId: string
  isMyTurn: boolean
  isAdmin: boolean
  readyMembers: string[]
  passedMembers: string[]
  finishedMembers: string[]
  isFinished: boolean
  pendingPlayer: Player | null
  pendingNominatorId: string | null
  nominatorUsername: string | null
  nominatorConfirmed: boolean
  activeAuction: ActiveAuction | null
  awaitingResumeAuctionId: string | null
  timerSeconds: number
  timerStartedAt: string | null
  pendingAck: PendingAck | null
  myBudget: number
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

export interface ManagerRosterPlayer {
  id: string
  playerId: string
  playerName: string
  playerTeam: string
  position: string
  acquisitionPrice: number
  contract: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
}

export interface SelectedManagerData {
  id: string
  username: string
  teamName?: string
  currentBudget: number
  roster: ManagerRosterPlayer[]
  slotsByPosition: { P: { filled: number; total: number }; D: { filled: number; total: number }; C: { filled: number; total: number }; A: { filled: number; total: number } }
  slotsFilled: number
  totalSlots: number
}

// Alias for backward compatibility with existing code that uses POSITION_COLORS as gradients
export const POSITION_COLORS = POSITION_GRADIENTS
export const POSITION_BG = POSITION_FILTER_COLORS

export const SERIE_A_TEAMS = [
  'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Empoli',
  'Fiorentina', 'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce',
  'Milan', 'Monza', 'Napoli', 'Parma', 'Roma',
  'Torino', 'Udinese', 'Venezia', 'Verona',
]

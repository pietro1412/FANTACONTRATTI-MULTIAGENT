import type { ComputedSeasonStats } from '../components/PlayerStatsModal'

export interface LeagueMember {
  id: string
  teamName?: string
  rubataOrder?: number
  currentBudget: number
  user: {
    id: string
    username: string
  }
}

export interface BoardPlayer {
  rosterId: string
  memberId: string
  playerId: string
  playerName: string
  playerPosition: 'P' | 'D' | 'C' | 'A'
  playerTeam: string
  playerQuotation?: number
  playerAge?: number | null
  playerApiFootballId?: number | null
  playerApiFootballStats?: unknown
  playerComputedStats?: ComputedSeasonStats | null
  ownerUsername: string
  ownerTeamName: string | null
  rubataPrice: number
  contractSalary: number
  contractDuration: number
  contractClause: number
  stolenById?: string | null
  stolenByUsername?: string | null
  stolenPrice?: number | null
}

export interface ActiveAuction {
  id: string
  player: {
    id: string
    name: string
    team: string
    position: string
  }
  basePrice: number
  currentPrice: number
  sellerId: string
  bids: Array<{
    amount: number
    bidder: string
    bidderId: string
    isWinning: boolean
  }>
}

export interface AuctionReadyInfo {
  bidderUsername: string
  playerName: string
  playerTeam: string
  playerPosition: string
  ownerUsername: string
  basePrice: number
}

export interface RubataPreference {
  id: string
  playerId: string
  isWatchlist: boolean
  isAutoPass: boolean
  maxBid: number | null
  priority: number | null
  notes: string | null
}

export interface MemberBudgetInfo {
  memberId: string
  teamName: string
  username: string
  currentBudget: number
  totalSalaries: number
  residuo: number
}

export interface BoardPlayerWithPreference extends BoardPlayer {
  preference?: RubataPreference | null
}

export type RubataStateType = 'WAITING' | 'PREVIEW' | 'READY_CHECK' | 'OFFERING' | 'AUCTION_READY_CHECK' | 'AUCTION' | 'PENDING_ACK' | 'PAUSED' | 'COMPLETED' | null

export interface BoardData {
  isRubataPhase: boolean
  board: BoardPlayer[] | null
  currentIndex: number | null
  currentPlayer: BoardPlayer | null
  totalPlayers: number
  rubataState: RubataStateType
  remainingSeconds: number | null
  offerTimerSeconds: number
  auctionTimerSeconds: number
  activeAuction: ActiveAuction | null
  auctionReadyInfo: AuctionReadyInfo | null
  pausedRemainingSeconds: number | null
  pausedFromState: string | null
  memberBudgets?: MemberBudgetInfo[]
  sessionId: string | null
  myMemberId: string
  isAdmin: boolean
}

export interface PreviewBoardData {
  board: BoardPlayerWithPreference[]
  totalPlayers: number
  rubataState: string
  isPreview: boolean
  myMemberId: string
  watchlistCount: number
  autoPassCount: number
}

export interface ReadyStatus {
  rubataState: string | null
  readyMembers: Array<{ id: string; username: string; isConnected?: boolean }>
  pendingMembers: Array<{ id: string; username: string; isConnected?: boolean }>
  totalMembers: number
  readyCount: number
  allReady: boolean
  userIsReady: boolean
  myMemberId: string
  isAdmin: boolean
}

export interface PendingAck {
  auctionId: string
  player: {
    id: string
    name: string
    team: string
    position: string
  }
  winner: { id: string; username: string } | null
  seller: { id: string; username: string }
  finalPrice: number
  acknowledgedMembers: Array<{ id: string; username: string }>
  pendingMembers: Array<{ id: string; username: string }>
  totalMembers: number
  totalAcknowledged: number
  userAcknowledged: boolean
  allAcknowledged: boolean
  prophecies?: Array<{ memberId: string; username: string; content: string; createdAt: string }>
}

export interface ContractForModification {
  contractId: string
  rosterId: string
  playerId: string
  playerName: string
  playerTeam?: string
  playerPosition?: string
  salary: number
  duration: number
  initialSalary: number
  rescissionClause: number
}

export interface AppealStatus {
  auctionId: string
  auctionStatus: string
  hasActiveAppeal: boolean
  appeal: {
    id: string
    status: string
    reason: string
    adminNotes?: string
    submittedBy?: { username: string }
  } | null
  winner?: { username: string }
  finalPrice?: number
  player?: { name: string; team: string; position: string }
  userHasAcked: boolean
  appealDecisionAcks: string[]
  allMembers: Array<{ id: string; username: string }>
  userIsReady: boolean
  resumeReadyMembers: string[]
}

export interface ProgressStats {
  currentIndex: number
  totalPlayers: number
  remaining: number
  managerProgress: {
    processed: number
    total: number
    username: string
  } | null
}

export const POSITION_COLORS: Record<string, string> = {
  P: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  D: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  A: 'bg-red-500/20 text-red-400 border-red-500/30',
}

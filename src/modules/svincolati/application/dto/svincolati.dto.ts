/**
 * Svincolati DTOs - Application Layer
 *
 * Data Transfer Objects for svincolati operations.
 * These define the shape of data flowing in and out of use cases.
 */

import type { SvincolatiStatus } from '../../domain/entities/svincolati-session.entity'
import type { NominationStatus } from '../../domain/entities/nomination.entity'

// ==================== SETUP ====================

/**
 * DTO for setting up a svincolati session
 */
export interface SetupSvincolatiDto {
  /** The market session ID to set up svincolati for */
  sessionId: string

  /** Optional: override default timer seconds */
  timerSeconds?: number

  /** Optional: custom turn order (if not provided, calculated by budget) */
  customTurnOrder?: string[]
}

/**
 * Result of setting up a svincolati session
 */
export interface SetupSvincolatiResultDto {
  sessionId: string
  turnOrder: TurnOrderMemberDto[]
  firstNominatorId: string
  firstNominatorUsername: string
  timerSeconds: number
}

// ==================== NOMINATION ====================

/**
 * DTO for nominating a player
 */
export interface NominatePlayerDto {
  /** The market session ID */
  sessionId: string

  /** ID of the member making the nomination */
  nominatorId: string

  /** ID of the player being nominated */
  playerId: string
}

/**
 * Result of a player nomination
 */
export interface NominatePlayerResultDto {
  nominationId: string
  player: PlayerDto
  nominatorId: string
  nominatorUsername: string
  status: NominationStatus
}

/**
 * DTO for confirming a nomination
 */
export interface ConfirmNominationDto {
  sessionId: string
  nominatorId: string
}

/**
 * DTO for cancelling a nomination
 */
export interface CancelNominationDto {
  sessionId: string
  nominatorId: string
}

// ==================== TURN MANAGEMENT ====================

/**
 * DTO for passing a turn
 */
export interface PassTurnDto {
  /** The market session ID */
  sessionId: string

  /** ID of the member passing their turn */
  memberId: string
}

/**
 * Result of passing a turn
 */
export interface PassTurnResultDto {
  /** Whether all members have now passed */
  allPassed: boolean

  /** Next member's turn (null if all passed) */
  nextMemberId: string | null
  nextMemberUsername: string | null

  /** Count of members who have passed */
  passedCount: number

  /** Total active members */
  totalMembers: number
}

/**
 * DTO for marking ready
 */
export interface MarkReadyDto {
  sessionId: string
  memberId: string
}

/**
 * Result of marking ready
 */
export interface MarkReadyResultDto {
  readyCount: number
  totalCount: number
  allReady: boolean
  /** If all ready, auction starts */
  auctionStarted?: boolean
  auctionId?: string
}

// ==================== STATE QUERIES ====================

/**
 * DTO for getting svincolati state
 */
export interface GetSvincolatiStateDto {
  sessionId: string
  memberId: string
}

/**
 * Complete state of a svincolati session for UI rendering
 */
export interface SvincolatiStateDto {
  /** Whether session is active */
  isActive: boolean

  /** Current status/phase */
  status: SvincolatiStatus

  /** Current round number */
  round: number

  /** Current nominator info */
  currentNominator: {
    id: string
    username: string
  } | null

  /** Whether it's the requesting member's turn */
  isMyTurn: boolean

  /** Turn order with member details */
  turnOrder: TurnOrderMemberDto[]

  /** Recent/active nominations */
  nominations: NominationDto[]

  /** Pending nomination (if any) */
  pendingNomination: PendingNominationDto | null

  /** Active auction (if any) */
  activeAuction: ActiveAuctionDto | null

  /** Members who are ready for current auction */
  readyMembers: string[]

  /** Available players for nomination */
  availablePlayers: PlayerDto[]

  /** Timer settings */
  timerSeconds: number

  /** Requesting member's info */
  myInfo: {
    memberId: string
    budget: number
    hasPassed: boolean
    hasFinished: boolean
    isAdmin: boolean
  }
}

// ==================== HELPER DTOS ====================

/**
 * Turn order member info
 */
export interface TurnOrderMemberDto {
  memberId: string
  username: string
  budget: number
  orderIndex: number
  hasPassed: boolean
  hasFinished: boolean
}

/**
 * Nomination info for display
 */
export interface NominationDto {
  id: string
  player: PlayerDto
  nominatorId: string
  nominatorUsername: string
  status: NominationStatus
  round: number
  winnerId: string | null
  winnerUsername: string | null
  finalPrice: number | null
  createdAt: Date
}

/**
 * Pending nomination waiting for confirmation
 */
export interface PendingNominationDto {
  id: string
  player: PlayerDto
  nominatorId: string
  nominatorUsername: string
  isConfirmed: boolean
  readyMembers: string[]
  totalMembers: number
}

/**
 * Active auction info
 */
export interface ActiveAuctionDto {
  id: string
  player: PlayerDto
  basePrice: number
  currentPrice: number
  currentWinnerId: string | null
  currentWinnerUsername: string | null
  timerExpiresAt: Date
  timerSeconds: number
  nominatorId: string
  bids: AuctionBidDto[]
}

/**
 * Auction bid info
 */
export interface AuctionBidDto {
  bidderId: string
  bidderUsername: string
  amount: number
  isWinning: boolean
  createdAt: Date
}

/**
 * Player info for display
 */
export interface PlayerDto {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
}

// ==================== ADVANCE TURN ====================

/**
 * DTO for advancing turn after auction
 */
export interface AdvanceTurnDto {
  sessionId: string
  /** ID of the completed auction */
  auctionId: string
}

/**
 * Result of advancing turn
 */
export interface AdvanceTurnResultDto {
  /** Next member's turn */
  nextMemberId: string | null
  nextMemberUsername: string | null

  /** Whether a new round started */
  newRoundStarted: boolean
  currentRound: number

  /** Whether session is completed */
  sessionCompleted: boolean
}

// ==================== DECLARE FINISHED ====================

/**
 * DTO for declaring finished
 */
export interface DeclareFinishedDto {
  sessionId: string
  memberId: string
}

/**
 * Result of declaring finished
 */
export interface DeclareFinishedResultDto {
  finishedCount: number
  totalMembers: number
  allFinished: boolean
}

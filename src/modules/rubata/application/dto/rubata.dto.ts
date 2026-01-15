/**
 * Rubata DTOs
 *
 * Data Transfer Objects for the Rubata module application layer.
 * These DTOs define the contract between the application layer and external layers.
 */

import type { RubataBoardEntry, RubataBoardEntryWithDetails } from '../../domain/entities/rubata-board.entity'
import type { RubataOffer } from '../../domain/entities/rubata-offer.entity'
import type { RubataReadyStatus } from '../../domain/entities/rubata-ready.entity'
import type { RubataSession, RubataStatus, RubataPhase } from '../../domain/entities/rubata-session.entity'

// =============================================================================
// Input DTOs (for use case inputs)
// =============================================================================

/**
 * Input for setting up a rubata session
 */
export interface SetupRubataDto {
  /** The market session ID to setup rubata for */
  sessionId: string
}

/**
 * Input for adding a player to the board
 */
export interface AddToBoardDto {
  /** The session ID */
  sessionId: string
  /** The roster entry ID of the player to add */
  rosterId: string
  /** The member adding the player (must be owner) */
  memberId: string
}

/**
 * Input for removing a player from the board
 */
export interface RemoveFromBoardDto {
  /** The session ID */
  sessionId: string
  /** The board entry ID to remove */
  entryId: string
  /** The member requesting removal (must be owner) */
  memberId: string
}

/**
 * Input for placing an offer
 */
export interface PlaceOfferDto {
  /** The board entry ID to make offer on */
  boardEntryId: string
  /** The member making the offer */
  offeredById: string
  /** The offer amount */
  amount: number
}

/**
 * Input for marking a member as ready
 */
export interface SetReadyDto {
  /** The session ID */
  sessionId: string
  /** The member marking themselves ready */
  memberId: string
}

/**
 * Input for starting the rubata auction
 */
export interface StartAuctionDto {
  /** The session ID */
  sessionId: string
  /** The board entry to start auction for */
  boardEntryId: string
}

// =============================================================================
// Output DTOs (for use case results)
// =============================================================================

/**
 * Output for setup rubata result
 */
export interface SetupRubataResultDto {
  session: RubataSession
  memberCount: number
}

/**
 * Output for the rubata board state
 */
export interface RubataBoardDto {
  /** All entries on the board */
  entries: RubataBoardEntryWithDetails[]
  /** List of member IDs that are ready */
  readyMembers: string[]
  /** Total members in the session */
  totalMembers: number
  /** Current board entry being processed (if any) */
  currentEntry: RubataBoardEntryWithDetails | null
  /** Current phase of the rubata */
  phase: RubataPhase
  /** Current status of the rubata */
  status: RubataStatus
}

/**
 * Output for add to board result
 */
export interface AddToBoardResultDto {
  /** The created board entry */
  entry: RubataBoardEntry
  /** Updated count of entries for this member */
  memberEntryCount: number
}

/**
 * Output for place offer result
 */
export interface PlaceOfferResultDto {
  /** The created offer */
  offer: RubataOffer
  /** Current highest offer amount */
  highestOffer: number
  /** Whether this offer is currently the highest */
  isHighest: boolean
}

/**
 * Output for ready status check
 */
export interface ReadyStatusDto {
  /** All ready statuses */
  statuses: RubataReadyStatus[]
  /** Count of ready members */
  readyCount: number
  /** Total members */
  totalCount: number
  /** Whether all members are ready */
  allReady: boolean
  /** IDs of members not yet ready */
  pendingMembers: string[]
}

/**
 * Output for start auction result
 */
export interface StartAuctionResultDto {
  /** The auction that was created */
  auctionId: string
  /** The board entry being auctioned */
  boardEntry: RubataBoardEntryWithDetails
  /** The starting price (highest offer) */
  startingPrice: number
  /** The member who made the highest offer */
  initialBidderId: string
}

// =============================================================================
// Query DTOs
// =============================================================================

/**
 * Query for getting board entries
 */
export interface GetBoardQueryDto {
  sessionId: string
  memberId?: string
  status?: RubataBoardEntry['status']
}

/**
 * Query for getting offers
 */
export interface GetOffersQueryDto {
  boardEntryId: string
}

/**
 * Query for getting member's entries
 */
export interface GetMemberEntriesQueryDto {
  sessionId: string
  memberId: string
}

/**
 * Appeal Entity - Domain Layer
 *
 * Represents an appeal/complaint about an auction result.
 * Used when a league member contests the outcome of an auction.
 */

/**
 * Appeal status represents the lifecycle state of an appeal
 */
export type AppealStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

/**
 * Core appeal entity representing a complaint about an auction
 */
export interface AuctionAppeal {
  /** Unique identifier */
  id: string
  /** Auction being appealed */
  auctionId: string
  /** League member filing the complaint */
  complainantId: string
  /** Reason for the appeal */
  reason: string
  /** Current state of the appeal */
  status: AppealStatus
  /** Admin's resolution notes (null if not resolved) */
  resolution: string | null
  /** When the appeal was created */
  createdAt: Date
  /** When the appeal was resolved (null if pending) */
  resolvedAt: Date | null
}

/**
 * Data required to create a new appeal
 */
export interface CreateAppealData {
  auctionId: string
  complainantId: string
  reason: string
}

/**
 * Data for resolving an appeal
 */
export interface ResolveAppealData {
  resolution: 'ACCEPTED' | 'REJECTED'
  notes: string
}

/**
 * Type guard to check if a status is a valid AppealStatus
 */
export const isValidAppealStatus = (status: string): status is AppealStatus => {
  return ['PENDING', 'ACCEPTED', 'REJECTED'].includes(status)
}

/**
 * Check if an appeal is still pending
 */
export const isPending = (appeal: AuctionAppeal): boolean => {
  return appeal.status === 'PENDING'
}

/**
 * Check if an appeal was accepted
 */
export const isAccepted = (appeal: AuctionAppeal): boolean => {
  return appeal.status === 'ACCEPTED'
}

/**
 * Check if an appeal was rejected
 */
export const isRejected = (appeal: AuctionAppeal): boolean => {
  return appeal.status === 'REJECTED'
}

/**
 * Check if an appeal has been resolved
 */
export const isResolved = (appeal: AuctionAppeal): boolean => {
  return appeal.status !== 'PENDING'
}

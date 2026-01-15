/**
 * RubataOffer Entity
 *
 * Represents an offer made by a member for a player on the rubata board.
 * Offers are placed during the offering phase before auctions start.
 */

/**
 * Possible statuses for an offer
 * - PENDING: Offer is active and waiting
 * - ACCEPTED: Offer was highest and triggered auction
 * - OUTBID: Offer was outbid by another offer
 * - CANCELLED: Offer was cancelled by the bidder
 */
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'OUTBID' | 'CANCELLED'

/**
 * RubataOffer - represents an offer for a player on the board
 */
export interface RubataOffer {
  /** Unique identifier for this offer */
  id: string
  /** The board entry this offer is for */
  boardEntryId: string
  /** The member making the offer */
  offeredByMemberId: string
  /** The amount offered */
  amount: number
  /** Current status of this offer */
  status: OfferStatus
  /** When this offer was placed */
  placedAt: Date
}

/**
 * Data required to create a new offer
 */
export interface CreateOfferData {
  boardEntryId: string
  offeredByMemberId: string
  amount: number
}

/**
 * Factory function to create a new offer
 */
export function createOffer(id: string, data: CreateOfferData): RubataOffer {
  return {
    id,
    boardEntryId: data.boardEntryId,
    offeredByMemberId: data.offeredByMemberId,
    amount: data.amount,
    status: 'PENDING',
    placedAt: new Date(),
  }
}

/**
 * Checks if an offer amount is valid (must be positive)
 */
export function isValidOfferAmount(amount: number): boolean {
  return amount > 0 && Number.isInteger(amount)
}

/**
 * Checks if a new offer amount beats the current highest offer
 */
export function isHigherOffer(newAmount: number, currentHighest: number | null): boolean {
  if (currentHighest === null) {
    return true
  }
  return newAmount > currentHighest
}

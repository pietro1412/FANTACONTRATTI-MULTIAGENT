/**
 * Bid Entity - Domain Layer
 *
 * Represents a bid placed on an auction by a league member.
 */

import { ValidationError } from '@/shared/infrastructure/http/errors'

/**
 * Core bid entity representing a bid on an auction
 */
export interface AuctionBid {
  /** Unique identifier */
  id: string
  /** Auction this bid belongs to */
  auctionId: string
  /** League member who placed the bid */
  bidderId: string
  /** Bid amount in credits */
  amount: number
  /** When the bid was placed */
  placedAt: Date
  /** Whether this is currently the winning bid */
  isWinning: boolean
}

/**
 * Data required to create a new bid
 */
export interface CreateBidData {
  auctionId: string
  bidderId: string
  amount: number
}

/**
 * Value object for bid validation
 * Ensures bid amount follows business rules
 */
export class BidAmount {
  readonly value: number

  constructor(value: number) {
    if (value <= 0) {
      throw new ValidationError('Il rilancio deve essere positivo', { value })
    }
    if (!Number.isInteger(value)) {
      throw new ValidationError('Il rilancio deve essere intero', { value })
    }
    this.value = value
  }

  /**
   * Check if this bid beats another bid
   */
  beats(other: BidAmount): boolean {
    return this.value > other.value
  }

  /**
   * Check if this bid meets or exceeds a minimum
   */
  meetsMinimum(minimum: number): boolean {
    return this.value >= minimum
  }

  /**
   * Calculate the difference from another amount
   */
  differenceFrom(other: number): number {
    return this.value - other
  }
}

/**
 * Create a BidAmount value object, returning null if invalid
 * Use this when you want to validate without throwing
 */
export const tryCreateBidAmount = (value: number): BidAmount | null => {
  try {
    return new BidAmount(value)
  } catch {
    return null
  }
}

/**
 * Check if a bid is outbid by another amount
 */
export const isOutbid = (bid: AuctionBid, newAmount: number): boolean => {
  return newAmount > bid.amount
}

/**
 * Get the minimum valid bid amount given current price
 */
export const getMinimumBid = (currentPrice: number): number => {
  return currentPrice + 1
}

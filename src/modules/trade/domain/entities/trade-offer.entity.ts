/**
 * Trade Offer Entity - Domain Layer
 * Represents a trade offer between two league members
 */

/**
 * Status of a trade offer
 */
export type TradeStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'EXPIRED' | 'CANCELLED'

/**
 * Trade Offer Entity
 * Represents a trade proposal between two league members
 */
export interface TradeOffer {
  id: string
  leagueId: string
  senderId: string       // LeagueMemberId
  receiverId: string     // LeagueMemberId
  senderPlayers: string[]   // rosterId[]
  receiverPlayers: string[] // rosterId[]
  senderBudget: number      // Budget offered
  receiverBudget: number    // Budget requested
  status: TradeStatus
  message?: string
  createdAt: Date
  respondedAt: Date | null
  expiresAt: Date | null
  counterOfferId: string | null  // Link to counter offer
  marketSessionId: string | null
}

/**
 * Data required to create a new trade offer
 */
export interface CreateTradeOfferData {
  leagueId: string
  senderId: string
  receiverId: string
  senderPlayers: string[]
  receiverPlayers: string[]
  senderBudget: number
  receiverBudget: number
  message?: string
  expiresAt?: Date
  marketSessionId?: string
}

/**
 * Validates that a trade status is valid
 */
export function isValidTradeStatus(status: string): status is TradeStatus {
  return ['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'CANCELLED'].includes(status)
}

/**
 * Check if trade offer can be responded to
 */
export function canRespondToTrade(trade: TradeOffer): boolean {
  return trade.status === 'PENDING'
}

/**
 * Check if trade offer has expired
 */
export function isTradeExpired(trade: TradeOffer): boolean {
  if (!trade.expiresAt) return false
  return new Date() > trade.expiresAt
}

/**
 * Check if trade offer can be cancelled by sender
 */
export function canCancelTrade(trade: TradeOffer): boolean {
  return trade.status === 'PENDING'
}

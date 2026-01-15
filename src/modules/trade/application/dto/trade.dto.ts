/**
 * Trade DTOs - Application Layer
 * Data Transfer Objects for trade operations
 */

import type { TradeOffer, TradeStatus } from '../../domain/entities/trade-offer.entity'

/**
 * Player info for trade display
 */
export interface TradePlayerInfo {
  id: string
  rosterId: string
  name: string
  team: string
  position: string
  salary?: number
  duration?: number
  rescissionClause?: number
}

/**
 * Request DTO for creating a trade offer
 */
export interface CreateTradeOfferDto {
  leagueId: string
  senderId: string
  receiverId: string
  senderPlayers: string[]    // rosterId[]
  receiverPlayers: string[]  // rosterId[]
  senderBudget: number
  receiverBudget: number
  message?: string
  durationHours?: number     // Default 24 hours
}

/**
 * Request DTO for responding to a trade offer
 */
export interface RespondTradeDto {
  tradeId: string
  memberId: string
}

/**
 * Request DTO for counter offer
 */
export interface CounterOfferDto {
  originalTradeId: string
  senderId: string           // The one making the counter (original receiver)
  senderPlayers: string[]    // rosterId[]
  receiverPlayers: string[]  // rosterId[]
  senderBudget: number
  receiverBudget: number
  message?: string
}

/**
 * Request DTO for cancelling a trade offer
 */
export interface CancelTradeDto {
  tradeId: string
  senderId: string
}

/**
 * Response DTO for trade offer with enriched player details
 */
export interface TradeOfferDetailDto {
  id: string
  leagueId: string
  senderId: string
  receiverId: string
  senderPlayers: TradePlayerInfo[]
  receiverPlayers: TradePlayerInfo[]
  senderBudget: number
  receiverBudget: number
  status: TradeStatus
  message?: string
  createdAt: Date
  respondedAt: Date | null
  expiresAt: Date | null
  counterOfferId: string | null
}

/**
 * Response DTO for trade creation result
 */
export interface CreateTradeResultDto {
  trade: TradeOffer
  message: string
}

/**
 * Response DTO for trade acceptance result
 */
export interface AcceptTradeResultDto {
  tradeId: string
  message: string
}

/**
 * Response DTO for trade rejection result
 */
export interface RejectTradeResultDto {
  tradeId: string
  message: string
}

/**
 * Response DTO for counter offer result
 */
export interface CounterOfferResultDto {
  originalTradeId: string
  counterOffer: TradeOffer
  message: string
}

/**
 * Response DTO for trade cancellation result
 */
export interface CancelTradeResultDto {
  tradeId: string
  message: string
}

/**
 * Response DTO for anti-loop validation
 */
export interface AntiLoopValidationDto {
  isValid: boolean
  reason?: string
}

/**
 * Trade history summary for a member
 */
export interface TradeHistoryDto {
  memberId: string
  sent: TradeOfferDetailDto[]
  received: TradeOfferDetailDto[]
  completed: TradeOfferDetailDto[]
}

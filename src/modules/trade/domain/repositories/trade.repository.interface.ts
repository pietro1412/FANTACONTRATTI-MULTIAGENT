/**
 * Trade Repository Interface - Domain Layer
 * Defines the contract for trade data persistence operations
 */

import type { TradeOffer, TradeStatus, CreateTradeOfferData } from '../entities/trade-offer.entity'

/**
 * Player roster information needed for trade validation
 */
export interface RosterInfo {
  id: string
  leagueMemberId: string
  playerId: string
  status: string
}

/**
 * Member budget information
 */
export interface MemberBudgetInfo {
  memberId: string
  currentBudget: number
}

/**
 * Interface for trade repository operations
 * Implementations can use different data sources (Prisma, in-memory, etc.)
 */
export interface ITradeRepository {
  /**
   * Find a trade offer by ID
   * @param id - The trade offer ID
   * @returns Promise resolving to the trade offer or null if not found
   */
  findById(id: string): Promise<TradeOffer | null>

  /**
   * Find all trade offers for a league
   * @param leagueId - The league ID
   * @returns Promise resolving to array of trade offers
   */
  findByLeague(leagueId: string): Promise<TradeOffer[]>

  /**
   * Find pending trade offers for a member (as receiver)
   * @param memberId - The league member ID
   * @returns Promise resolving to array of pending trade offers
   */
  findPendingForMember(memberId: string): Promise<TradeOffer[]>

  /**
   * Find sent trade offers from a member (as sender)
   * @param memberId - The league member ID
   * @returns Promise resolving to array of sent trade offers
   */
  findSentByMember(memberId: string): Promise<TradeOffer[]>

  /**
   * Create a new trade offer
   * @param data - The trade offer creation data
   * @returns Promise resolving to the created trade offer
   */
  create(data: CreateTradeOfferData): Promise<TradeOffer>

  /**
   * Update the status of a trade offer
   * @param id - The trade offer ID
   * @param status - The new status
   * @param respondedAt - Optional timestamp for when the response was made
   */
  updateStatus(id: string, status: TradeStatus, respondedAt?: Date): Promise<void>

  /**
   * Set the counter offer link on the original trade
   * @param originalId - The original trade offer ID
   * @param counterOfferId - The counter offer ID
   */
  setCounterOffer(originalId: string, counterOfferId: string): Promise<void>

  /**
   * Get roster information for validation
   * @param rosterIds - Array of roster IDs to fetch
   * @returns Promise resolving to array of roster info
   */
  getRosterInfo(rosterIds: string[]): Promise<RosterInfo[]>

  /**
   * Get member budget information
   * @param memberId - The league member ID
   * @returns Promise resolving to member budget info or null
   */
  getMemberBudget(memberId: string): Promise<MemberBudgetInfo | null>

  /**
   * Execute trade: swap players and budgets between members
   * This should be done in a transaction
   * @param tradeId - The trade offer ID
   * @param senderMemberId - The sender's league member ID
   * @param receiverMemberId - The receiver's league member ID
   * @param senderPlayers - Roster IDs of players from sender
   * @param receiverPlayers - Roster IDs of players from receiver
   * @param senderBudget - Budget amount from sender
   * @param receiverBudget - Budget amount from receiver
   */
  executeTrade(
    tradeId: string,
    senderMemberId: string,
    receiverMemberId: string,
    senderPlayers: string[],
    receiverPlayers: string[],
    senderBudget: number,
    receiverBudget: number
  ): Promise<void>

  /**
   * Find accepted trades in same session involving same parties (for anti-loop check)
   * @param marketSessionId - The market session ID
   * @param senderId - The sender member ID
   * @param receiverId - The receiver member ID
   * @returns Promise resolving to array of accepted trades between these parties
   */
  findAcceptedTradesInSession(
    marketSessionId: string,
    senderId: string,
    receiverId: string
  ): Promise<TradeOffer[]>

  /**
   * Check if a trade window is currently open for a league
   * @param leagueId - The league ID
   * @returns Promise resolving to boolean indicating if trade window is open
   */
  isTradeWindowOpen(leagueId: string): Promise<boolean>

  /**
   * Get the active market session ID for a league (if any)
   * @param leagueId - The league ID
   * @returns Promise resolving to session ID or null
   */
  getActiveMarketSessionId(leagueId: string): Promise<string | null>
}

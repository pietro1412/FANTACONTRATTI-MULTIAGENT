/**
 * Domain Events for FANTACONTRATTI
 *
 * All domain events are defined here as TypeScript types.
 * These events are used for communication between modules (Bounded Contexts)
 * following the Clean Architecture and Domain-Driven Design patterns.
 */

// =============================================================================
// Identity Events
// =============================================================================

/**
 * Emitted when a new user registers in the system
 */
export type UserRegistered = {
  userId: string
  email: string
  timestamp: Date
}

/**
 * Emitted when a user successfully logs in
 */
export type UserLoggedIn = {
  userId: string
  timestamp: Date
}

// =============================================================================
// League Events
// =============================================================================

/**
 * Emitted when a new league is created
 */
export type LeagueCreated = {
  leagueId: string
  adminId: string
  name: string
}

/**
 * Emitted when a member joins a league
 */
export type MemberJoined = {
  leagueId: string
  memberId: string
  userId: string
}

/**
 * Emitted when a member leaves a league
 */
export type MemberLeft = {
  leagueId: string
  memberId: string
}

// =============================================================================
// Roster Events
// =============================================================================

/**
 * Emitted when a player is added to a roster (via auction, trade, etc.)
 */
export type PlayerAddedToRoster = {
  rosterId: string
  playerId: string
  memberId: string
}

/**
 * Emitted when a player is removed from a roster (release, trade, etc.)
 */
export type PlayerRemovedFromRoster = {
  rosterId: string
  playerId: string
  memberId: string
}

/**
 * Emitted when a contract is renewed
 */
export type ContractRenewed = {
  contractId: string
  playerId: string
  newSalary: number
  newDuration: number
}

/**
 * Emitted when a contract is consolidated
 */
export type ContractConsolidated = {
  contractId: string
  playerId: string
}

// =============================================================================
// Auction Events (Primo Mercato)
// =============================================================================

/**
 * Emitted when a new auction is created
 */
export type AuctionCreated = {
  auctionId: string
  sessionId: string
  playerId: string
}

/**
 * Emitted when a bid is placed on an auction
 */
export type BidPlaced = {
  auctionId: string
  bidderId: string
  amount: number
}

/**
 * Emitted when an auction is closed (timer expired or no more bids)
 */
export type AuctionClosed = {
  auctionId: string
  winnerId: string | null
  finalAmount: number
}

/**
 * Emitted when an appeal is created for an auction
 */
export type AppealCreated = {
  appealId: string
  auctionId: string
  complainantId: string
}

/**
 * Emitted when an appeal is resolved by admin
 */
export type AppealResolved = {
  appealId: string
  resolution: 'ACCEPTED' | 'REJECTED'
}

/**
 * Emitted when an auction timer expires (detected by cron job)
 */
export type AuctionTimerExpired = {
  auctionId: string
}

// =============================================================================
// Rubata Events (Mercato Ricorrente)
// =============================================================================

/**
 * Emitted when a rubata phase starts
 */
export type RubataStarted = {
  sessionId: string
}

/**
 * Emitted when an offer is placed during rubata
 */
export type RubataOfferPlaced = {
  sessionId: string
  playerId: string
  offeredById: string
}

/**
 * Emitted when a rubata auction starts for a player
 */
export type RubataAuctionStarted = {
  sessionId: string
  playerId: string
}

/**
 * Emitted when the rubata phase is completed
 */
export type RubataCompleted = {
  sessionId: string
}

// =============================================================================
// Svincolati Events (Free Agents)
// =============================================================================

/**
 * Emitted when the svincolati phase starts
 */
export type SvincolatiStarted = {
  sessionId: string
}

/**
 * Emitted when a free agent is nominated by a member
 */
export type FreeAgentNominated = {
  sessionId: string
  playerId: string
  nominatorId: string
}

/**
 * Emitted when a svincolati auction is closed
 */
export type SvincolatiAuctionClosed = {
  sessionId: string
  playerId: string
  winnerId: string | null
}

/**
 * Emitted when the svincolati phase is completed
 */
export type SvincolatiCompleted = {
  sessionId: string
}

// =============================================================================
// Trade Events
// =============================================================================

/**
 * Emitted when a trade offer is created
 */
export type TradeOffered = {
  tradeId: string
  senderId: string
  receiverId: string
}

/**
 * Emitted when a trade is accepted
 */
export type TradeAccepted = {
  tradeId: string
}

/**
 * Emitted when a trade is rejected
 */
export type TradeRejected = {
  tradeId: string
}

/**
 * Emitted when a counter offer is made
 */
export type CounterOfferMade = {
  originalTradeId: string
  counterTradeId: string
}

// =============================================================================
// Prize Events
// =============================================================================

/**
 * Emitted when a prize is assigned to a member
 */
export type PrizeAssigned = {
  prizeId: string
  memberId: string
  categoryId: string
  amount: number
}

/**
 * Emitted when all prizes for a session are finalized
 */
export type PrizesFinalized = {
  sessionId: string
}

// =============================================================================
// Movement Events (Cross-cutting)
// =============================================================================

/**
 * Movement types for player transfers
 */
export type MovementType = 'AUCTION' | 'RUBATA' | 'SVINCOLATI' | 'TRADE' | 'RELEASE'

/**
 * Emitted when a player movement is recorded (cross-cutting event)
 * This event is typically triggered by other events and consumed by
 * the Movement module to maintain a history of all player transfers.
 */
export type MovementRecorded = {
  movementId: string
  playerId: string
  fromMemberId: string | null
  toMemberId: string | null
  type: MovementType
  amount: number
  sessionId: string
}

// =============================================================================
// Event Type Constants
// =============================================================================

/**
 * Event type string constants for use with EventBus
 * Using constants prevents typos and enables autocomplete
 */
export const DomainEventTypes = {
  // Identity
  USER_REGISTERED: 'identity.user.registered',
  USER_LOGGED_IN: 'identity.user.loggedIn',

  // League
  LEAGUE_CREATED: 'league.created',
  MEMBER_JOINED: 'league.member.joined',
  MEMBER_LEFT: 'league.member.left',

  // Roster
  PLAYER_ADDED_TO_ROSTER: 'roster.player.added',
  PLAYER_REMOVED_FROM_ROSTER: 'roster.player.removed',
  CONTRACT_RENEWED: 'roster.contract.renewed',
  CONTRACT_CONSOLIDATED: 'roster.contract.consolidated',

  // Auction
  AUCTION_CREATED: 'auction.created',
  BID_PLACED: 'auction.bid.placed',
  AUCTION_CLOSED: 'auction.closed',
  APPEAL_CREATED: 'auction.appeal.created',
  APPEAL_RESOLVED: 'auction.appeal.resolved',
  AUCTION_TIMER_EXPIRED: 'auction.timer.expired',

  // Rubata
  RUBATA_STARTED: 'rubata.started',
  RUBATA_OFFER_PLACED: 'rubata.offer.placed',
  RUBATA_AUCTION_STARTED: 'rubata.auction.started',
  RUBATA_COMPLETED: 'rubata.completed',

  // Svincolati
  SVINCOLATI_STARTED: 'svincolati.started',
  FREE_AGENT_NOMINATED: 'svincolati.freeAgent.nominated',
  SVINCOLATI_AUCTION_CLOSED: 'svincolati.auction.closed',
  SVINCOLATI_COMPLETED: 'svincolati.completed',

  // Trade
  TRADE_OFFERED: 'trade.offered',
  TRADE_ACCEPTED: 'trade.accepted',
  TRADE_REJECTED: 'trade.rejected',
  COUNTER_OFFER_MADE: 'trade.counterOffer.made',

  // Prize
  PRIZE_ASSIGNED: 'prize.assigned',
  PRIZES_FINALIZED: 'prize.finalized',

  // Movement
  MOVEMENT_RECORDED: 'movement.recorded',
} as const

/**
 * Type for domain event type strings
 */
export type DomainEventType = (typeof DomainEventTypes)[keyof typeof DomainEventTypes]

// =============================================================================
// Event Map for Type Safety
// =============================================================================

/**
 * Maps event type strings to their payload types
 * This enables type-safe event publishing and subscribing
 */
export interface DomainEventMap {
  // Identity
  [DomainEventTypes.USER_REGISTERED]: UserRegistered
  [DomainEventTypes.USER_LOGGED_IN]: UserLoggedIn

  // League
  [DomainEventTypes.LEAGUE_CREATED]: LeagueCreated
  [DomainEventTypes.MEMBER_JOINED]: MemberJoined
  [DomainEventTypes.MEMBER_LEFT]: MemberLeft

  // Roster
  [DomainEventTypes.PLAYER_ADDED_TO_ROSTER]: PlayerAddedToRoster
  [DomainEventTypes.PLAYER_REMOVED_FROM_ROSTER]: PlayerRemovedFromRoster
  [DomainEventTypes.CONTRACT_RENEWED]: ContractRenewed
  [DomainEventTypes.CONTRACT_CONSOLIDATED]: ContractConsolidated

  // Auction
  [DomainEventTypes.AUCTION_CREATED]: AuctionCreated
  [DomainEventTypes.BID_PLACED]: BidPlaced
  [DomainEventTypes.AUCTION_CLOSED]: AuctionClosed
  [DomainEventTypes.APPEAL_CREATED]: AppealCreated
  [DomainEventTypes.APPEAL_RESOLVED]: AppealResolved
  [DomainEventTypes.AUCTION_TIMER_EXPIRED]: AuctionTimerExpired

  // Rubata
  [DomainEventTypes.RUBATA_STARTED]: RubataStarted
  [DomainEventTypes.RUBATA_OFFER_PLACED]: RubataOfferPlaced
  [DomainEventTypes.RUBATA_AUCTION_STARTED]: RubataAuctionStarted
  [DomainEventTypes.RUBATA_COMPLETED]: RubataCompleted

  // Svincolati
  [DomainEventTypes.SVINCOLATI_STARTED]: SvincolatiStarted
  [DomainEventTypes.FREE_AGENT_NOMINATED]: FreeAgentNominated
  [DomainEventTypes.SVINCOLATI_AUCTION_CLOSED]: SvincolatiAuctionClosed
  [DomainEventTypes.SVINCOLATI_COMPLETED]: SvincolatiCompleted

  // Trade
  [DomainEventTypes.TRADE_OFFERED]: TradeOffered
  [DomainEventTypes.TRADE_ACCEPTED]: TradeAccepted
  [DomainEventTypes.TRADE_REJECTED]: TradeRejected
  [DomainEventTypes.COUNTER_OFFER_MADE]: CounterOfferMade

  // Prize
  [DomainEventTypes.PRIZE_ASSIGNED]: PrizeAssigned
  [DomainEventTypes.PRIZES_FINALIZED]: PrizesFinalized

  // Movement
  [DomainEventTypes.MOVEMENT_RECORDED]: MovementRecorded
}

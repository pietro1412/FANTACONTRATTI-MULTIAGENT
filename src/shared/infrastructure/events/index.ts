/**
 * Event Infrastructure Exports
 *
 * This module exports the event bus infrastructure and all domain event types.
 */

// Event Bus
export { EventBus, eventBus } from './event-bus'
export type { EventHandler, Unsubscribe } from './event-bus'

// Domain Events
export {
  DomainEventTypes,
  type DomainEventType,
  type DomainEventMap,
  // Identity Events
  type UserRegistered,
  type UserLoggedIn,
  // League Events
  type LeagueCreated,
  type MemberJoined,
  type MemberLeft,
  // Roster Events
  type PlayerAddedToRoster,
  type PlayerRemovedFromRoster,
  type ContractRenewed,
  type ContractConsolidated,
  // Auction Events
  type AuctionCreated,
  type BidPlaced,
  type AuctionClosed,
  type AppealCreated,
  type AppealResolved,
  type AuctionTimerExpired,
  // Rubata Events
  type RubataStarted,
  type RubataOfferPlaced,
  type RubataAuctionStarted,
  type RubataCompleted,
  // Svincolati Events
  type SvincolatiStarted,
  type FreeAgentNominated,
  type SvincolatiAuctionClosed,
  type SvincolatiCompleted,
  // Trade Events
  type TradeOffered,
  type TradeAccepted,
  type TradeRejected,
  type CounterOfferMade,
  // Prize Events
  type PrizeAssigned,
  type PrizesFinalized,
  // Movement Events
  type MovementType,
  type MovementRecorded,
} from './domain-events'

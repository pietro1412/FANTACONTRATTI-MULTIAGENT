import * as PusherModule from 'pusher'

// Handle both ESM and CJS module formats
const Pusher = (PusherModule as { default?: typeof PusherModule }).default || PusherModule
type PusherInstance = InstanceType<typeof Pusher>

// ==================== TYPES ====================
// These types match the client-side types in pusher.client.ts

export interface BidPlacedData {
  auctionId: string
  memberId: string
  memberName: string
  amount: number
  playerId: string
  playerName: string
  timestamp: string
  timerExpiresAt: string // ISO string - new timer after bid
  timerSeconds: number   // Timer duration setting
}

export interface NominationPendingData {
  auctionId: string
  nominatorId: string
  nominatorName: string
  playerId: string
  playerName: string
  playerRole: string
  startingPrice: number
  timestamp: string
}

export interface NominationConfirmedData {
  auctionId: string
  playerId: string
  playerName: string
  playerRole: string
  startingPrice: number
  nominatorId: string
  nominatorName: string
  timerDuration: number
  timestamp: string
}

export interface MemberReadyData {
  memberId: string
  memberName: string
  isReady: boolean
  readyCount: number
  totalMembers: number
  readyMembers: Array<{ id: string; username: string }>
  pendingMembers: Array<{ id: string; username: string }>
  timestamp: string
}

export interface AuctionStartedData {
  sessionId: string
  auctionType: string
  nominatorId: string
  nominatorName: string
  timestamp: string
}

export interface AuctionClosedData {
  auctionId: string
  playerId: string
  playerName: string
  winnerId: string | null
  winnerName: string | null
  finalPrice: number | null
  wasUnsold: boolean
  timestamp: string
}

export interface TimerUpdateData {
  auctionId: string
  remainingSeconds: number
  totalSeconds: number
  timestamp: string
}

// ==================== RUBATA EVENTS ====================

export interface RubataStealDeclaredData {
  sessionId: string
  bidderId: string
  bidderUsername: string
  playerId: string
  playerName: string
  playerTeam: string
  playerPosition: string
  ownerUsername: string
  basePrice: number
  timestamp: string
}

export interface RubataBidPlacedData {
  sessionId: string
  auctionId: string
  bidderId: string
  bidderUsername: string
  amount: number
  playerName: string
  timestamp: string
}

export interface RubataStateChangedData {
  sessionId: string
  newState: string
  currentIndex: number
  timestamp: string
}

export interface RubataReadyChangedData {
  sessionId: string
  memberId: string
  memberUsername: string
  isReady: boolean
  readyCount: number
  totalMembers: number
  timestamp: string
}

// ==================== PUSHER INITIALIZATION ====================

// Initialize Pusher with environment variables
// Using VITE_ prefix for key and cluster since they're shared with frontend
const pusherConfig = {
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.VITE_PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.VITE_PUSHER_CLUSTER || 'eu',
  useTLS: true,
}

// Check if Pusher is properly configured
const isPusherConfigured = Boolean(
  pusherConfig.appId &&
  pusherConfig.key &&
  pusherConfig.secret &&
  pusherConfig.cluster
)

// Create Pusher instance (or null if not configured)
export const pusher: PusherInstance | null = isPusherConfigured
  ? new Pusher(pusherConfig)
  : null

// Log Pusher configuration status on startup
console.log('[Pusher] === CONFIGURATION STATUS ===')
console.log(`[Pusher] appId: ${pusherConfig.appId || 'MISSING'}`)
console.log(`[Pusher] key: ${pusherConfig.key ? pusherConfig.key.slice(0, 8) + '...' : 'MISSING'}`)
console.log(`[Pusher] secret: ${pusherConfig.secret ? pusherConfig.secret.slice(0, 4) + '...' : 'MISSING'}`)
console.log(`[Pusher] cluster: ${pusherConfig.cluster || 'MISSING'}`)
console.log(`[Pusher] configured: ${isPusherConfigured ? 'YES ✓' : 'NO ✗'}`)
console.log(`[Pusher] instance created: ${pusher ? 'YES ✓' : 'NO ✗'}`)
console.log('[Pusher] ================================')

if (!isPusherConfigured) {
  console.error(
    '[Pusher] NOT CONFIGURED! Missing:',
    !pusherConfig.appId && 'PUSHER_APP_ID',
    !pusherConfig.key && 'VITE_PUSHER_KEY',
    !pusherConfig.secret && 'PUSHER_SECRET',
    !pusherConfig.cluster && 'VITE_PUSHER_CLUSTER'
  )
}

// ==================== CHANNEL NAMING ====================

function getAuctionChannel(sessionId: string): string {
  return `auction-${sessionId}`
}

// ==================== EVENT NAMES ====================

export const PUSHER_EVENTS = {
  BID_PLACED: 'bid-placed',
  NOMINATION_PENDING: 'nomination-pending',
  NOMINATION_CONFIRMED: 'nomination-confirmed',
  MEMBER_READY: 'member-ready',
  AUCTION_STARTED: 'auction-started',
  AUCTION_CLOSED: 'auction-closed',
  TIMER_UPDATE: 'timer-update',
  // Rubata events
  RUBATA_STEAL_DECLARED: 'rubata-steal-declared',
  RUBATA_BID_PLACED: 'rubata-bid-placed',
  RUBATA_STATE_CHANGED: 'rubata-state-changed',
  RUBATA_READY_CHANGED: 'rubata-ready-changed',
  // Svincolati events
  SVINCOLATI_STATE_CHANGED: 'svincolati-state-changed',
  SVINCOLATI_NOMINATION: 'svincolati-nomination',
  SVINCOLATI_BID_PLACED: 'svincolati-bid-placed',
  SVINCOLATI_READY_CHANGED: 'svincolati-ready-changed',
  // Indemnity phase events
  INDEMNITY_DECISION_SUBMITTED: 'indemnity-decision-submitted',
  INDEMNITY_ALL_DECIDED: 'indemnity-all-decided',
  // Pause request events
  PAUSE_REQUESTED: 'pause-requested',
  // Trade events (league channel)
  TRADE_OFFER_RECEIVED: 'trade-offer-received',
  TRADE_UPDATED: 'trade-updated',
} as const

// ==================== HELPER FUNCTIONS ====================

/**
 * Generic trigger function with error handling
 * Logs errors but doesn't throw to prevent breaking the main flow
 */
async function triggerEvent<T extends object>(
  sessionId: string,
  event: string,
  data: T
): Promise<boolean> {
  if (!pusher) {
    console.warn(`[Pusher] Cannot trigger event '${event}' - Pusher not configured`)
    return false
  }

  try {
    const channel = getAuctionChannel(sessionId)
    // Enrich all events with serverTimestamp for client clock synchronization
    const enrichedData = {
      ...data,
      serverTimestamp: Date.now()
    }
    await pusher.trigger(channel, event, enrichedData)
    console.log(`[Pusher] Event '${event}' triggered on channel '${channel}'`)
    return true
  } catch (error) {
    console.error(`[Pusher] Failed to trigger event '${event}':`, error)
    return false
  }
}

// ==================== EXPORTED TRIGGER FUNCTIONS ====================

/**
 * Trigger when a bid is placed during an auction
 */
export async function triggerBidPlaced(
  sessionId: string,
  data: BidPlacedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.BID_PLACED, data)
}

/**
 * Trigger when a player is nominated for auction (pending confirmation)
 */
export async function triggerNominationPending(
  sessionId: string,
  data: NominationPendingData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.NOMINATION_PENDING, data)
}

/**
 * Trigger when a nomination is confirmed and auction starts
 */
export async function triggerNominationConfirmed(
  sessionId: string,
  data: NominationConfirmedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.NOMINATION_CONFIRMED, data)
}

/**
 * Trigger when a member marks themselves as ready
 */
export async function triggerMemberReady(
  sessionId: string,
  data: MemberReadyData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.MEMBER_READY, data)
}

/**
 * Trigger when the auction session officially starts
 */
export async function triggerAuctionStarted(
  sessionId: string,
  data: AuctionStartedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.AUCTION_STARTED, data)
}

/**
 * Trigger when an individual auction closes (player sold or unsold)
 */
export async function triggerAuctionClosed(
  sessionId: string,
  data: AuctionClosedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.AUCTION_CLOSED, data)
}

/**
 * Trigger timer synchronization updates
 */
export async function triggerTimerUpdate(
  sessionId: string,
  data: TimerUpdateData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.TIMER_UPDATE, data)
}

/**
 * Trigger when a manager requests a pause
 */
export async function triggerPauseRequested(
  sessionId: string,
  data: { memberId: string; username: string; type: 'nomination' | 'auction' }
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.PAUSE_REQUESTED, data)
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if Pusher is properly configured and ready to use
 */
export function isPusherReady(): boolean {
  return pusher !== null
}

/**
 * Get the channel name for a given session
 * Useful for clients that need to subscribe
 */
export function getChannelName(sessionId: string): string {
  return getAuctionChannel(sessionId)
}

// ==================== RUBATA TRIGGER FUNCTIONS ====================

/**
 * Trigger when someone declares intent to steal (rubata)
 */
export async function triggerRubataStealDeclared(
  sessionId: string,
  data: RubataStealDeclaredData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.RUBATA_STEAL_DECLARED, data)
}

/**
 * Trigger when a bid is placed during rubata auction
 */
export async function triggerRubataBidPlaced(
  sessionId: string,
  data: RubataBidPlacedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.RUBATA_BID_PLACED, data)
}

/**
 * Trigger when rubata state changes
 */
export async function triggerRubataStateChanged(
  sessionId: string,
  data: RubataStateChangedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.RUBATA_STATE_CHANGED, data)
}

/**
 * Trigger when a member's ready status changes during rubata
 */
export async function triggerRubataReadyChanged(
  sessionId: string,
  data: RubataReadyChangedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.RUBATA_READY_CHANGED, data)
}

// ==================== SVINCOLATI TRIGGER FUNCTIONS ====================

interface SvincolatiStateChangedData {
  state: string
  currentTurnMemberId: string | null
  currentTurnUsername: string | null
  passedMembers: string[]
}

interface SvincolatiNominationData {
  playerId: string
  playerName: string
  nominatorId: string
  nominatorUsername: string
  confirmed: boolean
}

interface SvincolatiBidPlacedData {
  auctionId: string
  playerId: string
  bidderId: string
  bidderUsername: string
  amount: number
}

interface SvincolatiReadyChangedData {
  readyMembers: string[]
  totalMembers: number
}

/**
 * Trigger when svincolati state changes
 */
export async function triggerSvincolatiStateChanged(
  sessionId: string,
  data: SvincolatiStateChangedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED, data)
}

/**
 * Trigger when a player is nominated in svincolati
 */
export async function triggerSvincolatiNomination(
  sessionId: string,
  data: SvincolatiNominationData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.SVINCOLATI_NOMINATION, data)
}

/**
 * Trigger when a bid is placed in svincolati auction
 */
export async function triggerSvincolatiBidPlaced(
  sessionId: string,
  data: SvincolatiBidPlacedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.SVINCOLATI_BID_PLACED, data)
}

/**
 * Trigger when ready status changes in svincolati
 */
export async function triggerSvincolatiReadyChanged(
  sessionId: string,
  data: SvincolatiReadyChangedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.SVINCOLATI_READY_CHANGED, data)
}

// ==================== INDEMNITY PHASE EVENTS ====================

interface IndemnityDecisionSubmittedData {
  memberId: string
  memberUsername: string
  decidedCount: number
  totalCount: number
  timestamp: string
}

interface IndemnityAllDecidedData {
  totalMembers: number
  timestamp: string
}

/**
 * Trigger when a manager submits indemnity decisions
 */
export async function triggerIndemnityDecisionSubmitted(
  sessionId: string,
  data: IndemnityDecisionSubmittedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.INDEMNITY_DECISION_SUBMITTED, data)
}

/**
 * Trigger when all managers have submitted their indemnity decisions
 */
export async function triggerIndemnityAllDecided(
  sessionId: string,
  data: IndemnityAllDecidedData
): Promise<boolean> {
  return triggerEvent(sessionId, PUSHER_EVENTS.INDEMNITY_ALL_DECIDED, data)
}

// ==================== LEAGUE CHANNEL (TRADES) ====================

function getLeagueChannel(leagueId: string): string {
  return `league-${leagueId}`
}

async function triggerLeagueEvent<T extends object>(
  leagueId: string,
  event: string,
  data: T
): Promise<boolean> {
  if (!pusher) {
    console.warn(`[Pusher] Cannot trigger event '${event}' - Pusher not configured`)
    return false
  }

  try {
    const channel = getLeagueChannel(leagueId)
    const enrichedData = {
      ...data,
      serverTimestamp: Date.now()
    }
    await pusher.trigger(channel, event, enrichedData)
    console.log(`[Pusher] Event '${event}' triggered on channel '${channel}'`)
    return true
  } catch (error) {
    console.error(`[Pusher] Failed to trigger event '${event}':`, error)
    return false
  }
}

export interface TradeOfferReceivedData {
  tradeId: string
  senderUsername: string
  receiverUserId: string
  timestamp: string
}

export interface TradeUpdatedData {
  tradeId: string
  newStatus: string
  timestamp: string
}

/**
 * Trigger when a new trade offer is created
 */
export async function triggerTradeOfferReceived(
  leagueId: string,
  data: TradeOfferReceivedData
): Promise<boolean> {
  return triggerLeagueEvent(leagueId, PUSHER_EVENTS.TRADE_OFFER_RECEIVED, data)
}

/**
 * Trigger when a trade offer status changes (accepted, rejected, countered, cancelled)
 */
export async function triggerTradeUpdated(
  leagueId: string,
  data: TradeUpdatedData
): Promise<boolean> {
  return triggerLeagueEvent(leagueId, PUSHER_EVENTS.TRADE_UPDATED, data)
}

/**
 * Get the league channel name for a given league ID
 */
export function getLeagueChannelName(leagueId: string): string {
  return getLeagueChannel(leagueId)
}

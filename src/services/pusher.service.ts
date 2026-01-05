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

if (!isPusherConfigured) {
  console.warn(
    '[Pusher] Not configured. Missing environment variables:',
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
} as const

// ==================== HELPER FUNCTIONS ====================

/**
 * Generic trigger function with error handling
 * Logs errors but doesn't throw to prevent breaking the main flow
 */
async function triggerEvent<T>(
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
    await pusher.trigger(channel, event, data)
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

import type { Channel } from 'pusher-js';
import Pusher from 'pusher-js';
import { useEffect, useState, useRef } from 'react';

// ==================== TYPES ====================

export interface BidPlacedData {
  auctionId: string;
  memberId: string;
  memberName: string;
  amount: number;
  playerId: string;
  playerName: string;
  timestamp: string;
  timerExpiresAt: string; // ISO string - new timer after bid
  timerSeconds: number;   // Timer duration setting
}

export interface NominationPendingData {
  auctionId: string;
  nominatorId: string;
  nominatorName: string;
  playerId: string;
  playerName: string;
  playerRole: string;
  startingPrice: number;
  timestamp: string;
}

export interface NominationConfirmedData {
  auctionId: string;
  playerId: string;
  playerName: string;
  playerRole: string;
  startingPrice: number;
  nominatorId: string;
  nominatorName: string;
  timerDuration: number;
  timestamp: string;
}

export interface MemberReadyData {
  memberId: string;
  memberName: string;
  isReady: boolean;
  readyCount: number;
  totalMembers: number;
  timestamp: string;
}

export interface AuctionStartedData {
  sessionId: string;
  auctionType: string;
  nominatorId: string;
  nominatorName: string;
  timestamp: string;
}

export interface AuctionClosedData {
  auctionId: string;
  playerId: string;
  playerName: string;
  winnerId: string | null;
  winnerName: string | null;
  finalPrice: number | null;
  wasUnsold: boolean;
  timestamp: string;
}

export interface TimerUpdateData {
  auctionId: string;
  remainingSeconds: number;
  totalSeconds: number;
  timestamp: string;
}

// ==================== RUBATA TYPES ====================

export interface RubataStealDeclaredData {
  sessionId: string;
  bidderId: string;
  bidderUsername: string;
  playerId: string;
  playerName: string;
  playerTeam: string;
  playerPosition: string;
  ownerUsername: string;
  basePrice: number;
  timestamp: string;
}

export interface RubataBidPlacedData {
  sessionId: string;
  auctionId: string;
  bidderId: string;
  bidderUsername: string;
  amount: number;
  playerName: string;
  timestamp: string;
}

export interface RubataReadyChangedData {
  sessionId: string;
  memberId: string;
  memberUsername: string;
  isReady: boolean;
  readyCount: number;
  totalMembers: number;
  timestamp: string;
}

// ==================== SVINCOLATI TYPES ====================

export interface SvincolatiStateChangedData {
  state: string;
  currentTurnMemberId: string | null;
  currentTurnUsername: string | null;
  passedMembers: string[];
}

export interface SvincolatiNominationData {
  playerId: string;
  playerName: string;
  nominatorId: string;
  nominatorUsername: string;
  confirmed: boolean;
}

export interface SvincolatiBidPlacedData {
  auctionId: string;
  playerId: string;
  bidderId: string;
  bidderUsername: string;
  amount: number;
}

export interface SvincolatiReadyChangedData {
  readyMembers: string[];
  totalMembers: number;
}

// ==================== TRADE TYPES ====================

export interface TradeOfferReceivedData {
  tradeId: string;
  senderUsername: string;
  receiverUserId: string;
  timestamp: string;
}

export interface TradeUpdatedData {
  tradeId: string;
  newStatus: string;
  timestamp: string;
}

// ==================== INDEMNITY TYPES ====================

export interface IndemnityDecisionSubmittedData {
  memberId: string;
  memberUsername: string;
  decidedCount: number;
  totalCount: number;
  timestamp: string;
}

export interface IndemnityAllDecidedData {
  totalMembers: number;
  timestamp: string;
}

export interface AuctionEventHandlers {
  onBidPlaced?: (data: BidPlacedData) => void;
  onNominationPending?: (data: NominationPendingData) => void;
  onNominationConfirmed?: (data: NominationConfirmedData) => void;
  onMemberReady?: (data: MemberReadyData) => void;
  onAuctionStarted?: (data: AuctionStartedData) => void;
  onAuctionClosed?: (data: AuctionClosedData) => void;
  onTimerUpdate?: (data: TimerUpdateData) => void;
  // Rubata events
  onRubataStealDeclared?: (data: RubataStealDeclaredData) => void;
  onRubataBidPlaced?: (data: RubataBidPlacedData) => void;
  onRubataReadyChanged?: (data: RubataReadyChangedData) => void;
  // Svincolati events
  onSvincolatiStateChanged?: (data: SvincolatiStateChangedData) => void;
  onSvincolatiNomination?: (data: SvincolatiNominationData) => void;
  onSvincolatiBidPlaced?: (data: SvincolatiBidPlacedData) => void;
  onSvincolatiReadyChanged?: (data: SvincolatiReadyChangedData) => void;
  // Indemnity events
  onIndemnityDecisionSubmitted?: (data: IndemnityDecisionSubmittedData) => void;
  onIndemnityAllDecided?: (data: IndemnityAllDecidedData) => void;
  // Pause request event
  onPauseRequested?: (data: PauseRequestedData) => void;
}

export interface PauseRequestedData {
  memberId: string;
  username: string;
  type: 'nomination' | 'auction';
  serverTimestamp: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'failed' | 'unavailable';

// ==================== PUSHER CLIENT INITIALIZATION ====================

// Enable Pusher logging in development
if (import.meta.env.DEV) {
  Pusher.logToConsole = true;
}

// Initialize Pusher client
export const pusherClient = new Pusher(import.meta.env.VITE_PUSHER_KEY || '', {
  cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'eu',
  forceTLS: true,
});

// Store active channel subscriptions
const activeChannels = new Map<string, Channel>();

// ==================== SUBSCRIPTION FUNCTIONS ====================

/**
 * Get the channel name for an auction session
 */
function getChannelName(sessionId: string): string {
  return `auction-${sessionId}`;
}

/**
 * Subscribe to auction events for a specific session
 * @param sessionId - The auction session ID
 * @param handlers - Event handler callbacks
 * @returns The Pusher channel instance
 */
export function subscribeToAuction(
  sessionId: string,
  handlers: AuctionEventHandlers
): Channel {
  const channelName = getChannelName(sessionId);

  // Check if already subscribed
  let channel = activeChannels.get(channelName);

  if (!channel) {
    channel = pusherClient.subscribe(channelName);
    activeChannels.set(channelName, channel);
  }

  // Bind event handlers
  if (handlers.onBidPlaced) {
    channel.bind('bid-placed', handlers.onBidPlaced);
  }

  if (handlers.onNominationPending) {
    channel.bind('nomination-pending', handlers.onNominationPending);
  }

  if (handlers.onNominationConfirmed) {
    channel.bind('nomination-confirmed', handlers.onNominationConfirmed);
  }

  if (handlers.onMemberReady) {
    channel.bind('member-ready', handlers.onMemberReady);
  }

  if (handlers.onAuctionStarted) {
    channel.bind('auction-started', handlers.onAuctionStarted);
  }

  if (handlers.onAuctionClosed) {
    channel.bind('auction-closed', handlers.onAuctionClosed);
  }

  if (handlers.onTimerUpdate) {
    channel.bind('timer-update', handlers.onTimerUpdate);
  }

  // Rubata events
  if (handlers.onRubataStealDeclared) {
    channel.bind('rubata-steal-declared', handlers.onRubataStealDeclared);
  }

  if (handlers.onRubataBidPlaced) {
    channel.bind('rubata-bid-placed', handlers.onRubataBidPlaced);
  }

  if (handlers.onRubataReadyChanged) {
    channel.bind('rubata-ready-changed', handlers.onRubataReadyChanged);
  }

  // Svincolati events
  if (handlers.onSvincolatiStateChanged) {
    channel.bind('svincolati-state-changed', handlers.onSvincolatiStateChanged);
  }

  if (handlers.onSvincolatiNomination) {
    channel.bind('svincolati-nomination', handlers.onSvincolatiNomination);
  }

  if (handlers.onSvincolatiBidPlaced) {
    channel.bind('svincolati-bid-placed', handlers.onSvincolatiBidPlaced);
  }

  if (handlers.onSvincolatiReadyChanged) {
    channel.bind('svincolati-ready-changed', handlers.onSvincolatiReadyChanged);
  }

  // Indemnity events
  if (handlers.onIndemnityDecisionSubmitted) {
    channel.bind('indemnity-decision-submitted', handlers.onIndemnityDecisionSubmitted);
  }

  if (handlers.onIndemnityAllDecided) {
    channel.bind('indemnity-all-decided', handlers.onIndemnityAllDecided);
  }

  // Pause request event
  if (handlers.onPauseRequested) {
    channel.bind('pause-requested', handlers.onPauseRequested);
  }

  return channel;
}

/**
 * Unsubscribe from auction events for a specific session
 * @param sessionId - The auction session ID
 */
export function unsubscribeFromAuction(sessionId: string): void {
  const channelName = getChannelName(sessionId);
  const channel = activeChannels.get(channelName);

  if (channel) {
    // Unbind all events
    channel.unbind_all();

    // Unsubscribe from channel
    pusherClient.unsubscribe(channelName);

    // Remove from active channels map
    activeChannels.delete(channelName);
  }
}

/**
 * Unbind specific handlers from the auction channel without unsubscribing
 * @param sessionId - The auction session ID
 * @param handlers - Event handlers to unbind
 */
export function unbindAuctionHandlers(
  sessionId: string,
  handlers: AuctionEventHandlers
): void {
  const channelName = getChannelName(sessionId);
  const channel = activeChannels.get(channelName);

  if (channel) {
    if (handlers.onBidPlaced) {
      channel.unbind('bid-placed', handlers.onBidPlaced);
    }
    if (handlers.onNominationPending) {
      channel.unbind('nomination-pending', handlers.onNominationPending);
    }
    if (handlers.onNominationConfirmed) {
      channel.unbind('nomination-confirmed', handlers.onNominationConfirmed);
    }
    if (handlers.onMemberReady) {
      channel.unbind('member-ready', handlers.onMemberReady);
    }
    if (handlers.onAuctionStarted) {
      channel.unbind('auction-started', handlers.onAuctionStarted);
    }
    if (handlers.onAuctionClosed) {
      channel.unbind('auction-closed', handlers.onAuctionClosed);
    }
    if (handlers.onTimerUpdate) {
      channel.unbind('timer-update', handlers.onTimerUpdate);
    }
    // Rubata events
    if (handlers.onRubataStealDeclared) {
      channel.unbind('rubata-steal-declared', handlers.onRubataStealDeclared);
    }
    if (handlers.onRubataBidPlaced) {
      channel.unbind('rubata-bid-placed', handlers.onRubataBidPlaced);
    }
    if (handlers.onRubataReadyChanged) {
      channel.unbind('rubata-ready-changed', handlers.onRubataReadyChanged);
    }
    // Svincolati events
    if (handlers.onSvincolatiStateChanged) {
      channel.unbind('svincolati-state-changed', handlers.onSvincolatiStateChanged);
    }
    if (handlers.onSvincolatiNomination) {
      channel.unbind('svincolati-nomination', handlers.onSvincolatiNomination);
    }
    if (handlers.onSvincolatiBidPlaced) {
      channel.unbind('svincolati-bid-placed', handlers.onSvincolatiBidPlaced);
    }
    if (handlers.onSvincolatiReadyChanged) {
      channel.unbind('svincolati-ready-changed', handlers.onSvincolatiReadyChanged);
    }
    // Indemnity events
    if (handlers.onIndemnityDecisionSubmitted) {
      channel.unbind('indemnity-decision-submitted', handlers.onIndemnityDecisionSubmitted);
    }
    if (handlers.onIndemnityAllDecided) {
      channel.unbind('indemnity-all-decided', handlers.onIndemnityAllDecided);
    }
    // Pause request event
    if (handlers.onPauseRequested) {
      channel.unbind('pause-requested', handlers.onPauseRequested);
    }
  }
}

// ==================== REACT HOOK ====================

export interface UsePusherAuctionOptions {
  onBidPlaced?: (data: BidPlacedData) => void;
  onNominationPending?: (data: NominationPendingData) => void;
  onNominationConfirmed?: (data: NominationConfirmedData) => void;
  onMemberReady?: (data: MemberReadyData) => void;
  onAuctionStarted?: (data: AuctionStartedData) => void;
  onAuctionClosed?: (data: AuctionClosedData) => void;
  onTimerUpdate?: (data: TimerUpdateData) => void;
  // Rubata events
  onRubataStealDeclared?: (data: RubataStealDeclaredData) => void;
  onRubataBidPlaced?: (data: RubataBidPlacedData) => void;
  onRubataReadyChanged?: (data: RubataReadyChangedData) => void;
  // Svincolati events
  onSvincolatiStateChanged?: (data: SvincolatiStateChangedData) => void;
  onSvincolatiNomination?: (data: SvincolatiNominationData) => void;
  onSvincolatiBidPlaced?: (data: SvincolatiBidPlacedData) => void;
  onSvincolatiReadyChanged?: (data: SvincolatiReadyChangedData) => void;
  // Indemnity events
  onIndemnityDecisionSubmitted?: (data: IndemnityDecisionSubmittedData) => void;
  onIndemnityAllDecided?: (data: IndemnityAllDecidedData) => void;
  // Pause request event
  onPauseRequested?: (data: PauseRequestedData) => void;
}

export interface UsePusherAuctionResult {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  channel: Channel | null;
}

/**
 * React hook for subscribing to Pusher auction events
 * Automatically subscribes on mount and unsubscribes on unmount
 * @param sessionId - The auction session ID (null/undefined to skip subscription)
 * @param options - Event handler callbacks
 * @returns Connection status and channel reference
 */
export function usePusherAuction(
  sessionId: string | null | undefined,
  options: UsePusherAuctionOptions = {}
): UsePusherAuctionResult {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [channel, setChannel] = useState<Channel | null>(null);
  const handlersRef = useRef<UsePusherAuctionOptions>(options);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = options;
  }, [options]);

  // Subscribe to connection state changes
  useEffect(() => {
    const handleStateChange = (states: { current: string; previous: string }) => {
      setConnectionStatus(states.current as ConnectionStatus);
    };

    pusherClient.connection.bind('state_change', handleStateChange);

    // Set initial state
    setConnectionStatus(pusherClient.connection.state as ConnectionStatus);

    return () => {
      pusherClient.connection.unbind('state_change', handleStateChange);
    };
  }, []);

  // Subscribe to auction channel
  useEffect(() => {
    if (!sessionId) {
      setChannel(null);
      return;
    }

    // Create stable handler wrappers that use the ref
    const handlers: AuctionEventHandlers = {
      onBidPlaced: (data) => handlersRef.current.onBidPlaced?.(data),
      onNominationPending: (data) => handlersRef.current.onNominationPending?.(data),
      onNominationConfirmed: (data) => handlersRef.current.onNominationConfirmed?.(data),
      onMemberReady: (data) => handlersRef.current.onMemberReady?.(data),
      onAuctionStarted: (data) => handlersRef.current.onAuctionStarted?.(data),
      onAuctionClosed: (data) => handlersRef.current.onAuctionClosed?.(data),
      onTimerUpdate: (data) => handlersRef.current.onTimerUpdate?.(data),
      // Rubata events
      onRubataStealDeclared: (data) => handlersRef.current.onRubataStealDeclared?.(data),
      onRubataBidPlaced: (data) => handlersRef.current.onRubataBidPlaced?.(data),
      onRubataReadyChanged: (data) => handlersRef.current.onRubataReadyChanged?.(data),
      // Svincolati events
      onSvincolatiStateChanged: (data) => handlersRef.current.onSvincolatiStateChanged?.(data),
      onSvincolatiNomination: (data) => handlersRef.current.onSvincolatiNomination?.(data),
      onSvincolatiBidPlaced: (data) => handlersRef.current.onSvincolatiBidPlaced?.(data),
      onSvincolatiReadyChanged: (data) => handlersRef.current.onSvincolatiReadyChanged?.(data),
      // Pause request event
      onPauseRequested: (data) => handlersRef.current.onPauseRequested?.(data),
    };

    const subscribedChannel = subscribeToAuction(sessionId, handlers);
    setChannel(subscribedChannel);

    return () => {
      unsubscribeFromAuction(sessionId);
      setChannel(null);
    };
  }, [sessionId]);

  const isConnected = connectionStatus === 'connected';

  return {
    connectionStatus,
    isConnected,
    channel,
  };
}

// ==================== TRADE REACT HOOK ====================

export interface UsePusherTradesOptions {
  onTradeOfferReceived?: (data: TradeOfferReceivedData) => void;
  onTradeUpdated?: (data: TradeUpdatedData) => void;
}

export interface UsePusherTradesResult {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
}

/**
 * React hook for subscribing to Pusher trade events on a league channel
 * @param leagueId - The league ID (null/undefined to skip subscription)
 * @param options - Event handler callbacks
 */
export function usePusherTrades(
  leagueId: string | null | undefined,
  options: UsePusherTradesOptions = {}
): UsePusherTradesResult {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const handlersRef = useRef<UsePusherTradesOptions>(options);

  useEffect(() => {
    handlersRef.current = options;
  }, [options]);

  useEffect(() => {
    const handleStateChange = (states: { current: string; previous: string }) => {
      setConnectionStatus(states.current as ConnectionStatus);
    };
    pusherClient.connection.bind('state_change', handleStateChange);
    setConnectionStatus(pusherClient.connection.state as ConnectionStatus);
    return () => {
      pusherClient.connection.unbind('state_change', handleStateChange);
    };
  }, []);

  useEffect(() => {
    if (!leagueId) return;

    const channelName = `league-${leagueId}`;
    let channel = activeChannels.get(channelName);

    if (!channel) {
      channel = pusherClient.subscribe(channelName);
      activeChannels.set(channelName, channel);
    }

    const onReceived = (data: TradeOfferReceivedData) => handlersRef.current.onTradeOfferReceived?.(data);
    const onUpdated = (data: TradeUpdatedData) => handlersRef.current.onTradeUpdated?.(data);

    channel.bind('trade-offer-received', onReceived);
    channel.bind('trade-updated', onUpdated);

    return () => {
      if (channel) {
        channel.unbind('trade-offer-received', onReceived);
        channel.unbind('trade-updated', onUpdated);
      }
      // Only unsubscribe if no other bindings
      const ch = activeChannels.get(channelName);
      if (ch) {
        pusherClient.unsubscribe(channelName);
        activeChannels.delete(channelName);
      }
    };
  }, [leagueId]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
  };
}

/**
 * Disconnect Pusher client entirely
 * Use this when the user logs out or the app is closing
 */
export function disconnectPusher(): void {
  // Unsubscribe from all channels
  activeChannels.forEach((_, channelName) => {
    pusherClient.unsubscribe(channelName);
  });
  activeChannels.clear();

  // Disconnect the client
  pusherClient.disconnect();
}

/**
 * Reconnect Pusher client
 * Use this after calling disconnectPusher
 */
export function reconnectPusher(): void {
  pusherClient.connect();
}


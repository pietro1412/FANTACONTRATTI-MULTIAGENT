import Pusher, { Channel } from 'pusher-js';
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

export interface AuctionEventHandlers {
  onBidPlaced?: (data: BidPlacedData) => void;
  onNominationPending?: (data: NominationPendingData) => void;
  onNominationConfirmed?: (data: NominationConfirmedData) => void;
  onMemberReady?: (data: MemberReadyData) => void;
  onAuctionStarted?: (data: AuctionStartedData) => void;
  onAuctionClosed?: (data: AuctionClosedData) => void;
  onTimerUpdate?: (data: TimerUpdateData) => void;
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


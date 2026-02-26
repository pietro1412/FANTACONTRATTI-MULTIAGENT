// =============================================================================
// Pusher Service - Real-time notifications for FantaContratti Mobile App
// =============================================================================

import Pusher, { Channel } from 'pusher-js';

// =============================================================================
// Configuration
// =============================================================================

// TODO: Move to environment config
const PUSHER_KEY = 'e9bed48b0dd95a81e2fb';
const PUSHER_CLUSTER = 'mt1';

// =============================================================================
// Types
// =============================================================================

export interface BidPlacedData {
  auctionId: string;
  memberId: string;
  memberName: string;
  amount: number;
  playerId: string;
  playerName: string;
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

export interface TradeOfferReceivedData {
  tradeId: string;
  fromMemberId: string;
  fromMemberName: string;
  message?: string;
  timestamp: string;
}

export interface TradeOfferRespondedData {
  tradeId: string;
  memberId: string;
  memberName: string;
  status: 'ACCEPTED' | 'REJECTED' | 'COUNTERED';
  timestamp: string;
}

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

export interface RubataStealDeclaredData {
  sessionId: string;
  bidderId: string;
  bidderUsername: string;
  playerId: string;
  playerName: string;
  timestamp: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'failed' | 'unavailable';

export interface PusherEventHandlers {
  onBidPlaced?: (data: BidPlacedData) => void;
  onNominationConfirmed?: (data: NominationConfirmedData) => void;
  onMemberReady?: (data: MemberReadyData) => void;
  onAuctionClosed?: (data: AuctionClosedData) => void;
  onTimerUpdate?: (data: TimerUpdateData) => void;
  onTradeOfferReceived?: (data: TradeOfferReceivedData) => void;
  onTradeOfferResponded?: (data: TradeOfferRespondedData) => void;
  onIndemnityDecisionSubmitted?: (data: IndemnityDecisionSubmittedData) => void;
  onIndemnityAllDecided?: (data: IndemnityAllDecidedData) => void;
  onRubataStealDeclared?: (data: RubataStealDeclaredData) => void;
}

// =============================================================================
// Pusher Client
// =============================================================================

class PusherService {
  private client: Pusher | null = null;
  private activeChannels: Map<string, Channel> = new Map();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private connectionListeners: Set<(status: ConnectionStatus) => void> = new Set();

  // ===========================================================================
  // Initialization
  // ===========================================================================

  initialize(): void {
    if (this.client) {
      console.log('[PusherService] Already initialized');
      return;
    }

    console.log('[PusherService] Initializing Pusher client');

    this.client = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
    });

    // Listen to connection state changes
    this.client.connection.bind('state_change', (states: { current: string; previous: string }) => {
      this.connectionStatus = states.current as ConnectionStatus;
      console.log('[PusherService] Connection state changed:', states.current);
      this.notifyConnectionListeners();
    });

    this.client.connection.bind('connected', () => {
      console.log('[PusherService] Connected');
    });

    this.client.connection.bind('error', (err: Error) => {
      console.error('[PusherService] Connection error:', err);
    });
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  addConnectionListener(listener: (status: ConnectionStatus) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  private notifyConnectionListeners(): void {
    this.connectionListeners.forEach((listener) => listener(this.connectionStatus));
  }

  disconnect(): void {
    if (!this.client) return;

    // Unsubscribe from all channels
    this.activeChannels.forEach((_, channelName) => {
      this.client?.unsubscribe(channelName);
    });
    this.activeChannels.clear();

    this.client.disconnect();
    console.log('[PusherService] Disconnected');
  }

  reconnect(): void {
    if (this.client) {
      this.client.connect();
      console.log('[PusherService] Reconnecting...');
    } else {
      this.initialize();
    }
  }

  // ===========================================================================
  // Channel Subscription
  // ===========================================================================

  /**
   * Subscribe to an auction session channel
   */
  subscribeToAuction(sessionId: string, handlers: PusherEventHandlers): () => void {
    if (!this.client) {
      console.warn('[PusherService] Client not initialized');
      return () => {};
    }

    const channelName = `auction-${sessionId}`;
    let channel = this.activeChannels.get(channelName);

    if (!channel) {
      channel = this.client.subscribe(channelName);
      this.activeChannels.set(channelName, channel);
      console.log('[PusherService] Subscribed to channel:', channelName);
    }

    // Bind event handlers
    const boundHandlers: Array<{ event: string; handler: (data: unknown) => void }> = [];

    if (handlers.onBidPlaced) {
      channel.bind('bid-placed', handlers.onBidPlaced);
      boundHandlers.push({ event: 'bid-placed', handler: handlers.onBidPlaced as (data: unknown) => void });
    }

    if (handlers.onNominationConfirmed) {
      channel.bind('nomination-confirmed', handlers.onNominationConfirmed);
      boundHandlers.push({ event: 'nomination-confirmed', handler: handlers.onNominationConfirmed as (data: unknown) => void });
    }

    if (handlers.onMemberReady) {
      channel.bind('member-ready', handlers.onMemberReady);
      boundHandlers.push({ event: 'member-ready', handler: handlers.onMemberReady as (data: unknown) => void });
    }

    if (handlers.onAuctionClosed) {
      channel.bind('auction-closed', handlers.onAuctionClosed);
      boundHandlers.push({ event: 'auction-closed', handler: handlers.onAuctionClosed as (data: unknown) => void });
    }

    if (handlers.onTimerUpdate) {
      channel.bind('timer-update', handlers.onTimerUpdate);
      boundHandlers.push({ event: 'timer-update', handler: handlers.onTimerUpdate as (data: unknown) => void });
    }

    if (handlers.onIndemnityDecisionSubmitted) {
      channel.bind('indemnity-decision-submitted', handlers.onIndemnityDecisionSubmitted);
      boundHandlers.push({ event: 'indemnity-decision-submitted', handler: handlers.onIndemnityDecisionSubmitted as (data: unknown) => void });
    }

    if (handlers.onIndemnityAllDecided) {
      channel.bind('indemnity-all-decided', handlers.onIndemnityAllDecided);
      boundHandlers.push({ event: 'indemnity-all-decided', handler: handlers.onIndemnityAllDecided as (data: unknown) => void });
    }

    if (handlers.onRubataStealDeclared) {
      channel.bind('rubata-steal-declared', handlers.onRubataStealDeclared);
      boundHandlers.push({ event: 'rubata-steal-declared', handler: handlers.onRubataStealDeclared as (data: unknown) => void });
    }

    // Return unsubscribe function
    return () => {
      const ch = this.activeChannels.get(channelName);
      if (ch) {
        boundHandlers.forEach(({ event, handler }) => {
          ch.unbind(event, handler);
        });
      }
    };
  }

  /**
   * Subscribe to user-specific notifications (trades, etc.)
   */
  subscribeToUser(userId: string, handlers: PusherEventHandlers): () => void {
    if (!this.client) {
      console.warn('[PusherService] Client not initialized');
      return () => {};
    }

    const channelName = `user-${userId}`;
    let channel = this.activeChannels.get(channelName);

    if (!channel) {
      channel = this.client.subscribe(channelName);
      this.activeChannels.set(channelName, channel);
      console.log('[PusherService] Subscribed to user channel:', channelName);
    }

    const boundHandlers: Array<{ event: string; handler: (data: unknown) => void }> = [];

    if (handlers.onTradeOfferReceived) {
      channel.bind('trade-offer-received', handlers.onTradeOfferReceived);
      boundHandlers.push({ event: 'trade-offer-received', handler: handlers.onTradeOfferReceived as (data: unknown) => void });
    }

    if (handlers.onTradeOfferResponded) {
      channel.bind('trade-offer-responded', handlers.onTradeOfferResponded);
      boundHandlers.push({ event: 'trade-offer-responded', handler: handlers.onTradeOfferResponded as (data: unknown) => void });
    }

    return () => {
      const ch = this.activeChannels.get(channelName);
      if (ch) {
        boundHandlers.forEach(({ event, handler }) => {
          ch.unbind(event, handler);
        });
      }
    };
  }

  /**
   * Subscribe to a league channel for general updates
   */
  subscribeToLeague(leagueId: string, handlers: PusherEventHandlers): () => void {
    if (!this.client) {
      console.warn('[PusherService] Client not initialized');
      return () => {};
    }

    const channelName = `league-${leagueId}`;
    let channel = this.activeChannels.get(channelName);

    if (!channel) {
      channel = this.client.subscribe(channelName);
      this.activeChannels.set(channelName, channel);
      console.log('[PusherService] Subscribed to league channel:', channelName);
    }

    const boundHandlers: Array<{ event: string; handler: (data: unknown) => void }> = [];

    if (handlers.onTradeOfferReceived) {
      channel.bind('trade-offer-received', handlers.onTradeOfferReceived);
      boundHandlers.push({ event: 'trade-offer-received', handler: handlers.onTradeOfferReceived as (data: unknown) => void });
    }

    if (handlers.onTradeOfferResponded) {
      channel.bind('trade-offer-responded', handlers.onTradeOfferResponded);
      boundHandlers.push({ event: 'trade-offer-responded', handler: handlers.onTradeOfferResponded as (data: unknown) => void });
    }

    return () => {
      const ch = this.activeChannels.get(channelName);
      if (ch) {
        boundHandlers.forEach(({ event, handler }) => {
          ch.unbind(event, handler);
        });
      }
    };
  }

  /**
   * Unsubscribe from a channel completely
   */
  unsubscribeFromChannel(channelName: string): void {
    const channel = this.activeChannels.get(channelName);
    if (channel) {
      channel.unbind_all();
      this.client?.unsubscribe(channelName);
      this.activeChannels.delete(channelName);
      console.log('[PusherService] Unsubscribed from channel:', channelName);
    }
  }
}

// Singleton instance
export const pusherService = new PusherService();

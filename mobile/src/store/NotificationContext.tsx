// =============================================================================
// NotificationContext - Real-time notifications for FantaContratti Mobile App
// =============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from './AuthContext';
import { useLeague } from './LeagueContext';
import {
  pusherService,
  ConnectionStatus,
  BidPlacedData,
  AuctionClosedData,
  TradeOfferReceivedData,
  TradeOfferRespondedData,
} from '../services/pusher';

// =============================================================================
// Types
// =============================================================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

interface NotificationContextType {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  clearNotifications: () => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  primary: '#6366F1',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

const NOTIFICATION_COLORS: Record<Notification['type'], string> = {
  info: COLORS.info,
  success: COLORS.success,
  warning: COLORS.warning,
  error: COLORS.error,
};

const NOTIFICATION_ICONS: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  error: 'close-circle',
};

const MAX_NOTIFICATIONS = 50;
const TOAST_DURATION = 4000;

// =============================================================================
// Toast Component
// =============================================================================

interface ToastProps {
  notification: Notification;
  onDismiss: () => void;
}

function Toast({ notification, onDismiss }: ToastProps): React.JSX.Element {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [translateY, opacity, onDismiss]);

  const color = NOTIFICATION_COLORS[notification.type];
  const icon = NOTIFICATION_ICONS[notification.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          transform: [{ translateY }],
          opacity,
          borderLeftColor: color,
        },
      ]}
    >
      <View style={[styles.toastIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.toastContent}>
        <Text style={styles.toastTitle}>{notification.title}</Text>
        <Text style={styles.toastMessage} numberOfLines={2}>
          {notification.message}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.toastDismiss}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// Provider Component
// =============================================================================

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps): React.JSX.Element {
  const { user, isAuthenticated } = useAuth();
  const { selectedLeague, membership } = useLeague();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentToast, setCurrentToast] = useState<Notification | null>(null);
  const toastQueue = useRef<Notification[]>([]);

  // ===========================================================================
  // Notification Management
  // ===========================================================================

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notif,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, MAX_NOTIFICATIONS);
    });
    setUnreadCount((prev) => prev + 1);

    // Queue toast
    toastQueue.current.push(newNotification);
    if (!currentToast) {
      showNextToast();
    }
  }, [currentToast]);

  const showNextToast = useCallback(() => {
    if (toastQueue.current.length > 0) {
      const next = toastQueue.current.shift();
      if (next) {
        setCurrentToast(next);
      }
    } else {
      setCurrentToast(null);
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // ===========================================================================
  // Pusher Event Handlers
  // ===========================================================================

  const handleBidPlaced = useCallback((data: BidPlacedData) => {
    addNotification({
      type: 'info',
      title: 'Nuova Offerta',
      message: `${data.memberName} ha offerto ${data.amount}M per ${data.playerName}`,
      data: { auctionId: data.auctionId },
    });
  }, [addNotification]);

  const handleAuctionClosed = useCallback((data: AuctionClosedData) => {
    if (data.wasUnsold) {
      addNotification({
        type: 'warning',
        title: 'Asta Terminata',
        message: `${data.playerName} e\' rimasto invenduto`,
      });
    } else {
      addNotification({
        type: 'success',
        title: 'Asta Terminata',
        message: `${data.playerName} acquistato da ${data.winnerName} per ${data.finalPrice}M`,
      });
    }
  }, [addNotification]);

  const handleTradeOfferReceived = useCallback((data: TradeOfferReceivedData) => {
    addNotification({
      type: 'info',
      title: 'Nuova Offerta di Scambio',
      message: `${data.fromMemberName} ti ha inviato una proposta di scambio`,
      data: { tradeId: data.tradeId },
    });
  }, [addNotification]);

  const handleTradeOfferResponded = useCallback((data: TradeOfferRespondedData) => {
    const statusMessages = {
      ACCEPTED: 'ha accettato',
      REJECTED: 'ha rifiutato',
      COUNTERED: 'ha controproposto',
    };
    addNotification({
      type: data.status === 'ACCEPTED' ? 'success' : data.status === 'REJECTED' ? 'error' : 'info',
      title: 'Risposta allo Scambio',
      message: `${data.memberName} ${statusMessages[data.status]} la tua offerta`,
      data: { tradeId: data.tradeId },
    });
  }, [addNotification]);

  // ===========================================================================
  // Pusher Connection
  // ===========================================================================

  // Initialize Pusher on mount
  useEffect(() => {
    pusherService.initialize();

    const unsubscribe = pusherService.addConnectionListener((status) => {
      setConnectionStatus(status);
    });

    return () => {
      unsubscribe();
      pusherService.disconnect();
    };
  }, []);

  // Subscribe to user-specific notifications when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    const unsubscribe = pusherService.subscribeToUser(user.id, {
      onTradeOfferReceived: handleTradeOfferReceived,
      onTradeOfferResponded: handleTradeOfferResponded,
    });

    return unsubscribe;
  }, [isAuthenticated, user, handleTradeOfferReceived, handleTradeOfferResponded]);

  // Subscribe to league notifications when a league is selected
  useEffect(() => {
    if (!isAuthenticated || !selectedLeague) {
      return;
    }

    const unsubscribe = pusherService.subscribeToLeague(selectedLeague.id, {
      onTradeOfferReceived: handleTradeOfferReceived,
      onTradeOfferResponded: handleTradeOfferResponded,
    });

    return unsubscribe;
  }, [isAuthenticated, selectedLeague, handleTradeOfferReceived, handleTradeOfferResponded]);

  // ===========================================================================
  // Context Value
  // ===========================================================================

  const contextValue: NotificationContextType = {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    notifications,
    unreadCount,
    addNotification,
    clearNotifications,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {/* Toast Container */}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {currentToast && (
          <Toast
            key={currentToast.id}
            notification={currentToast}
            onDismiss={showNextToast}
          />
        )}
      </View>
    </NotificationContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// =============================================================================
// Auction-specific Hook
// =============================================================================

export interface UseAuctionNotificationsOptions {
  onBidPlaced?: (data: BidPlacedData) => void;
  onAuctionClosed?: (data: AuctionClosedData) => void;
}

export function useAuctionNotifications(
  sessionId: string | null | undefined,
  options: UseAuctionNotificationsOptions = {}
): void {
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = pusherService.subscribeToAuction(sessionId, {
      onBidPlaced: (data) => {
        if (options.onBidPlaced) {
          options.onBidPlaced(data);
        }
      },
      onAuctionClosed: (data) => {
        if (options.onAuctionClosed) {
          options.onAuctionClosed(data);
        }
        // Also add to notification center
        if (data.wasUnsold) {
          addNotification({
            type: 'warning',
            title: 'Asta Terminata',
            message: `${data.playerName} e\' rimasto invenduto`,
          });
        } else {
          addNotification({
            type: 'success',
            title: 'Asta Terminata',
            message: `${data.playerName} acquistato da ${data.winnerName} per ${data.finalPrice}M`,
          });
        }
      },
    });

    return unsubscribe;
  }, [sessionId, options, addNotification]);
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  toastDismiss: {
    padding: 4,
  },
});

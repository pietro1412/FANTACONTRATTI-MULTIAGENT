// =============================================================================
// TradesScreen - Trade offers management for FantaContratti Mobile App
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useLeague } from '@/store/LeagueContext';
import { tradesApi, Trade } from '@/services/api';

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardBorder: '#3d3d5c',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

type TabType = 'received' | 'sent' | 'history';

const TABS: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'received', label: 'Ricevute', icon: 'download-outline' },
  { key: 'sent', label: 'Inviate', icon: 'send-outline' },
  { key: 'history', label: 'Storico', icon: 'time-outline' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PENDING: { color: COLORS.warning, label: 'In attesa', icon: 'hourglass-outline' },
  ACCEPTED: { color: COLORS.success, label: 'Accettata', icon: 'checkmark-circle-outline' },
  REJECTED: { color: COLORS.error, label: 'Rifiutata', icon: 'close-circle-outline' },
  COUNTERED: { color: COLORS.info, label: 'Contro-offerta', icon: 'swap-horizontal-outline' },
  CANCELLED: { color: COLORS.textMuted, label: 'Annullata', icon: 'ban-outline' },
  EXPIRED: { color: COLORS.textMuted, label: 'Scaduta', icon: 'alarm-outline' },
};

// =============================================================================
// Types
// =============================================================================

type TradesNavigationProp = NativeStackNavigationProp<any>;

// =============================================================================
// Helper Functions
// =============================================================================

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatBudget = (amount: number | undefined | null): string => {
  const safeAmount = amount ?? 0;
  if (safeAmount >= 1000000) {
    return `${(safeAmount / 1000000).toFixed(1)}M`;
  }
  return safeAmount.toLocaleString('it-IT');
};

const getTimeRemaining = (expiresAt: string): string => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return 'Scaduta';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}g ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

// =============================================================================
// Sub-Components
// =============================================================================

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: Record<TabType, number>;
}

function TabBar({ activeTab, onTabChange, counts }: TabBarProps): React.JSX.Element {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key];

        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={isActive ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {count > 0 && (
              <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                <Text style={styles.tabBadgeText}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface TradeCardProps {
  trade: Trade;
  type: 'received' | 'sent' | 'history';
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

function TradeCard({ trade, type, onPress, onAccept, onReject }: TradeCardProps): React.JSX.Element {
  const statusConfig = STATUS_CONFIG[trade.status] || STATUS_CONFIG.PENDING;
  const isActionable = trade.status === 'PENDING' && type === 'received';

  // Determine the other party
  const otherParty = type === 'received' ? trade.fromMember : trade.toMember;

  return (
    <TouchableOpacity
      style={styles.tradeCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.tradeHeader}>
        <View style={styles.tradePartyInfo}>
          <View style={styles.tradeAvatar}>
            <Ionicons name="person" size={20} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.tradePartyName}>
              {type === 'received' ? 'Da: ' : 'A: '}
              <Text style={styles.tradePartyNameBold}>
                {otherParty?.teamName || otherParty?.username || 'Sconosciuto'}
              </Text>
            </Text>
            <Text style={styles.tradeDate}>{formatDate(trade.createdAt)}</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Trade Content */}
      <View style={styles.tradeContent}>
        {/* Offered */}
        <View style={styles.tradeSection}>
          <Text style={styles.tradeSectionLabel}>
            {type === 'received' ? 'Ti offre' : 'Offri'}
          </Text>
          <View style={styles.tradeItems}>
            {trade.offeredPlayers && trade.offeredPlayers.length > 0 ? (
              trade.offeredPlayers.slice(0, 3).map((rp, index) => (
                <View key={index} style={styles.playerChip}>
                  <Text style={styles.playerChipText} numberOfLines={1}>
                    {rp.player?.name || 'Giocatore'}
                  </Text>
                </View>
              ))
            ) : null}
            {trade.offeredPlayers && trade.offeredPlayers.length > 3 && (
              <View style={styles.moreChip}>
                <Text style={styles.moreChipText}>+{trade.offeredPlayers.length - 3}</Text>
              </View>
            )}
            {trade.offeredBudget > 0 && (
              <View style={[styles.playerChip, styles.budgetChip]}>
                <Ionicons name="cash-outline" size={12} color={COLORS.success} />
                <Text style={[styles.playerChipText, { color: COLORS.success }]}>
                  {formatBudget(trade.offeredBudget)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Arrow */}
        <View style={styles.tradeArrow}>
          <Ionicons name="swap-vertical" size={24} color={COLORS.textMuted} />
        </View>

        {/* Requested */}
        <View style={styles.tradeSection}>
          <Text style={styles.tradeSectionLabel}>
            {type === 'received' ? 'In cambio di' : 'Richiedi'}
          </Text>
          <View style={styles.tradeItems}>
            {trade.requestedPlayers && trade.requestedPlayers.length > 0 ? (
              trade.requestedPlayers.slice(0, 3).map((rp, index) => (
                <View key={index} style={styles.playerChip}>
                  <Text style={styles.playerChipText} numberOfLines={1}>
                    {rp.player?.name || 'Giocatore'}
                  </Text>
                </View>
              ))
            ) : null}
            {trade.requestedPlayers && trade.requestedPlayers.length > 3 && (
              <View style={styles.moreChip}>
                <Text style={styles.moreChipText}>+{trade.requestedPlayers.length - 3}</Text>
              </View>
            )}
            {trade.requestedBudget > 0 && (
              <View style={[styles.playerChip, styles.budgetChip]}>
                <Ionicons name="cash-outline" size={12} color={COLORS.warning} />
                <Text style={[styles.playerChipText, { color: COLORS.warning }]}>
                  {formatBudget(trade.requestedBudget)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Message */}
      {trade.message && (
        <View style={styles.messageContainer}>
          <Ionicons name="chatbubble-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.messageText} numberOfLines={2}>
            {trade.message}
          </Text>
        </View>
      )}

      {/* Expiration */}
      {trade.status === 'PENDING' && trade.expiresAt && (
        <View style={styles.expirationContainer}>
          <Ionicons name="alarm-outline" size={14} color={COLORS.warning} />
          <Text style={styles.expirationText}>
            Scade tra: {getTimeRemaining(trade.expiresAt)}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      {isActionable && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={onReject}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={COLORS.error} />
            <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Rifiuta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={onAccept}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={18} color={COLORS.success} />
            <Text style={[styles.actionButtonText, { color: COLORS.success }]}>Accetta</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyState({ type }: { type: TabType }): React.JSX.Element {
  const messages: Record<TabType, { title: string; subtitle: string }> = {
    received: {
      title: 'Nessuna offerta ricevuta',
      subtitle: 'Le offerte di scambio che riceverai appariranno qui',
    },
    sent: {
      title: 'Nessuna offerta inviata',
      subtitle: 'Le offerte di scambio che invierai appariranno qui',
    },
    history: {
      title: 'Nessuno storico',
      subtitle: 'Le offerte concluse appariranno qui',
    },
  };

  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="swap-horizontal-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>{messages[type].title}</Text>
      <Text style={styles.emptySubtitle}>{messages[type].subtitle}</Text>
    </View>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento scambi...</Text>
    </View>
  );
}

function NoLeagueState(): React.JSX.Element {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="trophy-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>Nessuna lega selezionata</Text>
      <Text style={styles.emptySubtitle}>
        Seleziona una lega dalla schermata Home per visualizzare gli scambi
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function TradesScreen(): React.JSX.Element {
  const navigation = useNavigation<TradesNavigationProp>();
  const { selectedLeague } = useLeague();

  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [received, setReceived] = useState<Trade[]>([]);
  const [sent, setSent] = useState<Trade[]>([]);
  const [history, setHistory] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchTrades = useCallback(async (showLoader: boolean = true) => {
    if (!selectedLeague) {
      setIsLoading(false);
      return;
    }

    if (showLoader) {
      setIsLoading(true);
    }

    try {
      console.log('[TradesScreen] Fetching trades for league:', selectedLeague.id);
      const response = await tradesApi.getTrades(selectedLeague.id);
      console.log('[TradesScreen] Response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        setReceived(response.data.received || []);
        setSent(response.data.sent || []);
        setHistory(response.data.history || []);
      }
    } catch (err) {
      console.error('[TradesScreen] Error fetching trades:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLeague]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTrades(false);
  }, [fetchTrades]);

  const handleTradePress = useCallback((trade: Trade) => {
    navigation.navigate('TradeDetail', { tradeId: trade.id });
  }, [navigation]);

  const handleAcceptTrade = useCallback(async (trade: Trade) => {
    Alert.alert(
      'Conferma Accettazione',
      'Sei sicuro di voler accettare questa offerta di scambio?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Accetta',
          style: 'default',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await tradesApi.respondToOffer(trade.id, 'accept');
              if (response.success) {
                Alert.alert('Successo', 'Offerta accettata con successo!');
                fetchTrades(false);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile accettare l\'offerta');
              }
            } catch (err) {
              console.error('Error accepting trade:', err);
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  }, [fetchTrades]);

  const handleRejectTrade = useCallback(async (trade: Trade) => {
    Alert.alert(
      'Conferma Rifiuto',
      'Sei sicuro di voler rifiutare questa offerta di scambio?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rifiuta',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await tradesApi.respondToOffer(trade.id, 'reject');
              if (response.success) {
                Alert.alert('Successo', 'Offerta rifiutata');
                fetchTrades(false);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile rifiutare l\'offerta');
              }
            } catch (err) {
              console.error('Error rejecting trade:', err);
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  }, [fetchTrades]);

  const handleCreateTrade = useCallback(() => {
    navigation.navigate('CreateTrade');
  }, [navigation]);

  // =============================================================================
  // Computed Values
  // =============================================================================

  const currentList = activeTab === 'received' ? received : activeTab === 'sent' ? sent : history;
  const pendingReceivedCount = received.filter(t => t.status === 'PENDING').length;

  const counts: Record<TabType, number> = {
    received: pendingReceivedCount,
    sent: sent.filter(t => t.status === 'PENDING').length,
    history: 0,
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (!selectedLeague) {
    return (
      <View style={styles.container}>
        <NoLeagueState />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      {/* Trade List */}
      <FlatList
        data={currentList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TradeCard
            trade={item}
            type={activeTab === 'history' ? 'received' : activeTab}
            onPress={() => handleTradePress(item)}
            onAccept={activeTab === 'received' ? () => handleAcceptTrade(item) : undefined}
            onReject={activeTab === 'received' ? () => handleRejectTrade(item) : undefined}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          currentList.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={<EmptyState type={activeTab} />}
      />

      {/* FAB - Create Trade */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateTrade}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={COLORS.text} />
      </TouchableOpacity>

      {/* Processing Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContent}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.processingText}>Elaborazione...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary + '20',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabBadge: {
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Trade Card
  tradeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tradePartyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tradeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tradePartyName: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tradePartyNameBold: {
    fontWeight: '600',
    color: COLORS.text,
  },
  tradeDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Trade Content
  tradeContent: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
  },
  tradeSection: {
    marginBottom: 8,
  },
  tradeSectionLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  tradeItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  playerChip: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerChipText: {
    fontSize: 13,
    color: COLORS.text,
    maxWidth: 100,
  },
  budgetChip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  moreChip: {
    backgroundColor: COLORS.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  moreChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tradeArrow: {
    alignItems: 'center',
    paddingVertical: 4,
  },

  // Message
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // Expiration
  expirationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  expirationText: {
    fontSize: 12,
    color: COLORS.warning,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: COLORS.error + '15',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  acceptButton: {
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  // Processing Overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingContent: {
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
});

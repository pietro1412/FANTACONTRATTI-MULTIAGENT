// =============================================================================
// TradeDetailScreen - Trade offer details for FantaContratti Mobile App
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradesStackParamList } from '@/navigation/AppNavigator';

import { useLeague } from '@/store/LeagueContext';
import { useAuth } from '@/store/AuthContext';
import { tradesApi, Trade, RosterPlayer } from '@/services/api';

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardBorder: '#3d3d5c',
  primary: '#6366F1',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

const POSITION_COLORS: Record<string, string> = {
  P: '#F59E0B',
  D: '#10B981',
  C: '#3B82F6',
  A: '#EF4444',
};

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

type Props = NativeStackScreenProps<TradesStackParamList, 'TradeDetail'>;

// =============================================================================
// Helper Functions
// =============================================================================

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
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
    return `${days} giorni ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

// =============================================================================
// Sub-Components
// =============================================================================

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento dettagli...</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
      <Text style={styles.errorTitle}>Errore</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
        <Text style={styles.retryButtonText}>Riprova</Text>
      </TouchableOpacity>
    </View>
  );
}

interface PlayerCardProps {
  player: RosterPlayer;
}

function PlayerCard({ player }: PlayerCardProps): React.JSX.Element {
  const positionColor = POSITION_COLORS[player.player?.position] || COLORS.textMuted;

  return (
    <View style={styles.playerCard}>
      <View style={[styles.positionBadge, { backgroundColor: positionColor }]}>
        <Text style={styles.positionText}>{player.player?.position || '?'}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.player?.name || 'Sconosciuto'}</Text>
        <Text style={styles.playerTeam}>{player.player?.team || 'N/A'}</Text>
      </View>
      <View style={styles.playerStats}>
        {player.contract && (
          <View style={styles.contractInfo}>
            <Text style={styles.contractLabel}>Contratto</Text>
            <Text style={styles.contractValue}>
              {player.contract.salary}M / {player.contract.duration}a
            </Text>
          </View>
        )}
        <Text style={styles.quotation}>Q: {player.player?.quotation || 0}</Text>
      </View>
    </View>
  );
}

interface MemberInfoProps {
  label: string;
  name: string;
  isCurrentUser: boolean;
}

function MemberInfo({ label, name, isCurrentUser }: MemberInfoProps): React.JSX.Element {
  return (
    <View style={styles.memberInfo}>
      <Text style={styles.memberLabel}>{label}</Text>
      <View style={styles.memberRow}>
        <View style={[styles.memberAvatar, isCurrentUser && styles.memberAvatarCurrent]}>
          <Ionicons
            name="person"
            size={20}
            color={isCurrentUser ? COLORS.primary : COLORS.textSecondary}
          />
        </View>
        <View>
          <Text style={styles.memberName}>{name}</Text>
          {isCurrentUser && <Text style={styles.youLabel}>Tu</Text>}
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function TradeDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { tradeId } = route.params;
  const { selectedLeague, membership } = useLeague();
  const { user } = useAuth();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchTradeDetails = useCallback(async (showLoader: boolean = true) => {
    if (!selectedLeague) {
      setError('Nessuna lega selezionata');
      setIsLoading(false);
      return;
    }

    if (showLoader) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Fetch all trades and find the one with matching ID
      const response = await tradesApi.getTrades(selectedLeague.id);

      if (response.success && response.data) {
        const allTrades = [
          ...(response.data.received || []),
          ...(response.data.sent || []),
          ...(response.data.history || []),
        ];

        const foundTrade = allTrades.find((t) => t.id === tradeId);

        if (foundTrade) {
          setTrade(foundTrade);
        } else {
          setError('Offerta di scambio non trovata');
        }
      } else {
        setError(response.message || 'Errore nel caricamento');
      }
    } catch (err) {
      console.error('[TradeDetailScreen] Error:', err);
      setError('Si è verificato un errore');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLeague, tradeId]);

  useEffect(() => {
    fetchTradeDetails();
  }, [fetchTradeDetails]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTradeDetails(false);
  }, [fetchTradeDetails]);

  const handleAccept = useCallback(async () => {
    Alert.alert(
      'Conferma Accettazione',
      'Sei sicuro di voler accettare questa offerta? I giocatori e il budget verranno scambiati immediatamente.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Accetta',
          style: 'default',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await tradesApi.respondToOffer(tradeId, 'accept');
              if (response.success) {
                Alert.alert('Successo', 'Offerta accettata con successo!', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile accettare l\'offerta');
              }
            } catch (err) {
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  }, [tradeId, navigation]);

  const handleReject = useCallback(async () => {
    Alert.alert(
      'Conferma Rifiuto',
      'Sei sicuro di voler rifiutare questa offerta?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rifiuta',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await tradesApi.respondToOffer(tradeId, 'reject');
              if (response.success) {
                Alert.alert('Offerta Rifiutata', 'L\'offerta è stata rifiutata', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile rifiutare l\'offerta');
              }
            } catch (err) {
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  }, [tradeId, navigation]);

  const handleCancel = useCallback(async () => {
    Alert.alert(
      'Annulla Offerta',
      'Sei sicuro di voler annullare questa offerta?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Annulla Offerta',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await tradesApi.respondToOffer(tradeId, 'cancel');
              if (response.success) {
                Alert.alert('Offerta Annullata', 'L\'offerta è stata annullata', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile annullare l\'offerta');
              }
            } catch (err) {
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  }, [tradeId, navigation]);

  // =============================================================================
  // Computed Values
  // =============================================================================

  const isReceiver = trade?.toMember?.userId === user?.id;
  const isSender = trade?.fromMember?.userId === user?.id;
  const canRespond = trade?.status === 'PENDING' && isReceiver;
  const canCancel = trade?.status === 'PENDING' && isSender;
  const statusConfig = trade ? STATUS_CONFIG[trade.status] || STATUS_CONFIG.PENDING : STATUS_CONFIG.PENDING;

  // =============================================================================
  // Render
  // =============================================================================

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  if (error || !trade) {
    return (
      <View style={styles.container}>
        <ErrorState message={error || 'Offerta non trovata'} onRetry={() => fetchTradeDetails()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Status Header */}
      <View style={[styles.statusHeader, { backgroundColor: statusConfig.color + '15' }]}>
        <View style={[styles.statusIconContainer, { backgroundColor: statusConfig.color + '30' }]}>
          <Ionicons name={statusConfig.icon} size={28} color={statusConfig.color} />
        </View>
        <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
        {trade.status === 'PENDING' && trade.expiresAt && (
          <View style={styles.expirationBadge}>
            <Ionicons name="alarm-outline" size={16} color={COLORS.warning} />
            <Text style={styles.expirationText}>
              Scade tra: {getTimeRemaining(trade.expiresAt)}
            </Text>
          </View>
        )}
      </View>

      {/* Parties Section */}
      <View style={styles.section}>
        <View style={styles.partiesRow}>
          <MemberInfo
            label="Da"
            name={trade.fromMember?.teamName || trade.fromMember?.username || 'Sconosciuto'}
            isCurrentUser={isSender}
          />
          <View style={styles.arrowContainer}>
            <Ionicons name="arrow-forward" size={24} color={COLORS.primary} />
          </View>
          <MemberInfo
            label="A"
            name={trade.toMember?.teamName || trade.toMember?.username || 'Sconosciuto'}
            isCurrentUser={isReceiver}
          />
        </View>
      </View>

      {/* Offered Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="arrow-up-circle-outline" size={22} color={COLORS.error} />
          <Text style={styles.sectionTitle}>
            {isSender ? 'Giocatori che Offri' : 'Giocatori Offerti'}
          </Text>
        </View>
        <View style={styles.card}>
          {trade.offeredPlayers && trade.offeredPlayers.length > 0 ? (
            trade.offeredPlayers.map((player, index) => (
              <React.Fragment key={player.id || index}>
                {index > 0 && <View style={styles.divider} />}
                <PlayerCard player={player} />
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.emptyText}>Nessun giocatore offerto</Text>
          )}

          {trade.offeredBudget > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.budgetRow}>
                <View style={styles.budgetIcon}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.success} />
                </View>
                <Text style={styles.budgetLabel}>Budget Offerto</Text>
                <Text style={[styles.budgetValue, { color: COLORS.success }]}>
                  +{formatBudget(trade.offeredBudget)}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Requested Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="arrow-down-circle-outline" size={22} color={COLORS.success} />
          <Text style={styles.sectionTitle}>
            {isSender ? 'Giocatori che Richiedi' : 'Giocatori Richiesti'}
          </Text>
        </View>
        <View style={styles.card}>
          {trade.requestedPlayers && trade.requestedPlayers.length > 0 ? (
            trade.requestedPlayers.map((player, index) => (
              <React.Fragment key={player.id || index}>
                {index > 0 && <View style={styles.divider} />}
                <PlayerCard player={player} />
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.emptyText}>Nessun giocatore richiesto</Text>
          )}

          {trade.requestedBudget > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.budgetRow}>
                <View style={styles.budgetIcon}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.warning} />
                </View>
                <Text style={styles.budgetLabel}>Budget Richiesto</Text>
                <Text style={[styles.budgetValue, { color: COLORS.warning }]}>
                  +{formatBudget(trade.requestedBudget)}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Message Section */}
      {trade.message && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Messaggio</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.messageText}>{trade.message}</Text>
          </View>
        </View>
      )}

      {/* Details Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Dettagli</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Creata il</Text>
            <Text style={styles.detailValue}>{formatDate(trade.createdAt)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Scadenza</Text>
            <Text style={styles.detailValue}>{formatDate(trade.expiresAt)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID Offerta</Text>
            <Text style={[styles.detailValue, styles.tradeId]}>{trade.id.slice(0, 8)}...</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      {(canRespond || canCancel) && (
        <View style={styles.actionSection}>
          {canRespond && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
                disabled={isProcessing}
              >
                <Ionicons name="close" size={22} color={COLORS.error} />
                <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Rifiuta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAccept}
                disabled={isProcessing}
              >
                <Ionicons name="checkmark" size={22} color={COLORS.success} />
                <Text style={[styles.actionButtonText, { color: COLORS.success }]}>Accetta</Text>
              </TouchableOpacity>
            </View>
          )}

          {canCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isProcessing}
            >
              <Ionicons name="close-circle-outline" size={20} color={COLORS.textSecondary} />
              <Text style={styles.cancelButtonText}>Annulla Offerta</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.processingText}>Elaborazione...</Text>
        </View>
      )}
    </ScrollView>
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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },

  // Center States
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Status Header
  statusHeader: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  statusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  expirationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  expirationText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.warning,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // Parties
  partiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  memberInfo: {
    flex: 1,
  },
  memberLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarCurrent: {
    backgroundColor: COLORS.primary + '30',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  youLabel: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  arrowContainer: {
    paddingHorizontal: 12,
  },

  // Player Card
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  playerTeam: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  playerStats: {
    alignItems: 'flex-end',
  },
  contractInfo: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  contractLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  contractValue: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  quotation: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Budget Row
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  budgetIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  budgetLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Message
  messageText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  tradeId: {
    fontFamily: 'monospace',
    color: COLORS.textMuted,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 4,
  },

  // Empty Text
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Action Section
  actionSection: {
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
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
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },

  // Processing
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  processingText: {
    fontSize: 14,
    color: COLORS.text,
  },
});

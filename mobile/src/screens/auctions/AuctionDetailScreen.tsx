// =============================================================================
// AuctionDetailScreen - Auction details for FantaContratti Mobile App
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionsStackParamList } from '@/navigation/AppNavigator';

import { useLeague } from '@/store/LeagueContext';
import { historyApi, Auction } from '@/services/api';

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

const POSITION_LABELS: Record<string, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ACTIVE: { color: COLORS.success, label: 'In corso', icon: 'flash-outline' },
  CLOSED: { color: COLORS.textMuted, label: 'Conclusa', icon: 'checkmark-circle-outline' },
  PENDING_ACKNOWLEDGMENT: { color: COLORS.warning, label: 'In attesa conferma', icon: 'hourglass-outline' },
};

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<AuctionsStackParamList, 'AuctionDetail'>;

// =============================================================================
// Helper Functions
// =============================================================================

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
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

// =============================================================================
// Sub-Components
// =============================================================================

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento dettagli asta...</Text>
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

// =============================================================================
// Main Component
// =============================================================================

export default function AuctionDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { auctionId } = route.params;
  const { selectedLeague } = useLeague();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchAuctionDetails = useCallback(async (showLoader: boolean = true) => {
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
      // Try to find the auction in sessions history
      const sessionsRes = await historyApi.getSessions(selectedLeague.id);

      if (sessionsRes.success && sessionsRes.data) {
        // Search through sessions for the auction
        let foundAuction: Auction | null = null;

        for (const sessionOverview of sessionsRes.data) {
          const sessionRes = await historyApi.getSessionDetails(selectedLeague.id, sessionOverview.id);

          if (sessionRes.success && sessionRes.data) {
            const found = sessionRes.data.auctions?.find((a: Auction) => a.id === auctionId);
            if (found) {
              foundAuction = found;
              break;
            }
          }
        }

        if (foundAuction) {
          setAuction(foundAuction);
        } else {
          setError('Asta non trovata');
        }
      } else {
        setError(sessionsRes.message || 'Errore nel caricamento');
      }
    } catch (err) {
      console.error('[AuctionDetailScreen] Error:', err);
      setError('Si è verificato un errore');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLeague, auctionId]);

  useEffect(() => {
    fetchAuctionDetails();
  }, [fetchAuctionDetails]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAuctionDetails(false);
  }, [fetchAuctionDetails]);

  // =============================================================================
  // Computed Values
  // =============================================================================

  const player = auction?.player;
  const positionColor = player ? POSITION_COLORS[player.position] || COLORS.textMuted : COLORS.textMuted;
  const statusConfig = auction ? STATUS_CONFIG[auction.status] || STATUS_CONFIG.CLOSED : STATUS_CONFIG.CLOSED;

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

  if (error || !auction) {
    return (
      <View style={styles.container}>
        <ErrorState message={error || 'Asta non trovata'} onRetry={() => fetchAuctionDetails()} />
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
          Asta {statusConfig.label}
        </Text>
      </View>

      {/* Player Card */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Giocatore</Text>
        </View>
        <View style={styles.playerCard}>
          <View style={[styles.playerAvatar, { backgroundColor: positionColor + '20' }]}>
            <Text style={[styles.playerAvatarText, { color: positionColor }]}>
              {player?.position || '?'}
            </Text>
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player?.name || 'Sconosciuto'}</Text>
            <Text style={styles.playerTeam}>{player?.team || 'N/A'}</Text>
            <View style={[styles.positionBadge, { backgroundColor: positionColor }]}>
              <Text style={styles.positionBadgeText}>
                {POSITION_LABELS[player?.position || ''] || 'N/D'}
              </Text>
            </View>
          </View>
        </View>

        {/* Player Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="trending-up-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.statLabel}>Quotazione</Text>
            <Text style={styles.statValue}>{player?.quotation || 0}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="cash-outline" size={18} color={COLORS.success} />
            <Text style={styles.statLabel}>Quotazione Iniziale</Text>
            <Text style={styles.statValue}>{player?.initialQuotation || player?.quotation || 0}</Text>
          </View>
        </View>
      </View>

      {/* Auction Result */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trophy-outline" size={20} color={COLORS.warning} />
          <Text style={styles.sectionTitle}>Risultato Asta</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.resultRow}>
            <View style={styles.resultLabel}>
              <Ionicons name="hammer-outline" size={18} color={COLORS.primary} />
              <Text style={styles.resultLabelText}>Prezzo Finale</Text>
            </View>
            <Text style={styles.resultValue}>{formatBudget(auction.currentBid)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.resultRow}>
            <View style={styles.resultLabel}>
              <Ionicons name="person-circle-outline" size={18} color={COLORS.success} />
              <Text style={styles.resultLabelText}>Vincitore</Text>
            </View>
            <Text style={[styles.resultValue, { color: COLORS.success }]}>
              {auction.currentBidder?.teamName || auction.currentBidder?.username || 'Nessuno'}
            </Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Timeline</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: COLORS.success }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Inizio Asta</Text>
              <Text style={styles.timelineValue}>{formatDate(auction.startedAt)}</Text>
            </View>
          </View>

          {auction.closedAt && (
            <>
              <View style={styles.timelineLine} />
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: COLORS.textMuted }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Fine Asta</Text>
                  <Text style={styles.timelineValue}>{formatDate(auction.closedAt)}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Informazioni</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID Asta</Text>
            <Text style={styles.infoValue}>{auctionId.slice(0, 8)}...</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID Giocatore</Text>
            <Text style={styles.infoValue}>{auction.playerId?.slice(0, 8) || 'N/A'}...</Text>
          </View>
        </View>
      </View>
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

  // Player Card
  playerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  playerAvatarText: {
    fontSize: 24,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  playerTeam: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  positionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  positionBadgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },

  // Stats Row
  statsRow: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 12,
  },

  // Result Row
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultLabelText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  timelineValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 2,
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.cardBorder,
    marginLeft: 5,
    marginVertical: 4,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 4,
  },
});

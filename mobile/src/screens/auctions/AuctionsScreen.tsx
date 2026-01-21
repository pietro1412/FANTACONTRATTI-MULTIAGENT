// =============================================================================
// AuctionsScreen - Auction management for FantaContratti Mobile App
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLeague } from '@/store/LeagueContext';
import { auctionsApi, AuctionSession, Auction } from '@/services/api';

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
  // Position colors
  positionP: '#F59E0B',
  positionD: '#3B82F6',
  positionC: '#10B981',
  positionA: '#EF4444',
};

const POSITION_COLORS: Record<string, string> = {
  P: COLORS.positionP,
  D: COLORS.positionD,
  C: COLORS.positionC,
  A: COLORS.positionA,
};

const POSITION_LABELS: Record<string, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
};

const PHASE_LABELS: Record<string, string> = {
  ASTA_LIBERA: 'Asta Libera',
  RUBATA: 'Asta Rubata',
  ASTA_SVINCOLATI: 'Asta Svincolati',
  WAITING: 'In Attesa',
};

// =============================================================================
// Helper Functions
// =============================================================================

const formatBudget = (amount: number | undefined | null): string => {
  const safeAmount = amount ?? 0;
  if (safeAmount >= 1000000) {
    return `${(safeAmount / 1000000).toFixed(1)}M`;
  }
  return safeAmount.toLocaleString('it-IT');
};

const getPositionColor = (position: string): string => {
  return POSITION_COLORS[position] || COLORS.textSecondary;
};

// =============================================================================
// Sub-Components
// =============================================================================

function NoLeagueState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="trophy-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.centerTitle}>Nessuna lega selezionata</Text>
      <Text style={styles.centerSubtitle}>
        Seleziona una lega dalla schermata Home per partecipare alle aste
      </Text>
    </View>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento aste...</Text>
    </View>
  );
}

function NoActiveAuctionState({ phase, onRefresh }: { phase?: string; onRefresh: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="time-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.centerTitle}>Nessuna asta attiva</Text>
      <Text style={styles.centerSubtitle}>
        {phase ? `Fase attuale: ${PHASE_LABELS[phase] || phase}` : 'Al momento non ci sono aste in corso'}
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.7}>
        <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
        <Text style={styles.refreshButtonText}>Aggiorna</Text>
      </TouchableOpacity>
    </View>
  );
}

interface SessionInfoCardProps {
  session: AuctionSession;
}

function SessionInfoCard({ session }: SessionInfoCardProps): React.JSX.Element {
  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionBadge}>
          <Ionicons name="flash" size={16} color={COLORS.success} />
          <Text style={styles.sessionBadgeText}>Sessione Attiva</Text>
        </View>
        <Text style={styles.sessionPhase}>
          {PHASE_LABELS[session.phase] || session.phase}
        </Text>
      </View>
      <View style={styles.sessionInfo}>
        <View style={styles.sessionInfoItem}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.sessionInfoText}>
            {session.isFirstMarket ? 'Primo Mercato' : 'Sessione Successiva'}
          </Text>
        </View>
        <View style={styles.sessionInfoItem}>
          <Ionicons name="timer-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.sessionInfoText}>
            Timer: {session.timerSeconds}s
          </Text>
        </View>
      </View>
    </View>
  );
}

interface CurrentAuctionCardProps {
  auction: Auction;
  onBid: (amount: number) => void;
  isProcessing: boolean;
  userBudget: number;
}

function CurrentAuctionCard({ auction, onBid, isProcessing, userBudget }: CurrentAuctionCardProps): React.JSX.Element {
  const [bidAmount, setBidAmount] = useState<string>('');
  const player = auction.player;
  const positionColor = getPositionColor(player?.position || 'C');
  const minBid = auction.currentBid + 1;

  const handleQuickBid = (increment: number) => {
    const newBid = auction.currentBid + increment;
    onBid(newBid);
  };

  const handleCustomBid = () => {
    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount < minBid) {
      Alert.alert('Offerta non valida', `L'offerta minima è ${formatBudget(minBid)}`);
      return;
    }
    if (amount > userBudget) {
      Alert.alert('Budget insufficiente', 'Non hai abbastanza budget per questa offerta');
      return;
    }
    onBid(amount);
    setBidAmount('');
  };

  return (
    <View style={styles.auctionCard}>
      {/* Player Header */}
      <View style={styles.playerHeader}>
        <View style={[styles.playerAvatar, { backgroundColor: positionColor + '20' }]}>
          <Text style={[styles.playerAvatarText, { color: positionColor }]}>
            {player?.position || '?'}
          </Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{player?.name || 'Giocatore'}</Text>
          <Text style={styles.playerTeam}>{player?.team || 'Squadra'}</Text>
        </View>
        <View style={[styles.positionBadge, { backgroundColor: positionColor }]}>
          <Text style={styles.positionBadgeText}>
            {POSITION_LABELS[player?.position || 'C'] || 'N/D'}
          </Text>
        </View>
      </View>

      {/* Player Stats */}
      <View style={styles.playerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Quotazione</Text>
          <Text style={styles.statValue}>{player?.quotation || 0}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Offerta Attuale</Text>
          <Text style={[styles.statValue, styles.currentBid]}>
            {formatBudget(auction.currentBid)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Miglior Offerente</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {auction.currentBidder?.teamName || auction.currentBidder?.username || 'Nessuno'}
          </Text>
        </View>
      </View>

      {/* Auction Status */}
      <View style={styles.auctionStatus}>
        {auction.status === 'ACTIVE' && (
          <View style={[styles.statusIndicator, { backgroundColor: COLORS.success + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
            <Text style={[styles.statusText, { color: COLORS.success }]}>Asta in corso</Text>
          </View>
        )}
        {auction.status === 'PENDING_ACKNOWLEDGMENT' && (
          <View style={[styles.statusIndicator, { backgroundColor: COLORS.warning + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: COLORS.warning }]} />
            <Text style={[styles.statusText, { color: COLORS.warning }]}>In attesa conferma</Text>
          </View>
        )}
      </View>

      {/* Bid Controls */}
      {auction.status === 'ACTIVE' && (
        <View style={styles.bidControls}>
          <Text style={styles.bidControlsTitle}>Fai un'offerta</Text>

          {/* Quick Bid Buttons */}
          <View style={styles.quickBidRow}>
            <TouchableOpacity
              style={styles.quickBidButton}
              onPress={() => handleQuickBid(1)}
              disabled={isProcessing || auction.currentBid + 1 > userBudget}
              activeOpacity={0.7}
            >
              <Text style={styles.quickBidText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBidButton}
              onPress={() => handleQuickBid(5)}
              disabled={isProcessing || auction.currentBid + 5 > userBudget}
              activeOpacity={0.7}
            >
              <Text style={styles.quickBidText}>+5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBidButton}
              onPress={() => handleQuickBid(10)}
              disabled={isProcessing || auction.currentBid + 10 > userBudget}
              activeOpacity={0.7}
            >
              <Text style={styles.quickBidText}>+10</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBidButton}
              onPress={() => handleQuickBid(50)}
              disabled={isProcessing || auction.currentBid + 50 > userBudget}
              activeOpacity={0.7}
            >
              <Text style={styles.quickBidText}>+50</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Bid */}
          <View style={styles.customBidRow}>
            <TextInput
              style={styles.bidInput}
              value={bidAmount}
              onChangeText={setBidAmount}
              placeholder={`Min: ${formatBudget(minBid)}`}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              editable={!isProcessing}
            />
            <TouchableOpacity
              style={[styles.bidButton, isProcessing && styles.bidButtonDisabled]}
              onPress={handleCustomBid}
              disabled={isProcessing || !bidAmount}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="hammer-outline" size={18} color={COLORS.text} />
                  <Text style={styles.bidButtonText}>Offri</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Budget Info */}
          <View style={styles.budgetInfo}>
            <Ionicons name="wallet-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.budgetText}>
              Il tuo budget: <Text style={styles.budgetValue}>{formatBudget(userBudget)}</Text>
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function AuctionsScreen(): React.JSX.Element {
  const { selectedLeague, selectedMember } = useLeague();

  const [session, setSession] = useState<AuctionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchAuction = useCallback(async (showLoader: boolean = true) => {
    if (!selectedLeague) {
      setIsLoading(false);
      return;
    }

    if (showLoader) {
      setIsLoading(true);
    }

    try {
      console.log('[AuctionsScreen] Fetching auction for league:', selectedLeague.id);
      const response = await auctionsApi.getCurrentAuction(selectedLeague.id);
      console.log('[AuctionsScreen] Response:', JSON.stringify(response, null, 2));

      if (response.success) {
        setSession(response.data || null);
      }
    } catch (err) {
      console.error('[AuctionsScreen] Error fetching auction:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLeague]);

  useEffect(() => {
    fetchAuction();

    // Poll for updates every 5 seconds when there's an active auction
    const interval = setInterval(() => {
      if (session?.status === 'ACTIVE' && session.currentAuction?.status === 'ACTIVE') {
        fetchAuction(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchAuction, session?.status, session?.currentAuction?.status]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAuction(false);
  }, [fetchAuction]);

  const handleBid = useCallback(async (amount: number) => {
    if (!session?.currentAuction) return;

    setIsProcessing(true);
    try {
      console.log('[AuctionsScreen] Placing bid:', amount);
      const response = await auctionsApi.placeBid(session.currentAuction.id, amount);

      if (response.success) {
        Alert.alert('Successo', `Offerta di ${formatBudget(amount)} piazzata!`);
        fetchAuction(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile piazzare l\'offerta');
      }
    } catch (err) {
      console.error('[AuctionsScreen] Error placing bid:', err);
      Alert.alert('Errore', 'Si è verificato un errore');
    } finally {
      setIsProcessing(false);
    }
  }, [session, fetchAuction]);

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

  if (!session) {
    return (
      <View style={styles.container}>
        <NoActiveAuctionState
          phase={selectedLeague.currentPhase}
          onRefresh={handleRefresh}
        />
      </View>
    );
  }

  const userBudget = selectedMember?.budget || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Session Info */}
      <SessionInfoCard session={session} />

      {/* Current Auction */}
      {session.currentAuction ? (
        <CurrentAuctionCard
          auction={session.currentAuction}
          onBid={handleBid}
          isProcessing={isProcessing}
          userBudget={userBudget}
        />
      ) : (
        <View style={styles.waitingCard}>
          <Ionicons name="hourglass-outline" size={48} color={COLORS.warning} />
          <Text style={styles.waitingTitle}>In attesa della prossima asta</Text>
          <Text style={styles.waitingSubtitle}>
            La sessione è attiva ma non ci sono aste in corso al momento
          </Text>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.info} />
        <Text style={styles.infoText}>
          Le offerte vengono aggiornate automaticamente. Tira verso il basso per aggiornare manualmente.
        </Text>
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

  // Center Container
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    textAlign: 'center',
  },
  centerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  refreshButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // Session Card
  sessionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  sessionBadgeText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionPhase: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  sessionInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  sessionInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionInfoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  // Auction Card
  auctionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerAvatarText: {
    fontSize: 20,
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
  },
  positionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  positionBadgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },

  // Player Stats
  playerStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  currentBid: {
    color: COLORS.primary,
    fontSize: 16,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 8,
  },

  // Auction Status
  auctionStatus: {
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Bid Controls
  bidControls: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 16,
  },
  bidControlsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  quickBidRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickBidButton: {
    flex: 1,
    backgroundColor: COLORS.primary + '20',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  quickBidText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  customBidRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  bidInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bidButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bidButtonDisabled: {
    opacity: 0.6,
  },
  bidButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  budgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  budgetValue: {
    color: COLORS.success,
    fontWeight: '600',
  },

  // Waiting Card
  waitingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  waitingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  waitingSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.info + '15',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: COLORS.info,
    fontSize: 13,
    lineHeight: 18,
  },
});

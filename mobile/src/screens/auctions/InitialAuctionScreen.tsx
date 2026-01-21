// =============================================================================
// InitialAuctionScreen - Initial/First Market Auction for FantaContratti Mobile
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
import { auctionsApi, AuctionSession } from '@/services/api';

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

const PHASE_INFO: Record<string, { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ASTA_LIBERA: {
    title: 'Asta Libera',
    description: 'Fase in cui i manager possono fare offerte per acquistare giocatori svincolati.',
    icon: 'hammer-outline',
  },
  RUBATA: {
    title: 'Asta Rubata',
    description: 'Fase in cui i manager possono tentare di rubare giocatori dagli altri roster.',
    icon: 'flash-outline',
  },
  WAITING: {
    title: 'In Attesa',
    description: 'L\'asta sta per iniziare. Preparati a fare le tue offerte!',
    icon: 'hourglass-outline',
  },
};

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<AuctionsStackParamList, 'InitialAuction'>;

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

// =============================================================================
// Sub-Components
// =============================================================================

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento sessione...</Text>
    </View>
  );
}

function NoSessionState({ onRefresh }: { onRefresh: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <View style={styles.noSessionIcon}>
        <Ionicons name="calendar-outline" size={64} color={COLORS.textMuted} />
      </View>
      <Text style={styles.noSessionTitle}>Nessuna Asta Iniziale</Text>
      <Text style={styles.noSessionSubtitle}>
        Non ci sono sessioni di asta iniziale attive per questa lega.
        L'asta iniziale si svolge all'inizio della stagione per costruire le rose.
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
        <Text style={styles.refreshButtonText}>Aggiorna</Text>
      </TouchableOpacity>
    </View>
  );
}

interface SessionCardProps {
  session: AuctionSession;
}

function SessionCard({ session }: SessionCardProps): React.JSX.Element {
  const phaseInfo = PHASE_INFO[session.phase] || PHASE_INFO.WAITING;
  const isActive = session.status === 'ACTIVE';

  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? COLORS.success + '20' : COLORS.textMuted + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? COLORS.success : COLORS.textMuted }]} />
          <Text style={[styles.statusText, { color: isActive ? COLORS.success : COLORS.textMuted }]}>
            {isActive ? 'Attiva' : 'Chiusa'}
          </Text>
        </View>
        <Text style={styles.sessionPhase}>{phaseInfo.title}</Text>
      </View>

      <View style={styles.sessionContent}>
        <View style={[styles.phaseIconContainer, { backgroundColor: COLORS.primary + '20' }]}>
          <Ionicons name={phaseInfo.icon} size={32} color={COLORS.primary} />
        </View>
        <Text style={styles.phaseDescription}>{phaseInfo.description}</Text>
      </View>

      <View style={styles.sessionInfo}>
        <View style={styles.infoItem}>
          <Ionicons name="timer-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.infoLabel}>Timer</Text>
          <Text style={styles.infoValue}>{session.timerSeconds}s</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.infoLabel}>Creata</Text>
          <Text style={styles.infoValue}>{formatDate(session.createdAt)}</Text>
        </View>
      </View>

      {session.currentAuction && (
        <View style={styles.currentAuctionBanner}>
          <Ionicons name="flash" size={20} color={COLORS.warning} />
          <Text style={styles.currentAuctionText}>
            Asta in corso per: {session.currentAuction.player?.name || 'Giocatore'}
          </Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function InitialAuctionScreen({ route, navigation }: Props): React.JSX.Element {
  const { leagueId } = route.params;
  const { selectedLeague, membership } = useLeague();

  const [session, setSession] = useState<AuctionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchSession = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const response = await auctionsApi.getCurrentAuction(leagueId || selectedLeague?.id || '');

      if (response.success && response.data && response.data.isFirstMarket) {
        setSession(response.data);
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('[InitialAuctionScreen] Error:', err);
      setSession(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [leagueId, selectedLeague]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSession(false);
  }, [fetchSession]);

  const handleGoToAuctions = useCallback(() => {
    navigation.navigate('FirstMarketRoom', { leagueId: leagueId || selectedLeague?.id || '' });
  }, [navigation, leagueId, selectedLeague]);

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

  if (!session) {
    return (
      <View style={styles.container}>
        <NoSessionState onRefresh={handleRefresh} />
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="flag" size={32} color={COLORS.primary} />
        </View>
        <Text style={styles.headerTitle}>Asta Iniziale</Text>
        <Text style={styles.headerSubtitle}>
          Prima sessione di mercato per la costruzione delle rose
        </Text>
      </View>

      {/* Session Card */}
      <SessionCard session={session} />

      {/* Info Cards */}
      <View style={styles.infoSection}>
        <View style={styles.infoCard}>
          <Ionicons name="wallet-outline" size={24} color={COLORS.success} />
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardLabel}>Il Tuo Budget</Text>
            <Text style={styles.infoCardValue}>{membership?.budget || 0}M</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="people-outline" size={24} color={COLORS.info} />
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardLabel}>Partecipanti</Text>
            <Text style={styles.infoCardValue}>{selectedLeague?.currentParticipants || 0}</Text>
          </View>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>Come Funziona</Text>
        <View style={styles.instructionItem}>
          <View style={styles.instructionNumber}>
            <Text style={styles.instructionNumberText}>1</Text>
          </View>
          <Text style={styles.instructionText}>
            L'admin avvia l'asta per un giocatore impostando la base d'asta
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <View style={styles.instructionNumber}>
            <Text style={styles.instructionNumberText}>2</Text>
          </View>
          <Text style={styles.instructionText}>
            I manager fanno le loro offerte entro il timer
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <View style={styles.instructionNumber}>
            <Text style={styles.instructionNumberText}>3</Text>
          </View>
          <Text style={styles.instructionText}>
            Il miglior offerente vince il giocatore alla scadenza del timer
          </Text>
        </View>
      </View>

      {/* Action Button */}
      {session.status === 'ACTIVE' && (
        <TouchableOpacity style={styles.actionButton} onPress={handleGoToAuctions}>
          <Ionicons name="hammer-outline" size={22} color={COLORS.text} />
          <Text style={styles.actionButtonText}>Vai alle Aste</Text>
        </TouchableOpacity>
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
  noSessionIcon: {
    marginBottom: 16,
  },
  noSessionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  noSessionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
    gap: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Session Card
  sessionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sessionPhase: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sessionContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  phaseIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  phaseDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sessionInfo: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 12,
  },
  currentAuctionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '15',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 10,
  },
  currentAuctionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.warning,
  },

  // Info Section
  infoSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 8,
  },
  infoCardContent: {
    alignItems: 'center',
  },
  infoCardLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  infoCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Instructions
  instructionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Action Button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});

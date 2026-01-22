// =============================================================================
// RepairAuctionScreen - Repair/Svincolati Auction for FantaContratti Mobile
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

const PHASE_INFO: Record<string, { title: string; description: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  ASTA_SVINCOLATI: {
    title: 'Asta Svincolati',
    description: 'Fase di mercato per acquisire giocatori svincolati e completare la rosa.',
    icon: 'person-add-outline',
    color: COLORS.success,
  },
  RUBATA: {
    title: 'Asta Rubata',
    description: 'Fase in cui puoi tentare di acquisire giocatori dagli altri roster pagando la clausola.',
    icon: 'flash-outline',
    color: COLORS.warning,
  },
  WAITING: {
    title: 'In Attesa',
    description: 'L\'asta di riparazione sta per iniziare. Preparati!',
    icon: 'hourglass-outline',
    color: COLORS.info,
  },
};

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<AuctionsStackParamList, 'RepairAuction'>;

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
        <Ionicons name="construct-outline" size={64} color={COLORS.textMuted} />
      </View>
      <Text style={styles.noSessionTitle}>Nessuna Asta di Riparazione</Text>
      <Text style={styles.noSessionSubtitle}>
        Non ci sono sessioni di riparazione attive.
        Le aste di riparazione permettono di completare la rosa con giocatori svincolati
        o acquisire giocatori da altri manager tramite la clausola.
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
        <Text style={[styles.sessionPhase, { color: phaseInfo.color }]}>{phaseInfo.title}</Text>
      </View>

      <View style={styles.sessionContent}>
        <View style={[styles.phaseIconContainer, { backgroundColor: phaseInfo.color + '20' }]}>
          <Ionicons name={phaseInfo.icon} size={32} color={phaseInfo.color} />
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

export default function RepairAuctionScreen({ route, navigation }: Props): React.JSX.Element {
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

      // Check for repair/svincolati session (not first market)
      if (response.success && response.data && !response.data.isFirstMarket) {
        setSession(response.data);
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('[RepairAuctionScreen] Error:', err);
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
    navigation.navigate('AuctionsList');
  }, [navigation]);

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
          <Ionicons name="construct" size={32} color={COLORS.warning} />
        </View>
        <Text style={styles.headerTitle}>Asta di Riparazione</Text>
        <Text style={styles.headerSubtitle}>
          Sessione di mercato per completare e migliorare la tua rosa
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

      {/* Phase Cards */}
      <View style={styles.phasesSection}>
        <Text style={styles.phasesSectionTitle}>Fasi della Riparazione</Text>

        <View style={styles.phaseCard}>
          <View style={[styles.phaseCardIcon, { backgroundColor: COLORS.success + '20' }]}>
            <Ionicons name="person-add-outline" size={24} color={COLORS.success} />
          </View>
          <View style={styles.phaseCardContent}>
            <Text style={styles.phaseCardTitle}>Asta Svincolati</Text>
            <Text style={styles.phaseCardDescription}>
              Acquista giocatori liberi per completare la rosa e sostituire infortunati
            </Text>
          </View>
        </View>

        <View style={styles.phaseCard}>
          <View style={[styles.phaseCardIcon, { backgroundColor: COLORS.warning + '20' }]}>
            <Ionicons name="flash-outline" size={24} color={COLORS.warning} />
          </View>
          <View style={styles.phaseCardContent}>
            <Text style={styles.phaseCardTitle}>Asta Rubata</Text>
            <Text style={styles.phaseCardDescription}>
              Tenta di acquisire giocatori degli altri pagando la clausola rescissoria
            </Text>
          </View>
        </View>
      </View>

      {/* Tips Card */}
      <View style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <Ionicons name="bulb-outline" size={20} color={COLORS.warning} />
          <Text style={styles.tipsTitle}>Consigli</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Valuta bene il budget disponibile prima di ogni offerta
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Nella rubata, considera la clausola del giocatore che vuoi acquisire
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Controlla i ruoli mancanti nella tua rosa prima di acquistare
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
    backgroundColor: COLORS.warning + '20',
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

  // Phases Section
  phasesSection: {
    marginBottom: 16,
  },
  phasesSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  phaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  phaseCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  phaseCardContent: {
    flex: 1,
  },
  phaseCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  phaseCardDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  // Tips Card
  tipsCard: {
    backgroundColor: COLORS.warning + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 14,
    color: COLORS.warning,
    marginRight: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
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

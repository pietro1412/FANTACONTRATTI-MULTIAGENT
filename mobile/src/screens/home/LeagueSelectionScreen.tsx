// =============================================================================
// LeagueSelectionScreen - League Selection for FantaContratti Mobile App
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useLeague } from '@/store/LeagueContext';
import { leaguesApi, League } from '@/services/api';
import { HomeStackParamList } from '@/navigation/AppNavigator';

// =============================================================================
// Theme Colors
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardHighlight: '#2d2d4a',
  cardSelected: '#3d3d5a',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  border: '#374151',
  borderSelected: '#6366F1',
};

// =============================================================================
// Types
// =============================================================================

type LeagueSelectionNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'LeagueSelection'
>;

interface LeagueCardProps {
  league: League;
  isSelected: boolean;
  onPress: () => void;
}

// =============================================================================
// Components
// =============================================================================

function LeagueCard({ league, isSelected, onPress }: LeagueCardProps): React.JSX.Element {
  // Get status color and text
  const getStatusInfo = (status: string): { color: string; text: string } => {
    switch (status) {
      case 'ACTIVE':
        return { color: COLORS.success, text: 'Attiva' };
      case 'DRAFT':
        return { color: COLORS.warning, text: 'Bozza' };
      case 'ARCHIVED':
        return { color: COLORS.textMuted, text: 'Archiviata' };
      default:
        return { color: COLORS.textSecondary, text: status };
    }
  };

  // Get phase display text
  const getPhaseText = (phase?: string | null): string => {
    if (!phase) return 'Nessuna fase';
    const phaseMap: Record<string, string> = {
      ASTA_LIBERA: 'Asta Libera',
      OFFERTE_PRE_RINNOVO: 'Offerte Pre-Rinnovo',
      PREMI: 'Assegnazione Premi',
      CONTRATTI: 'Gestione Contratti',
      CALCOLO_INDENNIZZI: 'Calcolo Indennizzi',
      RUBATA: 'Asta Rubata',
      ASTA_SVINCOLATI: 'Asta Svincolati',
      OFFERTE_POST_ASTA_SVINCOLATI: 'Offerte Post Asta',
    };
    return phaseMap[phase] || phase;
  };

  const statusInfo = getStatusInfo(league.status);

  return (
    <TouchableOpacity
      style={[
        styles.leagueCard,
        isSelected && styles.leagueCardSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leagueCardContent}>
        {/* League Icon */}
        <View
          style={[
            styles.leagueIcon,
            { backgroundColor: isSelected ? COLORS.primary + '30' : COLORS.cardHighlight },
          ]}
        >
          <Ionicons
            name="trophy"
            size={28}
            color={isSelected ? COLORS.primary : COLORS.textSecondary}
          />
        </View>

        {/* League Info */}
        <View style={styles.leagueInfo}>
          <Text style={styles.leagueName} numberOfLines={1}>
            {league.name}
          </Text>

          {/* Status Badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.text}
              </Text>
            </View>
          </View>

          {/* Details Row */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.detailText}>
                {league.currentParticipants || 0}/{league.maxParticipants}
              </Text>
            </View>
            {league.currentPhase && (
              <View style={styles.detailItem}>
                <Ionicons name="flag-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.detailText} numberOfLines={1}>
                  {getPhaseText(league.currentPhase)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Selection Indicator */}
        <View style={styles.selectionIndicator}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={26} color={COLORS.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={22} color={COLORS.textMuted} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento leghe...</Text>
    </View>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="trophy-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>Nessuna Lega</Text>
      <Text style={styles.emptySubtitle}>
        Non sei ancora iscritto a nessuna lega. Crea o unisciti a una lega dalla versione web.
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
        <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
        <Text style={styles.refreshButtonText}>Riprova</Text>
      </TouchableOpacity>
    </View>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
      <Text style={styles.errorTitle}>Errore</Text>
      <Text style={styles.errorSubtitle}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
        <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
        <Text style={styles.retryButtonText}>Riprova</Text>
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function LeagueSelectionScreen(): React.JSX.Element {
  const navigation = useNavigation<LeagueSelectionNavigationProp>();
  const { selectedLeague, selectLeague, isLoading: contextLoading } = useLeague();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user's leagues from API
   */
  const fetchLeagues = useCallback(async () => {
    setError(null);
    try {
      const response = await leaguesApi.getMyLeagues();
      if (response.success && response.data) {
        setLeagues(response.data);
      } else {
        setError(response.message || 'Errore nel caricamento delle leghe');
      }
    } catch (err) {
      console.error('Error fetching leagues:', err);
      setError('Errore di connessione al server');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Handle pull to refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeagues();
  }, [fetchLeagues]);

  /**
   * Handle league selection
   */
  const handleSelectLeague = useCallback(
    async (league: League) => {
      await selectLeague(league);
      navigation.goBack();
    },
    [selectLeague, navigation]
  );

  // Fetch leagues on mount
  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  // Render loading state
  if (isLoading && !refreshing) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  // Render error state
  if (error && leagues.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={fetchLeagues} />
      </View>
    );
  }

  // Render empty state
  if (leagues.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState onRefresh={handleRefresh} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>Le Tue Leghe</Text>
        <Text style={styles.headerSubtitle}>
          Seleziona una lega per visualizzare la dashboard
        </Text>
      </View>

      {/* Leagues List */}
      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LeagueCard
            league={item}
            isSelected={selectedLeague?.id === item.id}
            onPress={() => handleSelectLeague(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {leagues.length} {leagues.length === 1 ? 'lega' : 'leghe'} disponibili
            </Text>
          </View>
        }
      />

      {/* Loading Overlay */}
      {contextLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayContent}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingOverlayText}>Selezione in corso...</Text>
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
  headerInfo: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  leagueCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  leagueCardSelected: {
    borderColor: COLORS.borderSelected,
    backgroundColor: COLORS.cardSelected,
  },
  leagueCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  leagueIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  selectionIndicator: {
    marginLeft: 8,
    padding: 4,
  },
  separator: {
    height: 12,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 24,
    gap: 8,
  },
  refreshButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 24,
    gap: 8,
  },
  retryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlayContent: {
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingOverlayText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
});

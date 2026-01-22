// =============================================================================
// HistoryScreen - Session history for FantaContratti Mobile App
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
import { Ionicons } from '@expo/vector-icons';

import { useLeague } from '@/store/LeagueContext';
import { historyApi, SessionOverview } from '@/services/api';

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

const PHASE_LABELS: Record<string, string> = {
  ASTA_LIBERA: 'Asta Libera',
  OFFERTE_PRE_RINNOVO: 'Offerte Pre-Rinnovo',
  PREMI: 'Premi',
  CONTRATTI: 'Contratti',
  CALCOLO_INDENNIZZI: 'Indennizzi',
  RUBATA: 'Rubata',
  ASTA_SVINCOLATI: 'Svincolati',
  OFFERTE_POST_ASTA_SVINCOLATI: 'Post Asta',
  COMPLETED: 'Completata',
  CLOSED: 'Chiusa',
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: COLORS.success, label: 'Attiva' },
  CLOSED: { color: COLORS.textMuted, label: 'Chiusa' },
  COMPLETED: { color: COLORS.info, label: 'Completata' },
};

// =============================================================================
// Helper Functions
// =============================================================================

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
        Seleziona una lega dalla schermata Home per visualizzare lo storico
      </Text>
    </View>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento storico...</Text>
    </View>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="time-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.centerTitle}>Nessuna sessione</Text>
      <Text style={styles.centerSubtitle}>
        Non ci sono sessioni di mercato nello storico per questa lega
      </Text>
    </View>
  );
}

interface SessionCardProps {
  session: SessionOverview;
  onPress: () => void;
}

function SessionCard({ session, onPress }: SessionCardProps): React.JSX.Element {
  const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.CLOSED;

  return (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.sessionHeader}>
        <View style={styles.sessionTitleRow}>
          <View style={styles.semesterBadge}>
            <Text style={styles.semesterText}>
              {session.isFirstMarket ? '1° Mercato' : `Sem. ${session.semester}`}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <Text style={styles.sessionDate}>
          {formatDate(session.createdAt)}
          {session.closedAt && ` - ${formatDate(session.closedAt)}`}
        </Text>
      </View>

      {/* Phase Info */}
      <View style={styles.phaseContainer}>
        <Ionicons name="flag-outline" size={16} color={COLORS.primary} />
        <Text style={styles.phaseText}>
          {PHASE_LABELS[session.phase] || session.phase}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="cart-outline" size={18} color={COLORS.success} />
          <Text style={styles.statValue}>{session.stats?.totalAuctions || 0}</Text>
          <Text style={styles.statLabel}>Aste</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="swap-horizontal-outline" size={18} color={COLORS.warning} />
          <Text style={styles.statValue}>{session.stats?.totalTrades || 0}</Text>
          <Text style={styles.statLabel}>Scambi</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="flash-outline" size={18} color={COLORS.error} />
          <Text style={styles.statValue}>{session.stats?.totalRubate || 0}</Text>
          <Text style={styles.statLabel}>Rubate</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="exit-outline" size={18} color={COLORS.info} />
          <Text style={styles.statValue}>{session.stats?.totalSvincolati || 0}</Text>
          <Text style={styles.statLabel}>Svinc.</Text>
        </View>
      </View>

      {/* Arrow */}
      <View style={styles.arrowContainer}>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function HistoryScreen(): React.JSX.Element {
  const { selectedLeague } = useLeague();

  const [sessions, setSessions] = useState<SessionOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchSessions = useCallback(async (showLoader: boolean = true) => {
    if (!selectedLeague) {
      setIsLoading(false);
      return;
    }

    if (showLoader) {
      setIsLoading(true);
    }

    try {
      console.log('[HistoryScreen] Fetching sessions for league:', selectedLeague.id);
      const response = await historyApi.getSessionsOverview(selectedLeague.id);
      console.log('[HistoryScreen] Response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        setSessions(response.data);
      }
    } catch (err) {
      console.error('[HistoryScreen] Error fetching sessions:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLeague]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSessions(false);
  }, [fetchSessions]);

  const handleSessionPress = useCallback((session: SessionOverview) => {
    // For now, just log - could navigate to detail screen
    console.log('[HistoryScreen] Session pressed:', session.id);
  }, []);

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

  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessioni di Mercato</Text>
        <Text style={styles.headerSubtitle}>
          {sessions.length} {sessions.length === 1 ? 'sessione' : 'sessioni'} registrate
        </Text>
      </View>

      {/* Sessions List */}
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onPress={() => handleSessionPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />
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

  // Header
  header: {
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
    marginTop: 4,
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

  // List
  listContent: {
    padding: 16,
    paddingTop: 8,
  },

  // Session Card
  sessionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sessionHeader: {
    marginBottom: 12,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  semesterBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  semesterText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sessionDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Phase
  phaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  phaseText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 4,
  },

  // Arrow
  arrowContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});

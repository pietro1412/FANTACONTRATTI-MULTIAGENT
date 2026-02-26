// =============================================================================
// RosterScreen - Display player roster for the selected league
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
import { rosterApi, RosterPlayer } from '@/services/api';
import { Position } from '@/types';

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
  // Position colors as specified
  positionP: '#F59E0B', // Amber for Portiere
  positionD: '#3B82F6', // Blue for Difensore
  positionC: '#10B981', // Green for Centrocampista
  positionA: '#EF4444', // Red for Attaccante
};

type FilterTab = 'Tutti' | 'P' | 'D' | 'C' | 'A';

const FILTER_TABS: FilterTab[] = ['Tutti', 'P', 'D', 'C', 'A'];

const POSITION_COLORS: Record<Position, string> = {
  P: COLORS.positionP,
  D: COLORS.positionD,
  C: COLORS.positionC,
  A: COLORS.positionA,
};

const POSITION_LABELS: Record<Position, string> = {
  P: 'POR',
  D: 'DIF',
  C: 'CEN',
  A: 'ATT',
};

// =============================================================================
// Types
// =============================================================================

interface RosterSummary {
  totalPlayers: number;
  totalSalary: number;
  budgetRemaining: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (amount: number | undefined | null): string => {
  const safeAmount = amount ?? 0;
  return `${safeAmount.toLocaleString('it-IT')} M`;
};

const getPositionColor = (position: Position): string => {
  return POSITION_COLORS[position] || COLORS.textSecondary;
};

// =============================================================================
// Sub-Components
// =============================================================================

interface FilterTabsProps {
  activeFilter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
  playerCounts: Record<FilterTab, number>;
}

function FilterTabs({ activeFilter, onFilterChange, playerCounts }: FilterTabsProps): React.JSX.Element {
  return (
    <View style={styles.filterContainer}>
      {FILTER_TABS.map((tab) => {
        const isActive = activeFilter === tab;
        const count = playerCounts[tab];

        return (
          <TouchableOpacity
            key={tab}
            style={[
              styles.filterTab,
              isActive && styles.filterTabActive,
              tab !== 'Tutti' && { borderColor: POSITION_COLORS[tab as Position] },
              isActive && tab !== 'Tutti' && { backgroundColor: POSITION_COLORS[tab as Position] + '20' },
            ]}
            onPress={() => onFilterChange(tab)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                isActive && styles.filterTabTextActive,
                tab !== 'Tutti' && { color: POSITION_COLORS[tab as Position] },
                isActive && tab !== 'Tutti' && { color: POSITION_COLORS[tab as Position] },
              ]}
            >
              {tab}
            </Text>
            <Text
              style={[
                styles.filterTabCount,
                isActive && styles.filterTabCountActive,
              ]}
            >
              {count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface SummaryHeaderProps {
  summary: RosterSummary;
}

function SummaryHeader({ summary }: SummaryHeaderProps): React.JSX.Element {
  return (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryItem}>
        <Ionicons name="people-outline" size={20} color={COLORS.primary} />
        <Text style={styles.summaryValue}>{summary.totalPlayers}</Text>
        <Text style={styles.summaryLabel}>Giocatori</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Ionicons name="cash-outline" size={20} color={COLORS.warning} />
        <Text style={styles.summaryValue}>{formatCurrency(summary.totalSalary)}</Text>
        <Text style={styles.summaryLabel}>Stipendi</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Ionicons name="wallet-outline" size={20} color={COLORS.success} />
        <Text style={[styles.summaryValue, summary.budgetRemaining < 0 && styles.summaryValueNegative]}>
          {formatCurrency(summary.budgetRemaining)}
        </Text>
        <Text style={styles.summaryLabel}>Budget</Text>
      </View>
    </View>
  );
}

interface PlayerCardProps {
  rosterPlayer: RosterPlayer;
}

function PlayerCard({ rosterPlayer }: PlayerCardProps): React.JSX.Element {
  const { player, contract } = rosterPlayer;
  const position = player.position as Position;
  const positionColor = getPositionColor(position);

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerHeader}>
        {/* Team logo placeholder */}
        <View style={styles.teamLogoContainer}>
          <View style={[styles.teamLogoPlaceholder, { backgroundColor: positionColor + '30' }]}>
            <Ionicons name="shirt-outline" size={24} color={positionColor} />
          </View>
        </View>

        {/* Player info */}
        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <View style={[styles.positionBadge, { backgroundColor: positionColor }]}>
              <Text style={styles.positionBadgeText}>{POSITION_LABELS[position]}</Text>
            </View>
          </View>
          <Text style={styles.playerTeam} numberOfLines={1}>{player.team}</Text>
        </View>
      </View>

      {/* Contract info */}
      <View style={styles.contractContainer}>
        <View style={styles.contractRow}>
          <View style={styles.contractItem}>
            <Text style={styles.contractLabel}>Stipendio</Text>
            <Text style={styles.contractValue}>
              {contract ? formatCurrency(contract.salary) : '-'}
            </Text>
          </View>
          <View style={styles.contractItem}>
            <Text style={styles.contractLabel}>Durata</Text>
            <Text style={styles.contractValue}>
              {contract ? `${contract.duration} anni` : '-'}
            </Text>
          </View>
          <View style={styles.contractItem}>
            <Text style={styles.contractLabel}>Clausola</Text>
            <Text style={styles.contractValue}>
              {contract ? formatCurrency(contract.clause) : '-'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quotation */}
      <View style={styles.quotationContainer}>
        <Text style={styles.quotationLabel}>Quotazione</Text>
        <Text style={styles.quotationValue}>{player.quotation}</Text>
      </View>
    </View>
  );
}

interface EmptyStateProps {
  hasLeague: boolean;
}

function EmptyState({ hasLeague }: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={hasLeague ? 'people-outline' : 'trophy-outline'}
        size={64}
        color={COLORS.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {hasLeague ? 'Rosa vuota' : 'Nessuna lega selezionata'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasLeague
          ? 'Non hai ancora giocatori nella tua rosa.\nPartecipa alle aste per acquistare giocatori!'
          : 'Seleziona una lega dalla schermata Home\nper visualizzare la tua rosa.'}
      </Text>
    </View>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento rosa...</Text>
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
      <Text style={styles.errorTitle}>Errore</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
        <Text style={styles.retryButtonText}>Riprova</Text>
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function RosterScreen(): React.JSX.Element {
  const { selectedLeague, selectedMember } = useLeague();

  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('Tutti');

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchRoster = useCallback(async (showLoader: boolean = true) => {
    if (!selectedLeague) {
      setIsLoading(false);
      return;
    }

    if (showLoader) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await rosterApi.getRoster(selectedLeague.id);

      if (response.success && response.data) {
        // Ensure roster is always an array
        const rosterData = Array.isArray(response.data) ? response.data : [];
        setRoster(rosterData);
      } else {
        setError(response.message || 'Errore nel caricamento della rosa');
      }
    } catch (err) {
      console.error('Error fetching roster:', err);
      setError('Errore di connessione. Verifica la tua rete.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLeague]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchRoster(false);
  }, [fetchRoster]);

  const handleFilterChange = useCallback((filter: FilterTab) => {
    setActiveFilter(filter);
  }, []);

  // =============================================================================
  // Computed Values
  // =============================================================================

  const filteredRoster = roster.filter((rp) => {
    if (activeFilter === 'Tutti') return true;
    return rp.player.position === activeFilter;
  });

  const playerCounts: Record<FilterTab, number> = {
    Tutti: roster.length,
    P: roster.filter((rp) => rp.player.position === 'P').length,
    D: roster.filter((rp) => rp.player.position === 'D').length,
    C: roster.filter((rp) => rp.player.position === 'C').length,
    A: roster.filter((rp) => rp.player.position === 'A').length,
  };

  const summary: RosterSummary = {
    totalPlayers: roster.length,
    totalSalary: roster.reduce((sum, rp) => sum + (rp.contract?.salary || 0), 0),
    budgetRemaining: selectedMember?.budget || 0,
  };

  // =============================================================================
  // Render
  // =============================================================================

  // No league selected
  if (!selectedLeague) {
    return (
      <View style={styles.container}>
        <EmptyState hasLeague={false} />
      </View>
    );
  }

  // Loading state
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  // Error state
  if (error && !isRefreshing) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={() => fetchRoster()} />
      </View>
    );
  }

  // Empty roster
  if (roster.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState hasLeague={true} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredRoster}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PlayerCard rosterPlayer={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            progressBackgroundColor={COLORS.card}
          />
        }
        ListHeaderComponent={
          <View>
            <SummaryHeader summary={summary} />
            <FilterTabs
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              playerCounts={playerCounts}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.noResultsText}>
              Nessun giocatore trovato con questo filtro
            </Text>
          </View>
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Summary Header
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  summaryValueNegative: {
    color: COLORS.error,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.cardBorder,
  },

  // Filter Tabs
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 4,
  },
  filterTabActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.primary,
  },
  filterTabCount: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
    backgroundColor: COLORS.cardBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  filterTabCountActive: {
    backgroundColor: COLORS.primary + '40',
    color: COLORS.primary,
  },

  // Player Card
  playerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamLogoContainer: {
    marginRight: 12,
  },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  playerTeam: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  positionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Contract Info
  contractContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  contractRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contractItem: {
    flex: 1,
    alignItems: 'center',
  },
  contractLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  contractValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Quotation
  quotationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  quotationLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  quotationValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Loading State
  loadingContainer: {
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

  // Error State
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.error,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },

  // No Results
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  noResultsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});

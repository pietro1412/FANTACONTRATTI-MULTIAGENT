// =============================================================================
// HomeScreen - Main Dashboard for FantaContratti Mobile App
// =============================================================================

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useLeague } from '@/store/LeagueContext';
import { useAuth } from '@/store/AuthContext';
import { HomeStackParamList } from '@/navigation/AppNavigator';

// =============================================================================
// Theme Colors
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardHighlight: '#2d2d4a',
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
};

// =============================================================================
// Types
// =============================================================================

type HomeScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color: string;
}

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
}

// =============================================================================
// Components
// =============================================================================

function StatCard({ icon, label, value, color }: StatCardProps): React.JSX.Element {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, color }: QuickActionProps): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function NoLeagueSelected({ onSelectLeague }: { onSelectLeague: () => void }): React.JSX.Element {
  return (
    <View style={styles.noLeagueContainer}>
      <Ionicons name="trophy-outline" size={80} color={COLORS.primary} />
      <Text style={styles.noLeagueTitle}>Nessuna Lega Selezionata</Text>
      <Text style={styles.noLeagueSubtitle}>
        Seleziona una lega per visualizzare la dashboard e accedere alle funzionalita
      </Text>
      <TouchableOpacity
        style={styles.selectLeagueButton}
        onPress={onSelectLeague}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle-outline" size={24} color={COLORS.text} />
        <Text style={styles.selectLeagueButtonText}>Seleziona Lega</Text>
      </TouchableOpacity>
    </View>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento...</Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const {
    selectedLeague,
    selectedMember,
    leagueStats,
    isLoading,
    refreshLeagueData,
  } = useLeague();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLeagueData();
    setRefreshing(false);
  }, [refreshLeagueData]);

  const navigateToLeagueSelection = useCallback(() => {
    navigation.navigate('LeagueSelection');
  }, [navigation]);

  // Navigation handlers for quick actions
  const handleNavigateToRoster = useCallback(() => {
    // Navigate to Rosa tab
    // @ts-ignore - Navigation typing is complex with nested navigators
    navigation.getParent()?.navigate('RosaTab');
  }, [navigation]);

  const handleNavigateToAuctions = useCallback(() => {
    // Navigate to Mercato tab
    // @ts-ignore - Navigation typing is complex with nested navigators
    navigation.getParent()?.navigate('MercatoTab');
  }, [navigation]);

  const handleNavigateToTrades = useCallback(() => {
    // Navigate to Scambi tab
    // @ts-ignore - Navigation typing is complex with nested navigators
    navigation.getParent()?.navigate('ScambiTab');
  }, [navigation]);

  const handleNavigateToHistory = useCallback(() => {
    // Navigate to Altro tab and then to History
    // @ts-ignore - Navigation typing is complex with nested navigators
    navigation.getParent()?.navigate('AltroTab', {
      screen: 'History',
    });
  }, [navigation]);

  // Show loading state on initial load
  if (isLoading && !selectedLeague) {
    return <LoadingState />;
  }

  // Show no league selected state
  if (!selectedLeague) {
    return <NoLeagueSelected onSelectLeague={navigateToLeagueSelection} />;
  }

  // Get phase display text
  const getPhaseText = (phase?: string | null): string => {
    if (!phase) return 'Nessuna fase attiva';
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Ciao, {user?.username || 'Manager'}!
        </Text>
        <Text style={styles.welcomeSubtext}>
          {selectedMember?.teamName || 'Il tuo team'}
        </Text>
      </View>

      {/* League Info Card */}
      <View style={styles.leagueCard}>
        <View style={styles.leagueHeader}>
          <View style={styles.leagueInfo}>
            <Text style={styles.leagueName}>{selectedLeague.name}</Text>
            <View style={styles.leagueStatusContainer}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      selectedLeague.status === 'ACTIVE'
                        ? COLORS.success
                        : COLORS.warning,
                  },
                ]}
              />
              <Text style={styles.leagueStatus}>
                {selectedLeague.status === 'ACTIVE' ? 'Attiva' : selectedLeague.status}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.changeLeagueButton}
            onPress={navigateToLeagueSelection}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.leagueDivider} />

        <View style={styles.leagueDetails}>
          <View style={styles.leagueDetailItem}>
            <Ionicons name="wallet-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.leagueDetailText}>
              Budget: {selectedMember?.budget?.toLocaleString('it-IT') || '0'} FM
            </Text>
          </View>
          <View style={styles.leagueDetailItem}>
            <Ionicons name="flag-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.leagueDetailText}>
              Fase: {getPhaseText(selectedLeague.currentPhase)}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Section */}
      <Text style={styles.sectionTitle}>Statistiche</Text>
      <View style={styles.statsGrid}>
        <StatCard
          icon="people"
          label="Rosa"
          value={`${leagueStats?.rosterCount || 0}/${leagueStats?.maxRosterSlots || 25}`}
          color={COLORS.primary}
        />
        <StatCard
          icon="cart"
          label="Aste Attive"
          value={leagueStats?.activeAuctions || 0}
          color={COLORS.success}
        />
        <StatCard
          icon="swap-horizontal"
          label="Scambi Pending"
          value={leagueStats?.pendingTrades || 0}
          color={COLORS.warning}
        />
        <StatCard
          icon="wallet"
          label="Budget"
          value={`${((selectedMember?.budget || 0) / 1000000).toFixed(1)}M`}
          color={COLORS.info}
        />
      </View>

      {/* Quick Actions Section */}
      <Text style={styles.sectionTitle}>Azioni Rapide</Text>
      <View style={styles.quickActionsGrid}>
        <QuickAction
          icon="people-outline"
          label="La Mia Rosa"
          onPress={handleNavigateToRoster}
          color={COLORS.primary}
        />
        <QuickAction
          icon="cart-outline"
          label="Mercato"
          onPress={handleNavigateToAuctions}
          color={COLORS.success}
        />
        <QuickAction
          icon="swap-horizontal-outline"
          label="Scambi"
          onPress={handleNavigateToTrades}
          color={COLORS.warning}
        />
        <QuickAction
          icon="time-outline"
          label="Storico"
          onPress={handleNavigateToHistory}
          color={COLORS.info}
        />
      </View>

      {/* Change League Button */}
      <TouchableOpacity
        style={styles.changeLeagueFullButton}
        onPress={navigateToLeagueSelection}
        activeOpacity={0.8}
      >
        <Ionicons name="shuffle-outline" size={20} color={COLORS.text} />
        <Text style={styles.changeLeagueFullButtonText}>Cambia Lega</Text>
      </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 16,
  },
  noLeagueContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noLeagueTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 24,
    textAlign: 'center',
  },
  noLeagueSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  selectLeagueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 32,
    gap: 10,
  },
  selectLeagueButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  leagueCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  leagueStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  leagueStatus: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  changeLeagueButton: {
    backgroundColor: COLORS.cardHighlight,
    padding: 10,
    borderRadius: 10,
  },
  leagueDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  leagueDetails: {
    gap: 10,
  },
  leagueDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leagueDetailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  changeLeagueFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardHighlight,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  changeLeagueFullButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

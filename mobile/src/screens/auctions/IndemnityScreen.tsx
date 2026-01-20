// =============================================================================
// IndemnityScreen - Indemnity decisions for FantaContratti Mobile App
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { AuctionsStackParamList } from '@/navigation/AppNavigator';
import {
  indemnityApi,
  leaguesApi,
  AffectedPlayer,
  DecisionStatus,
  IndemnityDecision,
} from '@/services/api';

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

const POSITION_COLORS: Record<string, string> = {
  P: '#F59E0B',
  D: '#10B981',
  C: '#3B82F6',
  A: '#EF4444',
};

const EXIT_REASON_CONFIG = {
  RITIRATO: {
    label: 'Ritirato',
    description: 'Il giocatore si e\' ritirato. Il contratto viene automaticamente risolto.',
    color: COLORS.textMuted,
    icon: 'stop-circle-outline' as const,
    canDecide: false,
    releaseLabel: 'Rilasciato',
    keepLabel: '-',
    releaseCompensation: null,
  },
  RETROCESSO: {
    label: 'Retrocesso',
    description: 'Il giocatore e\' sceso in Serie B. Puoi tenerlo o rilasciarlo senza compenso.',
    color: COLORS.warning,
    icon: 'arrow-down-outline' as const,
    canDecide: true,
    releaseLabel: 'Rilascia (senza compenso)',
    keepLabel: 'Mantieni',
    releaseCompensation: 0,
  },
  ESTERO: {
    label: 'Estero',
    description: 'Il giocatore e\' andato all\'estero. Puoi tenerlo o rilasciarlo ricevendo un compenso.',
    color: COLORS.info,
    icon: 'airplane-outline' as const,
    canDecide: true,
    releaseLabel: 'Rilascia (con compenso)',
    keepLabel: 'Mantieni',
    releaseCompensation: 'calculated',
  },
};

type Props = NativeStackScreenProps<AuctionsStackParamList, 'Indemnity'>;

// =============================================================================
// Sub-Components
// =============================================================================

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento indennizzi...</Text>
    </View>
  );
}

function PhaseNotActiveState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="pause-circle-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.centerTitle}>Fase non attiva</Text>
      <Text style={styles.centerSubtitle}>
        La fase CALCOLO_INDENNIZZI non e' attualmente attiva.
      </Text>
    </View>
  );
}

function NoAffectedPlayersState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="checkmark-circle-outline" size={64} color={COLORS.success} />
      <Text style={styles.centerTitle}>Nessun giocatore interessato</Text>
      <Text style={styles.centerSubtitle}>
        Non hai giocatori nella tua rosa che siano usciti dalla lista quotazioni.
      </Text>
    </View>
  );
}

interface PlayerCardProps {
  player: AffectedPlayer;
  decision: IndemnityDecision | null;
  onDecisionChange: (decision: IndemnityDecision) => void;
  hasSubmitted: boolean;
  inCalcoloPhase: boolean;
  indennizzoEstero: number;
}

function PlayerCard({
  player,
  decision,
  onDecisionChange,
  hasSubmitted,
  inCalcoloPhase,
  indennizzoEstero,
}: PlayerCardProps): React.JSX.Element {
  const config = EXIT_REASON_CONFIG[player.exitReason];
  const compensation =
    player.exitReason === 'ESTERO'
      ? Math.min(player.contract.rescissionClause, indennizzoEstero)
      : 0;

  return (
    <View style={styles.playerCard}>
      {/* Player Header */}
      <View style={styles.playerHeader}>
        <View style={styles.playerInfo}>
          <View style={[styles.positionBadge, { backgroundColor: POSITION_COLORS[player.position] || COLORS.textMuted }]}>
            <Text style={styles.positionText}>{player.position}</Text>
          </View>
          <View style={styles.playerDetails}>
            <Text style={styles.playerName}>{player.playerName}</Text>
            <Text style={styles.playerTeam}>{player.team}</Text>
          </View>
        </View>
        <View style={[styles.reasonBadge, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.reasonText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {/* Contract Info */}
      <View style={styles.contractInfo}>
        <View style={styles.contractItem}>
          <Text style={styles.contractLabel}>Ingaggio</Text>
          <Text style={styles.contractValue}>{player.contract.salary}M</Text>
        </View>
        <View style={styles.contractItem}>
          <Text style={styles.contractLabel}>Durata</Text>
          <Text style={styles.contractValue}>{player.contract.duration} sem</Text>
        </View>
        <View style={styles.contractItem}>
          <Text style={styles.contractLabel}>Clausola</Text>
          <Text style={[styles.contractValue, { color: COLORS.primary }]}>
            {player.contract.rescissionClause}M
          </Text>
        </View>
        {player.exitReason === 'ESTERO' && (
          <View style={styles.contractItem}>
            <Text style={styles.contractLabel}>Compenso</Text>
            <Text style={[styles.contractValue, { color: COLORS.success }]}>
              {compensation}M
            </Text>
          </View>
        )}
      </View>

      {/* Decision Buttons */}
      {config.canDecide && !hasSubmitted && inCalcoloPhase && (
        <View style={styles.decisionButtons}>
          <TouchableOpacity
            style={[
              styles.decisionButton,
              decision === 'KEEP' && styles.decisionButtonSelected,
            ]}
            onPress={() => onDecisionChange('KEEP')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="home-outline"
              size={18}
              color={decision === 'KEEP' ? COLORS.text : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.decisionButtonText,
                decision === 'KEEP' && styles.decisionButtonTextSelected,
              ]}
            >
              {config.keepLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.decisionButton,
              styles.decisionButtonRelease,
              decision === 'RELEASE' && styles.decisionButtonReleaseSelected,
            ]}
            onPress={() => onDecisionChange('RELEASE')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="exit-outline"
              size={18}
              color={decision === 'RELEASE' ? COLORS.text : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.decisionButtonText,
                decision === 'RELEASE' && styles.decisionButtonTextSelected,
              ]}
            >
              {config.releaseLabel}
            </Text>
            {player.exitReason === 'ESTERO' && (
              <Text style={styles.compensationText}>+{compensation}M</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Auto-released badge for RITIRATO */}
      {player.exitReason === 'RITIRATO' && (
        <View style={styles.autoReleasedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.textMuted} />
          <Text style={styles.autoReleasedText}>Rilasciato automaticamente</Text>
        </View>
      )}

      {/* Submitted state */}
      {hasSubmitted && config.canDecide && (
        <View style={styles.submittedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
          <Text style={styles.submittedText}>Decisione inviata</Text>
        </View>
      )}
    </View>
  );
}

interface StatusCardProps {
  status: DecisionStatus;
}

function StatusCard({ status }: StatusCardProps): React.JSX.Element {
  return (
    <View style={[styles.statusCard, status.hasDecided && styles.statusCardDecided]}>
      <View style={styles.statusLeft}>
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: status.hasDecided ? COLORS.success + '20' : COLORS.textMuted + '20' },
          ]}
        >
          <Ionicons
            name={status.hasDecided ? 'checkmark' : 'time-outline'}
            size={18}
            color={status.hasDecided ? COLORS.success : COLORS.textMuted}
          />
        </View>
        <View>
          <Text style={styles.statusName}>{status.teamName || status.username}</Text>
          <Text style={styles.statusCount}>{status.affectedCount} giocatori interessati</Text>
        </View>
      </View>
      <Text style={[styles.statusLabel, { color: status.hasDecided ? COLORS.success : COLORS.warning }]}>
        {status.hasDecided ? 'Completato' : 'In attesa'}
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function IndemnityScreen({ route }: Props): React.JSX.Element {
  const { leagueId } = route.params;

  const [affectedPlayers, setAffectedPlayers] = useState<AffectedPlayer[]>([]);
  const [decisions, setDecisions] = useState<Record<string, IndemnityDecision>>({});
  const [currentBudget, setCurrentBudget] = useState(0);
  const [inCalcoloPhase, setInCalcoloPhase] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [indennizzoEstero, setIndennizzoEstero] = useState(50);
  const [decisionStatuses, setDecisionStatuses] = useState<DecisionStatus[]>([]);
  const [allDecided, setAllDecided] = useState(false);

  // ===========================================================================
  // Data Fetching
  // ===========================================================================

  const loadData = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      // Check if admin
      const leagueResponse = await leaguesApi.getLeagueById(leagueId);
      if (leagueResponse.success && leagueResponse.data) {
        const data = leagueResponse.data as { userMembership?: { role: string } };
        setIsLeagueAdmin(data.userMembership?.role === 'ADMIN');
      }

      // Load my affected players
      const myResult = await indemnityApi.getMyAffectedPlayers(leagueId);
      if (myResult.success && myResult.data) {
        const data = myResult.data;
        setInCalcoloPhase(data.inCalcoloIndennizziPhase);
        setHasSubmitted(data.hasSubmittedDecisions);
        setSubmittedAt(data.submittedAt);
        setCurrentBudget(data.currentBudget);
        setIndennizzoEstero(data.indennizzoEstero || 50);
        setAffectedPlayers(data.affectedPlayers);

        // Initialize decisions with KEEP for all players (except RITIRATO which is auto)
        const initialDecisions: Record<string, IndemnityDecision> = {};
        for (const p of data.affectedPlayers) {
          if (p.exitReason !== 'RITIRATO') {
            initialDecisions[p.roster.id] = 'KEEP';
          }
        }
        setDecisions(initialDecisions);
      }

      // If admin, load all statuses
      if (isLeagueAdmin) {
        const statusResult = await indemnityApi.getAllDecisionsStatus(leagueId);
        if (statusResult.success && statusResult.data) {
          setDecisionStatuses(statusResult.data.managers);
          setAllDecided(statusResult.data.allDecided);
        }
      }
    } catch (error) {
      console.error('[IndemnityScreen] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [leagueId, isLeagueAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData(false);
  }, [loadData]);

  const handleDecisionChange = useCallback((rosterId: string, decision: IndemnityDecision) => {
    setDecisions((prev) => ({
      ...prev,
      [rosterId]: decision,
    }));
  }, []);

  const handleSubmitDecisions = useCallback(async () => {
    const decisionArray = Object.entries(decisions).map(([rosterId, decision]) => ({
      rosterId,
      decision,
    }));

    if (decisionArray.length === 0) {
      Alert.alert('Errore', 'Nessuna decisione da inviare.');
      return;
    }

    Alert.alert(
      'Conferma Decisioni',
      'Sei sicuro di voler inviare le tue decisioni? Questa azione non puo\' essere annullata.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Conferma',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const result = await indemnityApi.submitDecisions(leagueId, decisionArray);
              if (result.success) {
                Alert.alert('Successo', result.message || 'Decisioni inviate con successo!');
                setHasSubmitted(true);
                setSubmittedAt(new Date().toISOString());
                loadData(false);
              } else {
                Alert.alert('Errore', result.message || 'Errore durante l\'invio delle decisioni.');
              }
            } catch (error) {
              Alert.alert('Errore', 'Si e\' verificato un errore.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  }, [decisions, leagueId, loadData]);

  // ===========================================================================
  // Computed Values
  // ===========================================================================

  const playersNeedingDecision = affectedPlayers.filter((p) => p.exitReason !== 'RITIRATO');
  const ritiratiPlayers = affectedPlayers.filter((p) => p.exitReason === 'RITIRATO');

  const totalPotentialCompensation = playersNeedingDecision
    .filter((p) => p.exitReason === 'ESTERO' && decisions[p.roster.id] === 'RELEASE')
    .reduce((sum, p) => sum + Math.min(p.contract.rescissionClause, indennizzoEstero), 0);

  // ===========================================================================
  // Render
  // ===========================================================================

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  if (!inCalcoloPhase) {
    return (
      <View style={styles.container}>
        <PhaseNotActiveState />
      </View>
    );
  }

  if (affectedPlayers.length === 0) {
    return (
      <View style={styles.container}>
        <NoAffectedPlayersState />
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
      {/* Already Submitted Banner */}
      {hasSubmitted && (
        <View style={styles.submittedBanner}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
          <View style={styles.submittedBannerText}>
            <Text style={styles.submittedBannerTitle}>Decisioni inviate</Text>
            <Text style={styles.submittedBannerSubtitle}>
              {submittedAt && `Inviate il ${new Date(submittedAt).toLocaleString('it-IT')}`}
            </Text>
          </View>
        </View>
      )}

      {/* Admin Status Panel */}
      {isLeagueAdmin && decisionStatuses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stato Decisioni Manager</Text>
          {decisionStatuses.map((status) => (
            <StatusCard key={status.memberId} status={status} />
          ))}
          {allDecided && (
            <View style={styles.allDecidedBanner}>
              <Ionicons name="checkmark-done" size={20} color={COLORS.success} />
              <Text style={styles.allDecidedText}>
                Tutti i manager hanno inviato le decisioni. Puoi procedere alla fase successiva.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* RITIRATO Players (auto-released) */}
      {ritiratiPlayers.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stop-circle-outline" size={20} color={COLORS.textMuted} />
            <Text style={styles.sectionTitle}>Giocatori Ritirati</Text>
            <Text style={styles.sectionSubtitle}>(rilasciati automaticamente)</Text>
          </View>
          {ritiratiPlayers.map((player) => (
            <PlayerCard
              key={player.playerId}
              player={player}
              decision={null}
              onDecisionChange={() => {}}
              hasSubmitted={hasSubmitted}
              inCalcoloPhase={inCalcoloPhase}
              indennizzoEstero={indennizzoEstero}
            />
          ))}
        </View>
      )}

      {/* Players Needing Decision */}
      {playersNeedingDecision.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Le Tue Decisioni</Text>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBadge, { backgroundColor: COLORS.warning + '20' }]}>
                <Ionicons name="arrow-down-outline" size={14} color={COLORS.warning} />
                <Text style={[styles.legendText, { color: COLORS.warning }]}>RETROCESSO</Text>
              </View>
              <Text style={styles.legendDescription}>Rilascio senza compenso</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBadge, { backgroundColor: COLORS.info + '20' }]}>
                <Ionicons name="airplane-outline" size={14} color={COLORS.info} />
                <Text style={[styles.legendText, { color: COLORS.info }]}>ESTERO</Text>
              </View>
              <Text style={styles.legendDescription}>Rilascio con compenso</Text>
            </View>
          </View>

          {playersNeedingDecision.map((player) => (
            <PlayerCard
              key={player.playerId}
              player={player}
              decision={decisions[player.roster.id]}
              onDecisionChange={(decision) => handleDecisionChange(player.roster.id, decision)}
              hasSubmitted={hasSubmitted}
              inCalcoloPhase={inCalcoloPhase}
              indennizzoEstero={indennizzoEstero}
            />
          ))}
        </View>
      )}

      {/* Summary and Submit */}
      {playersNeedingDecision.length > 0 && !hasSubmitted && inCalcoloPhase && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Budget attuale</Text>
            <Text style={styles.summaryValue}>{currentBudget}M</Text>
          </View>
          {totalPotentialCompensation > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Compenso da rilasci</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                +{totalPotentialCompensation}M
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmitDecisions}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color={COLORS.text} />
                <Text style={styles.submitButtonText}>Conferma Decisioni</Text>
              </>
            )}
          </TouchableOpacity>
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

  // Submitted Banner
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  submittedBannerText: {
    flex: 1,
  },
  submittedBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  submittedBannerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Legend
  legend: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flex: 1,
  },
  legendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  legendDescription: {
    fontSize: 11,
    color: COLORS.textMuted,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  positionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  playerTeam: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Contract Info
  contractInfo: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  contractItem: {
    flex: 1,
    alignItems: 'center',
  },
  contractLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  contractValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Decision Buttons
  decisionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  decisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  decisionButtonSelected: {
    backgroundColor: COLORS.primary,
  },
  decisionButtonRelease: {
    backgroundColor: COLORS.background,
  },
  decisionButtonReleaseSelected: {
    backgroundColor: COLORS.error,
  },
  decisionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  decisionButtonTextSelected: {
    color: COLORS.text,
  },
  compensationText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },

  // Auto-released Badge
  autoReleasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  autoReleasedText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Submitted Badge
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  submittedText: {
    fontSize: 13,
    color: COLORS.success,
  },

  // Status Card
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statusCardDecided: {
    borderColor: COLORS.success + '40',
    backgroundColor: COLORS.success + '10',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusCount: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // All Decided Banner
  allDecidedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  allDecidedText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '500',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});

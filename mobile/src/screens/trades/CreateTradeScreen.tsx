// =============================================================================
// CreateTradeScreen - Create trade offer for FantaContratti Mobile App
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useLeague } from '@/store/LeagueContext';
import {
  leaguesApi,
  rosterApi,
  tradesApi,
  LeagueMember,
  RosterPlayer,
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

const DURATION_OPTIONS = [
  { value: 12, label: '12 ore' },
  { value: 24, label: '24 ore' },
  { value: 48, label: '48 ore' },
  { value: 72, label: '72 ore' },
];

// =============================================================================
// Sub-Components
// =============================================================================

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento...</Text>
    </View>
  );
}

function NoLeagueState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="trophy-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.centerTitle}>Nessuna lega selezionata</Text>
      <Text style={styles.centerSubtitle}>
        Seleziona una lega dalla schermata Home per proporre uno scambio.
      </Text>
    </View>
  );
}

interface PlayerChipProps {
  player: RosterPlayer;
  selected: boolean;
  onPress: () => void;
}

function PlayerChip({ player, selected, onPress }: PlayerChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.playerChip, selected && styles.playerChipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.chipPosition,
          { backgroundColor: POSITION_COLORS[player.player.position] || COLORS.textMuted },
        ]}
      >
        <Text style={styles.chipPositionText}>{player.player.position}</Text>
      </View>
      <View style={styles.chipInfo}>
        <Text style={styles.chipName} numberOfLines={1}>{player.player.name}</Text>
        <Text style={styles.chipTeam}>{player.player.team}</Text>
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
      )}
    </TouchableOpacity>
  );
}

interface MemberSelectorProps {
  members: LeagueMember[];
  selectedMemberId: string | null;
  onSelect: (memberId: string) => void;
  myMemberId?: string;
}

function MemberSelector({ members, selectedMemberId, onSelect, myMemberId }: MemberSelectorProps): React.JSX.Element {
  const availableMembers = members.filter((m) => m.id !== myMemberId);

  return (
    <View style={styles.memberSelector}>
      <Text style={styles.sectionTitle}>Destinatario</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
        {availableMembers.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={[
              styles.memberChip,
              selectedMemberId === member.id && styles.memberChipSelected,
            ]}
            onPress={() => onSelect(member.id)}
            activeOpacity={0.7}
          >
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {(member.teamName || member.username).charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text
              style={[
                styles.memberName,
                selectedMemberId === member.id && styles.memberNameSelected,
              ]}
              numberOfLines={1}
            >
              {member.teamName || member.username}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

interface BudgetInputProps {
  label: string;
  value: number;
  maxValue: number;
  onChange: (value: number) => void;
  color: string;
}

function BudgetInput({ label, value, maxValue, onChange, color }: BudgetInputProps): React.JSX.Element {
  return (
    <View style={styles.budgetInputContainer}>
      <Text style={styles.budgetLabel}>{label}</Text>
      <View style={styles.budgetControls}>
        <TouchableOpacity
          style={[styles.budgetButton, value <= 0 && styles.budgetButtonDisabled]}
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
        >
          <Ionicons name="remove" size={20} color={value <= 0 ? COLORS.textMuted : COLORS.text} />
        </TouchableOpacity>
        <View style={[styles.budgetValueContainer, { borderColor: color + '40' }]}>
          <Text style={[styles.budgetValue, { color }]}>{value}M</Text>
        </View>
        <TouchableOpacity
          style={[styles.budgetButton, value >= maxValue && styles.budgetButtonDisabled]}
          onPress={() => onChange(Math.min(maxValue, value + 1))}
          disabled={value >= maxValue}
        >
          <Ionicons name="add" size={20} color={value >= maxValue ? COLORS.textMuted : COLORS.text} />
        </TouchableOpacity>
      </View>
      <Text style={styles.budgetMax}>Max: {maxValue}M</Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function CreateTradeScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { selectedLeague, membership } = useLeague();

  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [targetRoster, setTargetRoster] = useState<RosterPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedOfferedPlayers, setSelectedOfferedPlayers] = useState<string[]>([]);
  const [selectedRequestedPlayers, setSelectedRequestedPlayers] = useState<string[]>([]);
  const [offeredBudget, setOfferedBudget] = useState(0);
  const [requestedBudget, setRequestedBudget] = useState(0);
  const [message, setMessage] = useState('');
  const [offerDuration, setOfferDuration] = useState(24);

  // Modal state
  const [showDurationModal, setShowDurationModal] = useState(false);

  const myBudget = membership?.budget || 0;
  const targetMember = members.find((m) => m.id === selectedMemberId);
  const targetBudget = targetMember?.budget || 0;

  // ===========================================================================
  // Data Fetching
  // ===========================================================================

  const loadData = useCallback(async () => {
    if (!selectedLeague) return;

    setIsLoading(true);
    try {
      // Load league members
      const membersRes = await leaguesApi.getLeagueMembers(selectedLeague.id);
      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }

      // Load my roster
      const rosterRes = await rosterApi.getRoster(selectedLeague.id);
      if (rosterRes.success && rosterRes.data) {
        setMyRoster(rosterRes.data);
      }
    } catch (error) {
      console.error('[CreateTradeScreen] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLeague]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load target member's roster when selected
  useEffect(() => {
    async function loadTargetRoster() {
      if (!selectedLeague || !selectedMemberId) {
        setTargetRoster([]);
        return;
      }

      try {
        const res = await rosterApi.getMemberRoster(selectedLeague.id, selectedMemberId);
        if (res.success && res.data) {
          setTargetRoster(res.data);
        }
      } catch (error) {
        console.error('[CreateTradeScreen] Error loading target roster:', error);
      }
    }

    loadTargetRoster();
    // Reset requested players when target changes
    setSelectedRequestedPlayers([]);
  }, [selectedLeague, selectedMemberId]);

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  const handleToggleOfferedPlayer = (rosterId: string) => {
    setSelectedOfferedPlayers((prev) =>
      prev.includes(rosterId)
        ? prev.filter((id) => id !== rosterId)
        : [...prev, rosterId]
    );
  };

  const handleToggleRequestedPlayer = (rosterId: string) => {
    setSelectedRequestedPlayers((prev) =>
      prev.includes(rosterId)
        ? prev.filter((id) => id !== rosterId)
        : [...prev, rosterId]
    );
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedLeague || !selectedMemberId) {
      Alert.alert('Errore', 'Seleziona un destinatario per lo scambio.');
      return;
    }

    if (
      selectedOfferedPlayers.length === 0 &&
      offeredBudget === 0 &&
      selectedRequestedPlayers.length === 0 &&
      requestedBudget === 0
    ) {
      Alert.alert('Errore', 'Devi offrire o richiedere almeno un giocatore o un budget.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await tradesApi.createOffer({
        leagueId: selectedLeague.id,
        toMemberId: selectedMemberId,
        offeredPlayerIds: selectedOfferedPlayers,
        requestedPlayerIds: selectedRequestedPlayers,
        offeredBudget,
        requestedBudget,
        message: message || undefined,
        durationHours: offerDuration,
      });

      if (result.success) {
        Alert.alert('Successo', 'Offerta di scambio inviata con successo!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Errore', result.message || 'Errore durante l\'invio dell\'offerta.');
      }
    } catch (error) {
      Alert.alert('Errore', 'Si e\' verificato un errore.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedLeague,
    selectedMemberId,
    selectedOfferedPlayers,
    selectedRequestedPlayers,
    offeredBudget,
    requestedBudget,
    message,
    offerDuration,
    navigation,
  ]);

  // ===========================================================================
  // Render
  // ===========================================================================

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

  const canSubmit =
    selectedMemberId &&
    (selectedOfferedPlayers.length > 0 ||
      offeredBudget > 0 ||
      selectedRequestedPlayers.length > 0 ||
      requestedBudget > 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Member Selector */}
      <MemberSelector
        members={members}
        selectedMemberId={selectedMemberId}
        onSelect={setSelectedMemberId}
        myMemberId={membership?.id}
      />

      {selectedMemberId && (
        <>
          {/* My Players Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="arrow-up-circle-outline" size={20} color={COLORS.error} />
              <Text style={styles.sectionTitle}>Giocatori che Offro</Text>
              {selectedOfferedPlayers.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{selectedOfferedPlayers.length}</Text>
                </View>
              )}
            </View>
            {myRoster.length === 0 ? (
              <Text style={styles.emptyText}>Nessun giocatore nel roster</Text>
            ) : (
              <View style={styles.playersGrid}>
                {myRoster.map((player) => (
                  <PlayerChip
                    key={player.id}
                    player={player}
                    selected={selectedOfferedPlayers.includes(player.id)}
                    onPress={() => handleToggleOfferedPlayer(player.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Target Players Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="arrow-down-circle-outline" size={20} color={COLORS.success} />
              <Text style={styles.sectionTitle}>Giocatori che Richiedo</Text>
              {selectedRequestedPlayers.length > 0 && (
                <View style={[styles.countBadge, { backgroundColor: COLORS.success + '20' }]}>
                  <Text style={[styles.countText, { color: COLORS.success }]}>
                    {selectedRequestedPlayers.length}
                  </Text>
                </View>
              )}
            </View>
            {targetRoster.length === 0 ? (
              <Text style={styles.emptyText}>
                {targetMember?.teamName || targetMember?.username} non ha giocatori
              </Text>
            ) : (
              <View style={styles.playersGrid}>
                {targetRoster.map((player) => (
                  <PlayerChip
                    key={player.id}
                    player={player}
                    selected={selectedRequestedPlayers.includes(player.id)}
                    onPress={() => handleToggleRequestedPlayer(player.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Budget Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget</Text>
            <View style={styles.budgetRow}>
              <BudgetInput
                label="Offro"
                value={offeredBudget}
                maxValue={myBudget}
                onChange={setOfferedBudget}
                color={COLORS.error}
              />
              <BudgetInput
                label="Richiedo"
                value={requestedBudget}
                maxValue={targetBudget}
                onChange={setRequestedBudget}
                color={COLORS.success}
              />
            </View>
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Durata Offerta</Text>
            <TouchableOpacity
              style={styles.durationButton}
              onPress={() => setShowDurationModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <Text style={styles.durationText}>
                {DURATION_OPTIONS.find((d) => d.value === offerDuration)?.label}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Message */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Messaggio (opzionale)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Aggiungi un messaggio..."
              placeholderTextColor={COLORS.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Summary */}
          {canSubmit && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Riepilogo</Text>
              <View style={styles.summaryContent}>
                <View style={styles.summaryColumn}>
                  <Text style={styles.summaryLabel}>Offri</Text>
                  {selectedOfferedPlayers.length > 0 && (
                    <Text style={styles.summaryValue}>
                      {selectedOfferedPlayers.length} giocatori
                    </Text>
                  )}
                  {offeredBudget > 0 && (
                    <Text style={[styles.summaryValue, { color: COLORS.error }]}>
                      + {offeredBudget}M
                    </Text>
                  )}
                </View>
                <View style={styles.summaryArrow}>
                  <Ionicons name="swap-horizontal" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.summaryColumn}>
                  <Text style={styles.summaryLabel}>Richiedi</Text>
                  {selectedRequestedPlayers.length > 0 && (
                    <Text style={styles.summaryValue}>
                      {selectedRequestedPlayers.length} giocatori
                    </Text>
                  )}
                  {requestedBudget > 0 && (
                    <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                      + {requestedBudget}M
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (!canSubmit || isSubmitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color={COLORS.text} />
                <Text style={styles.submitButtonText}>Invia Offerta</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Duration Modal */}
      <Modal
        visible={showDurationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDurationModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDurationModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleziona Durata</Text>
            {DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  offerDuration === option.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setOfferDuration(option.value);
                  setShowDurationModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    offerDuration === option.value && styles.modalOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {offerDuration === option.value && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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

  // Member Selector
  memberSelector: {
    marginBottom: 20,
  },
  membersScroll: {
    marginTop: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    maxWidth: 100,
  },
  memberNameSelected: {
    color: COLORS.text,
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
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.error + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Players Grid
  playersGrid: {
    gap: 8,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playerChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  chipPosition: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chipPositionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  chipInfo: {
    flex: 1,
  },
  chipName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  chipTeam: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Budget Input
  budgetRow: {
    flexDirection: 'row',
    gap: 16,
  },
  budgetInputContainer: {
    flex: 1,
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  budgetControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetButtonDisabled: {
    opacity: 0.5,
  },
  budgetValueContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    marginHorizontal: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  budgetValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  budgetMax: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Duration
  durationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  durationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },

  // Message Input
  messageInput: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    textAlignVertical: 'top',
    minHeight: 80,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  summaryArrow: {
    paddingHorizontal: 12,
  },

  // Submit Button
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionSelected: {
    backgroundColor: COLORS.primary + '20',
  },
  modalOptionText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  modalOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

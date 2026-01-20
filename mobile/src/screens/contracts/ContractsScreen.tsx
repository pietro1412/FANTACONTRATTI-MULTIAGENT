// =============================================================================
// ContractsScreen - Contract management for FantaContratti Mobile App
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
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLeague } from '@/store/LeagueContext';
import { contractsApi, rosterApi, RosterPlayer } from '@/services/api';

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
  P: 'POR',
  D: 'DIF',
  C: 'CEN',
  A: 'ATT',
};

// Clause multipliers
const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,
  3: 9,
  2: 7,
  1: 4,
};

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  return amount.toLocaleString('it-IT');
};

const getPositionColor = (position: string): string => {
  return POSITION_COLORS[position] || COLORS.textSecondary;
};

const calculateClause = (salary: number, duration: number): number => {
  const multiplier = DURATION_MULTIPLIERS[duration] || 4;
  return salary * multiplier;
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
        Seleziona una lega dalla schermata Home per gestire i contratti
      </Text>
    </View>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento contratti...</Text>
    </View>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <Ionicons name="document-text-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.centerTitle}>Nessun contratto</Text>
      <Text style={styles.centerSubtitle}>
        Non hai ancora giocatori con contratti attivi
      </Text>
    </View>
  );
}

interface ContractCardProps {
  rosterPlayer: RosterPlayer;
  onModify: () => void;
  onRelease: () => void;
}

function ContractCard({ rosterPlayer, onModify, onRelease }: ContractCardProps): React.JSX.Element {
  const { player, contract } = rosterPlayer;
  const positionColor = getPositionColor(player.position);

  return (
    <View style={styles.contractCard}>
      {/* Player Header */}
      <View style={styles.playerHeader}>
        <View style={[styles.playerAvatar, { backgroundColor: positionColor + '20' }]}>
          <Text style={[styles.playerAvatarText, { color: positionColor }]}>
            {player.position}
          </Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          <Text style={styles.playerTeam}>{player.team}</Text>
        </View>
        <View style={[styles.positionBadge, { backgroundColor: positionColor }]}>
          <Text style={styles.positionBadgeText}>{POSITION_LABELS[player.position]}</Text>
        </View>
      </View>

      {/* Contract Details */}
      {contract ? (
        <View style={styles.contractDetails}>
          <View style={styles.contractRow}>
            <View style={styles.contractItem}>
              <Ionicons name="cash-outline" size={16} color={COLORS.warning} />
              <Text style={styles.contractLabel}>Stipendio</Text>
              <Text style={styles.contractValue}>{formatCurrency(contract.salary)}</Text>
            </View>
            <View style={styles.contractItem}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.info} />
              <Text style={styles.contractLabel}>Durata</Text>
              <Text style={styles.contractValue}>{contract.duration} anni</Text>
            </View>
            <View style={styles.contractItem}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.error} />
              <Text style={styles.contractLabel}>Clausola</Text>
              <Text style={styles.contractValue}>{formatCurrency(contract.clause)}</Text>
            </View>
          </View>

          {/* Status */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: COLORS.success + '20' }]}>
              <Text style={[styles.statusText, { color: COLORS.success }]}>
                Contratto Attivo
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.noContractBadge}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
          <Text style={styles.noContractText}>Contratto da definire</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.modifyButton]}
          onPress={onModify}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>Modifica</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.releaseButton]}
          onPress={onRelease}
          activeOpacity={0.7}
        >
          <Ionicons name="exit-outline" size={18} color={COLORS.error} />
          <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Svincola</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface ModifyModalProps {
  visible: boolean;
  rosterPlayer: RosterPlayer | null;
  onClose: () => void;
  onSave: (salary: number, duration: number) => void;
  isProcessing: boolean;
}

function ModifyModal({ visible, rosterPlayer, onClose, onSave, isProcessing }: ModifyModalProps): React.JSX.Element {
  const [salary, setSalary] = useState('');
  const [duration, setDuration] = useState('2');

  useEffect(() => {
    if (rosterPlayer?.contract) {
      setSalary(rosterPlayer.contract.salary.toString());
      setDuration(rosterPlayer.contract.duration.toString());
    }
  }, [rosterPlayer]);

  const handleSave = () => {
    const salaryNum = parseInt(salary, 10);
    const durationNum = parseInt(duration, 10);

    if (isNaN(salaryNum) || salaryNum <= 0) {
      Alert.alert('Errore', 'Inserisci uno stipendio valido');
      return;
    }
    if (durationNum < 1 || durationNum > 4) {
      Alert.alert('Errore', 'La durata deve essere tra 1 e 4 anni');
      return;
    }

    onSave(salaryNum, durationNum);
  };

  const previewClause = salary && duration
    ? calculateClause(parseInt(salary, 10) || 0, parseInt(duration, 10) || 2)
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifica Contratto</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {rosterPlayer && (
            <View style={styles.modalPlayerInfo}>
              <Text style={styles.modalPlayerName}>{rosterPlayer.player.name}</Text>
              <Text style={styles.modalPlayerTeam}>{rosterPlayer.player.team}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Stipendio</Text>
            <TextInput
              style={styles.input}
              value={salary}
              onChangeText={setSalary}
              keyboardType="numeric"
              placeholder="Es: 5000000"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Durata (anni)</Text>
            <View style={styles.durationButtons}>
              {[1, 2, 3, 4].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.durationButton,
                    duration === d.toString() && styles.durationButtonActive,
                  ]}
                  onPress={() => setDuration(d.toString())}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.durationButtonText,
                      duration === d.toString() && styles.durationButtonTextActive,
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Preview */}
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Clausola Rescissoria</Text>
            <Text style={styles.previewValue}>{formatCurrency(previewClause)}</Text>
            <Text style={styles.previewNote}>
              (Stipendio x {DURATION_MULTIPLIERS[parseInt(duration, 10)] || 4})
            </Text>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, isProcessing && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.saveButtonText}>Salva</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function ContractsScreen(): React.JSX.Element {
  const { selectedLeague } = useLeague();

  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  const [showModifyModal, setShowModifyModal] = useState(false);

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

    try {
      console.log('[ContractsScreen] Fetching roster for league:', selectedLeague.id);
      const response = await rosterApi.getRoster(selectedLeague.id);
      console.log('[ContractsScreen] Response:', response.success);

      if (response.success && response.data) {
        setRoster(response.data);
      }
    } catch (err) {
      console.error('[ContractsScreen] Error fetching roster:', err);
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

  const handleModifyPress = useCallback((rosterPlayer: RosterPlayer) => {
    setSelectedPlayer(rosterPlayer);
    setShowModifyModal(true);
  }, []);

  const handleModifySave = useCallback(async (salary: number, duration: number) => {
    if (!selectedPlayer || !selectedLeague) return;

    setIsProcessing(true);
    try {
      const response = await contractsApi.modifyContract(
        selectedLeague.id,
        selectedPlayer.id,
        { newSalary: salary, newDuration: duration }
      );

      if (response.success) {
        Alert.alert('Successo', 'Contratto modificato con successo');
        setShowModifyModal(false);
        fetchRoster(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile modificare il contratto');
      }
    } catch (err) {
      console.error('[ContractsScreen] Error modifying contract:', err);
      Alert.alert('Errore', 'Si è verificato un errore');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlayer, selectedLeague, fetchRoster]);

  const handleReleasePress = useCallback((rosterPlayer: RosterPlayer) => {
    if (!rosterPlayer.contract) {
      Alert.alert('Errore', 'Questo giocatore non ha un contratto attivo');
      return;
    }

    Alert.alert(
      'Conferma Svincolo',
      `Sei sicuro di voler svincolare ${rosterPlayer.player.name}?\n\nQuesto renderà il giocatore disponibile per le aste.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Svincola',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await contractsApi.releasePlayer(rosterPlayer.contract!.id);
              if (response.success) {
                Alert.alert('Successo', 'Giocatore svincolato');
                fetchRoster(false);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile svincolare il giocatore');
              }
            } catch (err) {
              console.error('[ContractsScreen] Error releasing player:', err);
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  }, [fetchRoster]);

  // =============================================================================
  // Computed Values
  // =============================================================================

  const totalSalary = roster.reduce((sum, rp) => sum + (rp.contract?.salary || 0), 0);
  const contractsCount = roster.filter(rp => rp.contract).length;

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

  if (roster.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryHeader}>
        <View style={styles.summaryItem}>
          <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
          <Text style={styles.summaryValue}>{contractsCount}</Text>
          <Text style={styles.summaryLabel}>Contratti</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Ionicons name="cash-outline" size={20} color={COLORS.warning} />
          <Text style={styles.summaryValue}>{formatCurrency(totalSalary)}</Text>
          <Text style={styles.summaryLabel}>Monte Stipendi</Text>
        </View>
      </View>

      {/* Contracts List */}
      <FlatList
        data={roster}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContractCard
            rosterPlayer={item}
            onModify={() => handleModifyPress(item)}
            onRelease={() => handleReleasePress(item)}
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

      {/* Modify Modal */}
      <ModifyModal
        visible={showModifyModal}
        rosterPlayer={selectedPlayer}
        onClose={() => setShowModifyModal(false)}
        onSave={handleModifySave}
        isProcessing={isProcessing}
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

  // Summary Header
  summaryHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
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
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
  },

  // List
  listContent: {
    padding: 16,
  },

  // Contract Card
  contractCard: {
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
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  playerInfo: {
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
    marginTop: 2,
  },
  positionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  positionBadgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },

  // Contract Details
  contractDetails: {
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
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  contractValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  statusRow: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  noContractBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  noContractText: {
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: '500',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modifyButton: {
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  releaseButton: {
    backgroundColor: COLORS.error + '15',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalPlayerInfo: {
    marginBottom: 20,
  },
  modalPlayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalPlayerTeam: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  durationButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  durationButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  durationButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  durationButtonTextActive: {
    color: COLORS.primary,
  },
  previewBox: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  previewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  previewNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

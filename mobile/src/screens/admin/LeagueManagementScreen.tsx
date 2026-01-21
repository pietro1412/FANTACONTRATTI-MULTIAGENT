// =============================================================================
// LeagueManagementScreen - Admin Dashboard for League Management
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
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLeague } from '@/store/LeagueContext';
import { adminApi, leaguesApi, PendingRequest, LeagueMember } from '@/services/api';
import * as Clipboard from 'expo-clipboard';

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardBorder: '#3d3d5c',
  primary: '#6366F1',
  primaryPressed: '#4F46E5',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  admin: '#8B5CF6',
};

// =============================================================================
// Sub-Components
// =============================================================================

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
}

function StatCard({ icon, label, value, color = COLORS.primary }: StatCardProps): React.JSX.Element {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface InviteCodeCardProps {
  inviteCode: string;
  onShare: () => void;
  onCopy: () => void;
}

function InviteCodeCard({ inviteCode, onShare, onCopy }: InviteCodeCardProps): React.JSX.Element {
  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <Ionicons name="link-outline" size={20} color={COLORS.primary} />
        <Text style={styles.inviteTitle}>Codice Invito</Text>
      </View>
      <View style={styles.inviteCodeContainer}>
        <Text style={styles.inviteCode}>{inviteCode}</Text>
      </View>
      <View style={styles.inviteActions}>
        <TouchableOpacity style={styles.inviteButton} onPress={onCopy}>
          <Ionicons name="copy-outline" size={18} color={COLORS.text} />
          <Text style={styles.inviteButtonText}>Copia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.inviteButton, styles.inviteButtonPrimary]} onPress={onShare}>
          <Ionicons name="share-outline" size={18} color={COLORS.text} />
          <Text style={styles.inviteButtonText}>Condividi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface PendingRequestCardProps {
  request: PendingRequest;
  onAccept: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

function PendingRequestCard({
  request,
  onAccept,
  onReject,
  isProcessing
}: PendingRequestCardProps): React.JSX.Element {
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestInfo}>
        <View style={styles.requestAvatar}>
          <Text style={styles.requestAvatarText}>
            {request.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.requestDetails}>
          <Text style={styles.requestUsername}>{request.username}</Text>
          <Text style={styles.requestTeamName}>{request.teamName || 'Nessun team'}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.requestButton, styles.rejectButton]}
          onPress={onReject}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Ionicons name="close" size={20} color={COLORS.error} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.requestButton, styles.acceptButton]}
          onPress={onAccept}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={COLORS.success} />
          ) : (
            <Ionicons name="checkmark" size={20} color={COLORS.success} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}

function ActionButton({
  icon,
  label,
  onPress,
  color = COLORS.primary,
  disabled = false
}: ActionButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.actionIconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={disabled ? COLORS.textMuted : color} />
      </View>
      <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={disabled ? COLORS.textMuted : COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function LeagueManagementScreen(): React.JSX.Element {
  const { selectedLeague, selectedMember, refreshLeague } = useLeague();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isStartingMarket, setIsStartingMarket] = useState(false);

  // Check if user is admin
  const isAdmin = selectedMember?.role === 'ADMIN';
  const inviteCode = selectedLeague?.inviteCode || '';

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchData = useCallback(async (showLoader = true) => {
    if (!selectedLeague || !isAdmin) {
      setIsLoading(false);
      return;
    }

    if (showLoader) setIsLoading(true);

    try {
      const [pendingRes, membersRes] = await Promise.all([
        adminApi.getPendingRequests(selectedLeague.id),
        leaguesApi.getLeagueMembers(selectedLeague.id),
      ]);

      if (pendingRes.success && pendingRes.data) {
        setPendingRequests(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      }

      if (membersRes.success && membersRes.data) {
        setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
      }
    } catch (error) {
      console.error('[LeagueManagement] Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLeague, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  const handleCopyInviteCode = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(inviteCode);
      Alert.alert('Copiato!', 'Codice invito copiato negli appunti');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile copiare il codice');
    }
  }, [inviteCode]);

  const handleShareInviteCode = useCallback(async () => {
    try {
      await Share.share({
        message: `Unisciti alla mia lega su FantaContratti!\n\nCodice invito: ${inviteCode}\n\nScarica l'app e usa questo codice per entrare.`,
        title: 'Invito FantaContratti',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [inviteCode]);

  const handleAcceptRequest = useCallback(async (memberId: string) => {
    if (!selectedLeague) return;

    setProcessingId(memberId);
    try {
      const response = await adminApi.handleMemberRequest(selectedLeague.id, memberId, 'accept');
      if (response.success) {
        setPendingRequests(prev => prev.filter(r => r.id !== memberId));
        Alert.alert('Successo', 'Richiesta approvata');
        refreshLeague();
      } else {
        Alert.alert('Errore', response.message || 'Impossibile approvare la richiesta');
      }
    } catch (error) {
      Alert.alert('Errore', 'Si è verificato un errore');
    } finally {
      setProcessingId(null);
    }
  }, [selectedLeague, refreshLeague]);

  const handleRejectRequest = useCallback(async (memberId: string) => {
    if (!selectedLeague) return;

    Alert.alert(
      'Conferma rifiuto',
      'Sei sicuro di voler rifiutare questa richiesta?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rifiuta',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(memberId);
            try {
              const response = await adminApi.handleMemberRequest(selectedLeague.id, memberId, 'reject');
              if (response.success) {
                setPendingRequests(prev => prev.filter(r => r.id !== memberId));
                Alert.alert('Successo', 'Richiesta rifiutata');
              } else {
                Alert.alert('Errore', response.message || 'Impossibile rifiutare la richiesta');
              }
            } catch (error) {
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, [selectedLeague]);

  const handleStartMarket = useCallback(async () => {
    if (!selectedLeague) return;

    Alert.alert(
      'Avvia Mercato',
      'Vuoi avviare una nuova sessione di mercato?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Avvia',
          onPress: async () => {
            setIsStartingMarket(true);
            try {
              const response = await adminApi.startMarket(selectedLeague.id);
              if (response.success) {
                Alert.alert('Successo', 'Sessione di mercato avviata!');
                refreshLeague();
              } else {
                Alert.alert('Errore', response.message || 'Impossibile avviare il mercato');
              }
            } catch (error) {
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsStartingMarket(false);
            }
          },
        },
      ]
    );
  }, [selectedLeague, refreshLeague]);

  const handleStartLeague = useCallback(async () => {
    if (!selectedLeague) return;

    const minParticipants = selectedLeague.config?.minParticipants || 4;
    const currentMembers = members.filter(m => m.status === 'ACCEPTED' || m.status === 'ACTIVE').length;

    if (currentMembers < minParticipants) {
      Alert.alert(
        'Partecipanti insufficienti',
        `Servono almeno ${minParticipants} partecipanti per avviare la lega. Attualmente ci sono ${currentMembers} membri.`
      );
      return;
    }

    Alert.alert(
      'Avvia Lega',
      'Sei sicuro di voler avviare la lega? Questa azione inizierà il primo mercato.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Avvia Lega',
          onPress: async () => {
            setIsStartingMarket(true);
            try {
              const response = await adminApi.startLeague(selectedLeague.id);
              if (response.success) {
                Alert.alert('Successo', 'Lega avviata! Il primo mercato è pronto.');
                refreshLeague();
              } else {
                Alert.alert('Errore', response.message || 'Impossibile avviare la lega');
              }
            } catch (error) {
              Alert.alert('Errore', 'Si è verificato un errore');
            } finally {
              setIsStartingMarket(false);
            }
          },
        },
      ]
    );
  }, [selectedLeague, members, refreshLeague]);

  // =============================================================================
  // Render
  // =============================================================================

  // Not admin
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.notAdminContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.notAdminTitle}>Accesso Riservato</Text>
          <Text style={styles.notAdminText}>
            Solo gli admin della lega possono accedere a questa sezione.
          </Text>
        </View>
      </View>
    );
  }

  // No league selected
  if (!selectedLeague) {
    return (
      <View style={styles.container}>
        <View style={styles.notAdminContainer}>
          <Ionicons name="people-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.notAdminTitle}>Nessuna Lega</Text>
          <Text style={styles.notAdminText}>
            Seleziona una lega per gestirla.
          </Text>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const activeMembers = members.filter(m => m.status === 'ACCEPTED' || m.status === 'ACTIVE').length;
  const isLeagueStarted = selectedLeague.status === 'ACTIVE' || selectedLeague.currentPhase;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.adminBadge}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.admin} />
          <Text style={styles.adminBadgeText}>Admin</Text>
        </View>
        <Text style={styles.leagueName}>{selectedLeague.name}</Text>
        <Text style={styles.leagueStatus}>
          {isLeagueStarted ? `Fase: ${selectedLeague.currentPhase || 'Attiva'}` : 'In attesa di avvio'}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <StatCard
          icon="people"
          label="Membri"
          value={`${activeMembers}/${selectedLeague.maxParticipants}`}
          color={COLORS.primary}
        />
        <StatCard
          icon="time"
          label="In Attesa"
          value={pendingRequests.length}
          color={pendingRequests.length > 0 ? COLORS.warning : COLORS.textMuted}
        />
        <StatCard
          icon="wallet"
          label="Budget"
          value={`${selectedLeague.config?.initialBudget || 500}M`}
          color={COLORS.success}
        />
      </View>

      {/* Invite Code */}
      <InviteCodeCard
        inviteCode={inviteCode}
        onCopy={handleCopyInviteCode}
        onShare={handleShareInviteCode}
      />

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Richieste in Attesa ({pendingRequests.length})
          </Text>
          {pendingRequests.map((request) => (
            <PendingRequestCard
              key={request.id}
              request={request}
              onAccept={() => handleAcceptRequest(request.id)}
              onReject={() => handleRejectRequest(request.id)}
              isProcessing={processingId === request.id}
            />
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Azioni</Text>

        {!isLeagueStarted && (
          <ActionButton
            icon="flag"
            label="Avvia Lega"
            onPress={handleStartLeague}
            color={COLORS.success}
            disabled={isStartingMarket || activeMembers < (selectedLeague.config?.minParticipants || 4)}
          />
        )}

        {isLeagueStarted && (
          <ActionButton
            icon="storefront"
            label="Avvia Sessione Mercato"
            onPress={handleStartMarket}
            color={COLORS.primary}
            disabled={isStartingMarket}
          />
        )}

        <ActionButton
          icon="settings"
          label="Impostazioni Lega"
          onPress={() => Alert.alert('Info', 'Funzionalità in arrivo')}
          color={COLORS.textSecondary}
        />
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
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notAdminContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  notAdminTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  notAdminText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.admin}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  adminBadgeText: {
    color: COLORS.admin,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  leagueName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  leagueStatus: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inviteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  inviteCodeContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 4,
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inviteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  inviteButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  inviteButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestAvatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestDetails: {
    marginLeft: 12,
    flex: 1,
  },
  requestUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  requestTeamName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: `${COLORS.success}20`,
  },
  rejectButton: {
    backgroundColor: `${COLORS.error}20`,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: 12,
  },
  actionLabelDisabled: {
    color: COLORS.textMuted,
  },
});

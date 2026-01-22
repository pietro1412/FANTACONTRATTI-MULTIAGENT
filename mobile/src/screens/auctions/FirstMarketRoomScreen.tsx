// =============================================================================
// FirstMarketRoomScreen - Live First Market Auction Room for FantaContratti Mobile
// Phase 2: Turn Order, Ready Check, Nomination Flow
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionsStackParamList } from '@/navigation/AppNavigator';

import { useLeague } from '@/store/LeagueContext';
import { useAuth } from '@/store/AuthContext';
import {
  auctionsApi,
  playersApi,
  adminApi,
  AuctionSession,
  Auction,
  Player,
  FirstMarketStatus,
  ReadyStatus,
  FirstMarketMemberStatus,
  PendingAcknowledgment,
} from '@/services/api';
import {
  pusherService,
  BidPlacedData,
  AuctionClosedData,
  MemberReadyData,
  NominationConfirmedData,
  ConnectionStatus,
} from '@/services/pusher';
import type { AuctionBid, Position } from '@/types';

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

const POSITION_COLORS: Record<Position, string> = {
  P: '#FFA500',
  D: '#4CAF50',
  C: '#2196F3',
  A: '#F44336',
};

const POSITION_LABELS: Record<Position, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
};

const POLLING_INTERVAL_CONNECTED = 10000; // 10 seconds when Pusher is connected (fallback)
const POLLING_INTERVAL_DISCONNECTED = 3000; // 3 seconds when Pusher is disconnected

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<AuctionsStackParamList, 'FirstMarketRoom'>;

interface BidHistoryItem {
  id: string;
  memberId?: string;
  bidderName: string;
  amount: number;
  placedAt: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeFromDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// =============================================================================
// Sub-Components - Common
// =============================================================================

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Caricamento asta...</Text>
    </View>
  );
}

interface SessionHeaderProps {
  session: AuctionSession;
  currentRole: Position | null;
}

function SessionHeader({ session, currentRole }: SessionHeaderProps): React.JSX.Element {
  const roleColor = currentRole ? POSITION_COLORS[currentRole] : COLORS.primary;
  const roleLabel = currentRole ? POSITION_LABELS[currentRole] : 'N/D';

  return (
    <View style={styles.sessionHeader}>
      <View style={styles.sessionHeaderLeft}>
        <Text style={styles.sessionHeaderTitle}>PRIMO MERCATO</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor + '30' }]}>
          <Text style={[styles.roleBadgeText, { color: roleColor }]}>
            {currentRole || '?'} - {roleLabel}
          </Text>
        </View>
      </View>
      <View style={styles.sessionHeaderRight}>
        <Text style={styles.sessionTimerLabel}>Timer Sessione</Text>
        <Text style={styles.sessionTimerValue}>{session.timerSeconds}s</Text>
      </View>
    </View>
  );
}

// =============================================================================
// Sub-Components - Connection Indicator
// =============================================================================

interface ConnectionIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting';
}

function ConnectionIndicator({ status }: ConnectionIndicatorProps): React.JSX.Element {
  const isConnected = status === 'connected';
  const dotColor = isConnected ? COLORS.success : COLORS.warning;
  const text = isConnected ? 'Live' : status === 'connecting' ? 'Connessione...' : 'Riconnessione...';

  return (
    <View style={styles.connectionIndicator}>
      <View style={[styles.connectionDot, { backgroundColor: dotColor }]} />
      <Text style={styles.connectionText}>{text}</Text>
    </View>
  );
}

// =============================================================================
// Sub-Components - Role Progress Bar
// =============================================================================

interface RoleProgressBarProps {
  currentRole: Position;
  roleSequence: string[];
}

function RoleProgressBar({ currentRole, roleSequence }: RoleProgressBarProps): React.JSX.Element {
  const roles: Position[] = ['P', 'D', 'C', 'A'];
  const currentIndex = roles.indexOf(currentRole);

  return (
    <View style={styles.roleProgressContainer}>
      <Text style={styles.roleProgressTitle}>Progresso Ruoli</Text>
      <View style={styles.roleProgressBar}>
        {roles.map((role, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          const color = POSITION_COLORS[role];

          return (
            <React.Fragment key={role}>
              <View
                style={[
                  styles.roleProgressItem,
                  isActive && styles.roleProgressItemActive,
                  isCompleted && { backgroundColor: color + '30' },
                ]}
              >
                <Text
                  style={[
                    styles.roleProgressText,
                    { color: isActive || isCompleted ? color : COLORS.textMuted },
                  ]}
                >
                  {role}
                </Text>
                {isCompleted && (
                  <Ionicons name="checkmark-circle" size={14} color={color} style={styles.roleCheckIcon} />
                )}
              </View>
              {index < roles.length - 1 && (
                <View
                  style={[
                    styles.roleProgressConnector,
                    isCompleted && { backgroundColor: color },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// =============================================================================
// Sub-Components - Turn Order Setup (Admin Only)
// =============================================================================

interface TurnOrderSetupProps {
  memberStatus: FirstMarketMemberStatus[];
  onConfirm: (order: string[]) => void;
  isSubmitting: boolean;
}

function TurnOrderSetup({ memberStatus, onConfirm, isSubmitting }: TurnOrderSetupProps): React.JSX.Element {
  const [order, setOrder] = useState<string[]>(memberStatus.map(m => m.memberId));

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrder(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrder(newOrder);
  };

  const getMemberByid = (id: string) => memberStatus.find(m => m.memberId === id);

  return (
    <View style={styles.turnOrderSetupContainer}>
      <View style={styles.turnOrderHeader}>
        <Ionicons name="list-outline" size={24} color={COLORS.primary} />
        <Text style={styles.turnOrderTitle}>Imposta Ordine Turni</Text>
      </View>
      <Text style={styles.turnOrderSubtitle}>
        Trascina per riordinare i manager. Il primo manager iniziera' a nominare.
      </Text>

      <View style={styles.turnOrderList}>
        {order.map((memberId, index) => {
          const member = getMemberByid(memberId);
          if (!member) return null;

          return (
            <View key={memberId} style={styles.turnOrderItem}>
              <View style={styles.turnOrderPosition}>
                <Text style={styles.turnOrderPositionText}>{index + 1}</Text>
              </View>

              <View style={styles.turnOrderMemberInfo}>
                <Text style={styles.turnOrderMemberName}>{member.username}</Text>
                {member.teamName && (
                  <Text style={styles.turnOrderMemberTeam}>{member.teamName}</Text>
                )}
              </View>

              <View style={styles.turnOrderButtons}>
                <TouchableOpacity
                  style={[styles.turnOrderMoveButton, index === 0 && styles.turnOrderMoveButtonDisabled]}
                  onPress={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <Ionicons name="chevron-up" size={20} color={index === 0 ? COLORS.textMuted : COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.turnOrderMoveButton, index === order.length - 1 && styles.turnOrderMoveButtonDisabled]}
                  onPress={() => moveDown(index)}
                  disabled={index === order.length - 1}
                >
                  <Ionicons name="chevron-down" size={20} color={index === order.length - 1 ? COLORS.textMuted : COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.confirmOrderButton, isSubmitting && styles.confirmOrderButtonDisabled]}
        onPress={() => onConfirm(order)}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={COLORS.text} />
        ) : (
          <>
            <Ionicons name="play-circle" size={20} color={COLORS.text} />
            <Text style={styles.confirmOrderButtonText}>Conferma Ordine e Inizia</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Sub-Components - Waiting for Setup
// =============================================================================

function WaitingForSetup(): React.JSX.Element {
  return (
    <View style={styles.waitingContainer}>
      <View style={styles.waitingIcon}>
        <Ionicons name="time-outline" size={64} color={COLORS.textMuted} />
      </View>
      <Text style={styles.waitingTitle}>In Attesa dell'Admin</Text>
      <Text style={styles.waitingSubtitle}>
        L'admin sta configurando l'ordine dei turni.
        La sessione iniziera' a breve.
      </Text>
      <ActivityIndicator size="small" color={COLORS.primary} style={styles.waitingSpinner} />
    </View>
  );
}

// =============================================================================
// Sub-Components - Turn Banner
// =============================================================================

interface TurnBannerProps {
  isMyTurn: boolean;
  nominatorName: string;
}

function TurnBanner({ isMyTurn, nominatorName }: TurnBannerProps): React.JSX.Element {
  if (isMyTurn) {
    return (
      <View style={styles.turnBannerMyTurn}>
        <Ionicons name="star" size={24} color={COLORS.warning} />
        <Text style={styles.turnBannerMyTurnText}>E' IL TUO TURNO!</Text>
        <Text style={styles.turnBannerMyTurnSubtext}>Seleziona un giocatore da nominare</Text>
      </View>
    );
  }

  return (
    <View style={styles.turnBannerWaiting}>
      <Ionicons name="hourglass-outline" size={20} color={COLORS.textSecondary} />
      <Text style={styles.turnBannerWaitingText}>
        Attendi che <Text style={styles.turnBannerHighlight}>{nominatorName}</Text> nomini...
      </Text>
    </View>
  );
}

// =============================================================================
// Sub-Components - Managers List with Turn Order
// =============================================================================

interface ManagersListProps {
  memberStatus: FirstMarketMemberStatus[];
  turnOrder: string[];
  currentTurnIndex: number;
  currentRole: Position;
}

function ManagersList({ memberStatus, turnOrder, currentTurnIndex, currentRole }: ManagersListProps): React.JSX.Element {
  const getMemberByid = (id: string) => memberStatus.find(m => m.memberId === id);

  return (
    <View style={styles.managersListContainer}>
      <Text style={styles.managersListTitle}>Ordine Turni</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.managersListScroll}>
        {turnOrder.map((memberId, index) => {
          const member = getMemberByid(memberId);
          if (!member) return null;

          const isCurrentTurn = index === currentTurnIndex;
          const roleSlots = member.slotsNeeded[currentRole];
          const filledSlots = member.rosterByRole[currentRole];
          const hasCompletedRole = filledSlots >= roleSlots || member.isCurrentRoleComplete;

          return (
            <View
              key={memberId}
              style={[
                styles.managerCard,
                isCurrentTurn && styles.managerCardActive,
                hasCompletedRole && styles.managerCardCompleted,
              ]}
            >
              <View style={styles.managerTurnNumber}>
                <Text style={styles.managerTurnNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.managerCardName} numberOfLines={1}>
                {member.username}
              </Text>
              <View style={styles.managerSlotsInfo}>
                <Text style={styles.managerSlotsText}>
                  {currentRole}: {filledSlots}/{roleSlots}
                </Text>
              </View>
              {hasCompletedRole && (
                <View style={styles.managerCompletedBadge}>
                  <Ionicons name="checkmark" size={12} color={COLORS.success} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Sub-Components - Nomination Panel (Player Selection)
// =============================================================================

interface NominationPanelProps {
  currentRole: Position;
  leagueId: string;
  onNominate: (player: Player) => void;
  isNominating: boolean;
}

function NominationPanel({ currentRole, leagueId, onNominate, isNominating }: NominationPanelProps): React.JSX.Element {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);

  useEffect(() => {
    const loadPlayers = async () => {
      setIsLoadingPlayers(true);
      try {
        const response = await playersApi.getAll({
          position: currentRole,
          available: true,
          leagueId: leagueId,
        });
        if (response.success && response.data) {
          setPlayers(response.data);
          setFilteredPlayers(response.data);
        }
      } catch (err) {
        console.error('[NominationPanel] Error loading players:', err);
      } finally {
        setIsLoadingPlayers(false);
      }
    };
    loadPlayers();
  }, [currentRole, leagueId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPlayers(players);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredPlayers(
        players.filter(
          p => p.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, players]);

  const roleColor = POSITION_COLORS[currentRole];

  const renderPlayer = ({ item }: { item: Player }) => (
    <TouchableOpacity
      style={[styles.playerSelectItem, isNominating && styles.playerSelectItemDisabled]}
      onPress={() => onNominate(item)}
      disabled={isNominating}
      activeOpacity={0.7}
    >
      <View style={[styles.playerSelectPosition, { backgroundColor: roleColor }]}>
        <Text style={styles.playerSelectPositionText}>{item.position}</Text>
      </View>
      <View style={styles.playerSelectInfo}>
        <Text style={styles.playerSelectName}>{item.name}</Text>
        <Text style={styles.playerSelectTeam}>{item.team}</Text>
      </View>
      <View style={styles.playerSelectQuotation}>
        <Text style={styles.playerSelectQuotationLabel}>Quot.</Text>
        <Text style={styles.playerSelectQuotationValue}>{item.quotation}</Text>
      </View>
      <View style={styles.nominateButton}>
        <Text style={styles.nominateButtonText}>NOMINA</Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoadingPlayers) {
    return (
      <View style={styles.nominationPanelContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Caricamento giocatori...</Text>
      </View>
    );
  }

  return (
    <View style={styles.nominationPanelContainer}>
      {/* Banner "È IL TUO TURNO" */}
      <View style={styles.yourTurnBanner}>
        <Ionicons name="hand-right" size={24} color="#FFFFFF" />
        <Text style={styles.yourTurnText}>È IL TUO TURNO!</Text>
      </View>

      <Text style={styles.nominationPanelTitle}>
        Seleziona un {POSITION_LABELS[currentRole]}
      </Text>
      <Text style={styles.nominationPanelSubtitle}>
        Tocca un giocatore per nominarlo all'asta
      </Text>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cerca giocatore o squadra..."
          placeholderTextColor={COLORS.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredPlayers}
        renderItem={renderPlayer}
        keyExtractor={(item) => item.id}
        style={styles.playersList}
        contentContainerStyle={styles.playersListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.noPlayersText}>Nessun giocatore disponibile</Text>
        }
      />
    </View>
  );
}

// =============================================================================
// Sub-Components - Ready Check Panel
// =============================================================================

interface ReadyCheckPanelProps {
  readyStatus: ReadyStatus;
  onMarkReady: () => void;
  onConfirmNomination?: () => void;
  onCancelNomination?: () => void;
  isMarkingReady: boolean;
  isConfirming: boolean;
}

function ReadyCheckPanel({
  readyStatus,
  onMarkReady,
  onConfirmNomination,
  onCancelNomination,
  isMarkingReady,
  isConfirming,
}: ReadyCheckPanelProps): React.JSX.Element {
  const player = readyStatus.player;
  const positionColor = player?.position ? POSITION_COLORS[player.position as Position] : COLORS.primary;
  const readyCount = readyStatus.readyCount;
  const totalMembers = readyStatus.totalMembers;
  const progressPercent = totalMembers > 0 ? (readyCount / totalMembers) * 100 : 0;
  // Null safety for member arrays
  const readyMembers = readyStatus.readyMembers || [];
  const statusPendingMembers = readyStatus.pendingMembers || [];

  return (
    <View style={styles.readyCheckContainer}>
      {/* Nominated Player Card */}
      {player && (
        <View style={styles.nominatedPlayerCard}>
          <Text style={styles.nominatedPlayerLabel}>GIOCATORE NOMINATO</Text>
          <View style={styles.nominatedPlayerInfo}>
            <View style={[styles.nominatedPlayerPosition, { backgroundColor: positionColor }]}>
              <Text style={styles.nominatedPlayerPositionText}>{player.position}</Text>
            </View>
            <View style={styles.nominatedPlayerDetails}>
              <Text style={styles.nominatedPlayerName}>{player.name}</Text>
              <Text style={styles.nominatedPlayerTeam}>{player.team}</Text>
            </View>
            <View style={styles.nominatedPlayerQuotation}>
              <Text style={styles.nominatedPlayerQuotationLabel}>Quot.</Text>
              <Text style={styles.nominatedPlayerQuotationValue}>{player.quotation}</Text>
            </View>
          </View>
          <Text style={styles.nominatorText}>
            Nominato da: <Text style={styles.nominatorName}>{readyStatus.nominatorUsername}</Text>
          </Text>
        </View>
      )}

      {/* Ready Progress */}
      <View style={styles.readyProgressSection}>
        <View style={styles.readyProgressHeader}>
          <Text style={styles.readyProgressTitle}>Pronti per l'asta</Text>
          <Text style={styles.readyProgressCount}>{readyCount}/{totalMembers}</Text>
        </View>
        <View style={styles.readyProgressBarBg}>
          <View style={[styles.readyProgressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Ready Members List */}
      <View style={styles.readyMembersList}>
        <View style={styles.readyMembersRow}>
          {readyMembers.map((member) => (
            <View key={member.id} style={styles.readyMemberBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={styles.readyMemberName}>{member.username}</Text>
            </View>
          ))}
          {statusPendingMembers.map((member) => (
            <View key={member.id} style={[styles.readyMemberBadge, styles.pendingMemberBadge]}>
              <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
              <Text style={[styles.readyMemberName, styles.pendingMemberName]}>{member.username}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      {readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
        <View style={styles.nominatorActions}>
          <TouchableOpacity
            style={styles.cancelNominationButton}
            onPress={onCancelNomination}
            disabled={isConfirming}
          >
            <Ionicons name="close" size={20} color={COLORS.error} />
            <Text style={styles.cancelNominationText}>Annulla</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmNominationButton, isConfirming && styles.buttonDisabled]}
            onPress={onConfirmNomination}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={COLORS.text} />
                <Text style={styles.confirmNominationText}>Conferma Nomina</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!readyStatus.userIsNominator && !readyStatus.userIsReady && readyStatus.nominatorConfirmed && (
        <TouchableOpacity
          style={[styles.readyButton, isMarkingReady && styles.buttonDisabled]}
          onPress={onMarkReady}
          disabled={isMarkingReady}
        >
          {isMarkingReady ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="hand-left" size={24} color={COLORS.text} />
              <Text style={styles.readyButtonText}>SONO PRONTO</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {readyStatus.userIsReady && !readyStatus.userIsNominator && (
        <View style={styles.alreadyReadyBadge}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
          <Text style={styles.alreadyReadyText}>Sei pronto! In attesa degli altri...</Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Sub-Components - Pending Acknowledgment Panel
// =============================================================================

interface PendingAcknowledgmentPanelProps {
  pendingAck: PendingAcknowledgment;
  prophecy: string;
  onProphecyChange: (text: string) => void;
  onAcknowledge: () => void;
  isAcknowledging: boolean;
  hasAcknowledged: boolean;
  currentUserId: string | undefined;
}

function PendingAcknowledgmentPanel({
  pendingAck,
  prophecy,
  onProphecyChange,
  onAcknowledge,
  isAcknowledging,
  hasAcknowledged,
  currentUserId,
}: PendingAcknowledgmentPanelProps): React.JSX.Element {
  // Null safety for arrays
  const acknowledgedMembers = pendingAck.acknowledgedMembers || [];
  const pendingMembers = pendingAck.pendingMembers || [];
  const totalMembers = acknowledgedMembers.length + pendingMembers.length;
  const progress = totalMembers > 0 ? acknowledgedMembers.length / totalMembers : 0;
  const positionColor = pendingAck.player?.position
    ? POSITION_COLORS[pendingAck.player.position as Position]
    : COLORS.primary;

  return (
    <View style={styles.ackPanel}>
      <Text style={styles.ackTitle}>Conferma Risultato</Text>

      {/* Risultato asta */}
      <View style={styles.ackResultCard}>
        {pendingAck.wasUnsold ? (
          <View style={styles.ackUnsoldContainer}>
            <Ionicons name="close-circle-outline" size={48} color={COLORS.warning} />
            <Text style={styles.ackUnsoldText}>Giocatore invenduto</Text>
            <View style={styles.ackPlayerInfo}>
              <View style={[styles.ackPlayerPosition, { backgroundColor: positionColor }]}>
                <Text style={styles.ackPlayerPositionText}>{pendingAck.player.position}</Text>
              </View>
              <View style={styles.ackPlayerDetails}>
                <Text style={styles.ackPlayerName}>{pendingAck.player.name}</Text>
                <Text style={styles.ackPlayerTeam}>{pendingAck.player.team}</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.ackPlayerInfo}>
              <View style={[styles.ackPlayerPosition, { backgroundColor: positionColor }]}>
                <Text style={styles.ackPlayerPositionText}>{pendingAck.player.position}</Text>
              </View>
              <View style={styles.ackPlayerDetails}>
                <Text style={styles.ackPlayerName}>{pendingAck.player.name}</Text>
                <Text style={styles.ackPlayerTeam}>{pendingAck.player.team}</Text>
              </View>
              <View style={styles.ackPriceContainer}>
                <Text style={styles.ackPriceLabel}>Prezzo</Text>
                <Text style={styles.ackPriceValue}>{pendingAck.finalPrice}M</Text>
              </View>
            </View>
            <View style={styles.ackWinnerSection}>
              <Ionicons name="trophy" size={20} color={COLORS.warning} />
              <Text style={styles.ackWinnerText}>
                Vinto da: <Text style={styles.ackWinnerName}>{pendingAck.winner?.username}</Text>
                {pendingAck.winner?.teamName && (
                  <Text style={styles.ackWinnerTeam}> ({pendingAck.winner.teamName})</Text>
                )}
              </Text>
            </View>
            {pendingAck.contractInfo && (
              <View style={styles.ackContractInfo}>
                <Text style={styles.ackContractTitle}>Dettagli Contratto</Text>
                <View style={styles.ackContractRow}>
                  <View style={styles.ackContractItem}>
                    <Text style={styles.ackContractLabel}>Stipendio</Text>
                    <Text style={styles.ackContractValue}>{pendingAck.contractInfo.salary}M/sem</Text>
                  </View>
                  <View style={styles.ackContractItem}>
                    <Text style={styles.ackContractLabel}>Durata</Text>
                    <Text style={styles.ackContractValue}>{pendingAck.contractInfo.duration} sem</Text>
                  </View>
                  <View style={styles.ackContractItem}>
                    <Text style={styles.ackContractLabel}>Clausola</Text>
                    <Text style={styles.ackContractValue}>{pendingAck.contractInfo.rescissionClause}M</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* Progress */}
      <View style={styles.ackProgressSection}>
        <View style={styles.ackProgressHeader}>
          <Text style={styles.ackProgressTitle}>Conferme</Text>
          <Text style={styles.ackProgressCount}>
            {acknowledgedMembers.length}/{totalMembers}
          </Text>
        </View>
        <View style={styles.ackProgressBarBg}>
          <View style={[styles.ackProgressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {/* Lista confermati/non confermati */}
      <View style={styles.ackMemberLists}>
        {acknowledgedMembers.map((m) => (
          <View key={m.id} style={styles.ackMemberRow}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={styles.ackMemberNameConfirmed}>{m.username}</Text>
          </View>
        ))}
        {pendingMembers.map((m) => (
          <View key={m.id} style={styles.ackMemberRow}>
            <Ionicons name="time-outline" size={18} color={COLORS.warning} />
            <Text style={styles.ackMemberNamePending}>{m.username}</Text>
          </View>
        ))}
      </View>

      {/* Input profezia (opzionale) - only for winner */}
      {!hasAcknowledged && pendingAck.winner?.id === currentUserId && (
        <View style={styles.ackProphecySection}>
          <Text style={styles.ackProphecyLabel}>Profezia sul giocatore (opzionale)</Text>
          <TextInput
            style={styles.ackProphecyInput}
            placeholder="Scrivi una profezia..."
            placeholderTextColor={COLORS.textMuted}
            value={prophecy}
            onChangeText={onProphecyChange}
            multiline
            numberOfLines={3}
          />
        </View>
      )}

      {/* Confirm Button */}
      {!hasAcknowledged && (
        <TouchableOpacity
          style={[styles.ackButton, isAcknowledging && styles.buttonDisabled]}
          onPress={onAcknowledge}
          disabled={isAcknowledging}
        >
          {isAcknowledging ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={24} color={COLORS.text} />
              <Text style={styles.ackButtonText}>CONFERMO</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {hasAcknowledged && (
        <View style={styles.ackConfirmedBanner}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
          <Text style={styles.ackConfirmedText}>Hai confermato! In attesa degli altri...</Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Sub-Components - Admin Controls Panel
// =============================================================================

interface AdminControlsPanelProps {
  session: AuctionSession;
  currentAuction: Auction | null;
  pendingAck: PendingAcknowledgment | null;
  onCloseAuction: () => void;
  onAdvanceTurn: () => void;
  onAdvanceRole: () => void;
  onForceAcknowledge: () => void;
  // Test utilities
  onForceAllReady: () => void;
  onBotNominate: () => void;
  onBotConfirmNomination: () => void;
  onBotBid: () => void;
  isLoading: boolean;
}

function AdminControlsPanel({
  session,
  currentAuction,
  pendingAck,
  onCloseAuction,
  onAdvanceTurn,
  onAdvanceRole,
  onForceAcknowledge,
  onForceAllReady,
  onBotNominate,
  onBotConfirmNomination,
  onBotBid,
  isLoading,
}: AdminControlsPanelProps): React.JSX.Element {
  return (
    <View style={styles.adminPanel}>
      <View style={styles.adminHeader}>
        <Ionicons name="shield" size={20} color={COLORS.warning} />
        <Text style={styles.adminTitle}>Controlli Admin</Text>
      </View>

      <View style={styles.adminButtons}>
        {currentAuction && (
          <TouchableOpacity
            style={[styles.adminButton, styles.dangerButton]}
            onPress={onCloseAuction}
            disabled={isLoading}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.error} />
            <Text style={styles.adminButtonText}>Chiudi Asta</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.adminButton, (isLoading || !!currentAuction) && styles.adminButtonDisabled]}
          onPress={onAdvanceTurn}
          disabled={isLoading || !!currentAuction}
        >
          <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
          <Text style={styles.adminButtonText}>Avanza Turno</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.adminButton, (isLoading || !!currentAuction) && styles.adminButtonDisabled]}
          onPress={onAdvanceRole}
          disabled={isLoading || !!currentAuction}
        >
          <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
          <Text style={styles.adminButtonText}>Avanza Ruolo</Text>
        </TouchableOpacity>

        {pendingAck && (
          <TouchableOpacity
            style={[styles.adminButton, styles.warningButton]}
            onPress={onForceAcknowledge}
            disabled={isLoading}
          >
            <Ionicons name="flash" size={18} color={COLORS.warning} />
            <Text style={styles.adminButtonText}>Forza Conferme</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Test Utilities Section */}
      <View style={styles.testUtilitiesSection}>
        <View style={styles.testUtilitiesHeader}>
          <Ionicons name="construct" size={16} color={COLORS.info} />
          <Text style={styles.testUtilitiesTitle}>Test Utilities</Text>
        </View>

        <View style={styles.adminButtons}>
          <TouchableOpacity
            style={[styles.adminButton, styles.testButton, isLoading && styles.adminButtonDisabled]}
            onPress={onBotNominate}
            disabled={isLoading}
          >
            <Text style={styles.testButtonEmoji}>🎯</Text>
            <Text style={styles.testButtonText}>Simula Scelta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminButton, styles.testButton, isLoading && styles.adminButtonDisabled]}
            onPress={onBotConfirmNomination}
            disabled={isLoading}
          >
            <Text style={styles.testButtonEmoji}>✅</Text>
            <Text style={styles.testButtonText}>Conferma Scelta</Text>
          </TouchableOpacity>

          {currentAuction && (
            <TouchableOpacity
              style={[styles.adminButton, styles.testButton, isLoading && styles.adminButtonDisabled]}
              onPress={onBotBid}
              disabled={isLoading}
            >
              <Text style={styles.testButtonEmoji}>💰</Text>
              <Text style={styles.testButtonText}>Simula Offerta</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.adminButton, styles.testButton, isLoading && styles.adminButtonDisabled]}
            onPress={onForceAllReady}
            disabled={isLoading}
          >
            <Ionicons name="people" size={18} color={COLORS.success} />
            <Text style={styles.testButtonText}>Forza Tutti Pronti</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Sub-Components - Active Auction UI
// =============================================================================

interface PlayerCardProps {
  auction: Auction;
  countdown: number;
  isWinning: boolean;
  currentBidderName: string | null;
}

function PlayerCard({ auction, countdown, isWinning, currentBidderName }: PlayerCardProps): React.JSX.Element {
  const player = auction.player;
  const positionColor = player?.position ? POSITION_COLORS[player.position as Position] : COLORS.primary;
  const isLowTime = countdown <= 10;

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerCardHeader}>
        <Text style={styles.playerCardTitle}>GIOCATORE IN ASTA</Text>
        {isWinning && (
          <View style={styles.winningBadge}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.winningBadgeText}>Stai vincendo!</Text>
          </View>
        )}
      </View>

      <View style={styles.playerInfo}>
        <View style={[styles.positionBadge, { backgroundColor: positionColor }]}>
          <Text style={styles.positionBadgeText}>{player?.position || '?'}</Text>
        </View>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{player?.name || 'Sconosciuto'}</Text>
          <Text style={styles.playerTeam}>{player?.team || 'N/D'}</Text>
        </View>
        <View style={styles.quotationContainer}>
          <Text style={styles.quotationLabel}>Quot.</Text>
          <Text style={styles.quotationValue}>{player?.quotation || 0}</Text>
        </View>
      </View>

      <View style={styles.bidInfoContainer}>
        <View style={styles.currentBidSection}>
          <Text style={styles.currentBidLabel}>OFFERTA ATTUALE</Text>
          <Text style={styles.currentBidValue}>{auction.currentBid || auction.basePrice}M</Text>
          {currentBidderName && (
            <Text style={styles.currentBidder}>Miglior offerente: {currentBidderName}</Text>
          )}
        </View>

        <View style={[styles.timerSection, isLowTime && styles.timerSectionWarning]}>
          <Ionicons
            name="timer-outline"
            size={24}
            color={isLowTime ? COLORS.error : COLORS.text}
          />
          <Text style={[styles.timerValue, isLowTime && styles.timerValueWarning]}>
            {formatTime(countdown)}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface BidControlsProps {
  currentBid: number;
  userBudget: number;
  bidAmount: number;
  onBidAmountChange: (amount: number) => void;
  onQuickBid: (increment: number) => void;
  onPlaceBid: () => void;
  isBidding: boolean;
  isWinning: boolean;
}

function BidControls({
  currentBid,
  userBudget,
  bidAmount,
  onBidAmountChange,
  onQuickBid,
  onPlaceBid,
  isBidding,
  isWinning,
}: BidControlsProps): React.JSX.Element {
  const canBid = bidAmount > currentBid && bidAmount <= userBudget && !isBidding;

  return (
    <View style={styles.bidControlsContainer}>
      <View style={styles.budgetInfo}>
        <Ionicons name="wallet-outline" size={20} color={COLORS.success} />
        <Text style={styles.budgetLabel}>Il tuo budget:</Text>
        <Text style={styles.budgetValue}>{userBudget}M</Text>
      </View>

      <View style={styles.quickBidsRow}>
        <TouchableOpacity
          style={styles.quickBidButton}
          onPress={() => onQuickBid(1)}
          disabled={isBidding}
        >
          <Text style={styles.quickBidButtonText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBidButton}
          onPress={() => onQuickBid(5)}
          disabled={isBidding}
        >
          <Text style={styles.quickBidButtonText}>+5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBidButton}
          onPress={() => onQuickBid(10)}
          disabled={isBidding}
        >
          <Text style={styles.quickBidButtonText}>+10</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.customBidInput}
          value={bidAmount > 0 ? bidAmount.toString() : ''}
          onChangeText={(text) => {
            const num = parseInt(text, 10);
            onBidAmountChange(isNaN(num) ? 0 : num);
          }}
          keyboardType="numeric"
          placeholder="Offerta"
          placeholderTextColor={COLORS.textMuted}
          editable={!isBidding}
        />

        <TouchableOpacity
          style={[
            styles.placeBidButton,
            !canBid && styles.placeBidButtonDisabled,
            isWinning && styles.placeBidButtonWinning,
          ]}
          onPress={onPlaceBid}
          disabled={!canBid}
        >
          {isBidding ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.placeBidButtonText}>OFFRI</Text>
          )}
        </TouchableOpacity>
      </View>

      {!canBid && bidAmount > 0 && (
        <Text style={styles.bidErrorText}>
          {bidAmount <= currentBid
            ? 'L\'offerta deve essere maggiore dell\'offerta attuale'
            : bidAmount > userBudget
            ? 'Budget insufficiente'
            : ''}
        </Text>
      )}
    </View>
  );
}

interface BidHistoryProps {
  bids: BidHistoryItem[];
}

function BidHistory({ bids }: BidHistoryProps): React.JSX.Element {
  if (bids.length === 0) {
    return (
      <View style={styles.bidHistoryContainer}>
        <Text style={styles.bidHistoryTitle}>Ultimi Bid</Text>
        <Text style={styles.noBidsText}>Nessuna offerta ancora</Text>
      </View>
    );
  }

  return (
    <View style={styles.bidHistoryContainer}>
      <Text style={styles.bidHistoryTitle}>Ultimi Bid</Text>
      {bids.slice(0, 5).map((bid) => (
        <View key={bid.id} style={styles.bidHistoryItem}>
          <View style={styles.bidHistoryDot} />
          <Text style={styles.bidHistoryName}>{bid.bidderName}:</Text>
          <Text style={styles.bidHistoryAmount}>{bid.amount}M</Text>
          <Text style={styles.bidHistoryTime}>({formatTimeFromDate(bid.placedAt)})</Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function FirstMarketRoomScreen({ route, navigation }: Props): React.JSX.Element {
  const { leagueId } = route.params;
  const { selectedLeague, selectedMember } = useLeague();
  const { user } = useAuth();

  // Session & Auction State
  const [session, setSession] = useState<AuctionSession | null>(null);
  const [currentAuction, setCurrentAuction] = useState<Auction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pusher Connection State
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // First Market State
  const [firstMarketStatus, setFirstMarketStatus] = useState<FirstMarketStatus | null>(null);
  const [readyStatus, setReadyStatus] = useState<ReadyStatus | null>(null);

  // Bidding State
  const [bidAmount, setBidAmount] = useState(0);
  const [isBidding, setIsBidding] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [bidHistory, setBidHistory] = useState<BidHistoryItem[]>([]);

  // Action States
  const [isSettingTurnOrder, setIsSettingTurnOrder] = useState(false);
  const [isNominating, setIsNominating] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [isConfirmingNomination, setIsConfirmingNomination] = useState(false);
  const [isAdminAction, setIsAdminAction] = useState(false);

  // Pending Acknowledgment States
  const [pendingAck, setPendingAck] = useState<PendingAcknowledgment | null>(null);
  const [prophecy, setProphecy] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Derived values
  const effectiveLeagueId = leagueId || selectedLeague?.id || '';
  const userBudget = selectedMember?.currentBudget ?? selectedMember?.budget ?? 0;
  const currentBid = currentAuction?.currentBid || currentAuction?.basePrice || 0;
  const currentRole = firstMarketStatus?.currentRole || (session as any)?.currentRole || null;
  const isAdmin = selectedMember?.role === 'ADMIN';
  const hasTurnOrder = firstMarketStatus?.turnOrder && firstMarketStatus.turnOrder.length > 0;
  const isMyTurn = firstMarketStatus?.isUserTurn ?? false;

  // Check if current user is winning
  const isWinning = currentAuction?.currentBidderId === selectedMember?.id;

  // Get current bidder name
  const currentBidderName = currentAuction?.currentBidder?.teamName
    || currentAuction?.currentBidder?.user?.username
    || null;

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchAuctionData = useCallback(async (showLoader: boolean = true) => {
    console.log('[FirstMarketRoomScreen] fetchAuctionData called', { showLoader, effectiveLeagueId });
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      console.log('[FirstMarketRoomScreen] Calling getCurrentAuction...');
      const response = await auctionsApi.getCurrentAuction(effectiveLeagueId);
      console.log('[FirstMarketRoomScreen] getCurrentAuction response:', {
        success: response.success,
        hasData: !!response.data,
        isFirstMarket: response.data?.isFirstMarket,
        sessionId: response.data?.id,
        sessionStatus: response.data?.status,
        message: response.message,
      });

      if (response.success && response.data && response.data.isFirstMarket) {
        setSession(response.data);
        const auction = response.data.currentAuction;
        setCurrentAuction(auction || null);

        // Fetch first market status
        console.log('[FirstMarketRoomScreen] Calling getFirstMarketStatus...');
        const statusResponse = await auctionsApi.getFirstMarketStatus(response.data.id);
        console.log('[FirstMarketRoomScreen] getFirstMarketStatus response:', {
          success: statusResponse.success,
          isUserTurn: statusResponse.data?.isUserTurn,
          currentRole: statusResponse.data?.currentRole,
          currentTurnIndex: statusResponse.data?.currentTurnIndex,
          turnOrderLength: statusResponse.data?.turnOrder?.length,
          pendingNomination: statusResponse.data?.pendingNomination,
          hasMemberStatus: !!statusResponse.data?.memberStatus,
        });
        if (statusResponse.success && statusResponse.data) {
          setFirstMarketStatus(statusResponse.data);
        }

        // Fetch ready status
        console.log('[FirstMarketRoomScreen] Calling getReadyStatus...');
        const readyResponse = await auctionsApi.getReadyStatus(response.data.id);
        console.log('[FirstMarketRoomScreen] getReadyStatus response:', {
          success: readyResponse.success,
          allReady: readyResponse.data?.allReady,
          hasPendingNomination: readyResponse.data?.hasPendingNomination,
          userIsReady: readyResponse.data?.userIsReady,
          userIsNominator: readyResponse.data?.userIsNominator,
          readyMembersCount: readyResponse.data?.readyMembers?.length,
          pendingMembersCount: readyResponse.data?.pendingMembers?.length,
        });
        if (readyResponse.success && readyResponse.data) {
          setReadyStatus(readyResponse.data);
        }

        // Check for pending acknowledgment when no active auction
        if (!auction) {
          const ackResponse = await auctionsApi.getPendingAcknowledgment(response.data.id);
          // Only set pendingAck if we have valid data with required arrays
          if (ackResponse.success && ackResponse.data && ackResponse.data.auctionId) {
            setPendingAck(ackResponse.data);
            // Check if current user has already acknowledged (with null safety)
            const acknowledgedMembers = ackResponse.data.acknowledgedMembers || [];
            const alreadyAcked = acknowledgedMembers.some(
              (m) => m.id === selectedMember?.id
            );
            setHasAcknowledged(alreadyAcked);
          } else {
            setPendingAck(null);
            setHasAcknowledged(false);
          }
        } else {
          // Clear pending acknowledgment when there's an active auction
          setPendingAck(null);
          setHasAcknowledged(false);
        }

        if (auction) {
          // Calculate countdown from timerExpiresAt
          if (auction.timerExpiresAt) {
            const expiresAt = new Date(auction.timerExpiresAt).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            setCountdown(remaining);
          } else if (auction.timerSeconds) {
            setCountdown(auction.timerSeconds);
          }

          // Update bid history from auction bids
          if (auction.bids && Array.isArray(auction.bids)) {
            const history: BidHistoryItem[] = auction.bids
              .filter((bid: AuctionBid) => !bid.isCancelled)
              .sort((a: AuctionBid, b: AuctionBid) =>
                new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
              )
              .map((bid: AuctionBid) => ({
                id: bid.id,
                bidderName: bid.bidder?.teamName || bid.user?.username || 'Anonimo',
                amount: bid.amount,
                placedAt: bid.placedAt,
              }));
            setBidHistory(history);
          }

          // Set initial bid amount if not set
          if (bidAmount === 0) {
            setBidAmount((auction.currentBid || auction.basePrice || 0) + 1);
          }
        }
      } else {
        setSession(null);
        setCurrentAuction(null);
        setFirstMarketStatus(null);
        setReadyStatus(null);
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error fetching auction:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [effectiveLeagueId, bidAmount]);

  // =============================================================================
  // Pusher Initialization Effect
  // =============================================================================

  useEffect(() => {
    // Initialize Pusher service
    pusherService.initialize();

    // Set initial connection status
    const initialStatus = pusherService.getConnectionStatus();
    setConnectionStatus(
      initialStatus === 'connected' ? 'connected' :
      initialStatus === 'connecting' ? 'connecting' : 'disconnected'
    );

    // Listen for connection status changes
    const removeListener = pusherService.addConnectionListener((status: ConnectionStatus) => {
      setConnectionStatus(
        status === 'connected' ? 'connected' :
        status === 'connecting' ? 'connecting' : 'disconnected'
      );
    });

    return () => {
      removeListener();
    };
  }, []);

  // =============================================================================
  // Pusher Subscription Effect
  // =============================================================================

  useEffect(() => {
    if (!session?.id) return;

    console.log('[FirstMarketRoomScreen] Setting up Pusher subscription for session:', session.id);

    // Subscribe to auction channel
    const unsubscribe = pusherService.subscribeToAuction(session.id, {
      onBidPlaced: (data: BidPlacedData) => {
        console.log('[Pusher] Bid placed:', data);

        // Optimistically update current auction
        setCurrentAuction(prev => prev ? {
          ...prev,
          currentBid: data.amount,
          currentBidderId: data.memberId,
          currentBidder: {
            id: data.memberId,
            teamName: data.memberName,
            user: { username: data.memberName }
          } as any
        } : null);

        // Update bid history
        setBidHistory(prev => [{
          id: Date.now().toString(),
          memberId: data.memberId,
          bidderName: data.memberName,
          amount: data.amount,
          placedAt: data.timestamp,
        }, ...prev.slice(0, 9)]);

        // Update bid amount suggestion
        setBidAmount(data.amount + 1);
      },

      onNominationConfirmed: (data: NominationConfirmedData) => {
        console.log('[Pusher] Nomination confirmed:', data);
        // Refresh session data to get the new auction
        fetchAuctionData(false);
      },

      onMemberReady: (data: MemberReadyData) => {
        console.log('[Pusher] Member ready:', data);

        // Optimistically update ready status
        setReadyStatus(prev => {
          if (!prev) return null;

          // Update ready count
          const newReadyCount = data.readyCount;

          // Find member and move between lists
          const member = prev.pendingMembers.find(m => m.id === data.memberId) ||
                        prev.readyMembers.find(m => m.id === data.memberId);

          if (!member) {
            // Member not found, just update count
            return {
              ...prev,
              readyCount: newReadyCount,
            };
          }

          if (data.isReady) {
            // Move from pending to ready
            return {
              ...prev,
              readyCount: newReadyCount,
              readyMembers: prev.readyMembers.some(m => m.id === data.memberId)
                ? prev.readyMembers
                : [...prev.readyMembers, member],
              pendingMembers: prev.pendingMembers.filter(m => m.id !== data.memberId),
            };
          } else {
            // Move from ready to pending
            return {
              ...prev,
              readyCount: newReadyCount,
              readyMembers: prev.readyMembers.filter(m => m.id !== data.memberId),
              pendingMembers: prev.pendingMembers.some(m => m.id === data.memberId)
                ? prev.pendingMembers
                : [...prev.pendingMembers, member],
            };
          }
        });
      },

      onAuctionClosed: (data: AuctionClosedData) => {
        console.log('[Pusher] Auction closed:', data);
        // Refresh session data to get the new state
        fetchAuctionData(false);
      },
    });

    return () => {
      console.log('[FirstMarketRoomScreen] Cleaning up Pusher subscription');
      unsubscribe();
    };
  }, [session?.id, fetchAuctionData]);

  // =============================================================================
  // Polling Effect (Fallback)
  // =============================================================================

  useEffect(() => {
    fetchAuctionData();

    // Use shorter polling interval when Pusher is disconnected
    const pollingInterval = connectionStatus === 'connected'
      ? POLLING_INTERVAL_CONNECTED
      : POLLING_INTERVAL_DISCONNECTED;

    pollingIntervalRef.current = setInterval(() => {
      fetchAuctionData(false);
    }, pollingInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchAuctionData, connectionStatus]);

  // =============================================================================
  // Countdown Timer Effect
  // =============================================================================

  useEffect(() => {
    if (countdown > 0 && currentAuction) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [currentAuction?.id]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAuctionData(false);
  }, [fetchAuctionData]);

  const handleSetTurnOrder = useCallback(async (memberOrder: string[]) => {
    if (!session) return;

    setIsSettingTurnOrder(true);
    try {
      const response = await adminApi.setTurnOrder(session.id, memberOrder);
      if (response.success) {
        await fetchAuctionData(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile impostare l\'ordine dei turni');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error setting turn order:', err);
      Alert.alert('Errore', 'Si e\' verificato un errore');
    } finally {
      setIsSettingTurnOrder(false);
    }
  }, [session, fetchAuctionData]);

  const handleNominate = useCallback(async (player: Player) => {
    console.log('[FirstMarketRoomScreen] handleNominate called', {
      sessionId: session?.id,
      playerId: player.id,
      playerName: player.name,
      playerPosition: player.position,
    });
    if (!session) {
      console.warn('[FirstMarketRoomScreen] handleNominate: no session!');
      return;
    }

    setIsNominating(true);
    try {
      console.log('[FirstMarketRoomScreen] Calling setPendingNomination...');
      const response = await auctionsApi.setPendingNomination(session.id, player.id);
      console.log('[FirstMarketRoomScreen] setPendingNomination response:', response);
      if (response.success) {
        await fetchAuctionData(false);
      } else {
        console.warn('[FirstMarketRoomScreen] setPendingNomination failed:', response.message);
        Alert.alert('Errore', response.message || 'Impossibile nominare il giocatore');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error nominating player:', err);
      Alert.alert('Errore', 'Si e\' verificato un errore');
    } finally {
      setIsNominating(false);
    }
  }, [session, fetchAuctionData]);

  const handleConfirmNomination = useCallback(async () => {
    console.log('[FirstMarketRoomScreen] handleConfirmNomination called', { sessionId: session?.id });
    if (!session) {
      console.warn('[FirstMarketRoomScreen] handleConfirmNomination: no session!');
      return;
    }

    setIsConfirmingNomination(true);
    try {
      console.log('[FirstMarketRoomScreen] Calling confirmNomination...');
      const response = await auctionsApi.confirmNomination(session.id);
      console.log('[FirstMarketRoomScreen] confirmNomination response:', response);
      if (response.success) {
        await fetchAuctionData(false);
      } else {
        console.warn('[FirstMarketRoomScreen] confirmNomination failed:', response.message);
        Alert.alert('Errore', response.message || 'Impossibile confermare la nomina');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error confirming nomination:', err);
      Alert.alert('Errore', 'Si e\' verificato un errore');
    } finally {
      setIsConfirmingNomination(false);
    }
  }, [session, fetchAuctionData]);

  const handleCancelNomination = useCallback(async () => {
    if (!session) return;

    try {
      const response = await auctionsApi.cancelNomination(session.id);
      if (response.success) {
        await fetchAuctionData(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile annullare la nomina');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error canceling nomination:', err);
      Alert.alert('Errore', 'Si e\' verificato un errore');
    }
  }, [session, fetchAuctionData]);

  const handleMarkReady = useCallback(async () => {
    console.log('[FirstMarketRoomScreen] handleMarkReady called', { sessionId: session?.id });
    if (!session) {
      console.warn('[FirstMarketRoomScreen] handleMarkReady: no session!');
      return;
    }

    setIsMarkingReady(true);
    try {
      console.log('[FirstMarketRoomScreen] Calling markReady...');
      const response = await auctionsApi.markReady(session.id);
      console.log('[FirstMarketRoomScreen] markReady response:', response);
      if (response.success) {
        await fetchAuctionData(false);
      } else {
        console.warn('[FirstMarketRoomScreen] markReady failed:', response.message);
        Alert.alert('Errore', response.message || 'Impossibile confermare la prontezza');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error marking ready:', err);
      Alert.alert('Errore', 'Si e\' verificato un errore');
    } finally {
      setIsMarkingReady(false);
    }
  }, [session, fetchAuctionData]);

  const handleAcknowledge = useCallback(async () => {
    if (!pendingAck) return;

    setIsAcknowledging(true);
    try {
      // Only send prophecy if user is the winner
      const prophecyToSend = pendingAck.winner?.id === selectedMember?.id ? prophecy : undefined;
      const response = await auctionsApi.acknowledgeAuction(pendingAck.auctionId, prophecyToSend);
      if (response.success) {
        setHasAcknowledged(true);
        setProphecy(''); // Reset prophecy
        await fetchAuctionData(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile confermare il risultato');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error acknowledging auction:', err);
      Alert.alert('Errore', 'Si e\' verificato un errore');
    } finally {
      setIsAcknowledging(false);
    }
  }, [pendingAck, prophecy, selectedMember?.id, fetchAuctionData]);

  const handleQuickBid = useCallback((increment: number) => {
    setBidAmount(currentBid + increment);
  }, [currentBid]);

  const handlePlaceBid = useCallback(async () => {
    if (!currentAuction || bidAmount <= currentBid || bidAmount > userBudget) {
      return;
    }

    setIsBidding(true);

    try {
      const response = await auctionsApi.placeBid(currentAuction.id, bidAmount);

      if (response.success) {
        await fetchAuctionData(false);
        setBidAmount(bidAmount + 1);
      } else {
        Alert.alert(
          'Errore',
          response.message || 'Impossibile effettuare l\'offerta',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error placing bid:', err);
      Alert.alert(
        'Errore',
        'Si e\' verificato un errore durante l\'offerta',
        [{ text: 'OK' }]
      );
    } finally {
      setIsBidding(false);
    }
  }, [currentAuction, bidAmount, currentBid, userBudget, fetchAuctionData]);

  // =============================================================================
  // Admin Event Handlers
  // =============================================================================

  const handleAdminCloseAuction = useCallback(async () => {
    if (!currentAuction) return;

    Alert.alert(
      'Conferma Chiusura Asta',
      'Sei sicuro di voler chiudere questa asta manualmente? L\'attuale miglior offerente vincera\' il giocatore.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Chiudi Asta',
          style: 'destructive',
          onPress: async () => {
            setIsAdminAction(true);
            try {
              const response = await adminApi.closeAuction(currentAuction.id);
              if (response.success) {
                await fetchAuctionData(false);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile chiudere l\'asta');
              }
            } catch (err) {
              console.error('[FirstMarketRoomScreen] Error closing auction:', err);
              Alert.alert('Errore', 'Si e\' verificato un errore');
            } finally {
              setIsAdminAction(false);
            }
          },
        },
      ]
    );
  }, [currentAuction, fetchAuctionData]);

  const handleAdvanceTurn = useCallback(async () => {
    if (!session) return;

    Alert.alert(
      'Conferma Avanzamento Turno',
      'Sei sicuro di voler passare al prossimo manager di turno?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Avanza Turno',
          onPress: async () => {
            setIsAdminAction(true);
            try {
              const response = await adminApi.advanceTurn(session.id);
              if (response.success) {
                await fetchAuctionData(false);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile avanzare il turno');
              }
            } catch (err) {
              console.error('[FirstMarketRoomScreen] Error advancing turn:', err);
              Alert.alert('Errore', 'Si e\' verificato un errore');
            } finally {
              setIsAdminAction(false);
            }
          },
        },
      ]
    );
  }, [session, fetchAuctionData]);

  const handleAdvanceRole = useCallback(async () => {
    if (!session) return;

    Alert.alert(
      'Conferma Avanzamento Ruolo',
      'Sei sicuro di voler passare al prossimo ruolo (es. da P a D)?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Avanza Ruolo',
          onPress: async () => {
            setIsAdminAction(true);
            try {
              const response = await adminApi.advanceRole(session.id);
              if (response.success) {
                await fetchAuctionData(false);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile avanzare il ruolo');
              }
            } catch (err) {
              console.error('[FirstMarketRoomScreen] Error advancing role:', err);
              Alert.alert('Errore', 'Si e\' verificato un errore');
            } finally {
              setIsAdminAction(false);
            }
          },
        },
      ]
    );
  }, [session, fetchAuctionData]);

  const handleForceAcknowledge = useCallback(async () => {
    if (!session) return;

    Alert.alert(
      'Conferma Forza Conferme',
      'Sei sicuro di voler forzare tutte le conferme? Questa azione sara\' eseguita per sbloccare situazioni di stallo.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Forza Conferme',
          style: 'destructive',
          onPress: async () => {
            setIsAdminAction(true);
            try {
              const response = await adminApi.forceAcknowledgeAll(session.id);
              if (response.success) {
                await fetchAuctionData(false);
              } else {
                Alert.alert('Errore', response.message || 'Impossibile forzare le conferme');
              }
            } catch (err) {
              console.error('[FirstMarketRoomScreen] Error forcing acknowledgment:', err);
              Alert.alert('Errore', 'Si e\' verificato un errore');
            } finally {
              setIsAdminAction(false);
            }
          },
        },
      ]
    );
  }, [session, fetchAuctionData]);

  // =============================================================================
  // Admin Test Handlers (for testing/simulation purposes)
  // =============================================================================

  const handleForceAllReady = useCallback(async () => {
    if (!session) return;

    setIsAdminAction(true);
    try {
      const response = await auctionsApi.forceAllReady(session.id);
      if (response.success) {
        Alert.alert('Successo', 'Tutti i manager sono stati impostati come pronti!');
        await fetchAuctionData(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile forzare tutti pronti');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error forcing all ready:', err);
      Alert.alert('Errore', 'Si è verificato un errore');
    } finally {
      setIsAdminAction(false);
    }
  }, [session, fetchAuctionData]);

  const handleBotNominate = useCallback(async () => {
    if (!session) return;

    setIsAdminAction(true);
    try {
      const response = await auctionsApi.botNominate(session.id);
      if (response.success) {
        const data = response.data as { player?: { name: string } };
        Alert.alert('Successo', `Bot ha scelto ${data.player?.name || 'un giocatore'}`);
        await fetchAuctionData(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile simulare scelta giocatore');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error bot nominate:', err);
      Alert.alert('Errore', 'Si è verificato un errore');
    } finally {
      setIsAdminAction(false);
    }
  }, [session, fetchAuctionData]);

  const handleBotConfirmNomination = useCallback(async () => {
    if (!session) return;

    setIsAdminAction(true);
    try {
      const response = await auctionsApi.botConfirmNomination(session.id);
      if (response.success) {
        const data = response.data as { player?: { name: string } };
        Alert.alert('Successo', `Scelta confermata: ${data.player?.name || 'giocatore'}`);
        await fetchAuctionData(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile confermare scelta');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error bot confirm nomination:', err);
      Alert.alert('Errore', 'Si è verificato un errore');
    } finally {
      setIsAdminAction(false);
    }
  }, [session, fetchAuctionData]);

  const handleBotBid = useCallback(async () => {
    if (!currentAuction) return;

    setIsAdminAction(true);
    try {
      const response = await auctionsApi.triggerBotBid(currentAuction.id);
      if (response.success) {
        const data = response.data as { hasBotBid: boolean; winningBot: string | null; newCurrentPrice: number };
        if (data.hasBotBid) {
          Alert.alert('Successo', `${data.winningBot} ha offerto ${data.newCurrentPrice}!`);
        } else {
          Alert.alert('Info', 'Nessun bot ha fatto offerte');
        }
        await fetchAuctionData(false);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile simulare offerta bot');
      }
    } catch (err) {
      console.error('[FirstMarketRoomScreen] Error bot bid:', err);
      Alert.alert('Errore', 'Si è verificato un errore');
    } finally {
      setIsAdminAction(false);
    }
  }, [currentAuction, fetchAuctionData]);

  // =============================================================================
  // Render Logic
  // =============================================================================

  // Compute hasPendingNomination here for logging (also used later)
  const hasPendingNominationForLog = readyStatus?.hasPendingNomination ?? false;

  // Debug logging for render state
  console.log('[FirstMarketRoomScreen] === RENDER STATE ===', {
    isLoading,
    hasSession: !!session,
    sessionId: session?.id,
    sessionStatus: session?.status,
    hasTurnOrder,
    hasPendingNomination: hasPendingNominationForLog,
    hasCurrentAuction: !!currentAuction,
    currentAuctionId: currentAuction?.id,
    hasPendingAck: !!pendingAck,
    isMyTurn,
    currentRole,
    isAdmin,
    userBudget,
    selectedMemberId: selectedMember?.id,
    firstMarketStatus: firstMarketStatus ? {
      isUserTurn: firstMarketStatus.isUserTurn,
      currentTurnIndex: firstMarketStatus.currentTurnIndex,
      turnOrderLength: firstMarketStatus.turnOrder?.length,
      currentNominatorId: firstMarketStatus.currentNominator?.id,
      pendingNomination: firstMarketStatus.pendingNomination,
    } : null,
    readyStatus: readyStatus ? {
      allReady: readyStatus.allReady,
      userIsReady: readyStatus.userIsReady,
      userIsNominator: readyStatus.userIsNominator,
      readyCount: readyStatus.readyMembers?.length,
      pendingCount: readyStatus.pendingMembers?.length,
    } : null,
  });

  // Log which render path will be taken
  // IMPORTANT: Check currentAuction?.id to ensure it's a valid auction, not an empty object
  const hasValidAuction = !!(currentAuction && currentAuction.id);
  let renderPath = 'unknown';
  if (isLoading) renderPath = 'LOADING';
  else if (!session) renderPath = 'NO_SESSION';
  else if (!hasTurnOrder && firstMarketStatus?.memberStatus) renderPath = 'TURN_ORDER_SETUP';
  else if (pendingAck && !hasValidAuction) renderPath = 'PENDING_ACKNOWLEDGMENT';
  else if (!hasValidAuction && hasTurnOrder && !hasPendingNominationForLog) renderPath = 'NOMINATION_PHASE';
  else if (!hasValidAuction && hasTurnOrder && hasPendingNominationForLog) renderPath = 'READY_CHECK_PHASE';
  else if (hasValidAuction) renderPath = 'ACTIVE_AUCTION';
  console.log('[FirstMarketRoomScreen] RENDER PATH:', renderPath, '(hasValidAuction:', hasValidAuction, ')');

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  // No active session
  if (!session) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="calendar-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.noAuctionTitle}>Nessuna Sessione Attiva</Text>
          <Text style={styles.noAuctionSubtitle}>
            Il primo mercato non e' ancora iniziato.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
            <Text style={styles.refreshButtonText}>Aggiorna</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Session exists but no turn order set yet
  if (!hasTurnOrder && firstMarketStatus?.memberStatus) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <ConnectionIndicator status={connectionStatus} />
        <SessionHeader session={session} currentRole={currentRole} />

        {isAdmin ? (
          <TurnOrderSetup
            memberStatus={firstMarketStatus.memberStatus}
            onConfirm={handleSetTurnOrder}
            isSubmitting={isSettingTurnOrder}
          />
        ) : (
          <WaitingForSetup />
        )}
      </ScrollView>
    );
  }

  // Turn order set, check for pending acknowledgment first
  const hasPendingNomination = readyStatus?.hasPendingNomination ?? false;

  // Pending Acknowledgment - highest priority after loading (except for active auction)
  if (pendingAck && !hasValidAuction) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <ConnectionIndicator status={connectionStatus} />
        <SessionHeader session={session} currentRole={currentRole} />

        {currentRole && (
          <RoleProgressBar
            currentRole={currentRole}
            roleSequence={firstMarketStatus?.roleSequence || ['P', 'D', 'C', 'A']}
          />
        )}

        <PendingAcknowledgmentPanel
          pendingAck={pendingAck}
          prophecy={prophecy}
          onProphecyChange={setProphecy}
          onAcknowledge={handleAcknowledge}
          isAcknowledging={isAcknowledging}
          hasAcknowledged={hasAcknowledged}
          currentUserId={selectedMember?.id}
        />

        {isAdmin && (
          <AdminControlsPanel
            session={session}
            currentAuction={currentAuction}
            pendingAck={pendingAck}
            onCloseAuction={handleAdminCloseAuction}
            onAdvanceTurn={handleAdvanceTurn}
            onAdvanceRole={handleAdvanceRole}
            onForceAcknowledge={handleForceAcknowledge}
            onForceAllReady={handleForceAllReady}
            onBotNominate={handleBotNominate}
            onBotConfirmNomination={handleBotConfirmNomination}
            onBotBid={handleBotBid}
            isLoading={isAdminAction}
          />
        )}
      </ScrollView>
    );
  }

  if (!hasValidAuction && hasTurnOrder && !hasPendingNomination) {
    // No auction active, no pending nomination - show nomination panel or waiting
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <ConnectionIndicator status={connectionStatus} />
        <SessionHeader session={session} currentRole={currentRole} />

        {currentRole && (
          <RoleProgressBar
            currentRole={currentRole}
            roleSequence={firstMarketStatus?.roleSequence || ['P', 'D', 'C', 'A']}
          />
        )}

        {firstMarketStatus && hasTurnOrder && (
          <ManagersList
            memberStatus={firstMarketStatus.memberStatus}
            turnOrder={firstMarketStatus.turnOrder!}
            currentTurnIndex={firstMarketStatus.currentTurnIndex}
            currentRole={currentRole || 'P'}
          />
        )}

        <TurnBanner
          isMyTurn={isMyTurn}
          nominatorName={firstMarketStatus?.currentNominator?.username || 'Manager'}
        />

        {isMyTurn && currentRole ? (
          <NominationPanel
            currentRole={currentRole}
            leagueId={effectiveLeagueId}
            onNominate={handleNominate}
            isNominating={isNominating}
          />
        ) : (
          <View style={styles.waitingForNominationContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.waitingForNominationText}>
              In attesa della nomina...
            </Text>
          </View>
        )}

        {isAdmin && (
          <AdminControlsPanel
            session={session}
            currentAuction={currentAuction}
            pendingAck={pendingAck}
            onCloseAuction={handleAdminCloseAuction}
            onAdvanceTurn={handleAdvanceTurn}
            onAdvanceRole={handleAdvanceRole}
            onForceAcknowledge={handleForceAcknowledge}
            onForceAllReady={handleForceAllReady}
            onBotNominate={handleBotNominate}
            onBotConfirmNomination={handleBotConfirmNomination}
            onBotBid={handleBotBid}
            isLoading={isAdminAction}
          />
        )}
      </ScrollView>
    );
  }

  // Pending nomination - show ready check panel
  if (hasPendingNomination && readyStatus && !hasValidAuction) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <ConnectionIndicator status={connectionStatus} />
        <SessionHeader session={session} currentRole={currentRole} />

        {currentRole && (
          <RoleProgressBar
            currentRole={currentRole}
            roleSequence={firstMarketStatus?.roleSequence || ['P', 'D', 'C', 'A']}
          />
        )}

        <ReadyCheckPanel
          readyStatus={readyStatus}
          onMarkReady={handleMarkReady}
          onConfirmNomination={handleConfirmNomination}
          onCancelNomination={handleCancelNomination}
          isMarkingReady={isMarkingReady}
          isConfirming={isConfirmingNomination}
        />

        {isAdmin && (
          <AdminControlsPanel
            session={session}
            currentAuction={currentAuction}
            pendingAck={pendingAck}
            onCloseAuction={handleAdminCloseAuction}
            onAdvanceTurn={handleAdvanceTurn}
            onAdvanceRole={handleAdvanceRole}
            onForceAcknowledge={handleForceAcknowledge}
            onForceAllReady={handleForceAllReady}
            onBotNominate={handleBotNominate}
            onBotConfirmNomination={handleBotConfirmNomination}
            onBotBid={handleBotBid}
            isLoading={isAdminAction}
          />
        )}
      </ScrollView>
    );
  }

  // Active auction - show bidding UI
  if (hasValidAuction) {
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
        <ConnectionIndicator status={connectionStatus} />
        <SessionHeader session={session} currentRole={currentRole} />

        {currentRole && (
          <RoleProgressBar
            currentRole={currentRole}
            roleSequence={firstMarketStatus?.roleSequence || ['P', 'D', 'C', 'A']}
          />
        )}

        <PlayerCard
          auction={currentAuction}
          countdown={countdown}
          isWinning={isWinning}
          currentBidderName={currentBidderName}
        />

        <BidControls
          currentBid={currentBid}
          userBudget={userBudget}
          bidAmount={bidAmount}
          onBidAmountChange={setBidAmount}
          onQuickBid={handleQuickBid}
          onPlaceBid={handlePlaceBid}
          isBidding={isBidding}
          isWinning={isWinning}
        />

        <BidHistory bids={bidHistory} />

        {isAdmin && (
          <AdminControlsPanel
            session={session}
            currentAuction={currentAuction}
            pendingAck={pendingAck}
            onCloseAuction={handleAdminCloseAuction}
            onAdvanceTurn={handleAdvanceTurn}
            onAdvanceRole={handleAdvanceRole}
            onForceAcknowledge={handleForceAcknowledge}
            onForceAllReady={handleForceAllReady}
            onBotNominate={handleBotNominate}
            onBotConfirmNomination={handleBotConfirmNomination}
            onBotBid={handleBotBid}
            isLoading={isAdminAction}
          />
        )}
      </ScrollView>
    );
  }

  // Fallback
  return (
    <View style={styles.container}>
      <View style={styles.centerContainer}>
        <Ionicons name="help-circle-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.noAuctionTitle}>Stato Sconosciuto</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
          <Text style={styles.refreshButtonText}>Aggiorna</Text>
        </TouchableOpacity>
      </View>
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
  noAuctionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noAuctionSubtitle: {
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

  // Session Header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sessionHeaderLeft: {
    flex: 1,
  },
  sessionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sessionHeaderRight: {
    alignItems: 'flex-end',
  },
  sessionTimerLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  sessionTimerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Role Progress Bar
  roleProgressContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  roleProgressTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  roleProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleProgressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  roleProgressItemActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  roleProgressText: {
    fontSize: 14,
    fontWeight: '700',
  },
  roleCheckIcon: {
    marginLeft: 4,
  },
  roleProgressConnector: {
    width: 20,
    height: 2,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 4,
  },

  // Turn Order Setup
  turnOrderSetupContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  turnOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  turnOrderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  turnOrderSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  turnOrderList: {
    gap: 8,
  },
  turnOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  turnOrderPosition: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnOrderPositionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  turnOrderMemberInfo: {
    flex: 1,
  },
  turnOrderMemberName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  turnOrderMemberTeam: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  turnOrderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  turnOrderMoveButton: {
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  turnOrderMoveButtonDisabled: {
    opacity: 0.3,
  },
  confirmOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
    gap: 8,
  },
  confirmOrderButtonDisabled: {
    opacity: 0.6,
  },
  confirmOrderButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Waiting States
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  waitingIcon: {
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  waitingSpinner: {
    marginTop: 24,
  },

  // Turn Banner
  turnBannerMyTurn: {
    backgroundColor: COLORS.warning + '20',
    borderWidth: 2,
    borderColor: COLORS.warning,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  turnBannerMyTurnText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.warning,
    marginTop: 8,
  },
  turnBannerMyTurnSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  turnBannerWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  turnBannerWaitingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  turnBannerHighlight: {
    fontWeight: '600',
    color: COLORS.text,
  },

  // Managers List
  managersListContainer: {
    marginBottom: 16,
  },
  managersListTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  managersListScroll: {
    flexDirection: 'row',
  },
  managerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  managerCardActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  managerCardCompleted: {
    opacity: 0.6,
  },
  managerTurnNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  managerTurnNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  managerCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  managerSlotsInfo: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  managerSlotsText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  managerCompletedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.success + '30',
    borderRadius: 8,
    padding: 2,
  },

  // Nomination Panel
  nominationPanelContainer: {
    flex: 1,
  },
  yourTurnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  yourTurnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nominationPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  nominationPanelSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  playersList: {
    maxHeight: 400,
  },
  playersListContent: {
    gap: 8,
  },
  playerSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  playerSelectPosition: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerSelectPositionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  playerSelectInfo: {
    flex: 1,
  },
  playerSelectName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  playerSelectTeam: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  playerSelectQuotation: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  playerSelectQuotationLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  playerSelectQuotationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.warning,
  },
  playerSelectItemDisabled: {
    opacity: 0.5,
  },
  nominateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nominateButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noPlayersText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    padding: 20,
  },
  waitingForNominationContainer: {
    alignItems: 'center',
    padding: 40,
  },
  waitingForNominationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
  },

  // Ready Check Panel
  readyCheckContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  nominatedPlayerCard: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  nominatedPlayerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  nominatedPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nominatedPlayerPosition: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nominatedPlayerPositionText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  nominatedPlayerDetails: {
    flex: 1,
  },
  nominatedPlayerName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  nominatedPlayerTeam: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  nominatedPlayerQuotation: {
    alignItems: 'center',
  },
  nominatedPlayerQuotationLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  nominatedPlayerQuotationValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.warning,
  },
  nominatorText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  nominatorName: {
    fontWeight: '600',
    color: COLORS.text,
  },
  readyProgressSection: {
    marginBottom: 16,
  },
  readyProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  readyProgressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  readyProgressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  readyProgressBarBg: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  readyProgressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 4,
  },
  readyMembersList: {
    marginBottom: 16,
  },
  readyMembersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  readyMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pendingMemberBadge: {
    backgroundColor: COLORS.background,
  },
  readyMemberName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.success,
  },
  pendingMemberName: {
    color: COLORS.textMuted,
  },
  nominatorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelNominationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '20',
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  cancelNominationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  confirmNominationButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  confirmNominationText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  readyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  readyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  alreadyReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success + '20',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },
  alreadyReadyText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.success,
  },

  // Player Card (Active Auction)
  playerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  playerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  winningBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  positionBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  playerTeam: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  quotationContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quotationLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  quotationValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.warning,
  },
  bidInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
  },
  currentBidSection: {
    flex: 1,
  },
  currentBidLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  currentBidValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.success,
    marginBottom: 2,
  },
  currentBidder: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  timerSection: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  timerSectionWarning: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '15',
  },
  timerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  timerValueWarning: {
    color: COLORS.error,
  },

  // Bid Controls
  bidControlsContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  budgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  budgetLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  budgetValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },
  quickBidsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickBidButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  quickBidButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  customBidInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    textAlign: 'center',
  },
  placeBidButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  placeBidButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.6,
  },
  placeBidButtonWinning: {
    backgroundColor: COLORS.success,
  },
  placeBidButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  bidErrorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 8,
    textAlign: 'center',
  },

  // Bid History
  bidHistoryContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bidHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  noBidsText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  bidHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  bidHistoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  bidHistoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 6,
  },
  bidHistoryAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.success,
    marginRight: 6,
  },
  bidHistoryTime: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Connection Indicator
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 12,
    alignSelf: 'center',
    gap: 6,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },

  // Pending Acknowledgment Panel
  ackPanel: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  ackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  ackResultCard: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  ackUnsoldContainer: {
    alignItems: 'center',
    gap: 12,
  },
  ackUnsoldText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.warning,
  },
  ackPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ackPlayerPosition: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ackPlayerPositionText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  ackPlayerDetails: {
    flex: 1,
  },
  ackPlayerName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  ackPlayerTeam: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  ackPriceContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ackPriceLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  ackPriceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },
  ackWinnerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    gap: 8,
  },
  ackWinnerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  ackWinnerName: {
    fontWeight: '600',
    color: COLORS.text,
  },
  ackWinnerTeam: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  ackContractInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  ackContractTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  ackContractRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ackContractItem: {
    alignItems: 'center',
    flex: 1,
  },
  ackContractLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  ackContractValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  ackProgressSection: {
    marginBottom: 16,
  },
  ackProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ackProgressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  ackProgressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  ackProgressBarBg: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ackProgressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 4,
  },
  ackMemberLists: {
    gap: 8,
    marginBottom: 16,
  },
  ackMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ackMemberNameConfirmed: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.success,
  },
  ackMemberNamePending: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  ackProphecySection: {
    marginBottom: 16,
  },
  ackProphecyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  ackProphecyInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  ackButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  ackConfirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success + '20',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },
  ackConfirmedText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.success,
  },

  // Admin Controls Panel
  adminPanel: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  adminTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
  },
  adminButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  adminButtonDisabled: {
    opacity: 0.4,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  warningButton: {
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  adminButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },

  // Test Utilities Section
  testUtilitiesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.info + '30',
  },
  testUtilitiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  testUtilitiesTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.info,
  },
  testButton: {
    borderWidth: 1,
    borderColor: COLORS.info + '40',
  },
  testButtonEmoji: {
    fontSize: 14,
  },
  testButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text,
  },
});

// =============================================================================
// Types for FantaContratti Mobile App
// =============================================================================

// ==================== USER & AUTH ====================

export interface User {
  id: string;
  email: string;
  username: string;
  isSuperAdmin: boolean;
  profilePhoto?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ==================== LEAGUE ====================

export type LeagueStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface League {
  id: string;
  name: string;
  description?: string | null;
  minParticipants: number;
  maxParticipants: number;
  requireEvenNumber: boolean;
  initialBudget: number;
  goalkeeperSlots: number;
  defenderSlots: number;
  midfielderSlots: number;
  forwardSlots: number;
  status: LeagueStatus;
  currentSeason: number;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  members?: LeagueMember[];
}

// ==================== LEAGUE MEMBER ====================

export type MemberRole = 'ADMIN' | 'MANAGER';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';
export type JoinType = 'CREATOR' | 'INVITE' | 'REQUEST';

export interface LeagueMember {
  id: string;
  userId: string;
  leagueId: string;
  role: MemberRole;
  teamName?: string | null;
  status: MemberStatus;
  joinType: JoinType;
  currentBudget: number;
  rubataOrder?: number | null;
  firstMarketOrder?: number | null;
  joinedAt: string;
  user?: User;
  league?: League;
  roster?: PlayerRoster[];
  contracts?: PlayerContract[];
}

// ==================== PLAYER ====================

export type Position = 'P' | 'D' | 'C' | 'A';
export type PlayerListStatus = 'IN_LIST' | 'NOT_IN_LIST';
export type PlayerExitReason = 'RITIRATO' | 'RETROCESSO' | 'ESTERO';

export interface SerieAPlayer {
  id: string;
  externalId?: string | null;
  name: string;
  team: string;
  position: Position;
  quotation: number;
  age?: number | null;
  isActive: boolean;
  listStatus: PlayerListStatus;
  exitReason?: PlayerExitReason | null;
  exitDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Alias for convenience
export type Player = SerieAPlayer;

// ==================== ROSTER ====================

export type AcquisitionType = 'FIRST_MARKET' | 'RUBATA' | 'SVINCOLATI' | 'TRADE';
export type RosterStatus = 'ACTIVE' | 'RELEASED' | 'TRADED';

export interface PlayerRoster {
  id: string;
  leagueMemberId: string;
  playerId: string;
  acquisitionPrice: number;
  acquisitionType: AcquisitionType;
  status: RosterStatus;
  acquiredAt: string;
  releasedAt?: string | null;
  player?: SerieAPlayer;
  contract?: PlayerContract;
  leagueMember?: LeagueMember;
}

// ==================== CONTRACT ====================

export interface PlayerContract {
  id: string;
  rosterId: string;
  leagueMemberId: string;
  salary: number;
  duration: number;
  initialSalary: number;
  initialDuration: number;
  rescissionClause: number;
  draftSalary?: number | null;
  draftDuration?: number | null;
  draftReleased: boolean;
  signedAt: string;
  expiresAt?: string | null;
  renewalHistory?: ContractRenewalEntry[] | null;
  roster?: PlayerRoster;
}

export interface ContractRenewalEntry {
  salary: number;
  duration: number;
  renewedAt: string;
}

export interface DraftContract {
  id: string;
  rosterId: string;
  memberId: string;
  sessionId: string;
  salary: number;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== MARKET SESSION ====================

export type MarketType = 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE';
export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type MarketPhase =
  | 'ASTA_LIBERA'
  | 'OFFERTE_PRE_RINNOVO'
  | 'PREMI'
  | 'CONTRATTI'
  | 'CALCOLO_INDENNIZZI'
  | 'RUBATA'
  | 'ASTA_SVINCOLATI'
  | 'OFFERTE_POST_ASTA_SVINCOLATI';

export interface MarketSession {
  id: string;
  leagueId: string;
  type: MarketType;
  season: number;
  semester: number;
  status: SessionStatus;
  currentPhase?: MarketPhase | null;
  currentRole?: Position | null;
  turnOrder?: string[] | null;
  currentTurnIndex?: number | null;
  auctionTimerSeconds: number;
  startsAt?: string | null;
  endsAt?: string | null;
  phaseStartedAt?: string | null;
  createdAt: string;
  league?: League;
  auctions?: Auction[];
}

// ==================== AUCTION ====================

export type AuctionType = 'FREE_BID' | 'RUBATA';
export type AuctionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_BIDS'
  | 'APPEAL_REVIEW'
  | 'AWAITING_APPEAL_ACK'
  | 'AWAITING_RESUME';

export interface Auction {
  id: string;
  leagueId: string;
  marketSessionId?: string | null;
  playerId: string;
  type: AuctionType;
  basePrice: number;
  currentPrice: number;
  winnerId?: string | null;
  sellerId?: string | null;
  nominatorId?: string | null;
  status: AuctionStatus;
  timerExpiresAt?: string | null;
  timerSeconds?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  player?: SerieAPlayer;
  winner?: LeagueMember;
  bids?: AuctionBid[];
}

export interface AuctionBid {
  id: string;
  auctionId: string;
  bidderId: string;
  userId: string;
  amount: number;
  isWinning: boolean;
  isCancelled: boolean;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  placedAt: string;
  bidder?: LeagueMember;
  user?: User;
}

export type AppealStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface AuctionAppeal {
  id: string;
  auctionId: string;
  memberId: string;
  content: string;
  status: AppealStatus;
  resolvedById?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface AuctionAcknowledgment {
  id: string;
  auctionId: string;
  memberId: string;
  prophecy?: string | null;
  acknowledgedAt: string;
}

// ==================== TRADE ====================

export type TradeStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTERED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface TradeOffer {
  id: string;
  marketSessionId: string;
  senderId: string;
  receiverId: string;
  offeredPlayers: string[];
  offeredBudget: number;
  requestedPlayers: string[];
  requestedBudget: number;
  status: TradeStatus;
  involvedPlayers: string[];
  message?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  respondedAt?: string | null;
  parentOfferId?: string | null;
  sender?: User;
  receiver?: User;
  marketSession?: MarketSession;
}

// ==================== MOVEMENT ====================

export type MovementType =
  | 'FIRST_MARKET'
  | 'TRADE'
  | 'RUBATA'
  | 'SVINCOLATI'
  | 'RELEASE'
  | 'CONTRACT_RENEW'
  | 'RETIREMENT'
  | 'RELEGATION_RELEASE'
  | 'RELEGATION_KEEP'
  | 'ABROAD_COMPENSATION'
  | 'ABROAD_KEEP';

export interface PlayerMovement {
  id: string;
  leagueId: string;
  playerId: string;
  movementType: MovementType;
  fromMemberId?: string | null;
  toMemberId?: string | null;
  price?: number | null;
  oldSalary?: number | null;
  oldDuration?: number | null;
  oldClause?: number | null;
  newSalary?: number | null;
  newDuration?: number | null;
  newClause?: number | null;
  auctionId?: string | null;
  tradeId?: string | null;
  marketSessionId?: string | null;
  createdAt: string;
  player?: SerieAPlayer;
  fromMember?: LeagueMember;
  toMember?: LeagueMember;
}

// ==================== PROPHECY ====================

export type ProphecyRole = 'BUYER' | 'SELLER';

export interface Prophecy {
  id: string;
  leagueId: string;
  playerId: string;
  authorId: string;
  movementId: string;
  authorRole: ProphecyRole;
  content: string;
  createdAt: string;
  player?: SerieAPlayer;
  author?: LeagueMember;
  movement?: PlayerMovement;
}

// ==================== INVITE ====================

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface LeagueInvite {
  id: string;
  leagueId: string;
  email: string;
  token: string;
  invitedBy: string;
  status: InviteStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  league?: League;
  inviter?: User;
}

// ==================== PRIZE ====================

export interface Prize {
  id: string;
  leagueId: string;
  memberId: string;
  adminId: string;
  amount: number;
  reason?: string | null;
  createdAt: string;
}

export interface PrizePhaseConfig {
  id: string;
  marketSessionId: string;
  baseReincrement: number;
  isFinalized: boolean;
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrizeCategory {
  id: string;
  marketSessionId: string;
  name: string;
  isSystemPrize: boolean;
  createdAt: string;
  managerPrizes?: SessionPrize[];
}

export interface SessionPrize {
  id: string;
  prizeCategoryId: string;
  leagueMemberId: string;
  amount: number;
  createdAt: string;
}

// ==================== RUBATA ====================

export interface RubataPreference {
  id: string;
  sessionId: string;
  memberId: string;
  playerId: string;
  isWatchlist: boolean;
  isAutoPass: boolean;
  maxBid?: number | null;
  priority?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  player?: SerieAPlayer;
}

export interface RubataBoardEntry {
  rosterId: string;
  memberId: string;
  playerId: string;
}

// ==================== CHAT ====================

export interface ChatMessage {
  id: string;
  marketSessionId: string;
  memberId: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  member?: LeagueMember;
}

// ==================== INDEMNITY ====================

export interface IndemnityDecision {
  id: string;
  sessionId: string;
  memberId: string;
  decisions: IndemnityDecisionEntry[];
  decidedAt: string;
}

export interface IndemnityDecisionEntry {
  rosterId: string;
  decision: 'KEEP' | 'RELEASE';
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== AUDIT LOG ====================

export interface AuditLog {
  id: string;
  userId?: string | null;
  leagueId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

// ==================== UTILITY TYPES ====================

export type PositionLabel = {
  [K in Position]: string;
};

export const POSITION_LABELS: PositionLabel = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
};

export type PositionColor = {
  [K in Position]: string;
};

export const POSITION_COLORS: PositionColor = {
  P: '#FFA500', // Orange
  D: '#4CAF50', // Green
  C: '#2196F3', // Blue
  A: '#F44336', // Red
};

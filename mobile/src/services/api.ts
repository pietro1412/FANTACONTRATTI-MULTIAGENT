/**
 * API Service for FantaContratti Mobile App
 *
 * Axios-based API client with JWT token management via SecureStore
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ============================================================================
// Storage Abstraction (SecureStore for native, localStorage for web)
// ============================================================================

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// ============================================================================
// Configuration
// ============================================================================

// API Configuration
// For local development:
//   - Android Emulator: http://10.0.2.2:3003
//   - iOS Simulator: http://localhost:3003
//   - Real device: http://<YOUR_PC_IP>:3003
// For production: https://fantacontratti-multiagent.vercel.app
// Dispositivo fisico Android sulla stessa rete WiFi del PC
const API_BASE_URL = 'http://10.93.249.172:3003';

const TOKEN_KEY = 'fantacontratti_auth_token';
const REFRESH_TOKEN_KEY = 'fantacontratti_refresh_token';

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

export interface User {
  id: string;
  email: string;
  username: string;
  profilePhoto?: string | null;
  createdAt?: string;
}

export interface AuthData {
  user: User;
  accessToken: string;
}

export interface League {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  status: string;
  currentPhase?: string;
  maxParticipants: number;
  currentParticipants?: number;
  adminUsername?: string;
  createdAt: string;
  config?: LeagueConfig;
}

export interface LeagueConfig {
  minParticipants: number;
  maxParticipants: number;
  initialBudget: number;
  goalkeeperSlots: number;
  defenderSlots: number;
  midfielderSlots: number;
  forwardSlots: number;
}

export interface LeagueMember {
  id: string;
  userId: string;
  username?: string;
  teamName: string | null;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'KICKED' | 'LEFT';
  currentBudget?: number;
  budget?: number;
  profilePhoto?: string | null;
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
    profilePhoto?: string | null;
  };
}

export interface Player {
  id: string;
  name: string;
  position: 'P' | 'D' | 'C' | 'A';
  team: string;
  quotation: number;
  initialQuotation?: number;
}

export interface RosterPlayer {
  id: string;
  player: Player;
  purchasePrice: number;
  purchasedAt: string;
  contract?: Contract;
}

export interface Contract {
  id: string;
  salary: number;
  duration: number;
  clause: number;
  status: 'ACTIVE' | 'DRAFT' | 'EXPIRED';
  createdAt: string;
  expiresAt?: string;
}

export interface ContractModifyData {
  newSalary: number;
  newDuration: number;
}

export interface Trade {
  id: string;
  fromMember: LeagueMember;
  toMember: LeagueMember;
  offeredPlayers: RosterPlayer[];
  requestedPlayers: RosterPlayer[];
  offeredBudget: number;
  requestedBudget: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'CANCELLED' | 'EXPIRED';
  message?: string;
  expiresAt: string;
  createdAt: string;
}

export interface TradeOfferData {
  toMemberId: string;
  offeredPlayerIds: string[];
  requestedPlayerIds: string[];
  offeredBudget?: number;
  requestedBudget?: number;
  message?: string;
  durationHours?: number;
}

export interface TradeResponseData {
  offeredPlayerIds?: string[];
  requestedPlayerIds?: string[];
  offeredBudget?: number;
  requestedBudget?: number;
  message?: string;
}

export interface Auction {
  id: string;
  playerId: string;
  player: Player;
  currentBid: number;
  currentBidderId?: string;
  currentBidder?: LeagueMember;
  status: 'ACTIVE' | 'CLOSED' | 'PENDING_ACKNOWLEDGMENT';
  startedAt: string;
  closedAt?: string;
}

export interface AuctionSession {
  id: string;
  leagueId: string;
  status: 'ACTIVE' | 'CLOSED';
  phase: string;
  isFirstMarket: boolean;
  timerSeconds: number;
  currentAuction?: Auction;
  createdAt: string;
}

export interface SessionOverview {
  id: string;
  semester: number;
  isFirstMarket: boolean;
  status: string;
  phase: string;
  createdAt: string;
  closedAt?: string;
  stats: {
    totalAuctions: number;
    totalTrades: number;
    totalRubate: number;
    totalSvincolati: number;
  };
}

export interface SessionDetails {
  id: string;
  semester: number;
  isFirstMarket: boolean;
  status: string;
  phase: string;
  createdAt: string;
  closedAt?: string;
  auctions: Auction[];
  trades: Trade[];
}

// ============================================================================
// API Client Setup
// ============================================================================

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - Add JWT token to requests
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Extended logging for debugging
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.url}`, {
      hasToken: !!token,
      params: config.params,
      dataKeys: config.data ? Object.keys(config.data) : null,
    });
    return config;
  },
  (error) => {
    console.error('[API REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    // Extended logging for debugging
    console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      success: response.data?.success,
      hasData: !!response.data?.data,
      message: response.data?.message,
    });
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    console.error(`[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      code: error.code,
    });
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't try to refresh for auth endpoints
    const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/refresh'];
    const isAuthEndpoint = authEndpoints.some((endpoint) => originalRequest.url?.includes(endpoint));

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject: (err: Error) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        } else {
          processQueue(new Error('Token refresh failed'), null);
          await clearTokens();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        await clearTokens();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Format error response
    const apiError: ApiResponse = {
      success: false,
      message: error.response?.data?.message || error.message || 'Errore di connessione al server',
      errors: error.response?.data?.errors,
    };

    return Promise.reject(apiError);
  }
);

// ============================================================================
// Token Management
// ============================================================================

export async function setAccessToken(token: string): Promise<void> {
  await storage.setItem(TOKEN_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  return await storage.getItem(TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await storage.setItem(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return await storage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await storage.deleteItem(TOKEN_KEY);
  await storage.deleteItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    const response = await axios.post<{ success: boolean; accessToken?: string }>(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      {
        headers: {
          Cookie: `refreshToken=${refreshToken}`,
        },
        withCredentials: true,
      }
    );

    if (response.data.success && response.data.accessToken) {
      await setAccessToken(response.data.accessToken);
      return response.data.accessToken;
    }

    return null;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  /**
   * Login with email/username and password
   */
  login: async (email: string, password: string): Promise<ApiResponse<AuthData>> => {
    try {
      const response = await apiClient.post<ApiResponse<AuthData>>('/api/auth/login', {
        emailOrUsername: email,
        password,
      });

      if (response.data.success && response.data.data?.accessToken) {
        await setAccessToken(response.data.data.accessToken);
      }

      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Logout and clear tokens
   */
  logout: async (): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>('/api/auth/logout');
      await clearTokens();
      return response.data;
    } catch (error) {
      await clearTokens();
      return error as ApiResponse;
    }
  },

  /**
   * Get current authenticated user
   */
  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.get<ApiResponse<User>>('/api/auth/me');
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Register new user
   */
  register: async (data: {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
  }): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>('/api/auth/register', data);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// Leagues API
// ============================================================================

export const leaguesApi = {
  /**
   * Get all leagues for the current user
   */
  getMyLeagues: async (): Promise<ApiResponse<League[]>> => {
    try {
      console.log('[API] getMyLeagues - calling /api/leagues');
      const response = await apiClient.get('/api/leagues');
      console.log('[API] getMyLeagues - raw response:', JSON.stringify(response.data, null, 2));

      // API returns { success: true, data: [{ membership, league }] }
      if (response.data.success && response.data.data) {
        const leagues = response.data.data.map((item: { membership: unknown; league: League }) => item.league);
        console.log('[API] getMyLeagues - transformed leagues:', JSON.stringify(leagues, null, 2));
        return { success: true, data: leagues };
      }

      return { success: response.data.success, message: response.data.message };
    } catch (error: unknown) {
      console.error('[API] getMyLeagues - error:', error);
      const apiError = error as ApiResponse;
      return { success: false, message: apiError.message || 'Errore nel caricamento delle leghe' };
    }
  },

  /**
   * Get league by ID
   * Backend returns { data: { league, userMembership, isAdmin } }
   * We extract league to return as data directly
   */
  getLeagueById: async (id: string): Promise<ApiResponse<League>> => {
    try {
      const response = await apiClient.get<ApiResponse<{ league: League; userMembership: LeagueMember | null; isAdmin: boolean }>>(`/api/leagues/${id}`);
      // Extract league from nested structure
      if (response.data.success && response.data.data?.league) {
        return {
          success: true,
          data: response.data.data.league,
        };
      }
      return response.data as unknown as ApiResponse<League>;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get league members
   * Backend returns { data: { members, isAdmin } }
   * We extract members array to return as data directly
   */
  getLeagueMembers: async (leagueId: string): Promise<ApiResponse<LeagueMember[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<{ members: LeagueMember[]; isAdmin: boolean }>>(`/api/leagues/${leagueId}/members`);
      // Extract members array from nested structure
      if (response.data.success && response.data.data?.members) {
        return {
          success: true,
          data: response.data.data.members,
        };
      }
      return response.data as unknown as ApiResponse<LeagueMember[]>;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Search for leagues
   */
  searchLeagues: async (query: string): Promise<ApiResponse<League[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<League[]>>(`/api/leagues/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get league by invite code
   */
  getLeagueByInviteCode: async (code: string): Promise<ApiResponse<League>> => {
    try {
      const response = await apiClient.get<ApiResponse<League>>(`/api/leagues/join/${code}`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Request to join a league
   */
  requestJoin: async (leagueId: string, teamName: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(`/api/leagues/${leagueId}/join`, { teamName });
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// Roster API
// ============================================================================

export const rosterApi = {
  /**
   * Get my roster for a league
   */
  getRoster: async (leagueId: string): Promise<ApiResponse<RosterPlayer[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<RosterPlayer[]>>(`/api/leagues/${leagueId}/roster`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get another member's roster
   */
  getMemberRoster: async (leagueId: string, memberId: string): Promise<ApiResponse<RosterPlayer[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<RosterPlayer[]>>(`/api/leagues/${leagueId}/roster/${memberId}`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get all rosters in a league
   */
  getAllRosters: async (leagueId: string): Promise<ApiResponse<{ memberId: string; roster: RosterPlayer[] }[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<{ memberId: string; roster: RosterPlayer[] }[]>>(
        `/api/leagues/${leagueId}/rosters`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get player details in context of a league roster
   */
  getPlayerDetails: async (leagueId: string, playerId: string): Promise<ApiResponse<RosterPlayer>> => {
    try {
      // Get roster and find the player
      const response = await apiClient.get<ApiResponse<RosterPlayer[]>>(`/api/leagues/${leagueId}/roster`);
      if (response.data.success && response.data.data) {
        const player = response.data.data.find((p) => p.player.id === playerId);
        if (player) {
          return { success: true, data: player };
        }
        return { success: false, message: 'Giocatore non trovato nel roster' };
      }
      return response.data as ApiResponse;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// Contracts API
// ============================================================================

export const contractsApi = {
  /**
   * Get all contracts for a league
   */
  getContracts: async (leagueId: string): Promise<ApiResponse<Contract[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<Contract[]>>(`/api/leagues/${leagueId}/contracts`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get contract by ID
   */
  getContractById: async (contractId: string): Promise<ApiResponse<Contract>> => {
    try {
      const response = await apiClient.get<ApiResponse<Contract>>(`/api/contracts/${contractId}`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Modify contract for a roster player (salary and duration)
   */
  modifyContract: async (
    leagueId: string,
    rosterId: string,
    data: ContractModifyData
  ): Promise<ApiResponse<Contract>> => {
    try {
      // First get the contract for this roster entry, then modify it
      const contractsResponse = await apiClient.get<ApiResponse<{ contracts: Array<{ rosterId: string; id: string }> }>>(
        `/api/leagues/${leagueId}/contracts`
      );

      if (!contractsResponse.data.success || !contractsResponse.data.data?.contracts) {
        return { success: false, message: 'Errore nel recupero dei contratti' };
      }

      const contractEntry = contractsResponse.data.data.contracts.find((c) => c.rosterId === rosterId);
      if (!contractEntry) {
        return { success: false, message: 'Contratto non trovato per questo giocatore' };
      }

      const response = await apiClient.post<ApiResponse<Contract>>(`/api/contracts/${contractEntry.id}/modify`, {
        newSalary: data.newSalary,
        newDuration: data.newDuration,
      });
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Preview contract modification
   */
  previewModify: async (
    contractId: string,
    data: ContractModifyData
  ): Promise<ApiResponse<{ cost: number; newClause: number }>> => {
    try {
      const response = await apiClient.post<ApiResponse<{ cost: number; newClause: number }>>(
        `/api/contracts/${contractId}/preview`,
        {
          newSalary: data.newSalary,
          newDuration: data.newDuration,
        }
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Renew an existing contract
   */
  renewContract: async (contractId: string, data: ContractModifyData): Promise<ApiResponse<Contract>> => {
    try {
      const response = await apiClient.post<ApiResponse<Contract>>(`/api/contracts/${contractId}/renew`, {
        newSalary: data.newSalary,
        newDuration: data.newDuration,
      });
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Release a player (svincola)
   */
  releasePlayer: async (contractId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(`/api/contracts/${contractId}/release`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// Trades API
// ============================================================================

export const tradesApi = {
  /**
   * Get all trades for a league (received and sent)
   */
  getTrades: async (
    leagueId: string
  ): Promise<ApiResponse<{ received: Trade[]; sent: Trade[]; history: Trade[] }>> => {
    try {
      const [receivedRes, sentRes, historyRes] = await Promise.all([
        apiClient.get<ApiResponse<Trade[]>>(`/api/leagues/${leagueId}/trades/received`),
        apiClient.get<ApiResponse<Trade[]>>(`/api/leagues/${leagueId}/trades/sent`),
        apiClient.get<ApiResponse<Trade[]>>(`/api/leagues/${leagueId}/trades/history`),
      ]);

      return {
        success: true,
        data: {
          received: receivedRes.data.data || [],
          sent: sentRes.data.data || [],
          history: historyRes.data.data || [],
        },
      };
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get received trade offers
   */
  getReceivedOffers: async (leagueId: string): Promise<ApiResponse<Trade[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<Trade[]>>(`/api/leagues/${leagueId}/trades/received`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get sent trade offers
   */
  getSentOffers: async (leagueId: string): Promise<ApiResponse<Trade[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<Trade[]>>(`/api/leagues/${leagueId}/trades/sent`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Create a new trade offer
   */
  createOffer: async (data: TradeOfferData & { leagueId: string }): Promise<ApiResponse<Trade>> => {
    try {
      const { leagueId, ...offerData } = data;
      const response = await apiClient.post<ApiResponse<Trade>>(`/api/leagues/${leagueId}/trades`, offerData);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Respond to a trade offer (accept, reject, or counter)
   */
  respondToOffer: async (
    tradeId: string,
    response: 'accept' | 'reject' | 'cancel',
    counterData?: TradeResponseData
  ): Promise<ApiResponse<Trade>> => {
    try {
      let apiResponse;

      switch (response) {
        case 'accept':
          apiResponse = await apiClient.put<ApiResponse<Trade>>(`/api/trades/${tradeId}/accept`);
          break;
        case 'reject':
          apiResponse = await apiClient.put<ApiResponse<Trade>>(`/api/trades/${tradeId}/reject`);
          break;
        case 'cancel':
          apiResponse = await apiClient.put<ApiResponse<Trade>>(`/api/trades/${tradeId}/cancel`);
          break;
        default:
          return { success: false, message: 'Risposta non valida' };
      }

      return apiResponse.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Create a counter offer
   */
  counterOffer: async (tradeId: string, counterData: TradeResponseData): Promise<ApiResponse<Trade>> => {
    try {
      const response = await apiClient.post<ApiResponse<Trade>>(`/api/trades/${tradeId}/counter`, counterData);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// First Market Types
// ============================================================================

export interface FirstMarketMemberStatus {
  memberId: string;
  username: string;
  teamName: string | null;
  rosterByRole: { P: number; D: number; C: number; A: number };
  slotsNeeded: { P: number; D: number; C: number; A: number };
  isComplete: boolean;
  isCurrentRoleComplete: boolean;
}

export interface FirstMarketStatus {
  currentRole: 'P' | 'D' | 'C' | 'A';
  currentTurnIndex: number;
  currentNominator: { memberId: string; username: string; index: number } | null;
  allCompletedCurrentRole: boolean;
  memberStatus: FirstMarketMemberStatus[];
  turnOrder: string[] | null;
  roleSequence: string[];
  isUserTurn: boolean;
}

export interface ReadyStatus {
  hasPendingNomination: boolean;
  nominatorConfirmed: boolean;
  player: Player | null;
  nominatorId: string | null;
  nominatorUsername: string;
  readyMembers: { id: string; username: string }[];
  pendingMembers: { id: string; username: string }[];
  totalMembers: number;
  readyCount: number;
  userIsReady: boolean;
  userIsNominator: boolean;
}

export interface PendingAcknowledgment {
  auctionId: string;
  player: {
    id: string;
    name: string;
    team: string;
    position: string;
    quotation: number;
  };
  winner: {
    id: string;
    username: string;
    teamName: string;
  } | null;
  finalPrice: number | null;
  wasUnsold: boolean;
  acknowledgedMembers: Array<{ id: string; username: string }>;
  pendingMembers: Array<{ id: string; username: string }>;
  contractInfo?: {
    salary: number;
    duration: number;
    rescissionClause: number;
  };
}

// ============================================================================
// Auctions API
// ============================================================================

export const auctionsApi = {
  /**
   * Get current auction session for a league
   */
  getCurrentAuction: async (leagueId: string): Promise<ApiResponse<AuctionSession | null>> => {
    try {
      const sessionsResponse = await apiClient.get<ApiResponse<AuctionSession[]>>(`/api/leagues/${leagueId}/auctions`);

      if (!sessionsResponse.data.success || !sessionsResponse.data.data) {
        return sessionsResponse.data as ApiResponse;
      }

      // Find the active session
      const activeSession = sessionsResponse.data.data.find((s) => s.status === 'ACTIVE');

      if (!activeSession) {
        return { success: true, data: null };
      }

      // Get current auction for this session
      const auctionResponse = await apiClient.get<ApiResponse<Auction>>(
        `/api/auctions/sessions/${activeSession.id}/current`
      );

      // Calculate isFirstMarket from session type
      const isFirstMarket = activeSession.type === 'PRIMO_MERCATO';

      // Ensure currentAuction is null if empty or has no id
      const auctionData = auctionResponse.data.data;
      const currentAuction = auctionData && auctionData.id ? auctionData : null;

      return {
        success: true,
        data: {
          ...activeSession,
          isFirstMarket,
          currentAuction,
        },
      };
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get all auction sessions for a league
   */
  getSessions: async (leagueId: string): Promise<ApiResponse<AuctionSession[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<AuctionSession[]>>(`/api/leagues/${leagueId}/auctions`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get current auction for a session
   */
  getSessionCurrentAuction: async (sessionId: string): Promise<ApiResponse<Auction>> => {
    try {
      const response = await apiClient.get<ApiResponse<Auction>>(`/api/auctions/sessions/${sessionId}/current`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Place a bid on an auction
   */
  placeBid: async (auctionId: string, amount: number): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(`/api/auctions/${auctionId}/bid`, { amount });
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Acknowledge auction completion
   */
  acknowledgeAuction: async (auctionId: string, prophecy?: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(`/api/auctions/${auctionId}/acknowledge`, { prophecy });
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get pending acknowledgment for a session
   */
  getPendingAcknowledgment: async (sessionId: string): Promise<ApiResponse<PendingAcknowledgment | null>> => {
    try {
      const response = await apiClient.get<ApiResponse<PendingAcknowledgment | null>>(
        `/api/auctions/sessions/${sessionId}/pending-acknowledgment`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Mark as ready for auction
   */
  markReady: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(`/api/auctions/sessions/${sessionId}/ready`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get ready status (full version with all details)
   */
  getReadyStatus: async (sessionId: string): Promise<ApiResponse<ReadyStatus>> => {
    try {
      const response = await apiClient.get<ApiResponse<ReadyStatus>>(
        `/api/auctions/sessions/${sessionId}/ready-status`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get first market status (turn order, current nominator, etc.)
   */
  getFirstMarketStatus: async (sessionId: string): Promise<ApiResponse<FirstMarketStatus>> => {
    try {
      const response = await apiClient.get<ApiResponse<FirstMarketStatus>>(
        `/api/auctions/sessions/${sessionId}/first-market-status`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Set pending nomination (select player before confirming)
   */
  setPendingNomination: async (sessionId: string, playerId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/nominate-pending`,
        { playerId }
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Confirm nomination (start the auction)
   */
  confirmNomination: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/confirm-nomination`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Cancel nomination
   */
  cancelNomination: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.delete<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/nomination`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Force all managers to be ready (admin only - test utility)
   */
  forceAllReady: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/force-all-ready`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Simulate bot nomination (admin only - test utility)
   */
  botNominate: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/bot-nominate`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Simulate bot confirm nomination (admin only - test utility)
   */
  botConfirmNomination: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/bot-confirm-nomination`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Trigger bot bid (admin only - test utility)
   */
  triggerBotBid: async (auctionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/auctions/${auctionId}/bot-bid`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Force all managers to acknowledge (admin only)
   */
  forceAcknowledgeAll: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/force-acknowledge-all`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// History API
// ============================================================================

export const historyApi = {
  /**
   * Get sessions overview for a league
   */
  getSessionsOverview: async (leagueId: string): Promise<ApiResponse<SessionOverview[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<SessionOverview[]>>(
        `/api/leagues/${leagueId}/history/sessions`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get detailed information about a specific session
   */
  getSessionDetails: async (leagueId: string, sessionId: string): Promise<ApiResponse<SessionDetails>> => {
    try {
      const response = await apiClient.get<ApiResponse<SessionDetails>>(
        `/api/leagues/${leagueId}/history/sessions/${sessionId}`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get first market history for a session
   */
  getFirstMarketHistory: async (
    leagueId: string,
    sessionId: string
  ): Promise<ApiResponse<Auction[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<Auction[]>>(
        `/api/leagues/${leagueId}/history/sessions/${sessionId}/first-market`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get trades for a session
   */
  getSessionTrades: async (
    leagueId: string,
    sessionId: string,
    options?: {
      status?: 'ALL' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'COUNTERED';
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<Trade[]>> => {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));
      const query = params.toString();

      const response = await apiClient.get<ApiResponse<Trade[]>>(
        `/api/leagues/${leagueId}/history/sessions/${sessionId}/trades${query ? `?${query}` : ''}`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get timeline events for a league
   */
  getTimeline: async (
    leagueId: string,
    options?: {
      limit?: number;
      offset?: number;
      eventTypes?: string[];
      sessionId?: string;
      playerId?: string;
    }
  ): Promise<ApiResponse<unknown[]>> => {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));
      if (options?.eventTypes) params.append('eventTypes', options.eventTypes.join(','));
      if (options?.sessionId) params.append('sessionId', options.sessionId);
      if (options?.playerId) params.append('playerId', options.playerId);
      const query = params.toString();

      const response = await apiClient.get<ApiResponse<unknown[]>>(
        `/api/leagues/${leagueId}/history/timeline${query ? `?${query}` : ''}`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get player career in a league
   */
  getPlayerCareer: async (leagueId: string, playerId: string): Promise<ApiResponse<unknown>> => {
    try {
      const response = await apiClient.get<ApiResponse<unknown>>(
        `/api/leagues/${leagueId}/history/players/${playerId}`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// Players API
// ============================================================================

export const playersApi = {
  /**
   * Get all players with optional filters
   */
  getAll: async (filters?: {
    position?: string;
    team?: string;
    search?: string;
    available?: boolean;
    leagueId?: string;
  }): Promise<ApiResponse<Player[]>> => {
    try {
      const params = new URLSearchParams();
      if (filters?.position) params.append('position', filters.position);
      if (filters?.team) params.append('team', filters.team);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.available) params.append('available', 'true');
      if (filters?.leagueId) params.append('leagueId', filters.leagueId);
      const query = params.toString();

      const response = await apiClient.get<ApiResponse<Player[]>>(`/api/players${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get player by ID
   */
  getById: async (id: string): Promise<ApiResponse<Player>> => {
    try {
      const response = await apiClient.get<ApiResponse<Player>>(`/api/players/${id}`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get all teams
   */
  getTeams: async (): Promise<ApiResponse<string[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<string[]>>('/api/players/teams');
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// Indemnity API
// ============================================================================

export interface AffectedPlayer {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  exitReason: 'RITIRATO' | 'RETROCESSO' | 'ESTERO';
  exitDate: string | null;
  contract: {
    id: string;
    salary: number;
    duration: number;
    rescissionClause: number;
  };
  roster: {
    id: string;
    acquisitionPrice: number;
  };
}

export interface DecisionStatus {
  memberId: string;
  username: string;
  teamName: string | null;
  affectedCount: number;
  hasDecided: boolean;
  decidedAt: string | null;
}

export interface IndemnityData {
  inCalcoloIndennizziPhase: boolean;
  hasSubmittedDecisions: boolean;
  submittedAt: string | null;
  currentBudget: number;
  indennizzoEstero: number;
  affectedPlayers: AffectedPlayer[];
}

export interface IndemnityStatusData {
  inCalcoloIndennizziPhase: boolean;
  managers: DecisionStatus[];
  allDecided: boolean;
}

export type IndemnityDecision = 'KEEP' | 'RELEASE';

export const indemnityApi = {
  /**
   * Get all affected players for the league (admin view)
   */
  getAffectedPlayers: async (leagueId: string): Promise<ApiResponse<AffectedPlayer[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<AffectedPlayer[]>>(
        `/api/leagues/${leagueId}/indemnity/affected`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get my affected players
   */
  getMyAffectedPlayers: async (leagueId: string): Promise<ApiResponse<IndemnityData>> => {
    try {
      const response = await apiClient.get<ApiResponse<IndemnityData>>(
        `/api/leagues/${leagueId}/indemnity/my-affected`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Submit decisions for affected players
   */
  submitDecisions: async (
    leagueId: string,
    decisions: Array<{ rosterId: string; decision: IndemnityDecision }>
  ): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/leagues/${leagueId}/indemnity/decisions`,
        { decisions }
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get all decisions status (admin view)
   */
  getAllDecisionsStatus: async (leagueId: string): Promise<ApiResponse<IndemnityStatusData>> => {
    try {
      const response = await apiClient.get<ApiResponse<IndemnityStatusData>>(
        `/api/leagues/${leagueId}/indemnity/status`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },
};

// ============================================================================
// Admin API (League Management)
// ============================================================================

export interface PendingRequest {
  id: string;
  userId: string;
  username: string;
  teamName: string | null;
  status: 'PENDING';
  createdAt: string;
  user?: {
    email: string;
    profilePhoto?: string | null;
  };
}

export interface LeagueUpdateData {
  name?: string;
  description?: string;
  maxParticipants?: number;
  initialBudget?: number;
}

export type MemberAction = 'accept' | 'reject' | 'kick';

export const adminApi = {
  /**
   * Get pending join requests for a league (admin only)
   */
  getPendingRequests: async (leagueId: string): Promise<ApiResponse<PendingRequest[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<PendingRequest[]>>(
        `/api/leagues/${leagueId}/pending-requests`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Handle member request (accept/reject/kick) - admin only
   */
  handleMemberRequest: async (
    leagueId: string,
    memberId: string,
    action: MemberAction
  ): Promise<ApiResponse> => {
    try {
      const response = await apiClient.put<ApiResponse>(
        `/api/leagues/${leagueId}/members/${memberId}`,
        { action }
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Start a new market/auction session (admin only)
   */
  startMarket: async (
    leagueId: string,
    isRegularMarket: boolean = false
  ): Promise<ApiResponse<AuctionSession>> => {
    try {
      const response = await apiClient.post<ApiResponse<AuctionSession>>(
        `/api/leagues/${leagueId}/auctions`,
        { isRegularMarket }
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Start the league (initiate first market) - admin only
   */
  startLeague: async (leagueId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post<ApiResponse>(
        `/api/leagues/${leagueId}/start`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Update league settings (admin only)
   */
  updateLeague: async (
    leagueId: string,
    data: LeagueUpdateData
  ): Promise<ApiResponse<League>> => {
    try {
      const response = await apiClient.put<ApiResponse<League>>(
        `/api/leagues/${leagueId}`,
        data
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Set market phase (admin only)
   */
  setMarketPhase: async (sessionId: string, phase: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.put<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/phase`,
        { phase }
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Close market session (admin only)
   */
  closeMarketSession: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.put<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/close`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Set turn order for first market (admin only)
   */
  setTurnOrder: async (sessionId: string, memberOrder: string[]): Promise<ApiResponse> => {
    try {
      const response = await apiClient.put<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/turn-order`,
        { memberOrder }
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get league invite code info
   */
  getInviteCode: async (leagueId: string): Promise<ApiResponse<{ inviteCode: string }>> => {
    try {
      const response = await apiClient.get<ApiResponse<League>>(
        `/api/leagues/${leagueId}`
      );
      if (response.data.success && response.data.data) {
        return { success: true, data: { inviteCode: response.data.data.inviteCode } };
      }
      return response.data as ApiResponse;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Close an auction manually (admin only)
   */
  closeAuction: async (auctionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.put<ApiResponse>(
        `/api/auctions/${auctionId}/close`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Advance to next turn (admin only)
   */
  advanceTurn: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.put<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/advance-turn`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Advance to next role (admin only)
   */
  advanceRole: async (sessionId: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.put<ApiResponse>(
        `/api/auctions/sessions/${sessionId}/advance-role`
      );
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

};

// ============================================================================
// Default Export
// ============================================================================

export default {
  auth: authApi,
  leagues: leaguesApi,
  roster: rosterApi,
  contracts: contractsApi,
  trades: tradesApi,
  auctions: auctionsApi,
  history: historyApi,
  players: playersApi,
  indemnity: indemnityApi,
  admin: adminApi,
};

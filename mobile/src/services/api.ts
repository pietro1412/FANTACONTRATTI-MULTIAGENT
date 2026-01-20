/**
 * API Service for FantaContratti Mobile App
 *
 * Axios-based API client with JWT token management via SecureStore
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// ============================================================================
// Configuration
// ============================================================================

// TODO: Use environment variable in production
const API_BASE_URL = 'http://10.138.157.172:3003';

const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

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
  username: string;
  teamName: string | null;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACCEPTED' | 'PENDING' | 'REJECTED';
  budget: number;
  profilePhoto?: string | null;
  joinedAt: string;
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
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
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
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
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
      const response = await apiClient.get<ApiResponse<League[]>>('/api/leagues');
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get league by ID
   */
  getLeagueById: async (id: string): Promise<ApiResponse<League>> => {
    try {
      const response = await apiClient.get<ApiResponse<League>>(`/api/leagues/${id}`);
      return response.data;
    } catch (error) {
      return error as ApiResponse;
    }
  },

  /**
   * Get league members
   */
  getLeagueMembers: async (leagueId: string): Promise<ApiResponse<LeagueMember[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<LeagueMember[]>>(`/api/leagues/${leagueId}/members`);
      return response.data;
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

      return {
        success: true,
        data: {
          ...activeSession,
          currentAuction: auctionResponse.data.data,
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
   * Get ready status
   */
  getReadyStatus: async (
    sessionId: string
  ): Promise<ApiResponse<{ allReady: boolean; readyMembers: string[] }>> => {
    try {
      const response = await apiClient.get<ApiResponse<{ allReady: boolean; readyMembers: string[] }>>(
        `/api/auctions/sessions/${sessionId}/ready-status`
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
};

// In production (Vercel), API is at same origin. In dev, use localhost:3003
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3003')

interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Array<{ message: string; path?: string[] }>
}

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // For cookies
    })

    const data = await response.json() as ApiResponse<T>

    // Handle token refresh on 401
    if (response.status === 401 && endpoint !== '/api/auth/refresh') {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        // Retry the request
        return request(endpoint, options)
      }
    }

    return data
  } catch (error) {
    console.error('API request error:', error)
    return { success: false, message: 'Errore di connessione al server' }
  }
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })

    if (response.ok) {
      const data = await response.json() as { accessToken?: string }
      if (data.accessToken) {
        setAccessToken(data.accessToken)
        return true
      }
    }
  } catch (error) {
    console.error('Token refresh error:', error)
  }

  setAccessToken(null)
  return false
}

// Auth API
export const authApi = {
  register: (data: { email: string; username: string; password: string; confirmPassword: string }) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { emailOrUsername: string; password: string }) =>
    request<{ user: { id: string; email: string; username: string }; accessToken: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ id: string; email: string; username: string; createdAt: string }>('/api/auth/me'),
}

// User API
export const userApi = {
  getProfile: () => request('/api/users/profile'),

  updateProfile: (data: { email?: string; username?: string }) =>
    request('/api/users/profile', { method: 'PUT', body: JSON.stringify(data) }),

  changePassword: (data: { currentPassword: string; newPassword: string; confirmNewPassword: string }) =>
    request('/api/users/password', { method: 'PUT', body: JSON.stringify(data) }),

  updateProfilePhoto: (photoData: string) =>
    request('/api/users/photo', { method: 'PUT', body: JSON.stringify({ photoData }) }),

  removeProfilePhoto: () =>
    request('/api/users/photo', { method: 'DELETE' }),

  // Get pending invites for current user
  getMyPendingInvites: () =>
    request<Array<{
      id: string
      token: string
      leagueId: string
      leagueName: string
      leagueDescription: string | null
      leagueStatus: string
      currentMembers: number
      maxMembers: number
      invitedBy: string
      expiresAt: string
      createdAt: string
    }>>('/api/users/me/invites'),
}

// League API
export const leagueApi = {
  create: (data: {
    name: string
    teamName: string
    description?: string
    minParticipants?: number
    maxParticipants?: number
    initialBudget?: number
    goalkeeperSlots?: number
    defenderSlots?: number
    midfielderSlots?: number
    forwardSlots?: number
    requireEvenNumber?: boolean
  }) => request('/api/leagues', { method: 'POST', body: JSON.stringify(data) }),

  getAll: () => request('/api/leagues'),

  getById: (id: string) => request(`/api/leagues/${id}`),

  getByInviteCode: (code: string) => request(`/api/leagues/join/${code}`),

  update: (id: string, data: Record<string, unknown>) =>
    request(`/api/leagues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  requestJoin: (id: string, teamName: string) =>
    request(`/api/leagues/${id}/join`, { method: 'POST', body: JSON.stringify({ teamName }) }),

  getMembers: (id: string) => request(`/api/leagues/${id}/members`),

  getAllRosters: (id: string) => request(`/api/leagues/${id}/rosters`),

  updateMember: (leagueId: string, memberId: string, action: 'accept' | 'reject' | 'kick') =>
    request(`/api/leagues/${leagueId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ action }),
    }),

  // Start league (admin only)
  start: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/start`, { method: 'POST' }),

  // Leave league
  leave: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/leave`, { method: 'POST' }),

  // Search leagues
  search: (query: string) =>
    request<Array<{
      id: string
      name: string
      description: string | null
      inviteCode: string
      status: string
      maxParticipants: number
      currentParticipants: number
      adminUsername: string
      createdAt: string
    }>>(`/api/leagues/search?q=${encodeURIComponent(query)}`),
}

// Invite API
export const inviteApi = {
  // Create email invite (admin only)
  create: (leagueId: string, email: string, expiresInDays?: number) =>
    request(`/api/leagues/${leagueId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email, expiresInDays }),
    }),

  // Get pending invites for a league (admin only)
  getPending: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/invites`),

  // Cancel an invite (admin only)
  cancel: (inviteId: string) =>
    request(`/api/invites/${inviteId}`, { method: 'DELETE' }),

  // Get invite info by token (public)
  getInfo: (token: string) =>
    request(`/api/invites/${token}`),

  // Get detailed invite info (requires auth)
  getDetails: (token: string) =>
    request<{
      token: string
      email: string
      expiresAt: string
      createdAt: string
      inviter: {
        username: string
        profilePhoto: string | null
      }
      league: {
        id: string
        name: string
        description: string | null
        status: string
        createdAt: string
        config: {
          minParticipants: number
          maxParticipants: number
          initialBudget: number
          slots: {
            goalkeeper: number
            defender: number
            midfielder: number
            forward: number
          }
        }
        admin: {
          username: string
          teamName: string
          profilePhoto: string | null
        } | null
        members: Array<{
          id: string
          role: string
          teamName: string
          username: string
          profilePhoto: string | null
        }>
        currentMembers: number
        availableSpots: number
      }
    }>(`/api/invites/${token}/details`),

  // Accept invite
  accept: (token: string) =>
    request(`/api/invites/${token}/accept`, { method: 'POST' }),

  // Reject invite
  reject: (token: string) =>
    request(`/api/invites/${token}/reject`, { method: 'POST' }),
}

// Player API
export const playerApi = {
  getAll: (filters?: { position?: string; team?: string; search?: string; available?: boolean; leagueId?: string }) => {
    const params = new URLSearchParams()
    if (filters?.position) params.append('position', filters.position)
    if (filters?.team) params.append('team', filters.team)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.available) params.append('available', 'true')
    if (filters?.leagueId) params.append('leagueId', filters.leagueId)
    const query = params.toString()
    return request(`/api/players${query ? `?${query}` : ''}`)
  },

  getById: (id: string) => request(`/api/players/${id}`),

  getTeams: () => request('/api/players/teams'),
}

// Auction API
export const auctionApi = {
  // Sessions
  createSession: (leagueId: string, isRegularMarket: boolean = false) =>
    request(`/api/leagues/${leagueId}/auctions`, {
      method: 'POST',
      body: JSON.stringify({ isRegularMarket }),
    }),

  getSessions: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/auctions`),

  closeSession: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/close`, { method: 'PUT' }),

  setPhase: (sessionId: string, phase: string) =>
    request(`/api/auctions/sessions/${sessionId}/phase`, {
      method: 'PUT',
      body: JSON.stringify({ phase }),
    }),

  updateSessionTimer: (sessionId: string, timerSeconds: number) =>
    request(`/api/auctions/sessions/${sessionId}/timer`, {
      method: 'PUT',
      body: JSON.stringify({ timerSeconds }),
    }),

  // Auction items
  nominatePlayer: (sessionId: string, playerId: string, basePrice?: number) =>
    request(`/api/auctions/sessions/${sessionId}/nominate`, {
      method: 'POST',
      body: JSON.stringify({ playerId, basePrice }),
    }),

  getCurrentAuction: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/current`),

  // Bidding
  placeBid: (auctionId: string, amount: number) =>
    request(`/api/auctions/${auctionId}/bid`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  closeAuction: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/close`, { method: 'PUT' }),

  // Roster
  getRoster: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/roster`),

  getMemberRoster: (leagueId: string, memberId: string) =>
    request(`/api/leagues/${leagueId}/roster/${memberId}`),

  getLeagueRosters: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rosters`),

  // Acknowledgment
  getPendingAcknowledgment: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/pending-acknowledgment`),

  acknowledgeAuction: (auctionId: string, prophecy?: string) =>
    request(`/api/auctions/${auctionId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ prophecy }),
    }),

  // Ready check
  setPendingNomination: (sessionId: string, playerId: string) =>
    request(`/api/auctions/sessions/${sessionId}/nominate-pending`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  confirmNomination: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/confirm-nomination`, {
      method: 'POST',
    }),

  cancelNomination: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/nomination`, {
      method: 'DELETE',
    }),

  markReady: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/ready`, {
      method: 'POST',
    }),

  getReadyStatus: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/ready-status`),

  cancelPendingNomination: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/cancel-nomination`, {
      method: 'PUT',
    }),

  // Roster & managers status
  getMyRosterSlots: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/my-roster-slots`),

  getManagersStatus: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/managers-status`),

  // Heartbeat / Connection tracking
  sendHeartbeat: (sessionId: string, memberId: string) =>
    request(`/api/auctions/sessions/${sessionId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),

  // Test utilities (admin only)
  forceAcknowledgeAll: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/force-acknowledge-all`, { method: 'POST' }),

  forceAllReady: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/force-all-ready`, { method: 'POST' }),

  triggerBotBid: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/bot-bid`, { method: 'POST' }),

  triggerBotTurn: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/bot-turn`, { method: 'POST' }),

  botNominate: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/bot-nominate`, { method: 'POST' }),

  botConfirmNomination: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/bot-confirm-nomination`, { method: 'POST' }),

  completeAllSlots: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/complete-all-slots`, { method: 'POST' }),

  // Appeals / Ricorsi
  submitAppeal: (auctionId: string, content: string) =>
    request(`/api/auctions/${auctionId}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  getAppeals: (leagueId: string, status?: 'PENDING' | 'ACCEPTED' | 'REJECTED') => {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/appeals${query ? `?${query}` : ''}`)
  },

  resolveAppeal: (appealId: string, decision: 'ACCEPTED' | 'REJECTED', resolutionNote?: string) =>
    request(`/api/appeals/${appealId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ decision, resolutionNote }),
    }),

  // Test utilities
  simulateAppeal: (leagueId: string, auctionId?: string) =>
    request(`/api/leagues/${leagueId}/appeals/simulate`, {
      method: 'POST',
      body: JSON.stringify({ auctionId }),
    }),

  // Appeal decision flow
  getAppealStatus: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/appeal-status`),

  acknowledgeAppealDecision: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/acknowledge-appeal-decision`, {
      method: 'POST',
    }),

  markReadyToResume: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/ready-to-resume`, {
      method: 'POST',
    }),

  forceAllAppealAcks: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/force-all-appeal-acks`, {
      method: 'POST',
    }),

  forceAllReadyResume: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/force-all-ready-resume`, {
      method: 'POST',
    }),
}

// Contract API
export const contractApi = {
  getAll: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/contracts`),

  getById: (contractId: string) =>
    request(`/api/contracts/${contractId}`),

  // Create initial contract for a player
  create: (rosterId: string, salary: number, duration: number) =>
    request('/api/contracts/create', {
      method: 'POST',
      body: JSON.stringify({ rosterId, salary, duration }),
    }),

  // Preview contract creation
  previewCreate: (rosterId: string, salary: number, duration: number) =>
    request('/api/contracts/preview-create', {
      method: 'POST',
      body: JSON.stringify({ rosterId, salary, duration }),
    }),

  // Preview renewal
  preview: (contractId: string, newSalary: number, newDuration: number) =>
    request(`/api/contracts/${contractId}/preview`, {
      method: 'POST',
      body: JSON.stringify({ newSalary, newDuration }),
    }),

  // Renew existing contract
  renew: (contractId: string, newSalary: number, newDuration: number) =>
    request(`/api/contracts/${contractId}/renew`, {
      method: 'POST',
      body: JSON.stringify({ newSalary, newDuration }),
    }),

  // Release player (svincola)
  release: (contractId: string) =>
    request(`/api/contracts/${contractId}/release`, { method: 'POST' }),

  // Get consolidation status for current manager
  getConsolidationStatus: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/contracts/consolidation`),

  // Save draft renewals, new contracts, and releases (staging area)
  saveDrafts: (
    leagueId: string,
    renewals: { contractId: string; salary: number; duration: number }[],
    newContracts: { rosterId: string; salary: number; duration: number }[],
    releases: string[] = []  // Contract IDs to mark for release
  ) =>
    request(`/api/leagues/${leagueId}/contracts/save-drafts`, {
      method: 'POST',
      body: JSON.stringify({ renewals, newContracts, releases }),
    }),

  // Consolidate all contracts at once (renewals + new contracts)
  consolidateAll: (
    leagueId: string,
    renewals: { contractId: string; salary: number; duration: number }[],
    newContracts: { rosterId: string; salary: number; duration: number }[]
  ) =>
    request(`/api/leagues/${leagueId}/contracts/consolidate`, {
      method: 'POST',
      body: JSON.stringify({ renewals, newContracts }),
    }),

  // Old consolidate (deprecated, kept for compatibility)
  consolidate: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/contracts/consolidate`, { method: 'POST' }),

  // Get all managers' consolidation status (admin only)
  getAllConsolidationStatus: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/contracts/consolidation-all`),

  // Simulate all managers consolidated (admin test only)
  simulateAllConsolidation: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/contracts/simulate-consolidation`, { method: 'POST' }),
}

// Trade API
export const tradeApi = {
  // Create trade offer
  create: (leagueId: string, data: {
    toMemberId: string
    offeredPlayerIds: string[]
    requestedPlayerIds: string[]
    offeredBudget?: number
    requestedBudget?: number
    message?: string
    durationHours?: number
  }) => request(`/api/leagues/${leagueId}/trades`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Get received offers
  getReceived: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/trades/received`),

  // Get sent offers
  getSent: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/trades/sent`),

  // Get trade history
  getHistory: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/trades/history`),

  // Accept trade
  accept: (tradeId: string) =>
    request(`/api/trades/${tradeId}/accept`, { method: 'PUT' }),

  // Reject trade
  reject: (tradeId: string) =>
    request(`/api/trades/${tradeId}/reject`, { method: 'PUT' }),

  // Cancel trade offer
  cancel: (tradeId: string) =>
    request(`/api/trades/${tradeId}/cancel`, { method: 'PUT' }),

  // Counter offer
  counter: (tradeId: string, data: {
    offeredPlayerIds: string[]
    requestedPlayerIds: string[]
    offeredBudget?: number
    requestedBudget?: number
    message?: string
  }) => request(`/api/trades/${tradeId}/counter`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}

// Rubata API
export const rubataApi = {
  // Set rubata order (Admin)
  setOrder: (leagueId: string, memberOrder: string[]) =>
    request(`/api/leagues/${leagueId}/rubata/order`, {
      method: 'PUT',
      body: JSON.stringify({ memberOrder }),
    }),

  // Get rubata order
  getOrder: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/order`),

  // Get full rubata status
  getStatus: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/status`),

  // Get current turn
  getTurn: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/turn`),

  // Skip current turn (Admin)
  skipTurn: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/skip`, { method: 'PUT' }),

  // Get rubable players for a member
  getRubablePlayers: (leagueId: string, memberId: string) =>
    request(`/api/leagues/${leagueId}/rubata/players/${memberId}`),

  // Put player on plate (start rubata auction)
  putOnPlate: (leagueId: string, rosterId: string) =>
    request(`/api/leagues/${leagueId}/rubata/plate`, {
      method: 'POST',
      body: JSON.stringify({ rosterId }),
    }),

  // Bid on rubata auction
  bid: (auctionId: string, amount: number) =>
    request(`/api/rubata/${auctionId}/bid`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  // Close rubata auction (Admin)
  closeAuction: (auctionId: string) =>
    request(`/api/rubata/${auctionId}/close`, { method: 'PUT' }),

  // ========== BOARD-BASED RUBATA (Timer-based) ==========

  // Get rubata board with current state
  getBoard: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/board`),

  // Generate rubata board (Admin)
  generateBoard: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/board/generate`, { method: 'POST' }),

  // Start rubata (Admin)
  start: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/start`, { method: 'POST' }),

  // Update timers (Admin)
  updateTimers: (leagueId: string, offerTimerSeconds?: number, auctionTimerSeconds?: number) =>
    request(`/api/leagues/${leagueId}/rubata/timers`, {
      method: 'PUT',
      body: JSON.stringify({ offerTimerSeconds, auctionTimerSeconds }),
    }),

  // Make initial offer on current player
  makeOffer: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/offer`, { method: 'POST' }),

  // Bid on active auction
  bidOnAuction: (leagueId: string, amount: number) =>
    request(`/api/leagues/${leagueId}/rubata/auction/bid`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  // Advance to next player (Admin)
  advance: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/advance`, { method: 'POST' }),

  // Go back to previous player (Admin)
  goBack: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/back`, { method: 'POST' }),

  // Close current auction and transfer player (Admin)
  closeCurrentAuction: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/close-auction`, { method: 'POST' }),

  // Pause rubata (Admin)
  pause: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/pause`, { method: 'POST' }),

  // Resume rubata (Admin)
  resume: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/resume`, { method: 'POST' }),

  // ========== READY CHECK ==========

  // Get ready status
  getReadyStatus: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/ready-status`),

  // Set member as ready
  setReady: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/ready`, { method: 'POST' }),

  // Force all ready (Admin)
  forceAllReady: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/force-ready`, { method: 'POST' }),

  // ========== TRANSACTION ACKNOWLEDGMENT ==========

  // Get pending acknowledgment
  getPendingAck: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/pending-ack`),

  // Acknowledge transaction (with optional prophecy)
  acknowledge: (leagueId: string, prophecy?: string) =>
    request(`/api/leagues/${leagueId}/rubata/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ prophecy }),
    }),

  // Force all acknowledge (Admin)
  forceAllAcknowledge: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/force-acknowledge`, { method: 'POST' }),

  // ========== ADMIN SIMULATION ==========

  // Simulate offer from another manager (Admin)
  simulateOffer: (leagueId: string, targetMemberId: string) =>
    request(`/api/leagues/${leagueId}/rubata/simulate-offer`, {
      method: 'POST',
      body: JSON.stringify({ targetMemberId }),
    }),

  // Simulate bid from another manager (Admin)
  simulateBid: (leagueId: string, targetMemberId: string, amount: number) =>
    request(`/api/leagues/${leagueId}/rubata/simulate-bid`, {
      method: 'POST',
      body: JSON.stringify({ targetMemberId, amount }),
    }),

  // Complete rubata with random transactions (Admin - for testing)
  completeWithTransactions: (leagueId: string, stealProbability?: number) =>
    request(`/api/leagues/${leagueId}/rubata/complete-with-transactions`, {
      method: 'POST',
      body: JSON.stringify({ stealProbability }),
    }),

  // ========== PREFERENCES (PREVIEW MODE) ==========

  // Get my preferences
  getPreferences: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/preferences`),

  // Set preference for a player
  setPreference: (leagueId: string, playerId: string, preference: {
    isWatchlist?: boolean
    isAutoPass?: boolean
    maxBid?: number | null
    priority?: number | null
    notes?: string | null
  }) =>
    request(`/api/leagues/${leagueId}/rubata/preferences/${playerId}`, {
      method: 'PUT',
      body: JSON.stringify(preference),
    }),

  // Delete preference for a player
  deletePreference: (leagueId: string, playerId: string) =>
    request(`/api/leagues/${leagueId}/rubata/preferences/${playerId}`, {
      method: 'DELETE',
    }),

  // Get preview board with preferences
  getPreviewBoard: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/preview`),

  // Set rubata to preview mode (Admin)
  setToPreview: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/rubata/preview`, { method: 'POST' }),

  // Year-round strategies - Get all players with strategies
  getAllPlayersForStrategies: (leagueId: string) =>
    request<{
      players: Array<{
        rosterId: string
        memberId: string
        playerId: string
        playerName: string
        playerPosition: string
        playerTeam: string
        playerQuotation: number
        ownerUsername: string
        ownerTeamName: string | null
        ownerRubataOrder: number | null
        contractSalary: number
        contractDuration: number
        contractClause: number
        rubataPrice: number
        preference: {
          id: string
          playerId: string
          memberId: string
          maxBid: number | null
          priority: number | null
          notes: string | null
          isWatchlist: boolean
          isAutoPass: boolean
        } | null
      }>
      myMemberId: string
      hasRubataBoard: boolean
      hasRubataOrder: boolean
      rubataState: string | null
      sessionId: string | null
      totalPlayers: number
    }>(`/api/leagues/${leagueId}/rubata/strategies`),

  // Year-round strategies - Get all svincolati (free agents) with strategies
  getAllSvincolatiForStrategies: (leagueId: string) =>
    request<{
      players: Array<{
        playerId: string
        playerName: string
        playerPosition: string
        playerTeam: string
        preference: {
          id: string
          playerId: string
          memberId: string
          maxBid: number | null
          priority: number | null
          notes: string | null
          isWatchlist: boolean
          isAutoPass: boolean
        } | null
      }>
      myMemberId: string
      sessionId: string | null
      totalPlayers: number
    }>(`/api/leagues/${leagueId}/rubata/svincolati-strategies`),
}

// Svincolati (Free Agents) API
export const svincolatiApi = {
  // Get free agents pool with filters
  getAll: (leagueId: string, filters?: {
    position?: string
    team?: string
    search?: string
    minQuotation?: number
    maxQuotation?: number
  }) => {
    const params = new URLSearchParams()
    if (filters?.position) params.append('position', filters.position)
    if (filters?.team) params.append('team', filters.team)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.minQuotation) params.append('minQuotation', filters.minQuotation.toString())
    if (filters?.maxQuotation) params.append('maxQuotation', filters.maxQuotation.toString())
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/svincolati${query ? `?${query}` : ''}`)
  },

  // Get teams list
  getTeams: () =>
    request('/api/svincolati/teams'),

  // Get current auction status
  getCurrentAuction: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/current`),

  // Get auction history
  getHistory: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/history`),

  // Start auction for a free agent (Admin)
  startAuction: (leagueId: string, playerId: string, basePrice?: number) =>
    request(`/api/leagues/${leagueId}/svincolati/auction`, {
      method: 'POST',
      body: JSON.stringify({ playerId, basePrice }),
    }),

  // Bid on free agent auction
  bid: (auctionId: string, amount: number) =>
    request(`/api/svincolati/${auctionId}/bid`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  // Close free agent auction (Admin)
  closeAuction: (auctionId: string) =>
    request(`/api/svincolati/${auctionId}/close`, { method: 'PUT' }),

  // Trigger bot bidding simulation
  triggerBotBid: (auctionId: string) =>
    request(`/api/svincolati/${auctionId}/bot-bid`, { method: 'POST' }),

  // Get bot members info
  getBots: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/bots`),

  // ==== NUOVE API A TURNI ====

  // Get svincolati board state
  getBoard: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/board`),

  // Set turn order (Admin)
  setTurnOrder: (leagueId: string, memberIds: string[]) =>
    request(`/api/leagues/${leagueId}/svincolati/turn-order`, {
      method: 'POST',
      body: JSON.stringify({ memberIds }),
    }),

  // Nominate a free agent
  nominate: (leagueId: string, playerId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/nominate`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  // Confirm nomination
  confirmNomination: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/confirm`, { method: 'PUT' }),

  // Cancel nomination
  cancelNomination: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/nomination`, { method: 'DELETE' }),

  // Mark ready
  markReady: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/ready`, { method: 'POST' }),

  // Pass turn
  passTurn: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/pass`, { method: 'POST' }),

  // Force all ready (Admin)
  forceAllReady: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/force-ready`, { method: 'POST' }),

  // Close svincolati auction (turn-based)
  closeTurnAuction: (auctionId: string) =>
    request(`/api/svincolati/${auctionId}/close-turn`, { method: 'PUT' }),

  // Acknowledge auction result
  acknowledge: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/acknowledge`, { method: 'POST' }),

  // Force all acks (Admin)
  forceAllAck: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/force-ack`, { method: 'POST' }),

  // Set timer (Admin)
  setTimer: (leagueId: string, timerSeconds: number) =>
    request(`/api/leagues/${leagueId}/svincolati/timer`, {
      method: 'PUT',
      body: JSON.stringify({ timerSeconds }),
    }),

  // Complete svincolati phase (Admin)
  completePhase: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/complete`, { method: 'PUT' }),

  // ==== BOT SIMULATION (ADMIN TEST) ====

  // Bot nominate random player (Admin)
  botNominate: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/bot-nominate`, { method: 'POST' }),

  // Bot confirm nomination (Admin)
  botConfirmNomination: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/bot-confirm`, { method: 'POST' }),

  // Bot bid on auction (Admin)
  botBid: (auctionId: string) =>
    request(`/api/svincolati/${auctionId}/bot-bid-turn`, { method: 'POST' }),

  // Declare finished with phase (can't bid anymore)
  declareFinished: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/finished`, { method: 'POST' }),

  // Undo declare finished (can bid again)
  undoFinished: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/finished`, { method: 'DELETE' }),

  // Force all managers as finished (Admin)
  forceAllFinished: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/svincolati/force-all-finished`, { method: 'POST' }),
}

// Admin API
export const adminApi = {
  // Export all rosters (Admin)
  exportRosters: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/admin/export/rosters`),

  // Get audit log (Admin)
  getAuditLog: (leagueId: string, options?: { limit?: number; offset?: number; action?: string }) => {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    if (options?.action) params.append('action', options.action)
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/admin/audit${query ? `?${query}` : ''}`)
  },

  // Get league statistics
  getStatistics: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/admin/stats`),

  // Reset first market (Admin)
  resetFirstMarket: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/admin/reset-first-market`, { method: 'POST' }),

  // Get members for prize assignment (Admin)
  getMembersForPrizes: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/admin/prizes/members`),

  // Get prize history (Admin)
  getPrizeHistory: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/admin/prizes`),

  // Assign prize to a member (Admin)
  assignPrize: (leagueId: string, memberId: string, amount: number, reason?: string) =>
    request(`/api/leagues/${leagueId}/admin/prizes`, {
      method: 'POST',
      body: JSON.stringify({ memberId, amount, reason }),
    }),
}

// Movement API (Storico Movimenti)
export const movementApi = {
  // Get league movements history
  getLeagueMovements: (leagueId: string, options?: {
    limit?: number
    offset?: number
    movementType?: string
    playerId?: string
    semester?: number
  }) => {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    if (options?.movementType) params.append('movementType', options.movementType)
    if (options?.playerId) params.append('playerId', options.playerId)
    if (options?.semester) params.append('semester', options.semester.toString())
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/movements${query ? `?${query}` : ''}`)
  },

  // Get player history in league
  getPlayerHistory: (leagueId: string, playerId: string) =>
    request(`/api/leagues/${leagueId}/players/${playerId}/history`),

  // Get player prophecies
  getPlayerProphecies: (leagueId: string, playerId: string) =>
    request(`/api/leagues/${leagueId}/players/${playerId}/prophecies`),

  // Check if user can make prophecy on a movement
  canMakeProphecy: (movementId: string) =>
    request(`/api/movements/${movementId}/can-prophecy`),

  // Add prophecy to movement
  addProphecy: (movementId: string, content: string) =>
    request(`/api/movements/${movementId}/prophecy`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
}

// First Market API (Primo Mercato)
export const firstMarketApi = {
  // Set turn order for first market (admin only)
  setTurnOrder: (sessionId: string, memberOrder: string[]) =>
    request(`/api/auctions/sessions/${sessionId}/turn-order`, {
      method: 'PUT',
      body: JSON.stringify({ memberOrder }),
    }),

  // Get first market status
  getStatus: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/first-market-status`),

  // Advance to next role (admin only)
  advanceRole: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/advance-role`, { method: 'PUT' }),

  // Advance to next turn (admin only)
  advanceTurn: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/advance-turn`, { method: 'PUT' }),

  // Nominate player (current turn manager)
  nominatePlayer: (sessionId: string, playerId: string) =>
    request(`/api/auctions/sessions/${sessionId}/manager-nominate`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  // Cancel last winning bid (admin only)
  cancelLastBid: (auctionId: string) =>
    request(`/api/auctions/${auctionId}/cancel-bid`, { method: 'PUT' }),

  // Get pending acknowledgment for session
  getPendingAcknowledgment: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/pending-acknowledgment`),

  // Acknowledge auction completion (with optional prophecy)
  acknowledgeAuction: (auctionId: string, prophecy?: string) =>
    request(`/api/auctions/${auctionId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ prophecy }),
    }),

  // ==================== READY CHECK ====================

  // Set pending nomination (manager nominates, waiting for ready check)
  setPendingNomination: (sessionId: string, playerId: string) =>
    request(`/api/auctions/sessions/${sessionId}/nominate-pending`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  // Mark current user as ready
  markReady: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/ready`, {
      method: 'POST',
    }),

  // Get ready check status
  getReadyStatus: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/ready-status`),

  // Cancel pending nomination (admin only)
  cancelPendingNomination: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/cancel-nomination`, {
      method: 'PUT',
    }),

  // ==================== ROSTER & MANAGERS STATUS ====================

  // Get my roster slots
  getMyRosterSlots: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/my-roster-slots`),

  // Get all managers status
  getManagersStatus: (sessionId: string) =>
    request(`/api/auctions/sessions/${sessionId}/managers-status`),
}

// Superadmin API (Gestione Quotazioni)
export const superadminApi = {
  // Check if current user is superadmin
  getStatus: () =>
    request('/api/superadmin/status'),

  // Upload quotazioni file
  importQuotazioni: async (file: File, sheetName?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (sheetName) formData.append('sheetName', sheetName)

    const headers: HeadersInit = {}
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(`${API_URL}/api/superadmin/quotazioni/import`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    })
    return response.json()
  },

  // Get upload history
  getUploadHistory: () =>
    request('/api/superadmin/quotazioni/history'),

  // Delete all players
  deleteAllPlayers: () =>
    request('/api/superadmin/players', { method: 'DELETE' }),

  // Get players statistics
  getPlayersStats: () =>
    request('/api/superadmin/players/stats'),

  // Get players list
  getPlayers: (filters?: { position?: string; listStatus?: string; search?: string; team?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams()
    if (filters?.position) params.append('position', filters.position)
    if (filters?.listStatus) params.append('listStatus', filters.listStatus)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.team) params.append('team', filters.team)
    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.limit) params.append('limit', String(filters.limit))
    const query = params.toString()
    return request(`/api/superadmin/players${query ? `?${query}` : ''}`)
  },

  // Get all leagues (supports search by name or username)
  getLeagues: (search?: string) => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    const query = params.toString()
    return request(`/api/superadmin/leagues${query ? `?${query}` : ''}`)
  },

  // Get member roster
  getMemberRoster: (memberId: string) =>
    request(`/api/superadmin/roster/${memberId}`),

  // Get all users
  getUsers: () =>
    request('/api/superadmin/users'),

  // Grant/revoke superadmin privileges
  setAdmin: (targetUserId: string, isSuperAdmin: boolean) =>
    request('/api/superadmin/grant', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, isSuperAdmin }),
    }),
}

// Chat API
export const chatApi = {
  // Get messages (optionally since a timestamp)
  getMessages: (sessionId: string, since?: string) => {
    const params = new URLSearchParams()
    if (since) params.append('since', since)
    const query = params.toString()
    return request(`/api/sessions/${sessionId}/chat${query ? `?${query}` : ''}`)
  },

  // Send a message
  sendMessage: (sessionId: string, content: string) =>
    request(`/api/sessions/${sessionId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Simulate random bot message (Admin only)
  simulateMessage: (sessionId: string) =>
    request(`/api/sessions/${sessionId}/chat/simulate`, { method: 'POST' }),
}

// Prize Phase API (Fase PREMI)
export const prizePhaseApi = {
  // Initialize prize phase for session (Admin)
  initialize: (sessionId: string) =>
    request(`/api/sessions/${sessionId}/prizes/init`, { method: 'POST' }),

  // Get prize phase data
  getData: (sessionId: string) =>
    request(`/api/sessions/${sessionId}/prizes`),

  // Update base reincrement (Admin)
  updateBaseReincrement: (sessionId: string, amount: number) =>
    request(`/api/sessions/${sessionId}/prizes/base-reincrement`, {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    }),

  // Create prize category (Admin)
  createCategory: (sessionId: string, name: string) =>
    request(`/api/sessions/${sessionId}/prizes/categories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // Delete prize category (Admin)
  deleteCategory: (categoryId: string) =>
    request(`/api/prizes/categories/${categoryId}`, { method: 'DELETE' }),

  // Set member prize amount (Admin)
  setMemberPrize: (categoryId: string, memberId: string, amount: number) =>
    request(`/api/prizes/categories/${categoryId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    }),

  // Finalize prize phase (Admin)
  finalize: (sessionId: string) =>
    request(`/api/sessions/${sessionId}/prizes/finalize`, { method: 'POST' }),

  // Get prize history for league
  getHistory: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/prizes/history`),
}

// History API (Storico Lega)
export const historyApi = {
  // Get sessions overview
  getSessionsOverview: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/history/sessions`),

  // Get session details
  getSessionDetails: (leagueId: string, sessionId: string) =>
    request(`/api/leagues/${leagueId}/history/sessions/${sessionId}`),

  // Get first market history
  getFirstMarketHistory: (leagueId: string, sessionId: string) =>
    request(`/api/leagues/${leagueId}/history/sessions/${sessionId}/first-market`),

  // Get session trades
  getSessionTrades: (leagueId: string, sessionId: string, options?: {
    status?: 'ALL' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'COUNTERED'
    limit?: number
    offset?: number
  }) => {
    const params = new URLSearchParams()
    if (options?.status) params.append('status', options.status)
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/history/sessions/${sessionId}/trades${query ? `?${query}` : ''}`)
  },

  // Get session prizes
  getSessionPrizes: (leagueId: string, sessionId: string) =>
    request(`/api/leagues/${leagueId}/history/sessions/${sessionId}/prizes`),

  // Get rubata history
  getSessionRubata: (leagueId: string, sessionId: string) =>
    request(`/api/leagues/${leagueId}/history/sessions/${sessionId}/rubata`),

  // Get svincolati history
  getSessionSvincolati: (leagueId: string, sessionId: string) =>
    request(`/api/leagues/${leagueId}/history/sessions/${sessionId}/svincolati`),

  // Get timeline events
  getTimeline: (leagueId: string, options?: {
    limit?: number
    offset?: number
    eventTypes?: string[]
    sessionId?: string
    playerId?: string
    startDate?: string
    endDate?: string
  }) => {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))
    if (options?.eventTypes) params.append('eventTypes', options.eventTypes.join(','))
    if (options?.sessionId) params.append('sessionId', options.sessionId)
    if (options?.playerId) params.append('playerId', options.playerId)
    if (options?.startDate) params.append('startDate', options.startDate)
    if (options?.endDate) params.append('endDate', options.endDate)
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/history/timeline${query ? `?${query}` : ''}`)
  },

  // Get player career
  getPlayerCareer: (leagueId: string, playerId: string) =>
    request(`/api/leagues/${leagueId}/history/players/${playerId}`),

  // Search players for filter
  searchPlayers: (leagueId: string, search?: string, options?: {
    includeReleased?: boolean
    limit?: number
  }) => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (options?.includeReleased) params.append('includeReleased', 'true')
    if (options?.limit) params.append('limit', String(options.limit))
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/history/players/search${query ? `?${query}` : ''}`)
  },

  // Get prophecies with filters
  getProphecies: (leagueId: string, options?: {
    playerId?: string
    authorId?: string
    search?: string
    limit?: number
    offset?: number
  }) => {
    const params = new URLSearchParams()
    if (options?.playerId) params.append('playerId', options.playerId)
    if (options?.authorId) params.append('authorId', options.authorId)
    if (options?.search) params.append('search', options.search)
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))
    const query = params.toString()
    return request(`/api/leagues/${leagueId}/history/prophecies${query ? `?${query}` : ''}`)
  },

  // Get prophecy stats
  getProphecyStats: (leagueId: string) =>
    request(`/api/leagues/${leagueId}/history/prophecies/stats`),
}

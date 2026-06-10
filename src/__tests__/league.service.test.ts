/**
 * league.service.test.ts - Unit Tests for League Service
 *
 * Tests for league creation, membership, admin operations, financials, and strategy.
 *
 * Creato il: 19/02/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    league: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    managerSessionSnapshot: {
      findMany: vi.fn(),
    },
    contractConsolidation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    contractHistory: {
      findMany: vi.fn(),
    },
    tradeOffer: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auctionAppeal: {
      count: vi.fn(),
    },
    auction: {
      count: vi.fn(),
    },
    rubataPreference: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  }

  // Create a proper class constructor
  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma with hoisted mock
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  MemberRole: { ADMIN: 'ADMIN', MANAGER: 'MANAGER' },
  MemberStatus: {
    ACTIVE: 'ACTIVE',
    PENDING: 'PENDING',
    LEFT: 'LEFT',
    REMOVED: 'REMOVED',
    SUSPENDED: 'SUSPENDED',
  },
  JoinType: { CREATOR: 'CREATOR', INVITE: 'INVITE', REQUEST: 'REQUEST' },
  TradeStatus: { ACCEPTED: 'ACCEPTED', PENDING: 'PENDING' },
}))

// Mock player-stats.service to avoid real DB calls
vi.mock('../services/player-stats.service', () => ({
  computeSeasonStatsBatch: vi.fn().mockResolvedValue(new Map()),
}))

// Mock the email service dynamic import (used inside league.service.ts)
vi.mock('../modules/identity/infrastructure/services/gmail-email.service', () => ({
  GmailEmailService: vi.fn().mockImplementation(() => ({
    sendJoinRequestNotificationEmail: vi.fn().mockResolvedValue(undefined),
    sendJoinRequestResponseEmail: vi.fn().mockResolvedValue(undefined),
    sendMemberExpelledEmail: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Import after mocking
import * as leagueService from '../services/league.service'

describe('League Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== createLeague ====================

  describe('createLeague', () => {
    it('should create a league successfully', async () => {
      const createdLeague = {
        id: 'league-1',
        name: 'Test League',
        inviteCode: 'league-1',
        initialBudget: 200,
        members: [
          {
            userId: 'user-1',
            role: 'ADMIN',
            status: 'ACTIVE',
            teamName: 'My Team',
            user: { id: 'user-1', username: 'admin', email: 'admin@test.it' },
          },
        ],
      }
      mockPrisma.league.create.mockResolvedValue(createdLeague)

      const result = await leagueService.createLeague('user-1', {
        name: 'Test League',
        maxParticipants: 10,
        initialBudget: 200,
        goalkeeperSlots: 3,
        defenderSlots: 8,
        midfielderSlots: 8,
        forwardSlots: 6,
        teamName: 'My Team',
        isPublic: false,
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Lega creata con successo')
      expect(result.data).toBeDefined()
      expect(mockPrisma.league.create).toHaveBeenCalledOnce()
    })

    it('should reject when maxParticipants exceeds 20', async () => {
      const result = await leagueService.createLeague('user-1', {
        name: 'Big League',
        maxParticipants: 25,
        initialBudget: 200,
        goalkeeperSlots: 3,
        defenderSlots: 8,
        midfielderSlots: 8,
        forwardSlots: 6,
        teamName: 'My Team',
        isPublic: false,
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('non può superare 20')
      expect(mockPrisma.league.create).not.toHaveBeenCalled()
    })

    it('should reject when teamName is missing or too short', async () => {
      const result = await leagueService.createLeague('user-1', {
        name: 'Test League',
        maxParticipants: 10,
        initialBudget: 200,
        goalkeeperSlots: 3,
        defenderSlots: 8,
        midfielderSlots: 8,
        forwardSlots: 6,
        teamName: 'A', // too short — minimum 2 characters
        isPublic: false,
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('nome della squadra')
      expect(mockPrisma.league.create).not.toHaveBeenCalled()
    })
  })

  // ==================== getLeaguesByUser ====================

  describe('getLeaguesByUser', () => {
    it('should return leagues the user belongs to', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          role: 'ADMIN',
          status: 'ACTIVE',
          currentBudget: 200,
          league: {
            id: 'league-1',
            name: 'Test League',
            members: [{ id: 'member-1', role: 'ADMIN', user: { id: 'user-1', username: 'admin' } }],
          },
        },
      ])

      const result = await leagueService.getLeaguesByUser('user-1')

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      const data = result.data as Array<{ membership: { id: string }; league: { id: string } }>
      expect(data).toHaveLength(1)
      const first = data[0] as { membership: { id: string }; league: { id: string } }
      expect(first.membership.id).toBe('member-1')
      expect(first.league.id).toBe('league-1')
    })

    it('should return empty array when user has no leagues', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([])

      const result = await leagueService.getLeaguesByUser('user-no-leagues')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  // ==================== getLeagueById ====================

  describe('getLeagueById', () => {
    it('should return league details with balance calculation', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        name: 'Test League',
        members: [
          {
            id: 'member-1',
            userId: 'user-1',
            role: 'ADMIN',
            currentBudget: 200,
            roster: [
              { contract: { salary: 10 } },
              { contract: { salary: 15 } },
            ],
          },
        ],
      })

      const result = await leagueService.getLeagueById('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as {
        league: { members: Array<{ totalSalaries: number; balance: number }> }
        userMembership: { totalSalaries: number; balance: number }
        isAdmin: boolean
      }
      const firstMember = data.league.members[0] as { totalSalaries: number; balance: number }
      expect(firstMember.totalSalaries).toBe(25)
      expect(firstMember.balance).toBe(175) // 200 - 25
      expect(data.isAdmin).toBe(true)
    })

    it('should return error when league not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null)

      const result = await leagueService.getLeagueById('nonexistent', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Lega non trovata')
    })

    it('should return null userMembership when user is not a member', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        name: 'Test League',
        members: [
          {
            id: 'member-1',
            userId: 'other-user',
            role: 'ADMIN',
            currentBudget: 200,
            roster: [],
          },
        ],
      })

      const result = await leagueService.getLeagueById('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { userMembership: unknown; isAdmin: boolean }
      expect(data.userMembership).toBeNull()
      expect(data.isAdmin).toBe(false)
    })
  })

  // ==================== requestJoinLeague ====================

  describe('requestJoinLeague', () => {
    it('should create a pending membership for a new user', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        isPublic: true,
        maxParticipants: 10,
        members: [{ role: 'ADMIN', user: { email: 'admin@test.it' } }],
      })
      mockPrisma.leagueMember.findUnique.mockResolvedValue(null)
      mockPrisma.leagueMember.create.mockResolvedValue({
        id: 'member-2',
        userId: 'user-2',
        leagueId: 'league-1',
        status: 'PENDING',
        teamName: 'New Team',
      })

      const result = await leagueService.requestJoinLeague('league-1', 'user-2', 'New Team')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Richiesta di partecipazione inviata')
      expect(mockPrisma.leagueMember.create).toHaveBeenCalledOnce()
    })

    it('should return error when league not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null)

      const result = await leagueService.requestJoinLeague('nonexistent', 'user-2', 'Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Lega non trovata')
    })

    it('should return error when league is ACTIVE (not DRAFT)', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'ACTIVE',
        isPublic: true,
        maxParticipants: 10,
        members: [],
      })

      const result = await leagueService.requestJoinLeague('league-1', 'user-2', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toContain('già stata avviata')
    })

    it('should return error when league is full', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        isPublic: true,
        maxParticipants: 1,
        members: [{ role: 'ADMIN', user: { email: 'admin@test.it' } }],
      })

      const result = await leagueService.requestJoinLeague('league-1', 'user-2', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Lega al completo')
    })

    it('should return error when user already has an active membership', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        isPublic: true,
        maxParticipants: 10,
        members: [{ role: 'ADMIN', user: { email: 'admin@test.it' } }],
      })
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-2',
        status: 'ACTIVE',
      })

      const result = await leagueService.requestJoinLeague('league-1', 'user-2', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sei già membro di questa lega')
    })

    it('should return error when team name is too short', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        isPublic: true,
        maxParticipants: 10,
        members: [{ role: 'ADMIN', user: { email: 'admin@test.it' } }],
      })
      mockPrisma.leagueMember.findUnique.mockResolvedValue(null)

      const result = await leagueService.requestJoinLeague('league-1', 'user-2', 'X')

      expect(result.success).toBe(false)
      expect(result.message).toContain('nome della squadra')
    })
  })

  // ==================== updateMemberStatus ====================

  describe('updateMemberStatus', () => {
    it('should accept a pending member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-2',
        leagueId: 'league-1',
        role: 'MANAGER',
        status: 'PENDING',
        league: { status: 'DRAFT', initialBudget: 200, name: 'Test' },
        user: { email: 'user@test.it' },
      })
      mockPrisma.leagueMember.update.mockResolvedValue({})

      const result = await leagueService.updateMemberStatus('league-1', 'member-2', 'admin-user', 'accept')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Membro accettato')
      expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'member-2' },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        })
      )
    })

    it('should reject a pending member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-2',
        leagueId: 'league-1',
        role: 'MANAGER',
        status: 'PENDING',
        league: { status: 'DRAFT', name: 'Test' },
        user: { email: 'user@test.it' },
      })
      mockPrisma.leagueMember.update.mockResolvedValue({})

      const result = await leagueService.updateMemberStatus('league-1', 'member-2', 'admin-user', 'reject')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Richiesta rifiutata')
    })

    it('should return error when non-admin tries to act', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null) // not admin

      const result = await leagueService.updateMemberStatus('league-1', 'member-2', 'non-admin', 'accept')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('should prevent kicking an admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'admin-target',
        leagueId: 'league-1',
        role: 'ADMIN',
        status: 'ACTIVE',
        league: { status: 'DRAFT', name: 'Test' },
        user: null,
      })

      const result = await leagueService.updateMemberStatus('league-1', 'admin-target', 'admin-user', 'kick')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non puoi rimuovere un admin')
    })

    it('should prevent kicking members after league is ACTIVE', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-2',
        leagueId: 'league-1',
        role: 'MANAGER',
        status: 'ACTIVE',
        league: { status: 'ACTIVE', name: 'Test' },
        user: null,
      })

      const result = await leagueService.updateMemberStatus('league-1', 'member-2', 'admin-user', 'kick')

      expect(result.success).toBe(false)
      expect(result.message).toContain("Non puoi rimuovere membri dopo l'avvio")
    })
  })

  // ==================== startLeague ====================

  describe('startLeague', () => {
    it('should start a league with enough members', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        maxParticipants: 10,
        requireEvenNumber: false,
        members: Array.from({ length: 6 }, (_, i) => ({ id: `member-${i}` })),
      })
      mockPrisma.league.update.mockResolvedValue({})
      mockPrisma.leagueMember.updateMany.mockResolvedValue({ count: 0 })

      const result = await leagueService.startLeague('league-1', 'admin-user')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Lega avviata con successo!')
      const data = result.data as { participantsCount: number }
      expect(data.participantsCount).toBe(6)
    })

    it('should return error when not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await leagueService.startLeague('league-1', 'non-admin')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('should return error when fewer than 6 members', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        maxParticipants: 10,
        requireEvenNumber: false,
        members: [{ id: 'member-1' }, { id: 'member-2' }], // only 2
      })

      const result = await leagueService.startLeague('league-1', 'admin-user')

      expect(result.success).toBe(false)
      expect(result.message).toContain('almeno 6 partecipanti')
    })

    it('should return error when league already started', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'ACTIVE',
        members: [],
      })

      const result = await leagueService.startLeague('league-1', 'admin-user')

      expect(result.success).toBe(false)
      expect(result.message).toBe('La lega è già stata avviata')
    })
  })

  // ==================== leaveLeague ====================

  describe('leaveLeague', () => {
    it('should allow a pending member to cancel their request', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-2',
        status: 'PENDING',
        role: 'MANAGER',
        league: { status: 'DRAFT' },
      })
      mockPrisma.leagueMember.update.mockResolvedValue({})

      const result = await leagueService.leaveLeague('league-1', 'user-2')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Richiesta di partecipazione annullata')
    })

    it('should return error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await leagueService.leaveLeague('league-1', 'outsider')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should prevent active member from leaving after league starts', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-2',
        status: 'ACTIVE',
        role: 'MANAGER',
        league: { status: 'ACTIVE' },
      })

      const result = await leagueService.leaveLeague('league-1', 'user-2')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Non puoi lasciare la lega dopo')
    })

    it('should prevent admin from leaving', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        status: 'ACTIVE',
        role: 'ADMIN',
        league: { status: 'DRAFT' },
      })

      const result = await leagueService.leaveLeague('league-1', 'admin-user')

      expect(result.success).toBe(false)
      expect(result.message).toContain("L'admin non può lasciare la lega")
    })
  })

  // ==================== searchLeagues ====================

  describe('searchLeagues', () => {
    it('should return matching leagues excluding user memberships', async () => {
      mockPrisma.league.findMany.mockResolvedValue([
        {
          id: 'league-1',
          name: 'Serie A Dynasty',
          description: 'Test league',
          status: 'DRAFT',
          maxParticipants: 10,
          createdAt: new Date(),
          members: [
            { role: 'ADMIN', user: { id: 'other-user', username: 'admin_user' } },
          ],
        },
      ])
      mockPrisma.leagueMember.findMany.mockResolvedValue([]) // user not in any league

      const result = await leagueService.searchLeagues('user-1', 'Dynasty')

      expect(result.success).toBe(true)
      const data = result.data as Array<{ name: string; adminUsername: string }>
      expect(data).toHaveLength(1)
      const firstLeague = data[0] as { name: string; adminUsername: string }
      expect(firstLeague.name).toBe('Serie A Dynasty')
      expect(firstLeague.adminUsername).toBe('admin_user')
    })

    it('should return error when query is too short', async () => {
      const result = await leagueService.searchLeagues('user-1', 'A')

      expect(result.success).toBe(false)
      expect(result.message).toContain('almeno 2 caratteri')
    })
  })

  // ==================== getStrategySummary ====================

  describe('getStrategySummary', () => {
    it('should return strategy watchlist counts', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.rubataPreference.groupBy.mockResolvedValue([
        { watchlistCategory: 'DA_RUBARE', _count: 5 },
        { watchlistCategory: 'SOTTO_OSSERVAZIONE', _count: 3 },
        { watchlistCategory: 'DA_VENDERE', _count: 2 },
      ])
      mockPrisma.rubataPreference.count.mockResolvedValue(4)

      const result = await leagueService.getStrategySummary('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { targets: number; watching: number; toSell: number; topPriority: number; total: number }
      expect(data.targets).toBe(5)
      expect(data.watching).toBe(3)
      expect(data.toSell).toBe(2)
      expect(data.topPriority).toBe(4)
      expect(data.total).toBe(10)
    })

    it('should return error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await leagueService.getStrategySummary('league-1', 'outsider')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })
  })

  // ==================== getLeagueFinancials ====================

  describe('getLeagueFinancials', () => {
    it('should return error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await leagueService.getLeagueFinancials('league-1', 'outsider')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return financial data for a league', async () => {
      // Membership check
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'member-1', role: 'ADMIN' }) // membership check
      // No active CONTRATTI session
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(null) // CONTRATTI session check
        .mockResolvedValueOnce(null) // active session check
      // Members with roster
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          userId: 'user-1',
          role: 'ADMIN',
          teamName: 'Team Alpha',
          currentBudget: 200,
          preConsolidationBudget: null,
          user: { username: 'admin' },
          roster: [
            {
              status: 'ACTIVE',
              acquisitionPrice: 10,
              player: { id: 'p1', name: 'Player 1', team: 'Milan', position: 'A', quotation: 30, age: 25 },
              contract: {
                salary: 15,
                duration: 2,
                rescissionClause: 5,
                draftSalary: null,
                draftDuration: null,
                draftReleased: false,
                preConsolidationSalary: null,
                preConsolidationDuration: null,
              },
            },
          ],
        },
      ])
      // League settings
      mockPrisma.league.findUnique.mockResolvedValue({
        name: 'Test League',
        goalkeeperSlots: 3,
        defenderSlots: 8,
        midfielderSlots: 8,
        forwardSlots: 6,
      })
      // Market sessions for phase selector
      mockPrisma.marketSession.findMany.mockResolvedValue([])

      const result = await leagueService.getLeagueFinancials('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as {
        leagueName: string
        maxSlots: number
        teams: Array<{ budget: number; annualContractCost: number; slotCount: number }>
        isAdmin: boolean
      }
      expect(data.leagueName).toBe('Test League')
      expect(data.maxSlots).toBe(25) // 3+8+8+6
      expect(data.teams).toHaveLength(1)
      const firstTeam = data.teams[0] as { budget: number; annualContractCost: number; slotCount: number }
      expect(firstTeam.budget).toBe(200)
      expect(firstTeam.annualContractCost).toBe(15)
      expect(firstTeam.slotCount).toBe(1)
      expect(data.isAdmin).toBe(true)
    })
  })

  // ==================== getPendingJoinRequests ====================

  describe('getPendingJoinRequests', () => {
    it('should return pending requests for admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        {
          id: 'member-2',
          status: 'PENDING',
          user: { id: 'user-2', username: 'requester', email: 'req@test.it', profilePhoto: null },
        },
      ])

      const result = await leagueService.getPendingJoinRequests('league-1', 'admin-user')

      expect(result.success).toBe(true)
      const data = result.data as Array<{ id: string }>
      expect(data).toHaveLength(1)
    })

    it('should return error when caller is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await leagueService.getPendingJoinRequests('league-1', 'non-admin')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })
  })

  // ==================== getDashboardSummary ====================

  describe('getDashboardSummary', () => {
    it('returns phase + admin signals for an admin in an active league', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-1', leagueId: 'league-1', role: 'ADMIN' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-1', type: 'MERCATO_RICORRENTE', currentPhase: 'OFFERTE_PRE_RINNOVO',
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(2)
      mockPrisma.leagueMember.count.mockResolvedValue(1) // pending join requests
      mockPrisma.auctionAppeal.count.mockResolvedValue(0)

      const result = await leagueService.getDashboardSummary('user-1')

      expect(result.success).toBe(true)
      const summaries = (result.data as { summaries: Record<string, unknown> }).summaries
      expect(summaries['league-1']).toEqual({
        phase: { type: 'MERCATO_RICORRENTE', currentPhase: 'OFFERTE_PRE_RINNOVO' },
        tradeOffersReceived: 2,
        isAdmin: true,
        pendingJoinRequests: 1,
        pendingAppeals: 0,
        needsConsolidation: false,
        isYourTurn: false,
        turnTarget: null,
      })
    })

    it('does not count admin-only signals for a non-admin member', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-2', leagueId: 'league-2', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-2', type: 'MERCATO_RICORRENTE', currentPhase: 'OFFERTE_PRE_RINNOVO',
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(0)

      const result = await leagueService.getDashboardSummary('user-2')

      const summaries = (result.data as { summaries: Record<string, { isAdmin: boolean; pendingJoinRequests: number; pendingAppeals: number }> }).summaries
      expect(summaries['league-2']?.isAdmin).toBe(false)
      expect(summaries['league-2']?.pendingJoinRequests).toBe(0)
      expect(summaries['league-2']?.pendingAppeals).toBe(0)
      // admin-only counts must not be queried for a non-admin
      expect(mockPrisma.leagueMember.count).not.toHaveBeenCalled()
      expect(mockPrisma.auctionAppeal.count).not.toHaveBeenCalled()
    })

    it('flags needsConsolidation in CONTRATTI phase when member has not consolidated', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-3', leagueId: 'league-3', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-3', type: 'MERCATO_RICORRENTE', currentPhase: 'CONTRATTI',
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(0)
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null) // not consolidated

      const result = await leagueService.getDashboardSummary('user-3')

      const summaries = (result.data as { summaries: Record<string, { needsConsolidation: boolean }> }).summaries
      expect(summaries['league-3']?.needsConsolidation).toBe(true)
    })

    it('returns null phase and zero signals when there is no active session', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-4', leagueId: 'league-4', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await leagueService.getDashboardSummary('user-4')

      const summaries = (result.data as { summaries: Record<string, { phase: unknown; tradeOffersReceived: number; needsConsolidation: boolean }> }).summaries
      expect(summaries['league-4']?.phase).toBeNull()
      expect(summaries['league-4']?.tradeOffersReceived).toBe(0)
      expect(summaries['league-4']?.needsConsolidation).toBe(false)
      expect(mockPrisma.tradeOffer.count).not.toHaveBeenCalled()
    })

    // ---- "Tocca a te" (turn detection) ----

    it('flags isYourTurn in PRIMO_MERCATO when it is the member turn and no active auction', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-5', leagueId: 'league-5', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-5',
        type: 'PRIMO_MERCATO',
        currentPhase: 'ASTA_LIBERA',
        turnOrder: ['mem-other', 'mem-5', 'mem-third'],
        currentTurnIndex: 1,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiState: null,
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(0)
      mockPrisma.auction.count.mockResolvedValue(0) // no active auction

      const result = await leagueService.getDashboardSummary('user-5')

      const summaries = (result.data as { summaries: Record<string, { isYourTurn: boolean; turnTarget: unknown }> }).summaries
      expect(summaries['league-5']?.isYourTurn).toBe(true)
      expect(summaries['league-5']?.turnTarget).toEqual({ kind: 'auction', sessionId: 'sess-5' })
    })

    it('does not flag isYourTurn in PRIMO_MERCATO when it is another member turn', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-6', leagueId: 'league-6', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-6',
        type: 'PRIMO_MERCATO',
        currentPhase: 'ASTA_LIBERA',
        turnOrder: ['mem-other', 'mem-6'],
        currentTurnIndex: 0, // points to mem-other, not mem-6
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiState: null,
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(0)
      mockPrisma.auction.count.mockResolvedValue(0)

      const result = await leagueService.getDashboardSummary('user-6')

      const summaries = (result.data as { summaries: Record<string, { isYourTurn: boolean; turnTarget: unknown }> }).summaries
      expect(summaries['league-6']?.isYourTurn).toBe(false)
      expect(summaries['league-6']?.turnTarget).toBeNull()
    })

    it('does not flag isYourTurn in PRIMO_MERCATO when an auction is already ACTIVE', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-7', leagueId: 'league-7', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-7',
        type: 'PRIMO_MERCATO',
        currentPhase: 'ASTA_LIBERA',
        turnOrder: ['mem-7'],
        currentTurnIndex: 0, // would be mem-7's turn...
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiState: null,
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(0)
      mockPrisma.auction.count.mockResolvedValue(1) // ...but bidding is underway

      const result = await leagueService.getDashboardSummary('user-7')

      const summaries = (result.data as { summaries: Record<string, { isYourTurn: boolean }> }).summaries
      expect(summaries['league-7']?.isYourTurn).toBe(false)
    })

    it('flags isYourTurn in ASTA_SVINCOLATI when state is READY_CHECK and it is the member turn', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-8', leagueId: 'league-8', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-8',
        type: 'MERCATO_RICORRENTE',
        currentPhase: 'ASTA_SVINCOLATI',
        turnOrder: null,
        currentTurnIndex: null,
        svincolatiTurnOrder: ['mem-other', 'mem-8'],
        svincolatiCurrentTurnIndex: 1,
        svincolatiState: 'READY_CHECK',
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(0)

      const result = await leagueService.getDashboardSummary('user-8')

      const summaries = (result.data as { summaries: Record<string, { isYourTurn: boolean; turnTarget: unknown }> }).summaries
      expect(summaries['league-8']?.isYourTurn).toBe(true)
      expect(summaries['league-8']?.turnTarget).toEqual({ kind: 'svincolati', sessionId: 'sess-8' })
      // svincolati does not need the active-auction query
      expect(mockPrisma.auction.count).not.toHaveBeenCalled()
    })

    it('does not flag isYourTurn in RUBATA (not reconstructible as a single turn-holder)', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'mem-9', leagueId: 'league-9', role: 'MANAGER' },
      ])
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'sess-9',
        type: 'MERCATO_RICORRENTE',
        currentPhase: 'RUBATA',
        turnOrder: null,
        currentTurnIndex: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiState: null,
      })
      mockPrisma.tradeOffer.count.mockResolvedValue(0)

      const result = await leagueService.getDashboardSummary('user-9')

      const summaries = (result.data as { summaries: Record<string, { isYourTurn: boolean; turnTarget: unknown }> }).summaries
      expect(summaries['league-9']?.isYourTurn).toBe(false)
      expect(summaries['league-9']?.turnTarget).toBeNull()
    })
  })

  // ==================== updateLeagueImage / removeLeagueImage ====================

  describe('updateLeagueImage', () => {
    const validImage = 'data:image/png;base64,iVBORw0KGgo='

    it('updates the image when caller is admin and data is valid', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'mem-1', role: 'ADMIN' })
      mockPrisma.league.update.mockResolvedValue({ id: 'league-1', name: 'Lega', imageUrl: validImage })

      const result = await leagueService.updateLeagueImage('league-1', 'admin-1', validImage)

      expect(result.success).toBe(true)
      expect(mockPrisma.league.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'league-1' }, data: { imageUrl: validImage } })
      )
    })

    it('rejects when caller is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await leagueService.updateLeagueImage('league-1', 'not-admin', validImage)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
      expect(mockPrisma.league.update).not.toHaveBeenCalled()
    })

    it('rejects an invalid image format', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'mem-1', role: 'ADMIN' })

      const result = await leagueService.updateLeagueImage('league-1', 'admin-1', 'not-an-image')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Formato immagine non valido')
      expect(mockPrisma.league.update).not.toHaveBeenCalled()
    })

    it('rejects an image over the size limit', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'mem-1', role: 'ADMIN' })
      const huge = 'data:image/png;base64,' + 'A'.repeat(700001)

      const result = await leagueService.updateLeagueImage('league-1', 'admin-1', huge)

      expect(result.success).toBe(false)
      expect(result.message).toContain('troppo grande')
      expect(mockPrisma.league.update).not.toHaveBeenCalled()
    })
  })

  describe('removeLeagueImage', () => {
    it('removes the image when caller is admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'mem-1', role: 'ADMIN' })
      mockPrisma.league.update.mockResolvedValue({ id: 'league-1' })

      const result = await leagueService.removeLeagueImage('league-1', 'admin-1')

      expect(result.success).toBe(true)
      expect(mockPrisma.league.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'league-1' }, data: { imageUrl: null } })
      )
    })

    it('rejects when caller is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await leagueService.removeLeagueImage('league-1', 'not-admin')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
      expect(mockPrisma.league.update).not.toHaveBeenCalled()
    })
  })
})

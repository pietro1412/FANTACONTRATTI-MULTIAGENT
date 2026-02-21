/**
 * Trade Prisma Repository Tests
 *
 * Unit tests for TradePrismaRepository with mocked Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TradePrismaRepository } from '../../infrastructure/repositories/trade.prisma-repository'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tradeOffer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueMember: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
    },
    playerRoster: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    playerContract: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'

describe('TradePrismaRepository', () => {
  let repository: TradePrismaRepository

  const mockTradeOffer = {
    id: 'trade-1',
    marketSessionId: 'session-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    offeredPlayers: ['roster-1', 'roster-2'],
    offeredBudget: 10,
    requestedPlayers: ['roster-3'],
    requestedBudget: 5,
    involvedPlayers: ['roster-1', 'roster-2', 'roster-3'],
    status: 'PENDING',
    message: 'Test offer',
    createdAt: new Date('2024-01-01'),
    expiresAt: new Date('2024-01-02'),
    respondedAt: null,
    parentOfferId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new TradePrismaRepository()
  })

  describe('findById', () => {
    it('should return trade offer when found', async () => {
      vi.mocked(prisma.tradeOffer.findUnique).mockResolvedValue(mockTradeOffer as never)

      const result = await repository.findById('trade-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('trade-1')
      expect(result?.status).toBe('PENDING')
      expect(result?.senderPlayers).toEqual(['roster-1', 'roster-2'])
      expect(result?.receiverPlayers).toEqual(['roster-3'])
      expect(prisma.tradeOffer.findUnique).toHaveBeenCalledWith({
        where: { id: 'trade-1' },
      })
    })

    it('should return null when trade not found', async () => {
      vi.mocked(prisma.tradeOffer.findUnique).mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findByLeague', () => {
    it('should return all trades for a league', async () => {
      vi.mocked(prisma.tradeOffer.findMany).mockResolvedValue([mockTradeOffer] as never)

      const result = await repository.findByLeague('league-1')

      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('trade-1')
      expect(prisma.tradeOffer.findMany).toHaveBeenCalledWith({
        where: {
          marketSession: {
            leagueId: 'league-1',
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('findPendingForMember', () => {
    it('should return pending trades for a member as receiver', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        id: 'member-1',
        userId: 'user-2',
        leagueId: 'league-1',
        role: 'MANAGER',
        teamName: 'Team A',
        status: 'ACTIVE',
        joinType: 'REQUEST',
        currentBudget: 100,
        rubataOrder: null,
        firstMarketOrder: null,
        joinedAt: new Date(),
      } as never)
      vi.mocked(prisma.tradeOffer.findMany).mockResolvedValue([mockTradeOffer] as never)

      const result = await repository.findPendingForMember('member-1')

      expect(result).toHaveLength(1)
      expect(result[0]!.receiverId).toBe('user-2')
    })

    it('should return empty array when member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.findPendingForMember('non-existent')

      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a new trade offer', async () => {
      vi.mocked(prisma.leagueMember.findUnique)
        .mockResolvedValueOnce({
          id: 'member-1',
          userId: 'user-1',
          leagueId: 'league-1',
          role: 'MANAGER',
          teamName: 'Team A',
          status: 'ACTIVE',
          joinType: 'REQUEST',
          currentBudget: 100,
          rubataOrder: null,
          firstMarketOrder: null,
          joinedAt: new Date(),
        } as never)
        .mockResolvedValueOnce({
          id: 'member-2',
          userId: 'user-2',
          leagueId: 'league-1',
          role: 'MANAGER',
          teamName: 'Team B',
          status: 'ACTIVE',
          joinType: 'REQUEST',
          currentBudget: 100,
          rubataOrder: null,
          firstMarketOrder: null,
          joinedAt: new Date(),
        } as never)
      vi.mocked(prisma.marketSession.findFirst).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        status: 'ACTIVE',
        currentPhase: 'OFFERTE_PRE_RINNOVO',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      } as never)
      vi.mocked(prisma.tradeOffer.create).mockResolvedValue(mockTradeOffer as never)

      const result = await repository.create({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1', 'roster-2'],
        receiverPlayers: ['roster-3'],
        senderBudget: 10,
        receiverBudget: 5,
        message: 'Test offer',
        expiresAt: new Date('2024-01-02'),
      })

      expect(result.id).toBe('trade-1')
      expect(prisma.tradeOffer.create).toHaveBeenCalled()
    })

    it('should throw error if sender member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'member-2',
          userId: 'user-2',
          leagueId: 'league-1',
          role: 'MANAGER',
          teamName: 'Team B',
          status: 'ACTIVE',
          joinType: 'REQUEST',
          currentBudget: 100,
          rubataOrder: null,
          firstMarketOrder: null,
          joinedAt: new Date(),
        } as never)

      await expect(
        repository.create({
          leagueId: 'league-1',
          senderId: 'non-existent',
          receiverId: 'member-2',
          senderPlayers: [],
          receiverPlayers: [],
          senderBudget: 0,
          receiverBudget: 0,
        })
      ).rejects.toThrow('Invalid sender or receiver member ID')
    })
  })

  describe('updateStatus', () => {
    it('should update trade status', async () => {
      vi.mocked(prisma.tradeOffer.update).mockResolvedValue({
        ...mockTradeOffer,
        status: 'ACCEPTED',
        respondedAt: new Date(),
      } as never)

      await repository.updateStatus('trade-1', 'ACCEPTED')

      expect(prisma.tradeOffer.update).toHaveBeenCalledWith({
        where: { id: 'trade-1' },
        data: expect.objectContaining({
          status: 'ACCEPTED',
        }),
      })
    })
  })

  describe('getRosterInfo', () => {
    it('should return roster info for given IDs', async () => {
      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([
        {
          id: 'roster-1',
          leagueMemberId: 'member-1',
          playerId: 'player-1',
          status: 'ACTIVE',
          acquisitionPrice: 10,
          acquisitionType: 'FIRST_MARKET',
          acquiredAt: new Date(),
          releasedAt: null,
        },
      ] as never)

      const result = await repository.getRosterInfo(['roster-1'])

      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('roster-1')
      expect(result[0]!.status).toBe('ACTIVE')
    })
  })

  describe('getMemberBudget', () => {
    it('should return member budget info', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        id: 'member-1',
        currentBudget: 150,
        userId: 'user-1',
        leagueId: 'league-1',
        role: 'MANAGER',
        teamName: 'Team A',
        status: 'ACTIVE',
        joinType: 'REQUEST',
        rubataOrder: null,
        firstMarketOrder: null,
        joinedAt: new Date(),
      } as never)

      const result = await repository.getMemberBudget('member-1')

      expect(result).not.toBeNull()
      expect(result?.memberId).toBe('member-1')
      expect(result?.currentBudget).toBe(150)
    })

    it('should return null when member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.getMemberBudget('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('isTradeWindowOpen', () => {
    it('should return true when trade window is open', async () => {
      vi.mocked(prisma.marketSession.findFirst).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        status: 'ACTIVE',
        currentPhase: 'OFFERTE_PRE_RINNOVO',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      } as never)

      const result = await repository.isTradeWindowOpen('league-1')

      expect(result).toBe(true)
    })

    it('should return false when no active session with trade phase', async () => {
      vi.mocked(prisma.marketSession.findFirst).mockResolvedValue(null)

      const result = await repository.isTradeWindowOpen('league-1')

      expect(result).toBe(false)
    })
  })

  describe('getActiveMarketSessionId', () => {
    it('should return session ID when active session exists', async () => {
      vi.mocked(prisma.marketSession.findFirst).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        status: 'ACTIVE',
        currentPhase: 'OFFERTE_PRE_RINNOVO',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof prisma.marketSession.findFirst>>)

      const result = await repository.getActiveMarketSessionId('league-1')

      expect(result).toBe('session-1')
    })

    it('should return null when no active session', async () => {
      vi.mocked(prisma.marketSession.findFirst).mockResolvedValue(null)

      const result = await repository.getActiveMarketSessionId('league-1')

      expect(result).toBeNull()
    })
  })
})

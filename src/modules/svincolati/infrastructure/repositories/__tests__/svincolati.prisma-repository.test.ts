/**
 * SvincolatiPrismaRepository Tests
 *
 * Tests for the Prisma-based implementation of the Svincolati repository.
 * Uses mocked Prisma client to verify atomic operations and correct behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SvincolatiPrismaRepository } from '../svincolati.prisma-repository'

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    leagueMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    serieAPlayer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    playerRoster: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Import the mocked prisma
import { prisma } from '@/lib/prisma'

describe('SvincolatiPrismaRepository', () => {
  let repository: SvincolatiPrismaRepository

  beforeEach(() => {
    repository = new SvincolatiPrismaRepository()
    vi.clearAllMocks()
  })

  describe('getSession', () => {
    it('should return null if session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      const result = await repository.getSession('non-existent')

      expect(result).toBeNull()
    })

    it('should return null if session is not in SVINCOLATI phase', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        currentPhase: 'RUBATA',
        svincolatiState: 'NOMINATION',
        svincolatiPendingNominatorId: null,
        svincolatiCurrentTurnIndex: 0,
        svincolatiTimerSeconds: 30,
      } as any)

      const result = await repository.getSession('session-1')

      expect(result).toBeNull()
    })

    it('should return mapped SvincolatiSession when found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        currentPhase: 'SVINCOLATI',
        svincolatiState: 'NOMINATION',
        svincolatiPendingNominatorId: 'member-1',
        svincolatiCurrentTurnIndex: 2,
        svincolatiTimerSeconds: 30,
      } as any)

      const result = await repository.getSession('session-1')

      expect(result).not.toBeNull()
      expect(result?.marketSessionId).toBe('session-1')
      expect(result?.status).toBe('NOMINATION')
      expect(result?.currentNominatorId).toBe('member-1')
      expect(result?.currentRound).toBe(2)
      expect(result?.timerSeconds).toBe(30)
    })
  })

  describe('getTurnOrder', () => {
    it('should return empty array if no turn order', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        svincolatiTurnOrder: null,
      } as any)

      const result = await repository.getTurnOrder('session-1')

      expect(result).toEqual([])
    })

    it('should return mapped turn order entries', async () => {
      const mockTurnOrder = [
        { memberId: 'member-1', hasPassed: false, hasFinished: false },
        { memberId: 'member-2', hasPassed: true, hasFinished: false },
        { memberId: 'member-3', hasPassed: false, hasFinished: true },
      ]

      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        svincolatiTurnOrder: mockTurnOrder,
      } as any)

      const result = await repository.getTurnOrder('session-1')

      expect(result).toHaveLength(3)
      expect(result[0]?.memberId).toBe('member-1')
      expect(result[0]?.orderIndex).toBe(0)
      expect(result[0]?.hasPassed).toBe(false)
      expect(result[1]?.memberId).toBe('member-2')
      expect(result[1]?.hasPassed).toBe(true)
      expect(result[2]?.memberId).toBe('member-3')
      expect(result[2]?.hasFinished).toBe(true)
    })
  })

  describe('setTurnOrder', () => {
    it('should set turn order and reset current index', async () => {
      vi.mocked(prisma.marketSession.update).mockResolvedValue({} as any)

      await repository.setTurnOrder('session-1', ['member-1', 'member-2', 'member-3'])

      expect(prisma.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          svincolatiTurnOrder: [
            { memberId: 'member-1', hasPassed: false, hasFinished: false },
            { memberId: 'member-2', hasPassed: false, hasFinished: false },
            { memberId: 'member-3', hasPassed: false, hasFinished: false },
          ],
          svincolatiCurrentTurnIndex: 0,
        },
      })
    })
  })

  describe('markPassed', () => {
    it('should mark member as passed in turn order using transaction', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
              { memberId: 'member-2', hasPassed: false, hasFinished: false },
            ],
            svincolatiPassedMembers: [],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.markPassed('session-1', 'member-1')

      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          svincolatiTurnOrder: [
            { memberId: 'member-1', hasPassed: true, hasFinished: false },
            { memberId: 'member-2', hasPassed: false, hasFinished: false },
          ],
          svincolatiPassedMembers: ['member-1'],
        },
      })
    })
  })

  describe('markFinished', () => {
    it('should mark member as finished and passed', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
            ],
            svincolatiFinishedMembers: [],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.markFinished('session-1', 'member-1')

      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          svincolatiTurnOrder: [
            { memberId: 'member-1', hasPassed: true, hasFinished: true },
          ],
          svincolatiFinishedMembers: ['member-1'],
        },
      })
    })
  })

  describe('getCurrentTurnMemberId', () => {
    it('should return null if no turn order', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: 0,
      } as any)

      const result = await repository.getCurrentTurnMemberId('session-1')

      expect(result).toBeNull()
    })

    it('should return first active member from current index', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        svincolatiTurnOrder: [
          { memberId: 'member-1', hasPassed: true, hasFinished: false },
          { memberId: 'member-2', hasPassed: false, hasFinished: false },
        ],
        svincolatiCurrentTurnIndex: 0,
      } as any)

      const result = await repository.getCurrentTurnMemberId('session-1')

      expect(result).toBe('member-2')
    })

    it('should wrap around to find active member', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        svincolatiTurnOrder: [
          { memberId: 'member-1', hasPassed: false, hasFinished: false },
          { memberId: 'member-2', hasPassed: true, hasFinished: false },
          { memberId: 'member-3', hasPassed: true, hasFinished: false },
        ],
        svincolatiCurrentTurnIndex: 1,
      } as any)

      const result = await repository.getCurrentTurnMemberId('session-1')

      expect(result).toBe('member-1')
    })

    it('should return null if all members passed or finished', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        svincolatiTurnOrder: [
          { memberId: 'member-1', hasPassed: true, hasFinished: false },
          { memberId: 'member-2', hasPassed: false, hasFinished: true },
        ],
        svincolatiCurrentTurnIndex: 0,
      } as any)

      const result = await repository.getCurrentTurnMemberId('session-1')

      expect(result).toBeNull()
    })
  })

  describe('nominatePlayerAtomic', () => {
    it('should return SESSION_NOT_ACTIVE when session not found', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.nominatePlayerAtomic({
        sessionId: 'session-1',
        playerId: 'player-1',
        nominatorId: 'member-1',
        round: 1,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('SESSION_NOT_ACTIVE')
    })

    it('should return WRONG_PHASE when auction already active', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            leagueId: 'league-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
            svincolatiTimerSeconds: 30,
            auctions: [{ id: 'auction-1', status: 'ACTIVE' }],
          }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.nominatePlayerAtomic({
        sessionId: 'session-1',
        playerId: 'player-1',
        nominatorId: 'member-1',
        round: 1,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('WRONG_PHASE')
    })

    it('should return NOT_YOUR_TURN when nominator is not current', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            leagueId: 'league-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
            svincolatiTimerSeconds: 30,
            auctions: [],
          }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.nominatePlayerAtomic({
        sessionId: 'session-1',
        playerId: 'player-1',
        nominatorId: 'member-2', // Not the current turn holder
        round: 1,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('NOT_YOUR_TURN')
    })

    it('should return PLAYER_ALREADY_OWNED when player in roster', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            leagueId: 'league-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
            svincolatiTimerSeconds: 30,
            auctions: [],
          }),
          update: vi.fn(),
        },
        playerRoster: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'roster-1',
            playerId: 'player-1',
            status: 'ACTIVE',
          }),
        },
        serieAPlayer: {
          findUnique: vi.fn(),
        },
        leagueMember: {
          findUnique: vi.fn(),
        },
        auction: {
          create: vi.fn(),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.nominatePlayerAtomic({
        sessionId: 'session-1',
        playerId: 'player-1',
        nominatorId: 'member-1',
        round: 1,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('PLAYER_ALREADY_OWNED')
    })

    it('should return INVALID_PLAYER when player not found or inactive', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            leagueId: 'league-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
            svincolatiTimerSeconds: 30,
            auctions: [],
          }),
          update: vi.fn(),
        },
        playerRoster: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        serieAPlayer: {
          findUnique: vi.fn().mockResolvedValue({ id: 'player-1', isActive: false }),
        },
        leagueMember: {
          findUnique: vi.fn(),
        },
        auction: {
          create: vi.fn(),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.nominatePlayerAtomic({
        sessionId: 'session-1',
        playerId: 'player-1',
        nominatorId: 'member-1',
        round: 1,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_PLAYER')
    })

    it('should return INSUFFICIENT_BUDGET when nominator budget is 0', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            leagueId: 'league-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
            svincolatiTimerSeconds: 30,
            auctions: [],
          }),
          update: vi.fn(),
        },
        playerRoster: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        serieAPlayer: {
          findUnique: vi.fn().mockResolvedValue({ id: 'player-1', isActive: true }),
        },
        leagueMember: {
          findUnique: vi.fn().mockResolvedValue({ id: 'member-1', currentBudget: 0 }),
        },
        auction: {
          create: vi.fn(),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.nominatePlayerAtomic({
        sessionId: 'session-1',
        playerId: 'player-1',
        nominatorId: 'member-1',
        round: 1,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INSUFFICIENT_BUDGET')
    })

    it('should successfully nominate player and create auction', async () => {
      const mockAuction = {
        id: 'auction-new',
        playerId: 'player-1',
        status: 'ACTIVE',
        currentPrice: 1,
      }

      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            leagueId: 'league-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
            svincolatiTimerSeconds: 30,
            auctions: [],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        playerRoster: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        serieAPlayer: {
          findUnique: vi.fn().mockResolvedValue({ id: 'player-1', isActive: true }),
        },
        leagueMember: {
          findUnique: vi.fn().mockResolvedValue({ id: 'member-1', currentBudget: 100 }),
        },
        auction: {
          create: vi.fn().mockResolvedValue(mockAuction),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.nominatePlayerAtomic({
        sessionId: 'session-1',
        playerId: 'player-1',
        nominatorId: 'member-1',
        round: 1,
      })

      expect(result.success).toBe(true)
      expect(result.nomination).toBeDefined()
      expect(result.nomination?.playerId).toBe('player-1')
      expect(result.nomination?.nominatorId).toBe('member-1')
      expect(result.nomination?.status).toBe('IN_AUCTION')
      expect(result.nomination?.auctionId).toBe('auction-new')

      // Verify auction was created
      expect(mockTx.auction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leagueId: 'league-1',
          marketSessionId: 'session-1',
          playerId: 'player-1',
          type: 'SVINCOLATI',
          basePrice: 1,
          currentPrice: 1,
          status: 'ACTIVE',
          nominatorId: 'member-1',
        }),
      })

      // Verify session was updated
      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          svincolatiState: 'AUCTION',
          svincolatiPendingPlayerId: 'player-1',
          svincolatiPendingNominatorId: 'member-1',
        }),
      })
    })
  })

  describe('getAvailablePlayers', () => {
    it('should return empty array if session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      const result = await repository.getAvailablePlayers('session-1')

      expect(result).toEqual([])
    })

    it('should exclude already owned players', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
      } as any)

      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([
        { playerId: 'owned-player-1' },
        { playerId: 'owned-player-2' },
      ] as any)

      vi.mocked(prisma.serieAPlayer.findMany).mockResolvedValue([
        { id: 'free-player-1', name: 'Player 1', team: 'Team A', position: 'D', quotation: 10, isActive: true },
        { id: 'free-player-2', name: 'Player 2', team: 'Team B', position: 'C', quotation: 15, isActive: true },
      ] as any)

      const result = await repository.getAvailablePlayers('session-1')

      expect(result).toHaveLength(2)
      expect(prisma.serieAPlayer.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
          id: { notIn: ['owned-player-1', 'owned-player-2'] },
        }),
        orderBy: expect.any(Array),
      })
    })

    it('should apply filters when provided', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
      } as any)

      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([])

      vi.mocked(prisma.serieAPlayer.findMany).mockResolvedValue([])

      await repository.getAvailablePlayers('session-1', {
        position: 'D',
        team: 'Team A',
        minQuotation: 5,
        maxQuotation: 20,
      })

      expect(prisma.serieAPlayer.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          position: 'D',
          team: 'Team A',
          quotation: { gte: 5, lte: 20 },
        }),
        orderBy: expect.any(Array),
      })
    })
  })

  describe('markReady', () => {
    it('should add member to ready list', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            svincolatiReadyMembers: ['member-1'],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.markReady('session-1', 'member-2')

      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { svincolatiReadyMembers: ['member-1', 'member-2'] },
      })
    })

    it('should not duplicate member in ready list', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            svincolatiReadyMembers: ['member-1', 'member-2'],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.markReady('session-1', 'member-2')

      expect(mockTx.marketSession.update).not.toHaveBeenCalled()
    })
  })

  describe('areAllReady', () => {
    it('should return false if session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      const result = await repository.areAllReady('session-1')

      expect(result).toBe(false)
    })

    it('should return true when all members are ready', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        svincolatiReadyMembers: ['member-1', 'member-2', 'member-3'],
      } as any)

      vi.mocked(prisma.leagueMember.count).mockResolvedValue(3)

      const result = await repository.areAllReady('session-1')

      expect(result).toBe(true)
    })

    it('should return false when not all members are ready', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        svincolatiReadyMembers: ['member-1', 'member-2'],
      } as any)

      vi.mocked(prisma.leagueMember.count).mockResolvedValue(4)

      const result = await repository.areAllReady('session-1')

      expect(result).toBe(false)
    })
  })

  describe('getMemberBudget', () => {
    it('should return member budget', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        id: 'member-1',
        currentBudget: 250,
      } as any)

      const result = await repository.getMemberBudget('member-1')

      expect(result).toBe(250)
    })

    it('should return 0 if member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.getMemberBudget('non-existent')

      expect(result).toBe(0)
    })
  })

  describe('advanceToNextMember', () => {
    it('should advance to next active member using transaction', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: false, hasFinished: false },
              { memberId: 'member-2', hasPassed: false, hasFinished: false },
              { memberId: 'member-3', hasPassed: true, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.advanceToNextMember('session-1')

      expect(result).not.toBeNull()
      expect(result?.memberId).toBe('member-2')
      expect(result?.orderIndex).toBe(1)

      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { svincolatiCurrentTurnIndex: 1 },
      })
    })

    it('should return null if all members passed', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            svincolatiTurnOrder: [
              { memberId: 'member-1', hasPassed: true, hasFinished: false },
              { memberId: 'member-2', hasPassed: true, hasFinished: false },
            ],
            svincolatiCurrentTurnIndex: 0,
          }),
          update: vi.fn(),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.advanceToNextMember('session-1')

      expect(result).toBeNull()
      expect(mockTx.marketSession.update).not.toHaveBeenCalled()
    })
  })

  describe('isPlayerOwned', () => {
    it('should return true when player is in active roster', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
      } as any)

      vi.mocked(prisma.playerRoster.findFirst).mockResolvedValue({
        id: 'roster-1',
        playerId: 'player-1',
        status: 'ACTIVE',
      } as any)

      const result = await repository.isPlayerOwned('session-1', 'player-1')

      expect(result).toBe(true)
    })

    it('should return false when player is not in any roster', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
      } as any)

      vi.mocked(prisma.playerRoster.findFirst).mockResolvedValue(null)

      const result = await repository.isPlayerOwned('session-1', 'player-1')

      expect(result).toBe(false)
    })
  })
})
